using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using OmElMaouna.Api.Features.Identity;
using OmElMaouna.Api.Infrastructure.Persistence;

namespace OmElMaouna.Api.Features.Content;

public static class ProgramEndpoints
{
    public static void MapProgramEndpoints(this WebApplication app)
    {
        app.MapGet("/api/v1/programs", async (string? locale, int? page, int? pageSize, AppDbContext db, CancellationToken ct) =>
        {
            locale ??= "ar";
            if (locale is not ("ar" or "en") || page is < 1 || pageSize is < 1 or > 50) return Results.BadRequest();
            var index = page ?? 1;
            var size = pageSize ?? 20;
            if (index > 100000) return Results.BadRequest();
            var query = db.Programs.AsNoTracking().Where(p => p.Status == "Published" && p.Translations.Any(t => t.Locale == locale));
            var count = await query.CountAsync(ct);
            var data = await query.Include(p => p.Translations).OrderBy(p => p.SortOrder).ThenBy(p => p.Id).Skip((index - 1) * size).Take(size).ToListAsync(ct);
            return Results.Ok(new { items = data.Select(p => PublicView(p, locale)), page = index, pageSize = size, totalCount = count });
        });
        app.MapGet("/api/v1/programs/by-slug/{slug}", async (string slug, string? locale, AppDbContext db, CancellationToken ct) =>
        {
            locale ??= "ar";
            if (locale is not ("ar" or "en")) return Results.BadRequest();
            var program = await db.Programs.AsNoTracking().Include(p => p.Translations)
                .SingleOrDefaultAsync(p => p.Status == "Published" && p.Translations.Any(t => t.Locale == locale && t.Slug == slug), ct);
            return program is null ? Results.NotFound() : Results.Ok(PublicView(program, locale));
        });
        var admin = app.MapGroup("/api/v1/admin").RequireAuthorization("Administrator").AddEndpointFilter(async (invocation, next) =>
        {
            var users = invocation.HttpContext.RequestServices.GetRequiredService<UserManager<AppUser>>();
            var user = await users.GetUserAsync(invocation.HttpContext.User);
            return user is null || !user.IsAdministrator || user.IsDisabled || !user.TwoFactorEnabled ? Results.Forbid() : await next(invocation);
        });
        admin.MapGet("/overview", async (AppDbContext db, CancellationToken ct) => Results.Ok(new
        {
            programs = await db.Programs.CountAsync(ct),
            publishedPrograms = await db.Programs.CountAsync(p => p.Status == "Published", ct),
            users = await db.Users.CountAsync(u => !u.IsAdministrator, ct)
        }));
        admin.MapGet("/programs", async (AppDbContext db, CancellationToken ct) => Results.Ok(
            await db.Programs.AsNoTracking().Include(p => p.Translations).OrderBy(p => p.SortOrder).Select(p => new
            { p.Id, p.Category, p.Status, p.Version, p.SortOrder, p.AcceptsSupportRequests, p.Translations }).ToListAsync(ct)));
        admin.MapGet("/programs/{id:guid}", async (Guid id, AppDbContext db, HttpResponse response, CancellationToken ct) =>
        {
            var program = await db.Programs.AsNoTracking().Include(p => p.Translations).SingleOrDefaultAsync(p => p.Id == id, ct);
            if (program is null) return Results.NotFound();
            response.Headers.ETag = $"\"{program.Version}\"";
            return Results.Ok(AdminView(program));
        });
        admin.MapPost("/programs", async (ProgramInput input, AppDbContext db, HttpContext context, CancellationToken ct) =>
        {
            var errors = ProgramRules.Validate(input);
            if (errors.Count > 0) return Results.ValidationProblem(errors);
            var program = new FoundationProgram();
            Apply(program, input);
            db.Programs.Add(program);
            Audit(db, context, "program.created", program.Id);
            var failure = await Save(db, ct);
            return failure ?? Results.Created($"/api/v1/admin/programs/{program.Id}", AdminView(program));
        });
        admin.MapPut("/programs/{id:guid}", async (Guid id, ProgramInput input, AppDbContext db, HttpContext context, CancellationToken ct) =>
        {
            var program = await db.Programs.Include(p => p.Translations).SingleOrDefaultAsync(p => p.Id == id, ct);
            if (program is null) return Results.NotFound();
            var conflict = MatchVersion(context, program.Version);
            if (conflict is not null) return conflict;
            var errors = ProgramRules.Validate(input, program.Status == "Published");
            if (errors.Count > 0) return Results.ValidationProblem(errors);
            // Stable public slugs avoid broken inbound links until redirect management is implemented.
            if (program.PublishedAt is not null && input.Translations.Any(t => program.Translations.Single(x => x.Locale == t.Locale).Slug != t.Slug))
                return Results.Problem(statusCode: 409, title: "Published slugs cannot change in this milestone.");
            Apply(program, input);
            program.Version++;
            program.UpdatedAt = DateTimeOffset.UtcNow;
            Audit(db, context, "program.updated", id);
            var failure = await Save(db, ct);
            return failure ?? Results.Ok(AdminView(program));
        });
        foreach (var action in new[] { "publish", "unpublish", "archive", "restore" })
        {
            admin.MapPost($"/programs/{{id:guid}}/{action}", async (Guid id, AppDbContext db, HttpContext context, CancellationToken ct) =>
            {
                var program = await db.Programs.Include(p => p.Translations).SingleOrDefaultAsync(p => p.Id == id, ct);
                if (program is null) return Results.NotFound();
                var conflict = MatchVersion(context, program.Version);
                if (conflict is not null) return conflict;
                if (action == "restore" && program.Status != "Archived")
                    return Results.Problem(statusCode: 409, title: "Only archived programs can be restored.");
                if (action == "publish" && program.Status == "Archived")
                    return Results.Problem(statusCode: 409, title: "Restore the program to a draft before publishing.");
                if (action == "publish")
                {
                    var errors = ProgramRules.Validate(ProgramRules.ToInput(program), true);
                    if (errors.Count > 0) return Results.ValidationProblem(errors);
                }
                program.Status = action switch { "publish" => "Published", "archive" => "Archived", _ => "Draft" };
                if (action == "publish") program.PublishedAt ??= DateTimeOffset.UtcNow;
                program.UpdatedAt = DateTimeOffset.UtcNow;
                program.Version++;
                Audit(db, context, $"program.{action}", id);
                var failure = await Save(db, ct);
                return failure ?? Results.Ok(AdminView(program));
            });
        }
        admin.MapDelete("/programs/{id:guid}", async (Guid id, AppDbContext db, HttpContext context, CancellationToken ct) =>
        {
            var program = await db.Programs.FindAsync([id], ct);
            if (program is null) return Results.NotFound();
            var conflict = MatchVersion(context, program.Version);
            if (conflict is not null) return conflict;
            db.Programs.Remove(program);
            Audit(db, context, "program.deleted", id);
            var failure = await Save(db, ct);
            return failure ?? Results.NoContent();
        });
    }

    private static object PublicView(FoundationProgram program, string locale)
    {
        var t = program.Translations.Single(t => t.Locale == locale);
        return new
        {
            program.Id,
            program.Category,
            program.AcceptsSupportRequests,
            t.Slug,
            t.Title,
            t.Summary,
            t.Body,
            t.EligibilityText,
            alternateSlugs = program.Translations.ToDictionary(x => x.Locale, x => x.Slug)
        };
    }
    private static object AdminView(FoundationProgram p) => new { p.Id, p.Category, p.Status, p.Version, p.SortOrder, p.AcceptsSupportRequests, p.Translations };
    private static void Apply(FoundationProgram p, ProgramInput input)
    {
        p.Category = input.Category;
        p.AcceptsSupportRequests = input.AcceptsSupportRequests;
        p.SortOrder = input.SortOrder;
        foreach (var value in input.Translations)
        {
            var t = p.Translations.SingleOrDefault(t => t.Locale == value.Locale);
            if (t is null) { t = new ProgramTranslation { ProgramId = p.Id, Locale = value.Locale }; p.Translations.Add(t); }
            t.Slug = value.Slug.Trim(); t.Title = value.Title.Trim(); t.Summary = value.Summary.Trim(); t.Body = value.Body.Trim(); t.EligibilityText = value.EligibilityText.Trim();
        }
    }
    private static IResult? MatchVersion(HttpContext context, long version)
    {
        var header = context.Request.Headers.IfMatch.ToString();
        if (string.IsNullOrWhiteSpace(header)) return Results.Problem(statusCode: 428, title: "If-Match is required.");
        return header != $"\"{version}\"" ? Results.Problem(statusCode: 412, title: "This program changed. Reload before saving.") : null;
    }
    private static void Audit(AppDbContext db, HttpContext context, string action, Guid id) => db.AuditLogs.Add(new AuditEntry
    { ActorUserId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!), Action = action, EntityId = id });
    private static async Task<IResult?> Save(AppDbContext db, CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); return null; }
        catch (DbUpdateConcurrencyException) { return Results.Problem(statusCode: 412, title: "This record changed. Reload before saving."); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { return Results.Problem(statusCode: 409, title: "A program already uses this translated slug."); }
    }
}
