$ErrorActionPreference = 'Stop'
$devTools = Join-Path $env:LOCALAPPDATA 'OmElMaouna\devtools'
$projectLocal = Join-Path (Split-Path $PSScriptRoot -Parent) '.local'
if (Test-Path -LiteralPath (Join-Path $projectLocal 'devtools\dotnet\dotnet.exe')) {
    $devTools = Join-Path $projectLocal 'devtools'
}
$developmentRoot = Join-Path $env:LOCALAPPDATA 'OmElMaouna\development'
if (Test-Path -LiteralPath (Join-Path $projectLocal 'development\database.credentials.json')) {
    $developmentRoot = Join-Path $projectLocal 'development'
}
$env:PATH = "$devTools\node-v24.21.0-win-x64;$devTools\dotnet;$devTools\dotnet-tools;C:\Program Files\PostgreSQL\16\bin;" + $env:PATH
$env:DOTNET_ROOT = Join-Path $devTools 'dotnet'
$devCa = Join-Path $devTools 'windows-trusted-ca.pem'
if (Test-Path -LiteralPath $devCa) { $env:NODE_EXTRA_CA_CERTS = $devCa }
$env:DOTNET_CLI_UI_LANGUAGE = 'en'
