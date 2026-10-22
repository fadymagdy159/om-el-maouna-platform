using System.Text.RegularExpressions;

namespace OmElMaouna.Api.Features.Content;

public sealed record TranslationInput(string Locale, string Slug, string Title, string Summary, string Body, string EligibilityText = "");
public sealed record ProgramInput(string Category, bool AcceptsSupportRequests, int SortOrder, List<TranslationInput> Translations);

public static partial class ProgramRules
{
    public static readonly string[] Categories = ["Education", "Health", "Development", "Skills"];
    public static Dictionary<string, string[]> Validate(ProgramInput input, bool publishing = false)
    {
        var errors = new Dictionary<string, string[]>();
        if (!Categories.Contains(input.Category)) errors["category"] = ["Select a valid category."];
        if (input.SortOrder is < 0 or > 1000) errors["sortOrder"] = ["Sort order must be between 0 and 1000."];
        if (input.Translations is null || input.Translations.Count != 2 || !input.Translations.Select(t => t.Locale).Order().SequenceEqual(new[] { "ar", "en" }))
        {
            errors["translations"] = ["Provide one Arabic and one English translation."];
            return errors;
        }
        foreach (var t in input.Translations)
        {
            var key = $"translations.{t.Locale}";
            if (string.IsNullOrWhiteSpace(t.Title) || t.Title.Length > 150) errors[$"{key}.title"] = ["Title is required (maximum 150 characters)."];
            if (string.IsNullOrWhiteSpace(t.Slug) || t.Slug.Length > 120 || !SlugPattern().IsMatch(t.Slug)) errors[$"{key}.slug"] = ["Use letters, numbers and single hyphens (maximum 120 characters)."];
            if (t.Summary is null || t.Summary.Length > 500 || (publishing && string.IsNullOrWhiteSpace(t.Summary))) errors[$"{key}.summary"] = ["Summary is required for publishing (maximum 500 characters)."];
            if (t.Body is null || t.Body.Length > 20000 || (publishing && string.IsNullOrWhiteSpace(t.Body))) errors[$"{key}.body"] = ["Body is required for publishing (maximum 20000 characters)."];
            if (t.EligibilityText is null || t.EligibilityText.Length > 4000) errors[$"{key}.eligibilityText"] = ["Maximum 4000 characters."];
        }
        return errors;
    }

    public static ProgramInput ToInput(FoundationProgram program) => new(program.Category, program.AcceptsSupportRequests, program.SortOrder,
        program.Translations.Select(t => new TranslationInput(t.Locale, t.Slug, t.Title, t.Summary, t.Body, t.EligibilityText)).ToList());

    [GeneratedRegex(@"^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex SlugPattern();
}
