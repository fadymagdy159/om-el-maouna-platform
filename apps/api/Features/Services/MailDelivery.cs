using System.Net;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using MimeKit;
using OmElMaouna.Api.Infrastructure.Persistence;
namespace OmElMaouna.Api.Features.Services;

public static class MailDelivery
{
    public static string Encode(string text) => WebUtility.HtmlEncode(text);
    public static bool IsLocal(IConfiguration config, IHostEnvironment env) => env.IsDevelopment() && (config.GetValue<bool>("Mail:ForceLocal") || string.IsNullOrWhiteSpace(config["Smtp:Host"]));
    public static void Queue(AppDbContext db, string to, string subject, string text, string? link = null) => db.MailItems.Add(new MailItem { To = to, Subject = subject, Html = $"<html lang='ar' dir='rtl'><meta charset='utf-8'><h2>أم المعونة</h2><p style='white-space:pre-wrap'>{Encode(text)}</p>" + (link is null ? "" : $"<p><a href='{Encode(link)}'>فتح الرابط / Open link</a></p>") + "</html>" });
    public static string Origin(IConfiguration config) => (config["Website:Origin"] ?? "http://127.0.0.1:3000").TrimEnd('/');
    public static async Task<string> FoundationRecipient(AppDbContext db, IConfiguration config)
    {
        if (!string.IsNullOrWhiteSpace(config["Foundation:Email"])) return config["Foundation:Email"]!;
        var document = await db.SiteDocuments.AsNoTracking().SingleOrDefaultAsync();
        if (document is not null) { var values = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(document.Values); if (values is not null && values.TryGetValue("email", out var email) && new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(email)) return email; }
        return "contact@example.invalid";
    }
}

public sealed class MailWorker(IServiceScopeFactory scopes, IConfiguration config, IWebHostEnvironment env, ILogger<MailWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (config.GetValue<bool>("Mail:DisableWorker")) return;
        while (!ct.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var messages = await db.MailItems.Where(m => m.State == "Pending" && m.RetryAfter <= DateTimeOffset.UtcNow && m.Attempts < 5).OrderBy(m => m.CreatedAt).Take(10).ToListAsync(ct);
                foreach (var message in messages)
                {
                    try
                    {
                        if (MailDelivery.IsLocal(config, env))
                        {
                            var directory = config["Mail:PickupDirectory"] ?? Path.Combine(env.ContentRootPath, "App_Data", "mail");
                            Directory.CreateDirectory(directory);
                            await File.WriteAllTextAsync(Path.Combine(directory, $"{message.CreatedAt:yyyyMMdd-HHmmss}-{message.Id}.html"), $"<!-- Local development preview; NOT sent. To: {MailDelivery.Encode(message.To)} -->\n{message.Html}", ct);
                            message.State = "LocalPreview";
                        }
                        else
                        {
                            var host = config["Smtp:Host"] ?? throw new InvalidOperationException("SMTP is not configured.");
                            var mime = new MimeMessage();
                            mime.From.Add(MailboxAddress.Parse(config["Smtp:From"] ?? throw new InvalidOperationException("Sender missing.")));
                            mime.To.Add(MailboxAddress.Parse(message.To)); mime.Subject = message.Subject;
                            mime.Body = new TextPart("html") { Text = message.Html };
                            using var smtp = new SmtpClient();
                            await smtp.ConnectAsync(host, config.GetValue("Smtp:Port", 587), config.GetValue("Smtp:Port", 587) == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls, ct);
                            if (!string.IsNullOrEmpty(config["Smtp:Username"])) await smtp.AuthenticateAsync(config["Smtp:Username"]!, config["Smtp:Password"] ?? throw new InvalidOperationException("SMTP password missing."), ct);
                            await smtp.SendAsync(mime, ct); await smtp.DisconnectAsync(true, ct); message.State = "Sent";
                        }
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    { message.Attempts++; message.RetryAfter = DateTimeOffset.UtcNow.AddMinutes(Math.Pow(2, message.Attempts)); logger.LogWarning("Mail delivery {Id} will retry; no recipient or body logged.", message.Id); }
                    await db.SaveChangesAsync(ct);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogWarning("Mail queue is temporarily unavailable ({ErrorType}).", ex.GetType().Name); }
            await Task.Delay(TimeSpan.FromSeconds(3), ct);
        }
    }
}
