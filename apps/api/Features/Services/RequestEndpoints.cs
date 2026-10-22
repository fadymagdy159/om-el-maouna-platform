using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OmElMaouna.Api.Features.Identity;
using OmElMaouna.Api.Infrastructure.Persistence;
namespace OmElMaouna.Api.Features.Services;

public sealed record RequestInput(Guid SubmissionKey, string Kind, string Phone, string Description, string? ChildName = null, DateOnly? ChildDateOfBirth = null, string? EducationStage = null, string? Skills = null, string? Availability = null, bool Consent = false, string? ContributionType = null);
public sealed record ContactInput(Guid SubmissionKey, string Name, string Email, string? Phone, string Message, bool Consent = false);
public sealed record ReplyInput(string Text);
public sealed record DecisionInput(string State, string Reason);

public static class RequestEndpoints
{
    public static void MapRequestEndpoints(this WebApplication app)
    {
        var member = Access.Member(app, "/api/v1/requests");
        member.MapGet("", async (HttpContext ctx, AppDbContext db) => Results.Ok(await db.ServiceRequests.AsNoTracking().Where(r => r.OwnerId == UserId(ctx)).OrderByDescending(r => r.CreatedAt).Select(r => new { r.Id, r.Reference, r.Kind, r.State, r.Version, r.CreatedAt }).Take(200).ToListAsync()));
        member.MapGet("/{id:guid}", async (Guid id, HttpContext ctx, AppDbContext db) =>
        {
            var r = await db.ServiceRequests.AsNoTracking().Include(r => r.Replies).SingleOrDefaultAsync(r => r.Id == id && r.OwnerId == UserId(ctx));
            return r is null ? Results.NotFound() : Results.Ok(View(r));
        });
        member.MapPost("", async (RequestInput input, HttpContext ctx, UserManager<AppUser> users, AppDbContext db, IConfiguration config, IWebHostEnvironment env) =>
        {
            var user = (await users.GetUserAsync(ctx.User))!;
            if (!input.Consent || input.SubmissionKey == Guid.Empty || input.Kind is not ("Volunteer" or "Enrollment" or "Contribution") || !Phone(input.Phone) || input.Description?.Trim().Length is not (>= 20 and <= 4000)) return Invalid("Confirm your consent, check the phone number and write 20–4000 characters describing your request.");
            if (input.Kind == "Contribution" && input.ContributionType is not ("Financial" or "InKind")) return Invalid("Choose financial or in-kind support.");
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (input.Kind == "Enrollment" && (string.IsNullOrWhiteSpace(input.ChildName) || input.ChildName.Trim().Length > 80 || input.ChildDateOfBirth is null || input.ChildDateOfBirth > today || input.ChildDateOfBirth < today.AddYears(-120) || input.EducationStage is not ("Primary" or "Preparatory" or "Secondary" or "University" or "Other"))) return Invalid("Enter the child's first name, valid birth date and education stage.");
            if (input.Kind == "Volunteer" && (input.Skills?.Trim().Length is not (>= 2 and <= 1000) || input.Availability?.Trim().Length is not (>= 2 and <= 500))) return Invalid("Tell us your skills and availability.");
            var prior = await db.ServiceRequests.SingleOrDefaultAsync(r => r.SubmissionKey == input.SubmissionKey && r.OwnerId == user.Id);
            if (prior is not null) return Results.Ok(new { prior.Id, prior.Reference, delivery = Delivery(config, env) });
            var r = new ServiceRequest
            {
                ConsentGiven = true,
                SubmissionKey = input.SubmissionKey,
                OwnerId = user.Id,
                Name = user.DisplayName,
                Email = user.Email!,
                Phone = input.Phone.Trim(),
                Description = input.Kind == "Contribution" ? (input.ContributionType == "Financial" ? "مساهمة مالية / Financial support\n" : "مساهمة عينية / In-kind support\n") + input.Description.Trim() : input.Description.Trim(),
                Kind = input.Kind,
                ChildName = input.Kind == "Enrollment" ? input.ChildName!.Trim() : null,
                ChildDateOfBirth = input.Kind == "Enrollment" ? input.ChildDateOfBirth : null,
                EducationStage = input.Kind == "Enrollment" ? input.EducationStage : null,
                Skills = input.Kind == "Volunteer" ? input.Skills!.Trim() : null,
                Availability = input.Kind == "Volunteer" ? input.Availability!.Trim() : null
            };
            db.ServiceRequests.Add(r);
            MailDelivery.Queue(db, user.Email!, "أم المعونة — تم تسجيل طلبك / Request received", $"تم تسجيل طلبك برقم {r.Reference}. تسجيل الطلب لا يعني الموافقة. يمكنك متابعة الطلب من حسابك.", MailDelivery.Origin(config) + "/" + user.PreferredLocale + "/account/requests");
            MailDelivery.Queue(db, await MailDelivery.FoundationRecipient(db, config), "أم المعونة — طلب جديد", $"طلب {r.Kind} جديد برقم {r.Reference}. راجعه من لوحة الإدارة.", MailDelivery.Origin(config) + "/ar/admin/requests");
            var failure = await Save(db); return failure ?? Results.Created($"/api/v1/requests/{r.Id}", new { r.Id, r.Reference, delivery = Delivery(config, env) });
        }).RequireRateLimiting("submissions");
        member.MapPost("/{id:guid}/reply", async (Guid id, ReplyInput input, HttpContext ctx, AppDbContext db, IConfiguration config) =>
        {
            var r = await db.ServiceRequests.SingleOrDefaultAsync(r => r.Id == id && r.OwnerId == UserId(ctx)); if (r is null) return Results.NotFound();
            var conflict = Access.Match(ctx, r.Version); if (conflict is not null) return conflict;
            if (r.State != "NeedsInformation") return Results.Problem(statusCode: 409, title: "Replies are available when the foundation requests more information.");
            if (input.Text?.Trim().Length is not (>= 2 and <= 4000)) return Invalid("Write 2–4000 characters.");
            db.RequestReplies.Add(new RequestReply { RequestId = id, Text = input.Text.Trim() }); r.State = "UnderReview"; r.Version++;
            MailDelivery.Queue(db, await MailDelivery.FoundationRecipient(db, config), "أم المعونة — استكمال طلب", $"تم استكمال معلومات الطلب {r.Reference}. راجع لوحة الإدارة.");
            return await Save(db) ?? Results.Ok(new { r.State, r.Version });
        }).RequireRateLimiting("submissions");
        member.MapPost("/{id:guid}/withdraw", async (Guid id, HttpContext ctx, AppDbContext db) =>
        {
            var r = await db.ServiceRequests.SingleOrDefaultAsync(r => r.Id == id && r.OwnerId == UserId(ctx)); if (r is null) return Results.NotFound();
            var conflict = Access.Match(ctx, r.Version); if (conflict is not null) return conflict;
            if (r.State is "Closed" or "Rejected" or "Withdrawn") return Results.Conflict(); r.State = "Withdrawn"; r.Version++;
            return await Save(db) ?? Results.Ok(new { r.State, r.Version });
        });
        app.MapPost("/api/v1/contact", async (ContactInput input, AppDbContext db, IConfiguration config, IWebHostEnvironment env) =>
        {
            if (!input.Consent || input.SubmissionKey == Guid.Empty || input.Name?.Trim().Length is not (>= 2 and <= 100) || input.Email?.Length is not (> 3 and <= 254) || !new EmailAddressAttribute().IsValid(input.Email) || input.Message?.Trim().Length is not (>= 20 and <= 4000) || (!string.IsNullOrWhiteSpace(input.Phone) && !Phone(input.Phone))) return Invalid("Confirm consent and check your name, email, phone and message (20–4000 characters).");
            var prior = await db.ServiceRequests.SingleOrDefaultAsync(r => r.SubmissionKey == input.SubmissionKey && r.Kind == "Contact"); if (prior is not null) return Results.Ok(new { prior.Reference, delivery = Delivery(config, env) });
            var r = new ServiceRequest { ConsentGiven = true, SubmissionKey = input.SubmissionKey, Kind = "Contact", Name = input.Name.Trim(), Email = input.Email.Trim(), Phone = input.Phone?.Trim() ?? "", Description = input.Message.Trim() }; db.ServiceRequests.Add(r);
            MailDelivery.Queue(db, await MailDelivery.FoundationRecipient(db, config), "أم المعونة — رسالة تواصل " + r.Reference, $"من: {r.Name}\nبريد الرد: {r.Email}\n{r.Description}");
            return await Save(db) ?? Results.Created("/api/v1/contact", new { r.Reference, delivery = Delivery(config, env) });
        }).RequireRateLimiting("submissions");
        var admin = Access.Admin(app, "/api/v1/admin/requests");
        admin.MapGet("", async (AppDbContext db, string? kind, string? state) => Results.Ok(await db.ServiceRequests.AsNoTracking().Where(r => (kind == null || r.Kind == kind) && (state == null || r.State == state)).OrderByDescending(r => r.CreatedAt).Select(r => new { r.Id, r.Reference, r.Kind, r.Name, r.State, r.Version, r.CreatedAt }).Take(200).ToListAsync()));
        admin.MapGet("/{id:guid}", async (Guid id, AppDbContext db) => { var r = await db.ServiceRequests.AsNoTracking().Include(r => r.Replies).SingleOrDefaultAsync(r => r.Id == id); return r is null ? Results.NotFound() : Results.Ok(View(r)); });
        admin.MapPost("/{id:guid}/decision", async (Guid id, DecisionInput input, HttpContext ctx, AppDbContext db, IConfiguration config) =>
        {
            var r = await db.ServiceRequests.SingleOrDefaultAsync(r => r.Id == id); if (r is null) return Results.NotFound(); var conflict = Access.Match(ctx, r.Version); if (conflict is not null) return conflict;
            var allowed = r.State switch { "Submitted" => new[] { "UnderReview", "NeedsInformation", "Rejected" }, "UnderReview" => new[] { "NeedsInformation", "Approved", "Rejected", "Closed" }, "NeedsInformation" => new[] { "UnderReview", "Rejected" }, "Approved" => new[] { "Closed" }, "Rejected" or "Closed" => new[] { "UnderReview" }, _ => Array.Empty<string>() };
            if (!allowed.Contains(input.State)) return Results.Problem(statusCode: 409, title: "That status transition is not available.");
            if (input.Reason?.Trim().Length is not (>= 2 and <= 4000)) return Invalid("Write a reason or a message to the applicant.");
            r.State = input.State; r.Version++; db.RequestReplies.Add(new RequestReply { RequestId = id, FromAdmin = true, Text = input.Reason.Trim() }); Access.Audit(db, ctx, "request." + input.State.ToLowerInvariant(), id);
            MailDelivery.Queue(db, r.Email, "أم المعونة — تحديث طلب " + r.Reference, $"تم تحديث طلبك {r.Reference}.\n{input.Reason.Trim()}", r.OwnerId is null ? null : MailDelivery.Origin(config) + "/ar/account/requests");
            return await Save(db) ?? Results.Ok(new { r.State, r.Version });
        });
        admin.MapGet("/mail-status", async (AppDbContext db, IConfiguration config, IWebHostEnvironment env) => Results.Ok(new { mode = Delivery(config, env), pending = await db.MailItems.CountAsync(m => m.State == "Pending"), sent = await db.MailItems.CountAsync(m => m.State == "Sent"), localPreviews = await db.MailItems.CountAsync(m => m.State == "LocalPreview") }));
    }
    private static Guid UserId(HttpContext ctx) => Guid.Parse(ctx.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private static string Delivery(IConfiguration config, IHostEnvironment env) => MailDelivery.IsLocal(config, env) ? "LocalPreview" : "Queued";
    private static bool Phone(string? value) => value is { Length: >= 7 and <= 30 } && value.Count(char.IsAsciiDigit) is >= 7 and <= 15 && value.All(c => char.IsAsciiDigit(c) || "+ ()-".Contains(c));
    private static IResult Invalid(string title) => Results.Problem(statusCode: 400, title: title);
    private static object View(ServiceRequest r) => new { r.Id, r.Reference, r.Kind, r.Name, r.Email, r.Phone, r.Description, r.ChildName, r.ChildDateOfBirth, r.EducationStage, r.Skills, r.Availability, r.State, r.Version, r.CreatedAt, replies = r.Replies.OrderBy(x => x.CreatedAt).Select(x => new { x.Id, x.FromAdmin, x.Text, x.CreatedAt }) };
    private static async Task<IResult?> Save(AppDbContext db) { try { await db.SaveChangesAsync(); return null; } catch (DbUpdateConcurrencyException) { return Results.Problem(statusCode: 412, title: "This request changed elsewhere. Reload first."); } catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" }) { return Results.Problem(statusCode: 409, title: "This submission is already recorded. Check your requests before submitting again."); } }
}
