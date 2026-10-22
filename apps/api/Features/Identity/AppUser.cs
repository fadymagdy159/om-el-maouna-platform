using Microsoft.AspNetCore.Identity;

namespace OmElMaouna.Api.Features.Identity;

public sealed class AppUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = "";
    public string PreferredLocale { get; set; } = "ar";
    public bool IsAdministrator { get; set; }
    public bool IsDisabled { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public byte[]? Avatar { get; set; }
    public Guid? AvatarVersion { get; set; }
}
