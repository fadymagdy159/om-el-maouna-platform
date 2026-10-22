using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using OmElMaouna.Api.Features.Content;
using OmElMaouna.Api.Features.Identity;
using OmElMaouna.Api.Features.Services;

namespace OmElMaouna.Api.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<FoundationProgram> Programs => Set<FoundationProgram>();
    public DbSet<AuditEntry> AuditLogs => Set<AuditEntry>();
    public DbSet<MediaAsset> MediaAssets => Set<MediaAsset>();
    public DbSet<ServiceRequest> ServiceRequests => Set<ServiceRequest>();
    public DbSet<RequestReply> RequestReplies => Set<RequestReply>();
    public DbSet<MailItem> MailItems => Set<MailItem>();
    public DbSet<SiteDocument> SiteDocuments => Set<SiteDocument>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<MediaAsset>(e => { e.Property(m => m.Version).IsConcurrencyToken(); e.HasIndex(m => m.SourceKey).IsUnique(); e.HasIndex(m => m.IsHero).IsUnique().HasFilter("\"IsHero\" = TRUE"); e.Property(m => m.TitleAr).HasMaxLength(150); e.Property(m => m.TitleEn).HasMaxLength(150); e.Property(m => m.AltAr).HasMaxLength(500); e.Property(m => m.AltEn).HasMaxLength(500); });
        builder.Entity<SiteDocument>().Property(x => x.Version).IsConcurrencyToken();
        builder.Entity<ServiceRequest>(e => { e.Property(r => r.Version).IsConcurrencyToken(); e.HasIndex(r => r.SubmissionKey).IsUnique(); e.HasIndex(r => r.Reference).IsUnique(); e.HasIndex(r => new { r.OwnerId, r.CreatedAt }); e.HasOne<AppUser>().WithMany().HasForeignKey(r => r.OwnerId).OnDelete(DeleteBehavior.Restrict); e.HasMany(r => r.Replies).WithOne().HasForeignKey(x => x.RequestId).OnDelete(DeleteBehavior.Cascade); });
        builder.Entity<MailItem>().HasIndex(m => new { m.State, m.RetryAfter });
        builder.Entity<AppUser>(e =>
        {
            e.Property(u => u.DisplayName).HasMaxLength(100);
            e.Property(u => u.PreferredLocale).HasMaxLength(2);
            e.Property(u => u.Gender).HasMaxLength(10);
            e.Property(u => u.PhoneNumber).HasMaxLength(30);
            e.HasIndex(u => u.NormalizedEmail).IsUnique();
            e.HasIndex(u => u.IsAdministrator).IsUnique().HasFilter("\"IsAdministrator\" = TRUE");
        });
        builder.Entity<FoundationProgram>(e =>
        {
            e.Property(p => p.Category).HasMaxLength(30);
            e.Property(p => p.Status).HasMaxLength(20);
            e.Property(p => p.Version).IsConcurrencyToken();
            e.HasIndex(p => new { p.Status, p.SortOrder });
            e.HasMany(p => p.Translations).WithOne().HasForeignKey(t => t.ProgramId).OnDelete(DeleteBehavior.Cascade);
        });
        builder.Entity<ProgramTranslation>(e =>
        {
            e.HasKey(t => new { t.ProgramId, t.Locale });
            e.Property(t => t.Locale).HasMaxLength(2);
            e.Property(t => t.Slug).HasMaxLength(120);
            e.Property(t => t.Title).HasMaxLength(150);
            e.Property(t => t.Summary).HasMaxLength(500);
            e.Property(t => t.Body).HasMaxLength(20000);
            e.Property(t => t.EligibilityText).HasMaxLength(4000);
            e.HasIndex(t => new { t.Locale, t.Slug }).IsUnique();
        });
        builder.Entity<AuditEntry>().Property(a => a.Action).HasMaxLength(80);
    }
}
