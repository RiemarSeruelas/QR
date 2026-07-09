#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
CERT_DIR="$ROOT_DIR/certs"
CONFIG="$CERT_DIR/openssl-ip-san.cnf"

mkdir -p "$CERT_DIR"

echo "Creating local root CA..."
openssl genrsa -out "$CERT_DIR/qr-system-root-ca.key" 4096
openssl req -x509 -new -nodes -key "$CERT_DIR/qr-system-root-ca.key" -sha256 -days 3650 -out "$CERT_DIR/qr-system-root-ca.crt" -subj "/CN=QR System Local Root CA/O=Local Factory QR System"

echo "Creating server certificate with SANs for 172.27.1.92 and 10.156.119.146..."
openssl genrsa -out "$CERT_DIR/qr-system.key" 2048
openssl req -new -key "$CERT_DIR/qr-system.key" -out "$CERT_DIR/qr-system.csr" -config "$CONFIG"
openssl x509 -req -in "$CERT_DIR/qr-system.csr" -CA "$CERT_DIR/qr-system-root-ca.crt" -CAkey "$CERT_DIR/qr-system-root-ca.key" -CAcreateserial -out "$CERT_DIR/qr-system.crt" -days 825 -sha256 -extensions req_ext -extfile "$CONFIG"

echo ""
echo "Done. Caddy will use:"
echo "  certs/qr-system.crt"
echo "  certs/qr-system.key"
echo ""
echo "Install/trust this CA on every phone/laptop to remove browser warnings:"
echo "  certs/qr-system-root-ca.crt"
