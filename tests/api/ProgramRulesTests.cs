using OmElMaouna.Api.Features.Content;

namespace OmElMaouna.Api.Tests;

public class ProgramRulesTests
{
    public static ProgramInput Valid(string slug = "a-program") => new("Education", false, 0,
        [new("ar", slug, "برنامج تعليمي", "ملخص البرنامج", "تفاصيل البرنامج"), new("en", slug, "Learning program", "Program summary", "Program details")]);
    [Fact]
    public void Publishing_requires_both_complete_translations()
    {
        var input = Valid();
        Assert.Empty(ProgramRules.Validate(input, true));
        input.Translations[1] = input.Translations[1] with { Body = "" };
        Assert.NotEmpty(ProgramRules.Validate(input, true));
        Assert.Empty(ProgramRules.Validate(input, false));
    }
    [Fact]
    public void Duplicate_locales_and_path_like_slugs_are_rejected()
    {
        var input = Valid();
        input.Translations[1] = input.Translations[1] with { Locale = "ar" };
        Assert.Contains("translations", ProgramRules.Validate(input).Keys);
        input = Valid("../admin");
        Assert.NotEmpty(ProgramRules.Validate(input));
    }
    [Theory]
    [InlineData("../x")]
    [InlineData("bad--slug")]
    [InlineData("x?admin=true")]
    [InlineData("with space")]
    public void Slug_rejects_unsafe_or_unstable_values(string slug) => Assert.NotEmpty(ProgramRules.Validate(Valid(slug)));
    [Fact]
    public void Missing_translations_and_invalid_category_are_rejected()
    {
        Assert.NotEmpty(ProgramRules.Validate(new("Owner", false, 0, [])));
        Assert.NotEmpty(ProgramRules.Validate(Valid() with { SortOrder = -1 }));
    }
}
