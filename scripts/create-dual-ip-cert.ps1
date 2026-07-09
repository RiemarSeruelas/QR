$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$CertDir = Join-Path $Root "certs"
$Config = Join-Path $CertDir "openssl-ip-san.cnf"

New-Item -ItemType Directory -Force -Path $CertDir | Out-Null

Write-Host "Creating local root CA..."
openssl genrsa -out "$CertDir/qr-system-root-ca.key" 4096
openssl req -x509 -new -nodes -key "$CertDir/qr-system-root-ca.key" -sha256 -days 3650 -out "$CertDir/qr-system-root-ca.crt" -subj "/CN=QR System Local Root CA/O=Local Factory QR System"

Write-Host "Creating server certificate with SANs for 172.27.1.92 and 10.156.119.146..."
openssl genrsa -out "$CertDir/qr-system.key" 2048
openssl req -new -key "$CertDir/qr-system.key" -out "$CertDir/qr-system.csr" -config "$Config"
openssl x509 -req -in "$CertDir/qr-system.csr" -CA "$CertDir/qr-system-root-ca.crt" -CAkey "$CertDir/qr-system-root-ca.key" -CAcreateserial -out "$CertDir/qr-system.crt" -days 825 -sha256 -extensions req_ext -extfile "$Config"

Write-Host ""
Write-Host "Done. Caddy will use:"
Write-Host "  certs/qr-system.crt"
Write-Host "  certs/qr-system.key"
Write-Host ""
Write-Host "Install/trust this CA on every phone/laptop to remove browser warnings:"
Write-Host "  certs/qr-system-root-ca.crt"
