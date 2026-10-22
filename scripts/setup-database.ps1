. "$PSScriptRoot\environment.ps1"
$projectRoot = Split-Path $PSScriptRoot -Parent
$dataRoot = $developmentRoot
$cluster = Join-Path $dataRoot 'postgres'
$credentialFile = Join-Path $dataRoot 'database.credentials.json'
New-Item -ItemType Directory -Force -Path $dataRoot | Out-Null
function New-LocalPassword {
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $bytes = New-Object byte[] 32; $random.GetBytes($bytes); [Convert]::ToBase64String($bytes) }
    finally { $random.Dispose() }
}
function Protect-LocalPassword([string]$value) { ConvertFrom-SecureString (ConvertTo-SecureString $value -AsPlainText -Force) }
function Unprotect-LocalPassword([string]$value) { [Net.NetworkCredential]::new('', (ConvertTo-SecureString $value)).Password }
if (-not (Test-Path -LiteralPath $credentialFile)) {
    $ownerPassword = New-LocalPassword
    $appPassword = New-LocalPassword
    @{ owner = (Protect-LocalPassword $ownerPassword); app = (Protect-LocalPassword $appPassword) } | ConvertTo-Json | Set-Content -LiteralPath $credentialFile -Encoding utf8
}
$credentials = Get-Content -LiteralPath $credentialFile -Raw | ConvertFrom-Json
$ownerPassword = Unprotect-LocalPassword $credentials.owner
$appPassword = Unprotect-LocalPassword $credentials.app
if (-not (Test-Path -LiteralPath (Join-Path $cluster 'PG_VERSION'))) {
    $passwordFile = Join-Path $dataRoot 'initdb-password.tmp'
    try {
        [IO.File]::WriteAllText($passwordFile, $ownerPassword, [Text.UTF8Encoding]::new($false))
        & initdb -D $cluster -U omelmaouna_owner --pwfile=$passwordFile --auth-host=scram-sha-256 --auth-local=scram-sha-256 --encoding=UTF8 --locale=C --no-instructions
        if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed.' }
    } finally { if (Test-Path -LiteralPath $passwordFile) { Remove-Item -LiteralPath $passwordFile } }
}
& pg_ctl -D $cluster status *> $null
if ($LASTEXITCODE -ne 0) {
    & pg_ctl -D $cluster -l (Join-Path $dataRoot 'postgres.log') -o '-p 55432 -h 127.0.0.1' start -w
    if ($LASTEXITCODE -ne 0) { throw 'Could not start the isolated development database.' }
}
try {
    $env:PGPASSWORD = $ownerPassword
    $roleExists = & psql -h 127.0.0.1 -p 55432 -U omelmaouna_owner -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='omelmaouna_app'"
    if ($LASTEXITCODE -ne 0) { throw 'Owner connection failed.' }
    if ($roleExists -ne '1') {
        "CREATE ROLE omelmaouna_app LOGIN PASSWORD '$appPassword' NOSUPERUSER NOCREATEDB NOCREATEROLE;" | & psql -h 127.0.0.1 -p 55432 -U omelmaouna_owner -d postgres -v ON_ERROR_STOP=1 -f -
        if ($LASTEXITCODE -ne 0) { throw 'Application role creation failed.' }
    }
    foreach ($databaseName in @('omelmaouna_dev', 'omelmaouna_test')) {
        $exists = & psql -h 127.0.0.1 -p 55432 -U omelmaouna_owner -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$databaseName'"
        if ($exists -ne '1') { & createdb -h 127.0.0.1 -p 55432 -U omelmaouna_owner -O omelmaouna_app $databaseName; if ($LASTEXITCODE -ne 0) { throw 'Database creation failed.' } }
    }
} finally { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
$connection = "Host=127.0.0.1;Port=55432;Database=omelmaouna_dev;Username=omelmaouna_app;Password=$appPassword"
@{ 'ConnectionStrings:Database' = $connection } | ConvertTo-Json | & dotnet user-secrets set --project (Join-Path $projectRoot 'apps\api')
if ($LASTEXITCODE -ne 0) { throw 'Could not save the local connection string.' }
Write-Output 'Development database ready on 127.0.0.1:55432. Credentials stored in user secrets; existing PostgreSQL service unchanged.'
