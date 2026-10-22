using System.ComponentModel.DataAnnotations;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using OmElMaouna.Api.Features.Services;
using OmElMaouna.Api.Infrastructure.Persistence;
namespace OmElMaouna.Api.Features.Identity;

public sealed record RegisterInput(string DisplayName, string Email, string Password, string Locale);
public sealed record EmailInput(string Email, string Locale);
public sealed record ConfirmInput(string Email, string Code);
public sealed record ResetInput(string Email, string Code, string Password);

public static class RegistrationEndpoints
{
    public static void MapRegistrationEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/auth").RequireRateLimiting("authentication");
        group.MapPost("/register", async (RegisterInput input, UserManager<AppUser> users, AppDbContext db, IConfiguration config, IWebHostEnvironment env) =>
        {
            if (string.IsNullOrWhiteSpace(input.DisplayName) || input.DisplayName.Trim().Length is < 2 or > 100 || !ValidEmail(input.Email) || input.Password is null || input.Password.Length is < 12 or > 128 || input.Locale is not ("ar" or "en")) return Results.Problem(statusCode: 400, title: "Check the name and email. Use a password of 12–128 characters.");
            var email = input.Email.Trim();
            var existing = await users.FindByEmailAsync(email);
            if (existing is not null)
            {
                // Recover the local preview for a pending account only after proving its password.
                if (env.IsDevelopment() && MailDelivery.IsLocal(config, env) && existing is { EmailConfirmed: false, IsDisabled: false, IsAdministrator: false } && !await users.IsLockedOutAsync(existing) && await users.CheckPasswordAsync(existing, input.Password))
                {
                    var pendingLink = await Confirmation(existing, input.Locale, users, db, config);
                    await db.SaveChangesAsync();
                    return Results.Ok(new { accepted = true, delivery = "LocalPreview", developmentConfirmationLink = pendingLink });
                }
                if (existing is { EmailConfirmed: true, IsDisabled: false, IsAdministrator: false } && !await users.IsLockedOutAsync(existing) && await users.CheckPasswordAsync(existing, input.Password))
                    return Results.Ok(new { accepted = true, delivery = "None", nextStep = "SignIn" });
                return Accepted(config, env);
            }
            await using var transaction = await db.Database.BeginTransactionAsync();
            var user = new AppUser { UserName = email, Email = email, DisplayName = input.DisplayName.Trim(), PreferredLocale = input.Locale };
            var result = await users.CreateAsync(user, input.Password);
            if (!result.Succeeded) return Results.Problem(statusCode: 400, title: "Unable to create the account. Check your details and password.");
            var confirmationLink = await Confirmation(user, input.Locale, users, db, config);
            await db.SaveChangesAsync(); await transaction.CommitAsync();
            // Only a newly created account in local development receives its own preview link.
            return Results.Ok(new { accepted = true, delivery = MailDelivery.IsLocal(config, env) ? "LocalPreview" : "Email", developmentConfirmationLink = env.IsDevelopment() && MailDelivery.IsLocal(config, env) ? confirmationLink : null });
        });
        group.MapPost("/resend-confirmation", async (EmailInput input, UserManager<AppUser> users, AppDbContext db, IConfiguration config, IWebHostEnvironment env) =>
        {
            if (!ValidEmail(input.Email) || input.Locale is not ("ar" or "en")) return Results.BadRequest();
            var user = await users.FindByEmailAsync(input.Email.Trim());
            if (user is { EmailConfirmed: false, IsDisabled: false, IsAdministrator: false }) { await Confirmation(user, input.Locale, users, db, config); await db.SaveChangesAsync(); }
            return Accepted(config, env);
        });
        group.MapPost("/confirm-email", async (ConfirmInput input, UserManager<AppUser> users) =>
        {
            if (!ValidEmail(input.Email) || input.Code?.Length is not (> 0 and <= 3000)) return Results.BadRequest();
            var user = await users.FindByEmailAsync(input.Email.Trim());
            if (user is null || user.IsDisabled) return InvalidToken();
            try { var result = await users.ConfirmEmailAsync(user, Decode(input.Code)); return result.Succeeded ? Results.Ok(new { confirmed = true }) : InvalidToken(); } catch (FormatException) { return InvalidToken(); }
        });
        group.MapPost("/forgot-password", async (EmailInput input, UserManager<AppUser> users, AppDbContext db, IConfiguration config, IWebHostEnvironment env) =>
        {
            if (!ValidEmail(input.Email) || input.Locale is not ("ar" or "en")) return Results.BadRequest();
            var user = await users.FindByEmailAsync(input.Email.Trim());
            if (user is { EmailConfirmed: true, IsDisabled: false })
            {
                var code = Encode(await users.GeneratePasswordResetTokenAsync(user));
                var link = $"{MailDelivery.Origin(config)}/{input.Locale}/reset-password#email={Uri.EscapeDataString(user.Email!)}&code={code}";
                MailDelivery.Queue(db, user.Email!, "أم المعونة — استعادة كلمة السر / Password reset", "طلبت إعادة تعيين كلمة السر. إذا لم تطلب ذلك، تجاهل الرسالة. / Reset your password using this link.", link); await db.SaveChangesAsync();
            }
            return Accepted(config, env);
        });
        group.MapPost("/reset-password", async (ResetInput input, UserManager<AppUser> users) =>
        {
            if (!ValidEmail(input.Email) || input.Code?.Length is not (> 0 and <= 3000) || input.Password?.Length is not (>= 12 and <= 128)) return Results.BadRequest();
            var user = await users.FindByEmailAsync(input.Email.Trim()); if (user is null || !user.EmailConfirmed || user.IsDisabled) return InvalidToken();
            try { var result = await users.ResetPasswordAsync(user, Decode(input.Code), input.Password); if (!result.Succeeded) return InvalidToken(); await users.ResetAccessFailedCountAsync(user); await users.SetLockoutEndDateAsync(user, null); return Results.Ok(new { reset = true }); } catch (FormatException) { return InvalidToken(); }
        });
    }
    internal static async Task<string> Confirmation(AppUser user, string locale, UserManager<AppUser> users, AppDbContext db, IConfiguration config)
    {
        var token = Encode(await users.GenerateEmailConfirmationTokenAsync(user));
        var link = $"{MailDelivery.Origin(config)}/{locale}/confirm-email#email={Uri.EscapeDataString(user.Email!)}&code={token}";
        MailDelivery.Queue(db, user.Email!, "أم المعونة — تأكيد البريد / Confirm your email", "أكد بريدك الإلكتروني لإكمال إنشاء حسابك. / Confirm your email to finish creating your account.", link);
        return link;
    }
    private static bool ValidEmail(string? value) => value is { Length: > 3 and <= 254 } && new EmailAddressAttribute().IsValid(value.Trim());
    private static string Encode(string value) => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(value));
    private static string Decode(string value) => Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(value));
    private static IResult InvalidToken() => Results.Problem(statusCode: 400, title: "This link is invalid or expired. Request a new one.");
    private static IResult Accepted(IConfiguration config, IHostEnvironment env) => Results.Ok(new { accepted = true, delivery = MailDelivery.IsLocal(config, env) ? "LocalPreview" : "Email" });
}
