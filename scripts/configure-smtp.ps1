param(
    [Parameter(Mandatory=$true)][string]$HostName,
    [Parameter(Mandatory=$true)][string]$From,
    [Parameter(Mandatory=$true)][string]$UserName,
    [Parameter(Mandatory=$true)][string]$WebsiteOrigin,
    [int]$Port=587
)
. "$PSScriptRoot\environment.ps1"
if ($Port -notin @(465,587)) { throw 'Use a TLS SMTP port: 465 or 587.' }
$originUri = [uri]$WebsiteOrigin
if (-not $originUri.IsAbsoluteUri -or $originUri.Scheme -notin @('http','https')) { throw 'Supply the full website origin, without a page path.' }
$protectedPassword = Read-Host 'SMTP password (hidden input; do not paste it into chat)' -AsSecureString
$password = [Net.NetworkCredential]::new('', $protectedPassword).Password
try {
    @{'Smtp:Host'=$HostName;'Smtp:Port'=$Port;'Smtp:From'=$From;'Smtp:Username'=$UserName;'Smtp:Password'=$password;'Website:Origin'=$WebsiteOrigin.TrimEnd('/')} | ConvertTo-Json | & dotnet user-secrets set --project (Join-Path (Split-Path $PSScriptRoot -Parent) 'apps\api')
    if ($LASTEXITCODE -ne 0) { throw 'Could not store SMTP settings.' }
    Write-Host 'Settings saved in local user secrets. Restart the API to load them. This command sends no messages.'
} finally { $password=$null }
