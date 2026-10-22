using System.Security.Claims;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using OmElMaouna.Api.Features.Content;
using OmElMaouna.Api.Features.Identity;
using OmElMaouna.Api.Features.Services;
using OmElMaouna.Api.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 34 * 1024 * 1024);
builder.Services.AddProblemDetails();
builder.Services.AddHostedService<MailWorker>();
builder.Services.Configure<Microsoft.AspNetCore.Routing.RouteHandlerOptions>(options => options.ThrowOnBadRequest = false);
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow);
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(
    builder.Configuration.GetConnectionString("Database") ?? throw new InvalidOperationException("Run scripts/setup-database.ps1 to configure the local database.")));
builder.Services.AddIdentity<AppUser, IdentityRole<Guid>>(options =>
{
    options.User.RequireUniqueEmail = true;
    options.Password.RequiredLength = 12;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireDigit = false;
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    options.SignIn.RequireConfirmedEmail = true;
}).AddEntityFrameworkStores<AppDbContext>().AddDefaultTokenProviders();
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = "omelmaouna.session";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    options.ExpireTimeSpan = TimeSpan.FromHours(8);
    options.SlidingExpiration = true;
    options.Events = new CookieAuthenticationEvents
    {
        OnRedirectToLogin = context => { context.Response.StatusCode = 401; return Task.CompletedTask; },
        OnRedirectToAccessDenied = context => { context.Response.StatusCode = 403; return Task.CompletedTask; },
        OnValidatePrincipal = async context =>
        {
            var manager = context.HttpContext.RequestServices.GetRequiredService<UserManager<AppUser>>();
            var user = await manager.GetUserAsync(context.Principal!);
            var stamp = context.Principal?.FindFirstValue("AspNet.Identity.SecurityStamp");
            var invalid = user is null || user.IsDisabled || stamp != user.SecurityStamp;
            if (user?.IsAdministrator == true)
            {
                if (!long.TryParse(context.Principal?.FindFirstValue("session_started"), out var started)) invalid = true;
                else invalid |= DateTimeOffset.UtcNow.ToUnixTimeSeconds() - started > 8 * 3600;
            }
            if (invalid) context.RejectPrincipal();
        }
    };
});
builder.Services.AddAuthorizationBuilder().AddPolicy("Administrator", policy => policy.RequireAuthenticatedUser().RequireClaim("amr", "mfa"));
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "omelmaouna.csrf";
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("submissions", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = builder.Configuration.GetValue<int?>("RateLimits:SubmissionsPerMinute") ?? 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.AddPolicy("authentication", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
        { PermitLimit = builder.Configuration.GetValue<int?>("RateLimits:AuthenticationPerMinute") ?? 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

var app = builder.Build();
app.UseExceptionHandler();
if (!app.Environment.IsDevelopment()) { app.UseHsts(); app.UseHttpsRedirection(); }
app.UseAuthentication();
app.UseRateLimiter();
app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff";
    if (context.Request.Path.StartsWithSegments("/api/v1/auth") || context.Request.Path.StartsWithSegments("/api/v1/admin") || context.Request.Path.StartsWithSegments("/api/v1/me") || context.Request.Path.StartsWithSegments("/api/v1/requests"))
        context.Response.Headers.CacheControl = "no-store";
    if (context.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method))
    {
        try { await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context); }
        catch (AntiforgeryValidationException) { await Results.Problem(statusCode: 400, title: "Invalid CSRF token. Refresh the form and try again.").ExecuteAsync(context); return; }
    }
    await next();
});
app.UseAuthorization();
app.MapGet("/health/live", () => Results.Ok(new { status = "ok" }));
app.MapGet("/health/ready", async (AppDbContext db, CancellationToken ct) =>
    await db.Database.CanConnectAsync(ct) ? Results.Ok(new { status = "ready" }) : Results.StatusCode(503));
app.MapIdentityEndpoints();
app.MapProfileEndpoints();
app.MapProgramEndpoints();
app.MapRegistrationEndpoints();
app.MapRequestEndpoints();
app.MapMediaEndpoints();
app.MapSiteContentEndpoints();

if (args.Contains("--migrate"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
    return;
}
if (args.Contains("--provision-admin"))
{
    using var scope = app.Services.CreateScope();
    await AdminProvisioning.RunAsync(scope.ServiceProvider, builder.Configuration);
    return;
}
if (args.Contains("--import-media"))
{
    if (!app.Environment.IsDevelopment()) throw new InvalidOperationException("Local media import is development only.");
    using var scope = app.Services.CreateScope(); await MediaEndpoints.ImportAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>(), builder.Configuration, app.Environment); return;
}
if (args.Contains("--seed-development"))
{
    if (!app.Environment.IsDevelopment()) throw new InvalidOperationException("Development seed is prohibited outside Development.");
    using var scope = app.Services.CreateScope();
    await DevelopmentSeed.RunAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    return;
}
app.Run();

public partial class Program;
