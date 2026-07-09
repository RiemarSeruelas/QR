# Docker run guide

This version is HTTP-only and does not need Caddy, HTTPS, or certificates.

## Run

```powershell
docker compose up --build
```

Open on the same PC:

```txt
http://localhost:5057
```

Open from another device on the same network:

```txt
http://YOUR-PC-IP:5057
```

Example:

```txt
http://192.168.0.242:5057
```

## Recommended `.env`

```env
PUBLIC_APP_URL=
QR_PAYLOAD_MODE=code
```

This stores only the QR code value inside the QR image. Users open the app first, then scan the QR through Follow up.

## Data persistence

The JSON database stays on the host here:

```txt
server/data/db.json
```

## Phone/tablet camera behavior

Phone/tablet users tap **Take / upload QR photo**. The native camera opens, they take one QR photo, and the app reads that image. This works over HTTP because it does not use continuous in-browser webcam streaming.
