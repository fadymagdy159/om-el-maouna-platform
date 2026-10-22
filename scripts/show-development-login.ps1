# Run this yourself in the VS Code terminal. It displays your local development password.
$ErrorActionPreference = 'Stop'
$credentialFile = Join-Path $env:LOCALAPPDATA 'OmElMaouna\development\admin.credentials.json'
if (-not (Test-Path -LiteralPath $credentialFile -PathType Leaf)) {
    $credentialFile = Join-Path (Split-Path $PSScriptRoot -Parent) '.local\admin.credentials.json'
}
if (-not (Test-Path -LiteralPath $credentialFile -PathType Leaf)) {
    throw "Local administrator credentials are missing at '$credentialFile'. Account setup or recovery is required; no password has been displayed."
}
$credential = Get-Content -LiteralPath $credentialFile -Raw | ConvertFrom-Json
Write-Host "Development administrator: $($credential.email)"
Write-Host ([Net.NetworkCredential]::new('', (ConvertTo-SecureString $credential.password)).Password)
Write-Host 'Authenticator setup is required on first login. Do not share this password.'
