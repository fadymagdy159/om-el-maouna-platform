# Run locally yourself; do not paste this command's password output into chat.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\environment.ps1"
$credentialFile = Join-Path $developmentRoot 'database.credentials.json'
if (-not (Test-Path -LiteralPath $credentialFile -PathType Leaf)) {
    throw 'Local database credentials are missing. Do not reinitialize an existing database to recover a password.'
}
$credential = Get-Content -LiteralPath $credentialFile -Raw | ConvertFrom-Json
Write-Host 'Local development database (PostgreSQL)'
Write-Host 'Host: 127.0.0.1'
Write-Host 'Port: 55432'
Write-Host 'Database: omelmaouna_dev'
Write-Host 'Username: omelmaouna_app'
Write-Host 'Password:'
Write-Host ([Net.NetworkCredential]::new('', (ConvertTo-SecureString $credential.app)).Password)
Write-Host 'This is the database password, not your website login. Do not share it.'
