$ErrorActionPreference = 'Stop'
$addresses = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*'
} | Select-Object -ExpandProperty IPAddress)
if (-not $addresses.Count) { throw 'No local network address found. Connect the computer to Wi-Fi first.' }
foreach ($address in $addresses) { Write-Host "Current mobile address: http://${address}:3000/ar" }
Write-Host 'Use the same Wi-Fi on the phone and computer. An old home-Wi-Fi address will not follow you to another network.'
Write-Host 'After changing Wi-Fi, restart scripts/start-web.ps1 -Lan to refresh the development browser origins.'
Write-Host 'Some public/guest Wi-Fi networks block communication between devices. A personal hotspot can avoid that restriction.'
