param([string]$Email)
$ErrorActionPreference = 'Stop'
$directory = Join-Path (Split-Path $PSScriptRoot -Parent) '.local\mail'
if (-not (Test-Path -LiteralPath $directory)) { throw 'No local mail previews yet. Submit a registration or message and wait a few seconds.' }
$files = Get-ChildItem -LiteralPath $directory -Filter '*.html' | Sort-Object Name -Descending
if ($Email) { $files = @($files | Where-Object { (Get-Content -LiteralPath $_.FullName -TotalCount 1).Contains($Email) }) }
$latest = $files | Select-Object -First 1
if (-not $latest) { throw 'No matching local preview found.' }
Write-Host 'LOCAL PREVIEW ONLY — this message has not been sent externally. Do not share confirmation or reset links.'
Start-Process -FilePath $latest.FullName
