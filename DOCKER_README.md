# Docker Desktop Run Guide

This version is for normal HTTP Docker deployment. Caddy/HTTPS files were removed.

## Run

```powershell
cd "C:\Users\Riej\Downloads\Unilever Projects\6th Project"
docker compose up --build
```

Open on the Docker PC:

```txt
http://localhost:5057
```

Open from another phone/PC on the same network:

```txt
http://YOUR-PC-IP:5057
```

Example:

```txt
http://192.168.254.109:5057
```

## .env

Before approving real assets, create `.env` beside `docker-compose.yml`:

```txt
PUBLIC_APP_URL=http://YOUR-PC-IP:5057
```

Example:

```txt
PUBLIC_APP_URL=http://192.168.254.109:5057
```

Then restart:

```powershell
docker compose down
docker compose up --build
```

## Camera behavior

- Mobile: **Follow up > Open mobile camera** opens the phone camera/native image picker, then the app reads the QR photo.
- PC/laptop: **Follow up > Upload QR image** opens file upload only.
- Live PC webcam was intentionally removed for HTTP LAN deployment because browsers block it without HTTPS.

For factory HTTP mode, use the same URL for everyone: phones use the camera/photo button, PCs upload a QR image or type the QR/reference ID.

## Useful Docker commands

Stop the app:

```powershell
docker compose down
```

Rebuild after code changes:

```powershell
docker compose up --build
```

See logs:

```powershell
docker logs -f qr-system
```

Remove the container:

```powershell
docker rm -f qr-system
```

## Data storage

The JSON database stays on your host machine here:

```txt
server/data/db.json
```

Because Docker Compose mounts this folder:

```txt
./server/data:/app/server/data
```

So deleting/rebuilding the container will not erase your app data unless you delete `server/data/db.json`.
