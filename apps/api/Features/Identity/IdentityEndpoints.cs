using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OmElMaouna.Api.Infrastructure.Persistence;
using OmElMaouna.Api.Features.Services;

namespace OmElMaouna.Api.Features.Identity;

public sealed record LoginInput(string Email, string Password);
public sealed record MfaInput(string Code);

public static class IdentityEndpoints
{
    public static void MapIdentityEndpoints(this WebApplication app)
    {
        var auth = app.MapGroup("/api/v1/auth").RequireRateLimiting("authentication");
        auth.MapGet("/csrf", (IAntiforgery antiforgery, HttpContext context) => Results.Ok(new { token = antiforgery.GetAndStoreTokens(context).RequestToken })).DisableRateLimiting();
        auth.MapPost("/login", async (LoginInput input, SignInManager<AppUser> signIn, UserManager<AppUser> users, AppDbContext db, IConfiguration config, IWebHostEnvironment env) =>
        {
            if (string.IsNullOrWhiteSpace(input.Email) || input.Email.Length > 254 || string.IsNullOrEmpty(input.Password) || input.Password.Length > 128) return InvalidLogin();
            var user = await users.FindByEmailAsync(input.Email.Trim());
            if (user is null || user.IsDisabled) return InvalidLogin();
            if (!user.EmailConfirmed && !user.IsAdministrator)
            {
                if (await users.IsLockedOutAsync(user)) return InvalidLogin();
                if (!await users.CheckPasswordAsync(user, input.Password)) { await users.AccessFailedAsync(user); return InvalidLogin(); }
                await users.ResetAccessFailedCountAsync(user);
                var link = await RegistrationEndpoints.Confirmation(user, user.PreferredLocale, users, db, config);
                await db.SaveChangesAsync();
                return Results.Ok(new { requiresEmailConfirmation = true, developmentConfirmationLink = env.IsDevelopment() && MailDelivery.IsLocal(config, env) ? link : null });
            }
            var result = await signIn.CheckPasswordSignInAsync(user, input.Password, lockoutOnFailure: true);
            if (!result.Succeeded) return InvalidLogin();
            if (user.IsAdministrator)
            {
                // A password-only principal is intentionally unable to enter admin endpoints.
                if (!user.TwoFactorEnabled)
                {
                    await signIn.SignInWithClaimsAsync(user, Session(TimeSpan.FromMinutes(10)), [Started()]);
                    return Results.Ok(new { requiresMfaSetup = true });
                }
                await signIn.SignOutAsync();
                await signIn.Context.SignInAsync(IdentityConstants.TwoFactorUserIdScheme,
                    new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Name, user.Id.ToString())], IdentityConstants.TwoFactorUserIdScheme)), Session(TimeSpan.FromMinutes(5)));
                return Results.Ok(new { requiresMfa = true });
            }
            await signIn.SignInAsync(user, Session(TimeSpan.FromHours(8)));
            return Results.Ok(new { requiresMfa = false });
        });
        auth.MapPost("/mfa/start-setup", async (HttpContext context, UserManager<AppUser> users, SignInManager<AppUser> signIn) =>
        {
            var user = await users.GetUserAsync(context.User);
            if (user is null || !user.IsAdministrator || user.TwoFactorEnabled) return Results.Forbid();
            var key = await users.GetAuthenticatorKeyAsync(user);
            if (string.IsNullOrEmpty(key))
            {
                await users.ResetAuthenticatorKeyAsync(user);
                key = await users.GetAuthenticatorKeyAsync(user);
                // Rotating the authenticator key also rotates the security stamp.
                // Refresh only the restricted setup session, never MFA authorization.
                await signIn.SignInWithClaimsAsync(user, Session(TimeSpan.FromMinutes(10)), [Started()]);
            }
            var uri = $"otpauth://totp/{Uri.EscapeDataString("OmElMaouna:" + user.Email)}?secret={key}&issuer=OmElMaouna&digits=6";
            return Results.Ok(new { sharedKey = key, authenticatorUri = uri });
        }).RequireAuthorization();
        auth.MapPost("/mfa/confirm-setup", async (MfaInput input, HttpContext context, UserManager<AppUser> users, SignInManager<AppUser> signIn) =>
        {
            var user = await users.GetUserAsync(context.User);
            if (user is null || !user.IsAdministrator || user.TwoFactorEnabled) return Results.Forbid();
            if (!await users.VerifyTwoFactorTokenAsync(user, users.Options.Tokens.AuthenticatorTokenProvider, NormalizeCode(input.Code))) return InvalidCode();
            await users.SetTwoFactorEnabledAsync(user, true);
            await SignInAdministrator(signIn, user);
            var recoveryCodes = await users.GenerateNewTwoFactorRecoveryCodesAsync(user, 10);
            return Results.Ok(new { recoveryCodes });
        }).RequireAuthorization();
        auth.MapPost("/mfa/verify", async (MfaInput input, UserManager<AppUser> users, SignInManager<AppUser> signIn) =>
        {
            var user = await signIn.GetTwoFactorAuthenticationUserAsync();
            if (user is null || user.IsDisabled || !user.IsAdministrator) return InvalidCode();
            var result = await signIn.TwoFactorAuthenticatorSignInAsync(NormalizeCode(input.Code), false, false);
            if (!result.Succeeded) return InvalidCode();
            await SignInAdministrator(signIn, user);
            return Results.Ok(new { authenticated = true });
        });
        auth.MapPost("/mfa/recovery", async (MfaInput input, SignInManager<AppUser> signIn) =>
        {
            var user = await signIn.GetTwoFactorAuthenticationUserAsync();
            if (user is null || user.IsDisabled || !user.IsAdministrator) return InvalidCode();
            var result = await signIn.TwoFactorRecoveryCodeSignInAsync(input.Code.Trim());
            if (!result.Succeeded) return InvalidCode();
            await SignInAdministrator(signIn, user);
            return Results.Ok(new { authenticated = true });
        });
        auth.MapPost("/logout", async (SignInManager<AppUser> signIn) => { await signIn.SignOutAsync(); return Results.NoContent(); });
        app.MapGet("/api/v1/me", async (HttpContext context, UserManager<AppUser> users) =>
        {
            var user = await users.GetUserAsync(context.User);
            return user is null ? Results.Unauthorized() : Results.Ok(new { user.Id, user.DisplayName, user.PreferredLocale, user.IsAdministrator, mfaVerified = context.User.HasClaim("amr", "mfa") });
        }).RequireAuthorization();
    }

    private static AuthenticationProperties Session(TimeSpan lifetime) => new() { IsPersistent = false, ExpiresUtc = DateTimeOffset.UtcNow.Add(lifetime) };
    private static Claim Started() => new("session_started", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString());
    private static Task SignInAdministrator(SignInManager<AppUser> signIn, AppUser user) => signIn.SignInWithClaimsAsync(user, Session(TimeSpan.FromMinutes(30)), [new Claim("amr", "mfa"), Started()]);
    private static string NormalizeCode(string? code) => (code ?? "").Replace(" ", "").Replace("-", "");
    private static IResult InvalidLogin() => Results.Problem(statusCode: 401, title: "Unable to sign in with these credentials.");
    private static IResult InvalidCode() => Results.Problem(statusCode: 400, title: "The verification code is invalid or expired.");
}

public static class AdminProvisioning
{
    public static async Task RunAsync(IServiceProvider services, IConfiguration configuration)
    {
        var db = services.GetRequiredService<AppDbContext>();
        if (await db.Users.AnyAsync(u => u.IsAdministrator)) { Console.WriteLine("The sole administrator already exists. No changes made."); return; }
        var email = configuration["Bootstrap:Email"];
        var password = configuration["Bootstrap:Password"];
        if (email is null || !new EmailAddressAttribute().IsValid(email) || password is null || password.Length is < 12 or > 128)
            throw new InvalidOperationException("Set Bootstrap:Email and Bootstrap:Password in user secrets or environment; never commit them.");
        var users = services.GetRequiredService<UserManager<AppUser>>();
        if (await users.FindByEmailAsync(email) is not null) throw new InvalidOperationException("That address already belongs to an account. Automatic promotion is prohibited.");
        var result = await users.CreateAsync(new AppUser { UserName = email, Email = email, DisplayName = "إدارة مؤسسة أم المعونة", IsAdministrator = true, EmailConfirmed = true }, password);
        if (!result.Succeeded) throw new InvalidOperationException("Administrator provisioning failed: " + string.Join(", ", result.Errors.Select(e => e.Code)));
        Console.WriteLine("Sole administrator provisioned. Authenticator setup is required at first sign-in.");
    }
}
