using System.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OmElMaouna.Api.Features.Identity;
using OmElMaouna.Api.Features.Services;
using OmElMaouna.Api.Infrastructure.Persistence;
using SkiaSharp;
namespace OmElMaouna.Api.Features.Content;

public sealed class MediaAsset
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string? SourceKey { get; set; }
    public string Kind { get; set; } = "Photo";
    public string StorageKey { get; set; } = "";
    public string? PosterKey { get; set; }
    public string TitleAr { get; set; } = "";
    public string TitleEn { get; set; } = "";
    public string AltAr { get; set; } = "";
    public string AltEn { get; set; } = "";
    public string Category { get; set; } = "Skills";
    public int Width { get; set; }
    public int Height { get; set; }
    public double Seconds { get; set; }
    public bool IsPublished { get; set; }
    public bool IsHero { get; set; }
    public bool IsDeleted { get; set; }
    public int SortOrder { get; set; }
    public long Version { get; set; } = 1;
}
public sealed record MediaInput(string TitleAr, string TitleEn, string AltAr, string AltEn, string Category, bool IsPublished, int SortOrder);

public static class MediaEndpoints
{
    public static string Root(IConfiguration c, IWebHostEnvironment e) => Path.GetFullPath(c["Media:Root"] ?? Path.Combine(e.ContentRootPath, "App_Data", "media"));
    public static void MapMediaEndpoints(this WebApplication app)
    {
        app.MapGet("/api/v1/media", async (AppDbContext db) => Results.Ok(new { items = (await db.MediaAssets.AsNoTracking().Where(m => m.IsPublished && !m.IsDeleted).OrderBy(m => m.SortOrder).ThenBy(m => m.Id).Take(200).ToListAsync()).Select(View) }));
        app.MapGet("/api/v1/media/{id:guid}/{part}", async (Guid id, string part, HttpContext ctx, UserManager<AppUser> users, AppDbContext db, IConfiguration config, IWebHostEnvironment env) =>
        {
            if (part is not ("file" or "poster")) return Results.NotFound();
            var m = await db.MediaAssets.AsNoTracking().SingleOrDefaultAsync(m => m.Id == id && !m.IsDeleted); if (m is null) return Results.NotFound();
            if (!m.IsPublished) { var u = await users.GetUserAsync(ctx.User); if (u is null || !u.IsAdministrator || u.IsDisabled || !u.TwoFactorEnabled || !ctx.User.HasClaim("amr", "mfa")) return Results.NotFound(); ctx.Response.Headers.CacheControl = "private, no-store"; }
            else ctx.Response.Headers.CacheControl = "public, max-age=0, must-revalidate";
            var key = part == "poster" ? m.PosterKey : m.StorageKey; if (key is null) return Results.NotFound();
            var file = Path.Combine(Root(config, env), Path.GetFileName(key)); if (!File.Exists(file)) return Results.NotFound();
            return Results.File(file, part == "poster" || m.Kind == "Photo" ? "image/jpeg" : "video/mp4", enableRangeProcessing: true);
        });
        var admin = Access.Admin(app, "/api/v1/admin/media");
        admin.MapGet("", async (AppDbContext db) => Results.Ok((await db.MediaAssets.AsNoTracking().Where(m => !m.IsDeleted).OrderBy(m => m.SortOrder).ThenBy(m => m.Id).Take(200).ToListAsync()).Select(View)));
        admin.MapPost("", async (HttpContext ctx, AppDbContext db, IConfiguration config, IWebHostEnvironment env, CancellationToken ct) =>
        {
            if (!ctx.Request.HasFormContentType) return Invalid("Upload a photo or MP4 video.");
            var form = await ctx.Request.ReadFormAsync(ct); var file = form.Files.GetFile("file");
            if (file is null || file.Length is < 1 or > 31457280) return Invalid("Photo limit: 8 MB. Video limit: 30 MB.");
            var kind = form["kind"].ToString(); if (kind is not ("Photo" or "Video")) return Invalid("Choose Photo or Video.");
            var input = new MediaInput(form["titleAr"].ToString(), form["titleEn"].ToString(), form["altAr"].ToString(), form["altEn"].ToString(), form["category"].ToString(), false, 0);
            if (!Valid(input)) return Invalid("Add Arabic and English titles and descriptions, and choose a category.");
            var root = Root(config, env); Directory.CreateDirectory(root);
            var m = new MediaAsset { Kind = kind }; var key = m.Id.ToString("N") + (kind == "Photo" ? ".jpg" : ".mp4"); var target = Path.Combine(root, key); var saved = false;
            try
            {
                if (kind == "Photo")
                {
                    if (file.Length > 8 * 1024 * 1024) return Invalid("Photos must be 8 MB or smaller.");
                    await using var stream = file.OpenReadStream(); using var memory = new MemoryStream(); await stream.CopyToAsync(memory, ct); memory.Position = 0;
                    using var codec = SKCodec.Create(memory);
                    if (codec is null || codec.Info.Width > 8192 || codec.Info.Height > 8192 || (long)codec.Info.Width * codec.Info.Height > 24000000 || codec.EncodedFormat is not (SKEncodedImageFormat.Jpeg or SKEncodedImageFormat.Png or SKEncodedImageFormat.Webp)) return Invalid("Choose a valid JPG, PNG or WebP photo.");
                    using var image = SKBitmap.Decode(codec); if (image is null) return Invalid("Unable to decode this photo.");
                    using var oriented = codec.EncodedOrigin == SKEncodedOrigin.TopLeft ? null : Orient(image, codec.EncodedOrigin); var source = oriented ?? image;
                    var scale = Math.Min(1, 1600d / Math.Max(source.Width, source.Height)); m.Width = Math.Max(1, (int)(source.Width * scale)); m.Height = Math.Max(1, (int)(source.Height * scale));
                    using var resized = new SKBitmap(m.Width, m.Height); using (var canvas = new SKCanvas(resized)) { canvas.Clear(SKColors.White); canvas.DrawBitmap(source, new SKRect(0, 0, m.Width, m.Height), new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.None)); }
                    using var encoded = resized.Encode(SKEncodedImageFormat.Jpeg, 85); await File.WriteAllBytesAsync(target, encoded.ToArray(), ct);
                }
                else
                {
                    await using (var output = File.Create(target)) { await file.CopyToAsync(output, ct); }
                    await using (var stream = File.OpenRead(target)) { var header = new byte[12]; if (await stream.ReadAsync(header, ct) != 12 || System.Text.Encoding.ASCII.GetString(header, 4, 4) != "ftyp") return Invalid("Choose a valid MP4 video."); }
                    var probe = await Run("ffprobe", ["-v", "quiet", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", target], ct);
                    using var info = JsonDocument.Parse(probe); var s = info.RootElement.GetProperty("streams")[0]; m.Width = s.GetProperty("width").GetInt32(); m.Height = s.GetProperty("height").GetInt32(); m.Seconds = double.Parse(info.RootElement.GetProperty("format").GetProperty("duration").GetString()!, System.Globalization.CultureInfo.InvariantCulture);
                    if (m.Width > 3840 || m.Height > 3840 || m.Seconds is <= 0 or > 600) return Invalid("Videos must be under 10 minutes and no larger than 4K.");
                    m.PosterKey = m.Id.ToString("N") + "-poster.jpg";
                    await Run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", Math.Min(1, m.Seconds / 2).ToString(System.Globalization.CultureInfo.InvariantCulture), "-i", target, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "4", Path.Combine(root, m.PosterKey)], ct);
                }
                m.StorageKey = key; Apply(m, input); db.MediaAssets.Add(m); Access.Audit(db, ctx, "media.created", m.Id);
                await db.SaveChangesAsync(ct); saved = true; return Results.Created($"/api/v1/admin/media/{m.Id}", View(m));
            }
            catch (Exception ex) when (ex is JsonException or InvalidOperationException or ArgumentException or System.ComponentModel.Win32Exception or KeyNotFoundException) { return Invalid("Could not process the file. Check its format; video uploads require FFmpeg on the server."); }
            finally { if (!saved) { if (File.Exists(target)) File.Delete(target); if (m.PosterKey is not null) { var poster = Path.Combine(root, m.PosterKey); if (File.Exists(poster)) File.Delete(poster); } } }
        }).WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(33 * 1024 * 1024));
        admin.MapPut("/{id:guid}", async (Guid id, MediaInput input, HttpContext ctx, AppDbContext db) =>
        {
            var m = await db.MediaAssets.SingleOrDefaultAsync(m => m.Id == id && !m.IsDeleted); if (m is null) return Results.NotFound(); var conflict = Access.Match(ctx, m.Version); if (conflict is not null) return conflict;
            if (!Valid(input)) return Invalid("Add complete Arabic and English titles and descriptions."); Apply(m, input); m.Version++; Access.Audit(db, ctx, "media.updated", id); return await Save(db) ?? Results.Ok(View(m));
        });
        admin.MapPost("/{id:guid}/hero", async (Guid id, HttpContext ctx, AppDbContext db) =>
        {
            var m = await db.MediaAssets.SingleOrDefaultAsync(m => m.Id == id && !m.IsDeleted && m.Kind == "Photo" && m.IsPublished); if (m is null) return Results.NotFound(); var conflict = Access.Match(ctx, m.Version); if (conflict is not null) return conflict;
            await using var tx = await db.Database.BeginTransactionAsync(); await db.MediaAssets.Where(x => x.IsHero && x.Id != id).ExecuteUpdateAsync(s => s.SetProperty(x => x.IsHero, false).SetProperty(x => x.Version, x => x.Version + 1)); m.IsHero = true; m.Version++; Access.Audit(db, ctx, "media.hero", id); var failure = await Save(db); if (failure is not null) return failure; await tx.CommitAsync(); return Results.Ok(View(m));
        });
        admin.MapDelete("/{id:guid}", async (Guid id, HttpContext ctx, AppDbContext db) =>
        {
            var m = await db.MediaAssets.SingleOrDefaultAsync(m => m.Id == id && !m.IsDeleted); if (m is null) return Results.NotFound(); var conflict = Access.Match(ctx, m.Version); if (conflict is not null) return conflict; m.IsDeleted = true; m.IsPublished = false; m.IsHero = false; m.Version++; Access.Audit(db, ctx, "media.removed", id); return await Save(db) ?? Results.NoContent();
        });
    }
    private static void Apply(MediaAsset m, MediaInput i) { m.TitleAr = i.TitleAr.Trim(); m.TitleEn = i.TitleEn.Trim(); m.AltAr = i.AltAr.Trim(); m.AltEn = i.AltEn.Trim(); m.Category = i.Category; m.IsPublished = i.IsPublished; m.SortOrder = i.SortOrder; if (!m.IsPublished) m.IsHero = false; }
    private static bool Valid(MediaInput i) => i.TitleAr?.Trim().Length is > 0 and <= 150 && i.TitleEn?.Trim().Length is > 0 and <= 150 && i.AltAr?.Trim().Length is > 0 and <= 500 && i.AltEn?.Trim().Length is > 0 and <= 500 && i.Category is ("Learning" or "Skills" or "Events" or "Trips") && i.SortOrder is >= 0 and <= 10000;
    public static object View(MediaAsset m) => new { m.Id, m.SourceKey, m.Kind, m.Category, m.Width, m.Height, m.Seconds, m.IsHero, m.IsPublished, m.SortOrder, m.Version, src = $"/api/v1/media/{m.Id}/file?v={m.Version}", poster = m.PosterKey is null ? null : $"/api/v1/media/{m.Id}/poster?v={m.Version}", title = new { ar = m.TitleAr, en = m.TitleEn }, alt = new { ar = m.AltAr, en = m.AltEn } };
    private static IResult Invalid(string title) => Results.Problem(statusCode: 400, title: title);
    private static SKBitmap Orient(SKBitmap source, SKEncodedOrigin origin)
    {
        var w = source.Width; var h = source.Height; var swap = (int)origin >= 5; var output = new SKBitmap(swap ? h : w, swap ? w : h);
        var (a, b, c, d, x, y) = origin switch { SKEncodedOrigin.TopRight => (-1f, 0f, 0f, 1f, (float)w, 0f), SKEncodedOrigin.BottomRight => (-1f, 0f, 0f, -1f, (float)w, (float)h), SKEncodedOrigin.BottomLeft => (1f, 0f, 0f, -1f, 0f, (float)h), SKEncodedOrigin.LeftTop => (0f, 1f, 1f, 0f, 0f, 0f), SKEncodedOrigin.RightTop => (0f, -1f, 1f, 0f, (float)h, 0f), SKEncodedOrigin.RightBottom => (0f, -1f, -1f, 0f, (float)h, (float)w), SKEncodedOrigin.LeftBottom => (0f, 1f, -1f, 0f, 0f, (float)w), _ => (1f, 0f, 0f, 1f, 0f, 0f) };
        using var canvas = new SKCanvas(output); canvas.SetMatrix(new SKMatrix { ScaleX = a, SkewX = b, SkewY = c, ScaleY = d, TransX = x, TransY = y, Persp2 = 1 }); canvas.DrawBitmap(source, 0, 0, new SKSamplingOptions(SKFilterMode.Nearest, SKMipmapMode.None)); return output;
    }
    private static async Task<IResult?> Save(AppDbContext db) { try { await db.SaveChangesAsync(); return null; } catch (DbUpdateConcurrencyException) { return Results.Problem(statusCode: 412, title: "Media changed elsewhere. Reload first."); } }
    private static async Task<string> Run(string command, string[] arguments, CancellationToken ct)
    {
        var start = new ProcessStartInfo(command) { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true }; foreach (var a in arguments) start.ArgumentList.Add(a);
        using var process = Process.Start(start) ?? throw new InvalidOperationException("Media tool unavailable."); using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromSeconds(45));
        var output = process.StandardOutput.ReadToEndAsync(timeout.Token); var error = process.StandardError.ReadToEndAsync(timeout.Token);
        try { await process.WaitForExitAsync(timeout.Token); var text = await output; await error; if (process.ExitCode != 0) throw new InvalidOperationException("Media decoding failed."); return text; } catch (OperationCanceledException) { if (!process.HasExited) process.Kill(true); throw; }
    }
    public static async Task ImportAsync(AppDbContext db, IConfiguration config, IWebHostEnvironment env)
    {
        var project = Path.GetFullPath(Path.Combine(env.ContentRootPath, "../..")); var manifest = Path.Combine(project, "design/media/selection.json"); if (!File.Exists(manifest)) return;
        using var document = JsonDocument.Parse(await File.ReadAllTextAsync(manifest)); var root = Root(config, env); Directory.CreateDirectory(root); int order = 0;
        foreach (var p in document.RootElement.GetProperty("photos").EnumerateArray())
        {
            var key = p.GetProperty("id").GetString()!; if (await db.MediaAssets.AnyAsync(m => m.SourceKey == key)) continue;
            var m = new MediaAsset { SourceKey = key, Kind = "Photo", TitleAr = p.GetProperty("title").GetProperty("ar").GetString()!, TitleEn = p.GetProperty("title").GetProperty("en").GetString()!, AltAr = p.GetProperty("alt").GetProperty("ar").GetString()!, AltEn = p.GetProperty("alt").GetProperty("en").GetString()!, Category = p.GetProperty("category").GetString()!, Width = p.GetProperty("width").GetInt32(), Height = p.GetProperty("height").GetInt32(), SortOrder = order++, IsPublished = true, IsHero = key == "P003" && !await db.MediaAssets.AnyAsync(x => x.IsHero) };
            m.StorageKey = m.Id.ToString("N") + ".jpg"; File.Copy(Path.Combine(project, "design/media/import-source", Path.GetFileName(p.GetProperty("src").GetString()!)), Path.Combine(root, m.StorageKey), true); db.MediaAssets.Add(m); await db.SaveChangesAsync();
        }
        if (!await db.MediaAssets.AnyAsync(m => m.SourceKey == "learning-moments"))
        {
            var m = new MediaAsset { SourceKey = "learning-moments", Kind = "Video", TitleAr = "لحظات من أنشطتنا التربوية", TitleEn = "Moments from our learning activities", AltAr = "مقتطف من الأنشطة التربوية", AltEn = "An excerpt from our learning activities", Category = "Learning", Width = 640, Height = 480, Seconds = 16, IsPublished = true, SortOrder = 100 }; m.StorageKey = m.Id.ToString("N") + ".mp4"; m.PosterKey = m.Id.ToString("N") + "-poster.jpg";
            var assets = Path.Combine(project, "design/media/import-source"); File.Copy(Path.Combine(assets, "learning-moments.mp4"), Path.Combine(root, m.StorageKey), true); File.Copy(Path.Combine(assets, "learning-moments-poster.jpg"), Path.Combine(root, m.PosterKey), true); db.MediaAssets.Add(m); await db.SaveChangesAsync();
        }
    }
}
