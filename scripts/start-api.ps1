. "$PSScriptRoot\environment.ps1"
$databaseRoot = Join-Path $developmentRoot 'postgres'
if (-not (Test-Path -LiteralPath (Join-Path $databaseRoot 'PG_VERSION'))) { throw 'Run scripts/initialize-development.ps1 first.' }
& pg_isready -h 127.0.0.1 -p 55432 *> $null
if ($LASTEXITCODE -ne 0) {
    & pg_ctl -D $databaseRoot -l (Join-Path (Split-Path $databaseRoot -Parent) 'postgres.log') -o '-p 55432 -h 127.0.0.1' start -w
    if ($LASTEXITCODE -ne 0) { throw 'Could not start the development database.' }
}
$env:ASPNETCORE_ENVIRONMENT='Development'
$env:Media__Root = Join-Path (Split-Path $PSScriptRoot -Parent) '.local\media'
$env:Mail__PickupDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) '.local\mail'
$credentials = Get-Content -LiteralPath (Join-Path $developmentRoot 'database.credentials.json') -Raw | ConvertFrom-Json
$appPassword = [Net.NetworkCredential]::new('', (ConvertTo-SecureString $credentials.app)).Password
$env:ConnectionStrings__Database = "Host=127.0.0.1;Port=55432;Database=omelmaouna_dev;Username=omelmaouna_app;Password=$appPassword"
try {
& dotnet run --project (Join-Path (Split-Path $PSScriptRoot -Parent) 'apps\api') --no-launch-profile --urls http://127.0.0.1:5080
} finally { Remove-Item Env:\ConnectionStrings__Database -ErrorAction SilentlyContinue }
