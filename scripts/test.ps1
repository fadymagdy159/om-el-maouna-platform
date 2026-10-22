. "$PSScriptRoot\environment.ps1"
$projectRoot=Split-Path $PSScriptRoot -Parent
$credentialFile=Join-Path $developmentRoot 'database.credentials.json'
$credentials=Get-Content -LiteralPath $credentialFile -Raw | ConvertFrom-Json
$password=[Net.NetworkCredential]::new('',(ConvertTo-SecureString $credentials.app)).Password
$env:OMELMAOUNA_TEST_CONNECTION="Host=127.0.0.1;Port=55432;Database=omelmaouna_test;Username=omelmaouna_app;Password=$password"
try { & dotnet test (Join-Path $projectRoot 'OmElMaouna.sln') --verbosity minimal; if($LASTEXITCODE -ne 0){throw 'Tests failed.'} }
finally { Remove-Item Env:\OMELMAOUNA_TEST_CONNECTION -ErrorAction SilentlyContinue }
