# Factory dual-network HTTPS deployment

This version supports HTTPS access from test/factory IPs as long as the certificate SAN includes the IP being opened. Typical URLs:

```txt
https://192.168.0.242
https://172.27.1.92
https://10.156.119.146
```

The Express/React app still runs internally on port `5057`. Caddy is the HTTPS reverse proxy on port `443`.

## Important certificate rule

If you open the app by IP address, the certificate must include both IP addresses as SANs:

```txt
IP Address: 172.27.1.92
IP Address: 10.156.119.146
```

The certificate files Caddy expects are:

```txt
certs/qr-system.crt
certs/qr-system.key
```

Do not put the private key inside `src/`, `public/`, or GitHub. It belongs only in `certs/` on the server.

## Recommended QR mode for two networks

Use this in `.env`:

```env
QR_PAYLOAD_MODE=code
PUBLIC_APP_URL=
```

In this mode, the QR contains only:

```txt
MACHINEQR:QR-XXXXXXXX
```

That is better for two networks because the QR is not locked to either `172.27.1.92` or `10.156.119.146`. Users open the app through whichever IP works for them, then scan inside **Follow up**.

If you use `QR_PAYLOAD_MODE=url`, the QR must contain one fixed URL only. That is not ideal when the same physical QR must work from two separated IP networks.

## Option A: use a provided trusted certificate

Place these files:

```txt
certs/qr-system.crt
certs/qr-system.key
```

Create `.env` from `.env.dual-https.example`:

```powershell
copy .env.dual-https.example .env
```

Then run:

```powershell
docker compose -f docker-compose.https.yml down --remove-orphans
docker compose -f docker-compose.https.yml up --build
```

Open:

```txt
https://172.27.1.92
https://10.156.119.146
```

## Option B: create your own local CA certificate

This creates your own root CA plus a server certificate for both IPs.

Run in PowerShell from the project folder:

```powershell
.\scripts\create-dual-ip-cert.ps1
```

Then install/trust this on every phone/laptop:

```txt
certs/qr-system-root-ca.crt
```

After that, run:

```powershell
docker compose -f docker-compose.https.yml down --remove-orphans
docker compose -f docker-compose.https.yml up --build
```

## Firewall

Open ports `443` and optionally `5057` on the server PC:

```powershell
New-NetFirewallRule -DisplayName "QR System HTTPS 443" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
New-NetFirewallRule -DisplayName "QR System HTTP 5057" -Direction Inbound -Protocol TCP -LocalPort 5057 -Action Allow
```

## Camera behavior

This build uses safer role/device behavior:

- Mobile/tablet + HTTPS URL: live camera scanner is shown.
- PC/laptop: live camera scanner is hidden by design. Use QR image upload or manual QR/Reference ID check.
- Any HTTP `:5057` access: app still works, but live scanner is hidden. Upload/manual fallback remains available.
- If a tablet opens the live scanner but the preview is black, start the scanner once, stop it, then choose another camera from the camera dropdown.
