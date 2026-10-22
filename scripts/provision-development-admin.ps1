. "$PSScriptRoot\environment.ps1"
$projectRoot = Split-Path $PSScriptRoot -Parent
$credentialFile = Join-Path $developmentRoot 'admin.credentials.json'
if (-not (Test-Path -LiteralPath $credentialFile)) {
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $bytes = New-Object byte[] 24; $random.GetBytes($bytes); $password = [Convert]::ToBase64String($bytes) }
    finally { $random.Dispose() }
    @{ email = 'admin@omelmaouna.local'; password = (ConvertFrom-SecureString (ConvertTo-SecureString $password -AsPlainText -Force)) } | ConvertTo-Json | Set-Content -LiteralPath $credentialFile -Encoding utf8
}
$credential = Get-Content -LiteralPath $credentialFile -Raw | ConvertFrom-Json
$password = [Net.NetworkCredential]::new('', (ConvertTo-SecureString $credential.password)).Password
@{ 'Bootstrap:Email' = $credential.email; 'Bootstrap:Password' = $password } | ConvertTo-Json | & dotnet user-secrets set --project (Join-Path $projectRoot 'apps\api')
$env:ASPNETCORE_ENVIRONMENT = 'Development'
& dotnet run --project (Join-Path $projectRoot 'apps\api') --no-launch-profile -- --provision-admin
if ($LASTEXITCODE -ne 0) { throw 'Provisioning failed.' }
