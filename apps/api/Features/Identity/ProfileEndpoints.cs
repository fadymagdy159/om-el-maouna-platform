using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OmElMaouna.Api.Infrastructure.Persistence;
using SkiaSharp;

namespace OmElMaouna.Api.Features.Identity;

public sealed record ProfileInput(string DisplayName, string? PhoneNumber, DateOnly? DateOfBirth, string? Gender);
public sealed record AvatarInput(string Base64);

public static class ProfileEndpoints
{
    public static void MapProfileEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/me").RequireAuthorization().AddEndpointFilter(async (context, next) =>
        {
            var users = context.HttpContext.RequestServices.GetRequiredService<UserManager<AppUser>>();
            var user = await users.GetUserAsync(context.HttpContext.User);
            if (user is null || user.IsDisabled) return Results.Unauthorized();
            if (user.IsAdministrator && (!user.TwoFactorEnabled || !context.HttpContext.User.HasClaim("amr", "mfa"))) return Results.Forbid();
            return await next(context);
        });
        group.MapGet("/profile", async (HttpContext context, UserManager<AppUser> users) =>
            Results.Ok(View((await users.GetUserAsync(context.User))!)));
        group.MapPut("/profile", async (ProfileInput input, HttpContext context, UserManager<AppUser> users) =>
        {
            var errors = new Dictionary<string, string[]>();
            var name = input.DisplayName?.Trim() ?? "";
            var phone = input.PhoneNumber?.Trim();
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (name.Length is < 2 or > 100) errors["displayName"] = ["Name must contain 2–100 characters."];
            if (!string.IsNullOrEmpty(phone) && (phone.Length > 30 || phone.Count(char.IsDigit) is < 7 or > 15 || phone.Any(c => !char.IsAsciiDigit(c) && !"+ ()-".Contains(c)))) errors["phoneNumber"] = ["Enter a valid phone number, including country code."];
            if (input.DateOfBirth is { } birth && (birth > today || birth < today.AddYears(-120))) errors["dateOfBirth"] = ["Enter a valid date of birth."];
            if (input.Gender is not (null or "" or "Male" or "Female")) errors["gender"] = ["Choose male or female, or leave blank."];
            if (errors.Count > 0) return Results.ValidationProblem(errors);
            var user = (await users.GetUserAsync(context.User))!;
            user.DisplayName = name;
            if (user.PhoneNumber != phone) user.PhoneNumberConfirmed = false;
            user.PhoneNumber = string.IsNullOrEmpty(phone) ? null : phone;
            user.DateOfBirth = input.DateOfBirth;
            user.Gender = string.IsNullOrEmpty(input.Gender) ? null : input.Gender;
            var result = await users.UpdateAsync(user);
            return result.Succeeded ? Results.Ok(View(user)) : Results.Problem(statusCode: 409, title: "Profile changed elsewhere. Reload and try again.");
        });
        group.MapGet("/avatar", async (HttpContext context, UserManager<AppUser> users, AppDbContext db, CancellationToken ct) =>
        {
            var id = users.GetUserId(context.User);
            var bytes = await db.Users.Where(u => u.Id == Guid.Parse(id!)).Select(u => u.Avatar).SingleAsync(ct);
            return bytes is null ? Results.NotFound() : Results.File(bytes, "image/jpeg");
        });
        group.MapPut("/avatar", async (AvatarInput input, HttpContext context, UserManager<AppUser> users, CancellationToken ct) =>
        {
            if (string.IsNullOrEmpty(input.Base64) || input.Base64.Length > 400000) return InvalidImage();
            byte[] bytes;
            try { bytes = Convert.FromBase64String(input.Base64); }
            catch (FormatException) { return InvalidImage(); }
            try
            {
                using var stream = new MemoryStream(bytes);
                using var codec = SKCodec.Create(stream);
                if (codec is null || codec.Info.Width > 4096 || codec.Info.Height > 4096 || (long)codec.Info.Width * codec.Info.Height > 4000000 || codec.EncodedFormat is not (SKEncodedImageFormat.Jpeg or SKEncodedImageFormat.Png or SKEncodedImageFormat.Webp)) return InvalidImage();
                using var bitmap = SKBitmap.Decode(codec);
                if (bitmap is null) return InvalidImage();
                using var thumbnail = new SKBitmap(256, 256);
                using (var canvas = new SKCanvas(thumbnail))
                {
                    canvas.Clear(SKColors.White);
                    var side = Math.Min(bitmap.Width, bitmap.Height);
                    var x = (bitmap.Width - side) / 2f; var y = (bitmap.Height - side) / 2f;
                    canvas.DrawBitmap(bitmap, new SKRect(x, y, x + side, y + side), new SKRect(0, 0, 256, 256), new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.None));
                }
                using var image = SKImage.FromBitmap(thumbnail);
                using var output = image.Encode(SKEncodedImageFormat.Jpeg, 82);
                var user = (await users.GetUserAsync(context.User))!;
                user.Avatar = output.ToArray();
                user.AvatarVersion = Guid.NewGuid();
                var result = await users.UpdateAsync(user);
                return result.Succeeded ? Results.Ok(View(user)) : Results.Conflict();
            }
            catch (Exception ex) when (ex is InvalidOperationException or NotSupportedException or ArgumentException) { return InvalidImage(); }
        }).WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(450000));
        group.MapDelete("/avatar", async (HttpContext context, UserManager<AppUser> users) =>
        {
            var user = (await users.GetUserAsync(context.User))!;
            user.Avatar = null; user.AvatarVersion = null;
            var result = await users.UpdateAsync(user);
            return result.Succeeded ? Results.NoContent() : Results.Conflict();
        });
    }
    private static object View(AppUser user)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        int? age = user.DateOfBirth is { } birth ? today.Year - birth.Year - (birth.AddYears(today.Year - birth.Year) > today ? 1 : 0) : null;
        return new { user.DisplayName, user.Email, user.PhoneNumber, user.DateOfBirth, user.Gender, age, user.AvatarVersion, user.IsAdministrator };
    }
    private static IResult InvalidImage() => Results.Problem(statusCode: 400, title: "Choose a valid JPG, PNG or WebP profile photo.");
}
