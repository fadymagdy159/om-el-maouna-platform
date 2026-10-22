using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using OmElMaouna.Api.Features.Identity;
using OmElMaouna.Api.Features.Content;
using OmElMaouna.Api.Infrastructure.Persistence;
namespace OmElMaouna.Api.Features.Services;

public static class Access
{
    public static RouteGroupBuilder Admin(WebApplication app, string prefix) => app.MapGroup(prefix).RequireAuthorization("Administrator").AddEndpointFilter(async (ctx, next) =>
    {
        var users = ctx.HttpContext.RequestServices.GetRequiredService<UserManager<AppUser>>();
        var u = await users.GetUserAsync(ctx.HttpContext.User);
        return u is null || !u.IsAdministrator || u.IsDisabled || !u.TwoFactorEnabled ? Results.Forbid() : await next(ctx);
    });
    public static RouteGroupBuilder Member(WebApplication app, string prefix) => app.MapGroup(prefix).RequireAuthorization().AddEndpointFilter(async (ctx, next) =>
    {
        var users = ctx.HttpContext.RequestServices.GetRequiredService<UserManager<AppUser>>();
        var u = await users.GetUserAsync(ctx.HttpContext.User);
        if (u is null || u.IsDisabled) return Results.Unauthorized();
        if (!u.EmailConfirmed || (u.IsAdministrator && !ctx.HttpContext.User.HasClaim("amr", "mfa"))) return Results.Forbid();
        return await next(ctx);
    });
    public static IResult? Match(HttpContext context, long version)
    {
        if (!context.Request.Headers.TryGetValue("If-Match", out var match)) return Results.Problem(statusCode: 428, title: "Reload this item before making changes.");
        return match.ToString() == $"\"{version}\"" ? null : Results.Problem(statusCode: 412, title: "This item changed elsewhere. Reload it first.");
    }
    public static void Audit(AppDbContext db, HttpContext context, string action, Guid id) => db.AuditLogs.Add(new AuditEntry { ActorUserId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!), Action = action, EntityId = id });
}
