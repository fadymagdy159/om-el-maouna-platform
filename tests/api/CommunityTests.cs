using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OmElMaouna.Api.Features.Identity;
using OmElMaouna.Api.Infrastructure.Persistence;
using SkiaSharp;
namespace OmElMaouna.Api.Tests;

public sealed class CommunityTests(DatabaseFixture fixture) : IClassFixture<DatabaseFixture>
{
    [Fact]
    public async Task Site_content_is_admin_only_versioned_and_rejects_private_configuration_keys()
    {
        using var admin = await fixture.Admin(); using var visitor = fixture.Client(); using var member = await Member();
        var initial = await visitor.GetFromJsonAsync<JsonElement>("/api/v1/site-content"); var version = initial.GetProperty("version").GetInt64();
        var body = new { values = new Dictionary<string, string> { { "heroStartEn", "New homepage heading" }, { "heroVisual", "Reference" }, { "email", "foundation@example.invalid" } } };
        Assert.Equal(HttpStatusCode.Forbidden, (await DatabaseFixture.Send(member, "/admin/site-content", body, "PUT", version)).StatusCode);
        (await DatabaseFixture.Send(admin, "/admin/site-content", body, "PUT", version)).EnsureSuccessStatusCode();
        var current = await visitor.GetFromJsonAsync<JsonElement>("/api/v1/site-content"); Assert.Equal("New homepage heading", current.GetProperty("values").GetProperty("heroStartEn").GetString());
        Assert.Equal(HttpStatusCode.PreconditionFailed, (await DatabaseFixture.Send(admin, "/admin/site-content", body, "PUT", version)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await DatabaseFixture.Send(admin, "/admin/site-content", new { values = new Dictionary<string, string> { { "heroVisual", "Other" } } }, "PUT", current.GetProperty("version").GetInt64())).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await DatabaseFixture.Send(admin, "/admin/site-content", new { values = new Dictionary<string, string> { { "Smtp:Password", "not-allowed" } } }, "PUT", current.GetProperty("version").GetInt64())).StatusCode);
    }
    private async Task<HttpClient> Member(string email = "member@example.invalid") { var c = fixture.Client(); (await DatabaseFixture.Send(c, "/auth/login", new { email, password = DatabaseFixture.TestPassword })).EnsureSuccessStatusCode(); return c; }
    [Fact]
    public async Task Registration_requires_confirmation_and_reset_invalidates_old_sessions()
    {
        using var client = fixture.Client(); var email = "registered-" + Guid.NewGuid().ToString("N") + "@example.invalid";
        var registration = await DatabaseFixture.Send(client, "/auth/register", new { displayName = "New member", email, password = DatabaseFixture.TestPassword, locale = "en" }); registration.EnsureSuccessStatusCode();
        var registered = (await registration.Content.ReadFromJsonAsync<JsonElement>());
        Assert.Equal("LocalPreview", registered.GetProperty("delivery").GetString());
        Assert.Contains("/en/confirm-email#", registered.GetProperty("developmentConfirmationLink").GetString());
        var duplicate = await DatabaseFixture.Send(client, "/auth/register", new { displayName = "New member", email, password = "IncorrectPassword-4831", locale = "en" });
        Assert.False((await duplicate.Content.ReadFromJsonAsync<JsonElement>()).TryGetProperty("developmentConfirmationLink", out _));
        var pending = await DatabaseFixture.Send(client, "/auth/register", new { displayName = "New member", email, password = DatabaseFixture.TestPassword, locale = "en" });
        Assert.Contains("/en/confirm-email#", (await pending.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("developmentConfirmationLink").GetString());
        var pendingLogin = await DatabaseFixture.Send(client, "/auth/login", new { email, password = DatabaseFixture.TestPassword });
        pendingLogin.EnsureSuccessStatusCode(); Assert.True((await pendingLogin.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("requiresEmailConfirmation").GetBoolean());
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/me/profile")).StatusCode);
        string ConfirmationCode()
        {
            using var scope = fixture.Factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var html = db.MailItems.Where(x => x.To == email).OrderByDescending(x => x.CreatedAt).First().Html; var href = WebUtility.HtmlDecode(Regex.Match(html, "href='([^']+)'").Groups[1].Value); return QueryHelpers.ParseQuery(new Uri(href).Fragment.TrimStart('#'))["code"].ToString();
        }
        (await DatabaseFixture.Send(client, "/auth/confirm-email", new { email, code = ConfirmationCode() })).EnsureSuccessStatusCode();
        (await DatabaseFixture.Send(client, "/auth/login", new { email, password = DatabaseFixture.TestPassword })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/me/profile")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/admin/media")).StatusCode);
        (await DatabaseFixture.Send(client, "/auth/forgot-password", new { email, locale = "en" })).EnsureSuccessStatusCode();
        string resetCode; using (var scope = fixture.Factory.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var html = db.MailItems.Where(x => x.To == email).OrderByDescending(x => x.CreatedAt).First().Html; resetCode = QueryHelpers.ParseQuery(new Uri(WebUtility.HtmlDecode(Regex.Match(html, "href='([^']+)'").Groups[1].Value)).Fragment.TrimStart('#'))["code"].ToString(); }
        Assert.Equal(HttpStatusCode.BadRequest, (await DatabaseFixture.Send(client, "/auth/reset-password", new { email, code = "bad-token", password = "ChangedFixturePassword-492" })).StatusCode);
        using (var lockScope = fixture.Factory.Services.CreateScope()) { var manager = lockScope.ServiceProvider.GetRequiredService<UserManager<AppUser>>(); await manager.SetLockoutEndDateAsync((await manager.FindByEmailAsync(email))!, DateTimeOffset.UtcNow.AddMinutes(15)); }
        (await DatabaseFixture.Send(client, "/auth/reset-password", new { email, code = resetCode, password = "ChangedFixturePassword-492" })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/me/profile")).StatusCode);
        using var fresh = fixture.Client(); (await DatabaseFixture.Send(fresh, "/auth/login", new { email, password = "ChangedFixturePassword-492" })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.BadRequest, (await DatabaseFixture.Send(fresh, "/auth/register", new { displayName = "Bad role", email = "role@example.invalid", password = DatabaseFixture.TestPassword, locale = "en", isAdministrator = true })).StatusCode);
    }
    [Fact]
    public async Task Existing_confirmed_registration_points_to_sign_in_without_changing_the_account()
    {
        using var client = fixture.Client();
        var input = new { displayName = "Do not replace profile", email = "member@example.invalid", password = DatabaseFixture.TestPassword, locale = "en" };
        var existing = await DatabaseFixture.Send(client, "/auth/register", input); existing.EnsureSuccessStatusCode();
        Assert.Equal("SignIn", (await existing.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("nextStep").GetString());
        (await DatabaseFixture.Send(client, "/auth/login", new { email = "  MEMBER@example.invalid  ", password = DatabaseFixture.TestPassword })).EnsureSuccessStatusCode();
        var profile = await client.GetFromJsonAsync<JsonElement>("/api/v1/me/profile"); Assert.NotEqual("Do not replace profile", profile.GetProperty("displayName").GetString());
    }
    [Fact]
    public async Task Requests_are_owner_scoped_idempotent_and_follow_admin_review_workflow()
    {
        using var member = await Member(); using var admin = await fixture.Admin(); using var visitor = fixture.Client();
        var key = Guid.NewGuid(); var input = new { submissionKey = key, kind = "Volunteer", phone = "+201001234567", description = "I would like to support educational activities.", skills = "Teaching and reading", availability = "Tuesday afternoons", consent = true };
        var response = await DatabaseFixture.Send(member, "/requests", input); Assert.Equal(HttpStatusCode.Created, response.StatusCode); var created = await response.Content.ReadFromJsonAsync<JsonElement>(); var id = created.GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.OK, (await DatabaseFixture.Send(member, "/requests", input)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync($"/api/v1/requests/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await member.GetAsync("/api/v1/admin/requests")).StatusCode);
        using (var scope = fixture.Factory.Services.CreateScope()) { var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>(); await users.CreateAsync(new AppUser { Email = "other@example.invalid", UserName = "other@example.invalid", EmailConfirmed = true, DisplayName = "Other" }, DatabaseFixture.TestPassword); }
        using var other = await Member("other@example.invalid"); Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/v1/requests/{id}")).StatusCode);
        var info = await member.GetFromJsonAsync<JsonElement>($"/api/v1/requests/{id}"); var version = info.GetProperty("version").GetInt64();
        var decision = await DatabaseFixture.Send(admin, $"/admin/requests/{id}/decision", new { state = "NeedsInformation", reason = "Please confirm your available hours." }, version: version); decision.EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.PreconditionFailed, (await DatabaseFixture.Send(member, $"/requests/{id}/reply", new { text = "Tuesday after noon." }, version: version)).StatusCode);
        info = await member.GetFromJsonAsync<JsonElement>($"/api/v1/requests/{id}");
        (await DatabaseFixture.Send(member, $"/requests/{id}/reply", new { text = "Tuesday after noon." }, version: info.GetProperty("version").GetInt64())).EnsureSuccessStatusCode();
        info = await member.GetFromJsonAsync<JsonElement>($"/api/v1/requests/{id}"); Assert.Equal("UnderReview", info.GetProperty("state").GetString());
        Assert.Equal(2, info.GetProperty("replies").GetArrayLength());
        using (var scope = fixture.Factory.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); Assert.Equal(1, await db.ServiceRequests.CountAsync(x => x.SubmissionKey == key)); Assert.True(await db.MailItems.AnyAsync(x => x.State == "Pending")); }
        Assert.Equal(HttpStatusCode.BadRequest, (await DatabaseFixture.Send(member, "/requests", new { submissionKey = Guid.NewGuid(), kind = "Enrollment", phone = "+201001234567", description = "I would like to enroll my child in activities.", consent = true })).StatusCode);
        var enrollment = await DatabaseFixture.Send(member, "/requests", new { submissionKey = Guid.NewGuid(), kind = "Enrollment", phone = "+201001234567", description = "I would like to enroll my child in activities.", childName = "Test child", childDateOfBirth = "2016-05-10", educationStage = "Primary", consent = true }); enrollment.EnsureSuccessStatusCode();
    }
    [Fact]
    public async Task Contributions_require_an_account_valid_type_and_are_visible_to_owner_and_admin()
    {
        using var visitor = fixture.Client(); using var member = await Member(); using var admin = await fixture.Admin();
        var input = new { submissionKey = Guid.NewGuid(), kind = "Contribution", contributionType = "InKind", phone = "+201001234567", description = "I can offer twenty new school bags for students.", consent = true };
        Assert.Equal(HttpStatusCode.Unauthorized, (await DatabaseFixture.Send(visitor, "/requests", input)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await DatabaseFixture.Send(member, "/requests", new { submissionKey = Guid.NewGuid(), kind = "Contribution", contributionType = "Other", phone = input.phone, description = input.description, consent = true })).StatusCode);
        var result = await DatabaseFixture.Send(member, "/requests", input); Assert.Equal(HttpStatusCode.Created, result.StatusCode);
        var id = (await result.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var own = await member.GetFromJsonAsync<JsonElement>($"/api/v1/requests/{id}");
        Assert.Equal("Contribution", own.GetProperty("kind").GetString()); Assert.Contains("In-kind", own.GetProperty("description").GetString());
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/v1/admin/requests/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await DatabaseFixture.Send(member, "/requests", input)).StatusCode);
    }
    [Fact]
    public async Task Contact_is_recorded_and_queued_without_claiming_delivery_and_rejects_no_consent()
    {
        using var visitor = fixture.Client();
        var response = await DatabaseFixture.Send(visitor, "/contact", new { submissionKey = Guid.NewGuid(), name = "Contact visitor", email = "contact@example.invalid", phone = "", message = "Please tell me about the foundation programs.", consent = true }); Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("LocalPreview", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("delivery").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await DatabaseFixture.Send(visitor, "/contact", new { submissionKey = Guid.NewGuid(), name = "Contact visitor", email = "contact@example.invalid", message = "Please tell me about the foundation programs." })).StatusCode);
    }
    [Fact]
    public async Task Media_upload_is_private_until_published_and_admin_edits_are_versioned()
    {
        using var admin = await fixture.Admin(); using var visitor = fixture.Client(); using var member = await Member();
        using var bitmap = new SKBitmap(32, 16); bitmap.Erase(SKColors.Green); using var encoded = bitmap.Encode(SKEncodedImageFormat.Png, 100);
        var csrf = await admin.GetFromJsonAsync<JsonElement>("/api/v1/auth/csrf");
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/admin/media"); request.Headers.Add("X-CSRF-TOKEN", csrf.GetProperty("token").GetString());
        var data = new MultipartFormDataContent(); data.Add(new ByteArrayContent(encoded.ToArray()), "file", "test.png"); foreach (var pair in new Dictionary<string, string> { { "kind", "Photo" }, { "titleAr", "صورة اختبار" }, { "titleEn", "Test photo" }, { "altAr", "صورة خضراء للاختبار" }, { "altEn", "A green test image" }, { "category", "Skills" } }) data.Add(new StringContent(pair.Value), pair.Key); request.Content = data;
        var uploaded = await admin.SendAsync(request); uploaded.EnsureSuccessStatusCode(); var item = await uploaded.Content.ReadFromJsonAsync<JsonElement>(); var id = item.GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.NotFound, (await visitor.GetAsync($"/api/v1/media/{id}/file")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/v1/media/{id}/file")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await member.GetAsync("/api/v1/admin/media")).StatusCode);
        var fields = new { titleAr = "صورة منشورة", titleEn = "Published photo", altAr = "وصف الاختبار", altEn = "Test description", category = "Skills", isPublished = true, sortOrder = 0 };
        var published = await DatabaseFixture.Send(admin, $"/admin/media/{id}", fields, "PUT", 1); published.EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.OK, (await visitor.GetAsync($"/api/v1/media/{id}/file")).StatusCode);
        Assert.Equal(HttpStatusCode.PreconditionFailed, (await DatabaseFixture.Send(admin, $"/admin/media/{id}", fields, "PUT", 1)).StatusCode);
        var hero = await DatabaseFixture.Send(admin, $"/admin/media/{id}/hero", version: 2); hero.EnsureSuccessStatusCode();
        (await DatabaseFixture.Send(admin, $"/admin/media/{id}", method: "DELETE", version: 3)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await visitor.GetAsync($"/api/v1/media/{id}/file")).StatusCode);
    }
}
