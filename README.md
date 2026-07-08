# QR Asset System MVP

React + Express MVP for registering assets, approving/rejecting requests, generating one permanent QR per approved item, and checking if the item is still valid, expired, or archived.

## Current deployment mode

This version is cleaned for **normal HTTP Docker deployment**.

- Use `docker compose up --build`.
- Open the app on the server PC with `http://localhost:5057`.
- Open the app on phones/other PCs with `http://YOUR-PC-IP:5057`.
- No Caddy files are included in this version.
- No certificate is required for the phone camera-upload flow.

## Camera behavior

This version is set for **HTTP factory/LAN mode**.

- **Mobile users:** Follow up opens the phone camera through the native camera picker, then the app reads the QR photo.
- **PC/laptop users:** Follow up only allows QR image upload/manual input.
- Uploaded/scanned QR photos show a preview frame while scanning and a detected QR marker before opening the item.
- The PC live webcam button was removed to avoid confusing users on LAN HTTP.

True in-page live camera streaming for both phone and PC still requires HTTPS. This HTTP version uses the browser-safe camera/photo flow for mobile and upload flow for PC.

## Main features

- User page
  - Register an item.
  - Follow up using mobile camera/photo upload, PC image upload, QR ID, scanned URL, or Reference ID.
  - Reference ID shows Pending / Accepted / Rejected.
  - Accepted references show the generated QR code and a Download QR button.
  - Item detail pages show a compact QR code and Reference ID inside the validity banner.

- Admin page
  - Password gate. Temporary password: `1234`.
  - Expiry quick list as the default view.
  - Clickable admin stat cards for Builder, Requests, Approved, Expired, and Archived.
  - Red request notification badge.
  - Add/edit categories such as Machines, Devices, Tools.
  - Add custom fields per category.
  - Supports text, number, date, textarea, select, and image fields.
  - Image fields are stored as base64 inside `server/data/db.json` for now.
  - Approve/reject requests.
  - Approved request generates one permanent QR code.
  - Update expiry while keeping the same QR code.
  - Archive and restore registered items.

- Backend JSON storage
  - Data is stored in `server/data/db.json`.
  - This can be replaced with PostgreSQL/MongoDB later if the API response shapes stay the same.

## Install locally

```bash
npm install
```

## Run locally for development

```bash
npm run dev
```

Frontend dev server:

```txt
http://localhost:5173
```

Backend:

```txt
http://localhost:5057
```

## Run with Docker Desktop

Create `.env` beside `docker-compose.yml`:

```env
PUBLIC_APP_URL=http://YOUR-PC-IP:5057
```

Example:

```env
PUBLIC_APP_URL=http://192.168.254.109:5057
```

Run:

```powershell
docker compose up --build
```

Open:

```txt
http://localhost:5057
```

Or from phone/other PC:

```txt
http://YOUR-PC-IP:5057
```

## Important before approving real QR codes

Set `PUBLIC_APP_URL` before approving real assets, because the QR image stores that URL.

If you approve QR codes while using `localhost`, the QR image will point to `localhost`, which will not work from phones.

Use a stable LAN URL instead:

```env
PUBLIC_APP_URL=http://192.168.254.109:5057
```

Then restart Docker:

```powershell
docker compose down
docker compose up --build
```

## JSON database location

```txt
server/data/db.json
```

This file stores:

- categories
- requests, including Reference IDs and review status
- approved items
- QR IDs
- QR payload URL
- QR image data URL
- base64 image field values
- expiry date
- archive status

## Later DB migration idea

When replacing JSON storage with a real DB, keep these main tables/collections:

- `categories`
- `category_fields`
- `asset_requests`
- `assets`
- `asset_values`
- `asset_archive_logs`

The frontend should not need major changes as long as the API responses stay the same.
