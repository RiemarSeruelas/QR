# Factory HTTPS setup for QR camera scanning

Phone camera scanning needs a secure context. For a factory network, do not rely on a browser warning/self-signed cert. Use a trusted certificate.

## Recommended setup

Ask IT for:

1. A DNS name that points to the Docker PC/server, for example:

   `qr-system.factory.local`

2. A trusted certificate for that exact name:

   - `qr-system.crt`
   - `qr-system.key`

The certificate must include the DNS name in Subject Alternative Name (SAN).

## Files to place

Put the cert files here:

```txt
certs/qr-system.crt
certs/qr-system.key
```

## .env

Create `.env` in the project root:

```txt
PUBLIC_APP_URL=https://qr-system.factory.local:8443
```

If IT gives you a different name, use that instead.

## Run

```powershell
docker compose -f docker-compose.trusted.yml down --remove-orphans
docker compose -f docker-compose.trusted.yml up --build
```

Open:

```txt
https://qr-system.factory.local:8443
```

## Firewall

PowerShell as Admin:

```powershell
New-NetFirewallRule -DisplayName "QR System HTTPS 8443" -Direction Inbound -Protocol TCP -LocalPort 8443 -Action Allow
```

## Why not IP/self-signed?

Using `https://192.168.x.x:8443` only works cleanly when the certificate has that IP address in its SAN and the issuing CA is trusted by the device. A normal local/self-signed Caddy cert is okay for testing, but not clean enough for factory-wide phone use.
