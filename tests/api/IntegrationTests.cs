using System.Buffers.Binary;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using OmElMaouna.Api.Features.Content;
using OmElMaouna.Api.Features.Identity;
using OmElMaouna.Api.Infrastructure.Persistence;
using Npgsql;

[assembly: CollectionBehavior(DisableTestParallelization = true)]
namespace OmElMaouna.Api.Tests;

public sealed class DatabaseFixture : IAsyncLifetime
{
    public string MediaDirectory { get; } = Path.Combine(Path.GetTempPath(), "OmElMaounaTests", Guid.NewGuid().ToString("N"));
    public WebApplicationFactory<Program> Factory { get; private set; } = null!;
    public const string AdminEmail = "test-admin@example.invalid";
    public const string TestPassword = "OnlyForIsolatedTests-4831";
    public async Task InitializeAsync()
    {
        var connection = Environment.GetEnvironmentVariable("OMELMAOUNA_TEST_CONNECTION");
        if (string.IsNullOrWhiteSpace(connection) || new NpgsqlConnectionStringBuilder(connection).Database != "omelmaouna_test")
            throw new InvalidOperationException("Run scripts/test.ps1. Integration tests require the dedicated omelmaouna_test database.");
        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(new Dictionary<string, string?>
            { ["ConnectionStrings:Database"] = connection, ["Logging:LogLevel:Default"] = "None", ["Mail:DisableWorker"] = "true", ["RateLimits:AuthenticationPerMinute"] = "200", ["RateLimits:SubmissionsPerMinute"] = "100", ["Smtp:Host"] = "", ["Media:Root"] = MediaDirectory }));
        });
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
        // This guarded database contains only disposable integration-test fixtures.
        await db.Database.ExecuteSqlRawAsync("TRUNCATE TABLE \"AuditLogs\", \"Programs\", \"AspNetUsers\", \"MediaAssets\", \"SiteDocuments\", \"MailItems\" CASCADE");
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var result = await users.CreateAsync(new AppUser { UserName = AdminEmail, Email = AdminEmail, EmailConfirmed = true, IsAdministrator = true, DisplayName = "Test admin" }, TestPassword);
        Assert.True(result.Succeeded);
        result = await users.CreateAsync(new AppUser { UserName = "member@example.invalid", Email = "member@example.invalid", EmailConfirmed = true, DisplayName = "Member" }, TestPassword);
        Assert.True(result.Succeeded);
    }
    public Task DisposeAsync() { Factory.Dispose(); return Task.CompletedTask; }
    public HttpClient Client() => Factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false, HandleCookies = true });
    public async Task<HttpClient> Admin()
    {
        var client = Client();
        var response = await Send(client, "/auth/login", new { email = AdminEmail, password = TestPassword });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        if (json.TryGetProperty("requiresMfaSetup", out var setup) && setup.GetBoolean())
        {
            response = await Send(client, "/auth/mfa/start-setup"); response.EnsureSuccessStatusCode();
            var details = await response.Content.ReadFromJsonAsync<JsonElement>();
            response = await Send(client, "/auth/mfa/confirm-setup", new { code = Totp(details.GetProperty("sharedKey").GetString()!) });
        }
        else
        {
            using var scope = Factory.Services.CreateScope();
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            var user = (await users.FindByEmailAsync(AdminEmail))!;
            var key = (await users.GetAuthenticatorKeyAsync(user))!;
            response = await Send(client, "/auth/mfa/verify", new { code = Totp(key) });
        }
        response.EnsureSuccessStatusCode();
        return client;
    }
    public static async Task<HttpResponseMessage> Send(HttpClient client, string path, object? body = null, string method = "POST", long? version = null)
    {
        var csrf = await client.GetFromJsonAsync<JsonElement>("/api/v1/auth/csrf");
        using var request = new HttpRequestMessage(new HttpMethod(method), "/api/v1" + path);
        request.Headers.Add("X-CSRF-TOKEN", csrf.GetProperty("token").GetString());
        if (version is not null) request.Headers.TryAddWithoutValidation("If-Match", $"\"{version}\"");
        if (body is not null) request.Content = JsonContent.Create(body);
        return await client.SendAsync(request);
    }
    public static string Totp(string base32)
    {
        var bytes = new List<byte>(); var value = 0; var bits = 0;
        foreach (var c in base32.ToUpperInvariant()) { var n = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".IndexOf(c); if (n < 0) continue; value = (value << 5) | n; bits += 5; if (bits >= 8) { bits -= 8; bytes.Add((byte)(value >> bits)); } }
        Span<byte> timestamp = stackalloc byte[8]; BinaryPrimitives.WriteInt64BigEndian(timestamp, DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30);
        var hash = HMACSHA1.HashData(bytes.ToArray(), timestamp); var offset = hash[^1] & 15;
        var number = BinaryPrimitives.ReadInt32BigEndian(hash.AsSpan(offset, 4)) & 0x7fffffff;
        return (number % 1000000).ToString("D6");
    }
}

public class IntegrationTests(DatabaseFixture fixture) : IClassFixture<DatabaseFixture>
{
    [Fact]
    public async Task Archive_is_visible_to_admin_and_restores_as_private_draft()
    {
        using var admin = await fixture.Admin(); using var visitor = fixture.Client();
        var slug = "archive-" + Guid.NewGuid().ToString("N");
        var created = await DatabaseFixture.Send(admin, "/admin/programs", ProgramRulesTests.Valid(slug));
        var p = await created.Content.ReadFromJsonAsync<JsonElement>(); var id = p.GetProperty("id").GetGuid();
        var archived = await DatabaseFixture.Send(admin, $"/admin/programs/{id}/archive", version: p.GetProperty("version").GetInt64());
        archived.EnsureSuccessStatusCode(); p = await archived.Content.ReadFromJsonAsync<JsonElement>();
        var list = await admin.GetFromJsonAsync<JsonElement>("/api/v1/admin/programs");
        Assert.Contains(list.EnumerateArray(), r => r.GetProperty("id").GetGuid() == id && r.GetProperty("status").GetString() == "Archived");
        Assert.Equal(HttpStatusCode.Conflict, (await DatabaseFixture.Send(admin, $"/admin/programs/{id}/publish", version: p.GetProperty("version").GetInt64())).StatusCode);
        var restored = await DatabaseFixture.Send(admin, $"/admin/programs/{id}/restore", version: p.GetProperty("version").GetInt64());
        restored.EnsureSuccessStatusCode(); p = await restored.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Draft", p.GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await visitor.GetAsync($"/api/v1/programs/by-slug/{slug}?locale=ar")).StatusCode);
    }

    [Fact]
    public async Task Profiles_are_private_validated_and_cannot_change_privileges_or_email()
    {
        using var visitor = fixture.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync("/api/v1/me/profile")).StatusCode);
        using var member = fixture.Client();
        (await DatabaseFixture.Send(member, "/auth/login", new { email = "member@example.invalid", password = DatabaseFixture.TestPassword })).EnsureSuccessStatusCode();
        var updated = await DatabaseFixture.Send(member, "/me/profile", new { displayName = "Member Profile", phoneNumber = "+201001234567", dateOfBirth = "2000-03-15", gender = "Male" }, "PUT");
        updated.EnsureSuccessStatusCode(); var profile = await updated.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Member Profile", profile.GetProperty("displayName").GetString());
        Assert.False(profile.GetProperty("isAdministrator").GetBoolean());
        using var admin = await fixture.Admin();
        var other = await admin.GetFromJsonAsync<JsonElement>("/api/v1/me/profile");
        Assert.NotEqual("Member Profile", other.GetProperty("displayName").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await DatabaseFixture.Send(member, "/me/profile", new { displayName = "Member", isAdministrator = true }, "PUT")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await DatabaseFixture.Send(member, "/me/profile", new { displayName = "Member", email = "changed@example.invalid" }, "PUT")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await DatabaseFixture.Send(member, "/me/profile", new { displayName = "Member", dateOfBirth = "2999-01-01", gender = "Invalid" }, "PUT")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await member.PutAsJsonAsync("/api/v1/me/profile", new { displayName = "No CSRF" })).StatusCode);
    }

    [Fact]
    public async Task Avatar_is_decoded_resized_private_and_removable()
    {
        using var admin = await fixture.Admin(); using var visitor = fixture.Client();
        Assert.Equal(HttpStatusCode.BadRequest, (await DatabaseFixture.Send(admin, "/me/avatar", new { base64 = Convert.ToBase64String("<svg/>"u8.ToArray()) }, "PUT")).StatusCode);
        using var bitmap = new SkiaSharp.SKBitmap(8, 8);
        bitmap.Erase(SkiaSharp.SKColors.Blue);
        using var image = SkiaSharp.SKImage.FromBitmap(bitmap);
        using var encoded = image.Encode(SkiaSharp.SKEncodedImageFormat.Png, 100);
        (await DatabaseFixture.Send(admin, "/me/avatar", new { base64 = Convert.ToBase64String(encoded.ToArray()) }, "PUT")).EnsureSuccessStatusCode();
        var avatar = await admin.GetAsync("/api/v1/me/avatar"); avatar.EnsureSuccessStatusCode();
        Assert.Equal("image/jpeg", avatar.Content.Headers.ContentType!.MediaType);
        using var decoded = SkiaSharp.SKBitmap.Decode(await avatar.Content.ReadAsByteArrayAsync());
        Assert.Equal(256, decoded.Width); Assert.Equal(256, decoded.Height);
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync("/api/v1/me/avatar")).StatusCode);
        using var member = fixture.Client();
        (await DatabaseFixture.Send(member, "/auth/login", new { email = "member@example.invalid", password = DatabaseFixture.TestPassword })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await member.GetAsync("/api/v1/me/avatar")).StatusCode);
        (await DatabaseFixture.Send(admin, "/me/avatar", method: "DELETE")).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync("/api/v1/me/avatar")).StatusCode);
    }
    [Fact]
    public async Task Draft_is_private_publish_is_bilingual_and_stale_updates_are_rejected()
    {
        using var admin = await fixture.Admin(); using var visitor = fixture.Client();
        var slug = "test-" + Guid.NewGuid().ToString("N"); var input = ProgramRulesTests.Valid(slug);
        var created = await DatabaseFixture.Send(admin, "/admin/programs", input); Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var json = await created.Content.ReadFromJsonAsync<JsonElement>(); var id = json.GetProperty("id").GetGuid(); var version = json.GetProperty("version").GetInt64();
        Assert.Equal(HttpStatusCode.NotFound, (await visitor.GetAsync($"/api/v1/programs/by-slug/{slug}?locale=ar")).StatusCode);
        var published = await DatabaseFixture.Send(admin, $"/admin/programs/{id}/publish", version: version); Assert.Equal(HttpStatusCode.OK, published.StatusCode);
        foreach (var locale in new[] { "ar", "en" })
        {
            var view = await visitor.GetAsync($"/api/v1/programs/by-slug/{slug}?locale={locale}"); Assert.Equal(HttpStatusCode.OK, view.StatusCode);
            var text = await view.Content.ReadAsStringAsync(); Assert.DoesNotContain("securityStamp", text, StringComparison.OrdinalIgnoreCase);
            Assert.Contains(locale == "ar" ? "برنامج تعليمي" : "Learning program", (await view.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("title").GetString());
        }
        var stale = await DatabaseFixture.Send(admin, $"/admin/programs/{id}", input, "PUT", version); Assert.Equal(HttpStatusCode.PreconditionFailed, stale.StatusCode);
        var missing = await DatabaseFixture.Send(admin, $"/admin/programs/{id}/archive"); Assert.Equal((HttpStatusCode)428, missing.StatusCode);
        var current = await published.Content.ReadFromJsonAsync<JsonElement>(); version = current.GetProperty("version").GetInt64();
        var archived = await DatabaseFixture.Send(admin, $"/admin/programs/{id}/archive", version: version); Assert.Equal(HttpStatusCode.OK, archived.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await visitor.GetAsync($"/api/v1/programs/by-slug/{slug}?locale=en")).StatusCode);
    }

    [Fact]
    public async Task Anonymous_regular_accounts_and_missing_csrf_cannot_manage_content()
    {
        using var visitor = fixture.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync("/api/v1/admin/programs")).StatusCode);
        var login = await DatabaseFixture.Send(visitor, "/auth/login", new { email = "member@example.invalid", password = DatabaseFixture.TestPassword }); login.EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Forbidden, (await visitor.GetAsync("/api/v1/admin/programs")).StatusCode);
        var setup = await DatabaseFixture.Send(visitor, "/auth/mfa/start-setup"); Assert.Equal(HttpStatusCode.Forbidden, setup.StatusCode);
        var forbidden = await DatabaseFixture.Send(visitor, "/admin/programs", ProgramRulesTests.Valid()); Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        using var admin = await fixture.Admin();
        var noCsrf = await admin.PostAsJsonAsync("/api/v1/admin/programs", ProgramRulesTests.Valid()); Assert.Equal(HttpStatusCode.BadRequest, noCsrf.StatusCode);
    }

    [Fact]
    public async Task Database_refuses_second_administrator_and_unique_slugs_are_enforced()
    {
        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Users.Add(new AppUser { Id = Guid.NewGuid(), IsAdministrator = true, UserName = "second", NormalizedUserName = "SECOND", Email = "second@example.invalid", NormalizedEmail = "SECOND@EXAMPLE.INVALID" });
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        }
        using var admin = await fixture.Admin(); var input = ProgramRulesTests.Valid("unique-" + Guid.NewGuid().ToString("N"));
        Assert.Equal(HttpStatusCode.Created, (await DatabaseFixture.Send(admin, "/admin/programs", input)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await DatabaseFixture.Send(admin, "/admin/programs", input)).StatusCode);
    }

    [Fact]
    public async Task Incomplete_publication_and_client_privilege_fields_are_rejected()
    {
        using var admin = await fixture.Admin(); var input = ProgramRulesTests.Valid("incomplete-" + Guid.NewGuid().ToString("N")); input.Translations[1] = input.Translations[1] with { Body = "" };
        var created = await DatabaseFixture.Send(admin, "/admin/programs", input); created.EnsureSuccessStatusCode(); var p = await created.Content.ReadFromJsonAsync<JsonElement>();
        var publish = await DatabaseFixture.Send(admin, $"/admin/programs/{p.GetProperty("id").GetGuid()}/publish", version: p.GetProperty("version").GetInt64());
        Assert.Equal(HttpStatusCode.BadRequest, publish.StatusCode);
        var unexpected = await DatabaseFixture.Send(admin, "/admin/programs", new { input.Category, input.Translations, input.SortOrder, input.AcceptsSupportRequests, isAdministrator = true });
        Assert.Equal(HttpStatusCode.BadRequest, unexpected.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/v1/programs?page=-1")).StatusCode);
    }
}
