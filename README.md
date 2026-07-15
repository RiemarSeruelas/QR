# QR Asset System MVP

React + Express MVP for registering assets, approving/rejecting requests, generating one permanent QR per approved item, and checking if the item is still valid, expired, or archived.

## Current camera mode

This version does **not** use continuous live video scanning. It works on normal HTTP without Caddy, HTTPS, or certificates.

Follow up behavior:

- **Phone/tablet:** tap **Take / upload QR photo**. The device camera opens, the user takes one QR photo, then the app reads the QR from that image.
- **PC/laptop:** upload a QR image file.
- **Everyone:** can manually enter QR ID, scanned URL, or Reference ID.

After a QR photo/image is selected, the app now runs a more forgiving scan: native barcode detection, full-image scan, cropped-region scan, high-contrast scan, brightened scan, threshold scan, and an html5-qrcode fallback. When it finds a QR, it shows a preview and draws a green detection border around the QR code it used when position data is available.

## Main features

- User page
  - Register an item.
  - Follow up using phone/tablet camera photo capture, PC image upload, QR ID, scanned URL, or Reference ID.
  - Reference ID shows Pending / Accepted / Rejected.
  - Accepted references show the generated QR code and a Download QR button.
  - Item detail pages show a compact QR code and Reference ID inside the validity banner.

- Admin page
  - Account login. Test accounts:
    - `security` / `1234`
    - `engineering` / `1234`
    - `admin` / `1234` for full admin access.
  - Expiry quick list as the default view.
  - Clickable admin stat cards for Builder, Requests, Approved, Expired, and Archived.
  - Red request notification badge.
  - Add/edit categories such as Machines, Devices, Tools.
  - Add custom fields per category.
  - Supports text, number, date, textarea, select, and image fields.
  - Image fields are stored as base64 inside `server/data/db.json` for now.
  - Two-step approval workflow by category:
    - Machines: Security → Engineering
    - Devices: Engineering → Security
    - Tools: Security → Engineering
  - The first required group approves first, then the request passes to the next group.
  - The QR code is generated only after the final required group approves.
  - Either current approver can reject the request.
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
PUBLIC_APP_URL=
QR_PAYLOAD_MODE=code
```

Then run:

```powershell
docker compose up --build
```

Open on the host PC:

```txt
http://localhost:5057
```

Open from phone/tablet/other PC on the same network:

```txt
http://YOUR-PC-IP:5057
```

Example:

```txt
http://192.168.0.242:5057
```

## Why `QR_PAYLOAD_MODE=code`

The QR stores only the QR ID, not one fixed IP URL. Users open the app first, then use Follow up to scan the QR photo/image. This makes the same physical QR work even if the app later moves to another IP.

## JSON database location

```txt
server/data/db.json
```

This file stores:

- categories
- requests, including Reference IDs, approval flow, approval trail, and review status
- approved items
- QR IDs
- QR image data URL
- base64 image field values
- expiry date
- archive status

## Later DB migration idea

When replacing JSON storage with a real DB, keep these main tables/collections:

- `categories`
- `category_fields`
- `asset_requests`
- `asset_request_approvals`
- `assets`
- `asset_values`
- `asset_archive_logs`

The frontend should not need major changes as long as the API responses stay the same.


## QR scanning note

This build uses a faster photo/upload scan path. It first tries the browser native barcode detector, then a small number of downscaled smart crops. It fails fast instead of scanning for minutes. If it cannot read the QR, retake the photo with the full QR visible and make the QR fill more of the image.
