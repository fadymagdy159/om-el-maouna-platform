using Microsoft.EntityFrameworkCore;
using OmElMaouna.Api.Features.Content;

namespace OmElMaouna.Api.Infrastructure.Persistence;

public static class DevelopmentSeed
{
    public static async Task RunAsync(AppDbContext db)
    {
        if (await db.Programs.AnyAsync()) { Console.WriteLine("Programs already exist; no development content was added."); return; }
        var admin = await db.Users.SingleAsync(u => u.IsAdministrator);
        var records = new[]
        {
            new { Category="Education", Slug="education", ArTitle="التعليم", EnTitle="Education", ArSummary="فرص للتعلّم، وأدوات للنجاح، ودعم مستمر في كل خطوة.", EnSummary="Learning opportunities, tools for success, and support at every step.", ArBody="نؤمن بأن التعليم يفتح أبواب المستقبل. يشمل مجال التعليم دعم المصروفات والكتب والأدوات، والمتابعة التعليمية، والأنشطة التي تشجع التفكير والاجتهاد.\nتُراجع تفاصيل الخدمات وآليات تقديمها مع المؤسسة قبل الإطلاق العام.", EnBody="Education opens doors to the future. This area includes support for school expenses, learning materials, educational follow-up, and activities that encourage thinking and effort.\nService details and application arrangements will be confirmed with the foundation before public launch." },
            new { Category="Health", Slug="health", ArTitle="الصحة", EnTitle="Health", ArSummary="مساندة صحية تساعد الطفل والأسرة على استكمال رحلتهم.", EnSummary="Health support that helps children and families continue their journey.", ArBody="تدعم رسالة المؤسسة وصول الأطفال والأسر إلى الرعاية الصحية الضرورية، وفق الاحتياج والإمكانات المتاحة.\nهذه نسخة تطوير للمحتوى، وتؤكد المؤسسة تفاصيل خدماتها قبل النشر العام.", EnBody="The foundation's mission supports access to essential health care for children and families, according to need and available resources.\nThis is development content; the foundation will confirm service details before public launch." },
            new { Category="Development", Slug="personal-development", ArTitle="التربية والدعم النفسي", EnTitle="Personal development", ArSummary="نبني الثقة، وننمي الشخصية، وندعم دور الأسرة.", EnSummary="Building confidence and character while supporting families.", ArBody="ندعم فهم المشاعر وبناء الشخصية والتوعية الأسرية، من خلال أنشطة وندوات تهتم بالطفل والأسرة معًا.\nيُستكمل المحتوى بصور الأنشطة الفعلية وبياناتها المعتمدة.", EnBody="Activities and family-awareness sessions help children understand emotions, develop confidence, and build character.\nApproved activity details and real photographs will be added before launch." },
            new { Category="Skills", Slug="skills", ArTitle="تنمية المهارات", EnTitle="Skills & discovery", ArSummary="التعلّم باللعب والأنشطة، لاكتشاف مواهب وقدرات جديدة.", EnSummary="Learning through play and activities to discover new talents.", ArBody="الألعاب التعليمية والأنشطة الجماعية والترفيه فرص لاكتشاف قدرات الأطفال وتنمية مهاراتهم الاجتماعية والفكرية.\nتُعلن تفاصيل الأنشطة المتاحة من خلال المؤسسة.", EnBody="Learning games, group activities, and recreation create opportunities to discover talents and develop social and thinking skills.\nAvailable activities will be announced by the foundation." }
        };
        for (var i = 0; i < records.Length; i++)
        {
            var r = records[i];
            var p = new FoundationProgram
            {
                Category = r.Category,
                SortOrder = i,
                Status = "Published",
                PublishedAt = DateTimeOffset.UtcNow,
                Translations = [new() { Locale = "ar", Slug = r.Slug, Title = r.ArTitle, Summary = r.ArSummary, Body = r.ArBody }, new() { Locale = "en", Slug = r.Slug, Title = r.EnTitle, Summary = r.EnSummary, Body = r.EnBody }]
            };
            db.Programs.Add(p);
            db.AuditLogs.Add(new AuditEntry { ActorUserId = admin.Id, EntityId = p.Id, Action = "development.seed" });
        }
        await db.SaveChangesAsync();
        Console.WriteLine("Four development program entries added. Real institutional content must be reviewed before public launch.");
    }
}
