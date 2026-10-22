param([switch]$Lan)
. "$PSScriptRoot\environment.ps1"
Push-Location (Join-Path (Split-Path $PSScriptRoot -Parent) 'apps\web')
try {
    if ($Lan) {
        $addresses = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
            $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*'
        } | Select-Object -ExpandProperty IPAddress)
        $env:DEV_LAN_ORIGINS = $addresses -join ','
        foreach ($address in $addresses) { Write-Host "Mobile preview: http://${address}:3000/ar" }
        & npm.cmd exec -- next dev --hostname 0.0.0.0 --port 3000
    } else { & npm.cmd run dev }
}
finally { Pop-Location }
