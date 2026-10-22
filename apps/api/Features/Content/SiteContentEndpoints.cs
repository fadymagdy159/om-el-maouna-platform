using System.Text.Json;
using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using OmElMaouna.Api.Features.Services;
using OmElMaouna.Api.Infrastructure.Persistence;
namespace OmElMaouna.Api.Features.Content;

public sealed class SiteDocument { public int Id { get; set; } = 1; public string Values { get; set; } = "{}"; public long Version { get; set; } = 1; }
public sealed record SiteContentInput(Dictionary<string, string> Values);
public static class SiteContentEndpoints
{
    private static readonly HashSet<string> Keys = new[] { "heroStart", "heroEnd", "heroBody", "pillars", "pillarsBody", "approachTitle", "approachText", "step1", "step1Body", "step2", "step2Body", "step3", "step3Body", "cta", "ctaBody", "about", "educationServices", "healthServices", "activityServices", "goals", "address" }.SelectMany(k => new[] { k + "Ar", k + "En" }).Concat(["phone", "email", "registration", "heroVisual"]).ToHashSet();
    public static void MapSiteContentEndpoints(this WebApplication app)
    {
        app.MapGet("/api/v1/site-content", async (AppDbContext db) => { var d = await db.SiteDocuments.AsNoTracking().SingleOrDefaultAsync(); return Results.Ok(new { values = d is null ? new Dictionary<string, string>() : JsonSerializer.Deserialize<Dictionary<string, string>>(d.Values), version = d?.Version ?? 0 }); });
        var admin = Access.Admin(app, "/api/v1/admin/site-content");
        admin.MapPut("", async (SiteContentInput input, HttpContext ctx, AppDbContext db) =>
        {
            if (input.Values is null || input.Values.Count > Keys.Count || input.Values.Any(v => !Keys.Contains(v.Key) || v.Value is null || v.Value.Length > 4000)) return Results.BadRequest();
            if (input.Values.TryGetValue("heroVisual", out var heroVisual) && heroVisual is not ("Reference" or "Media")) return Results.BadRequest();
            if (input.Values.TryGetValue("email", out var email) && email.Length > 0 && !new EmailAddressAttribute().IsValid(email)) return Results.Problem(statusCode: 400, title: "Enter a valid contact email.");
            if (input.Values.TryGetValue("phone", out var phone) && phone.Length > 0 && (phone.Length > 30 || phone.Any(c => !char.IsAsciiDigit(c) && !"+ ()-".Contains(c)))) return Results.BadRequest();
            var d = await db.SiteDocuments.SingleOrDefaultAsync(); var conflict = Access.Match(ctx, d?.Version ?? 0); if (conflict is not null) return conflict;
            if (d is null) { d = new SiteDocument(); db.SiteDocuments.Add(d); } else d.Version++;
            d.Values = JsonSerializer.Serialize(input.Values.ToDictionary(v => v.Key, v => v.Value.Trim())); Access.Audit(db, ctx, "site.updated", Guid.Empty);
            try { await db.SaveChangesAsync(); return Results.Ok(new { values = input.Values, version = d.Version }); } catch (DbUpdateConcurrencyException) { return Results.Problem(statusCode: 412, title: "Settings changed elsewhere. Reload first."); }
        });
    }
}
