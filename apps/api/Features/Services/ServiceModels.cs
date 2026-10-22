namespace OmElMaouna.Api.Features.Services;

public sealed class ServiceRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Reference { get; set; } = "MA-" + Guid.NewGuid().ToString("N")[..12].ToUpperInvariant();
    public Guid SubmissionKey { get; set; }
    public Guid? OwnerId { get; set; }
    public string Kind { get; set; } = "Contact";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Description { get; set; } = "";
    public bool ConsentGiven { get; set; }
    public string? ChildName { get; set; }
    public DateOnly? ChildDateOfBirth { get; set; }
    public string? EducationStage { get; set; }
    public string? Skills { get; set; }
    public string? Availability { get; set; }
    public string State { get; set; } = "Submitted";
    public long Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<RequestReply> Replies { get; set; } = [];
}
public sealed class RequestReply
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RequestId { get; set; }
    public bool FromAdmin { get; set; }
    public string Text { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class MailItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string To { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Html { get; set; } = "";
    public string State { get; set; } = "Pending";
    public int Attempts { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset RetryAfter { get; set; } = DateTimeOffset.UtcNow;
}
