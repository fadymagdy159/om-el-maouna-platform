namespace OmElMaouna.Api.Features.Content;

public sealed class FoundationProgram
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Category { get; set; } = "Education";
    public string Status { get; set; } = "Draft";
    public bool AcceptsSupportRequests { get; set; }
    public int SortOrder { get; set; }
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? PublishedAt { get; set; }
    public List<ProgramTranslation> Translations { get; set; } = [];
}

public sealed class ProgramTranslation
{
    public Guid ProgramId { get; set; }
    public string Locale { get; set; } = "ar";
    public string Slug { get; set; } = "";
    public string Title { get; set; } = "";
    public string Summary { get; set; } = "";
    public string Body { get; set; } = "";
    public string EligibilityText { get; set; } = "";
}

public sealed class AuditEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ActorUserId { get; set; }
    public string Action { get; set; } = "";
    public Guid EntityId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
