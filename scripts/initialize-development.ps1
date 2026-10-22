. "$PSScriptRoot\environment.ps1"
$projectRoot = Split-Path $PSScriptRoot -Parent
& "$PSScriptRoot\setup-database.ps1"
if ($LASTEXITCODE -ne 0) { throw 'Database setup failed.' }
& dotnet restore (Join-Path $projectRoot 'OmElMaouna.sln')
if ($LASTEXITCODE -ne 0) { throw 'NuGet restore failed.' }
Push-Location (Join-Path $projectRoot 'apps\web')
try { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' } }
finally { Pop-Location }
$env:ASPNETCORE_ENVIRONMENT = 'Development'
& dotnet run --project (Join-Path $projectRoot 'apps\api') --no-launch-profile -- --migrate
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
& "$PSScriptRoot\provision-development-admin.ps1"
if ($LASTEXITCODE -ne 0) { throw 'Administrator provisioning failed.' }
& dotnet run --project (Join-Path $projectRoot 'apps\api') --no-launch-profile -- --seed-development
if ($LASTEXITCODE -ne 0) { throw 'Development seed failed.' }
# Original institutional media is intentionally excluded from this public repository.
Write-Output 'Ready. Run scripts/start-api.ps1 and scripts/start-web.ps1 in separate terminals.'
