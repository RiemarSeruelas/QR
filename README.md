# QR Asset System MVP

React + Express MVP for registering assets, approving/rejecting requests, generating one permanent QR per approved item, and checking if the item is still valid, expired, or archived.

## Latest changes in this version

- Top nav is now only **User** and **Admin**.
- User default page now shows **Register**, **Scan**, and a compact Reference ID checker.
- Removed the long user explanation text.
- Added **Light/Dark mode** toggle in the top bar.
- Removed manual **Sync data**. The app now auto-refreshes every few seconds for live request/status updates.
- Admin now requires a password before opening.
  - Temporary password: `1234`
- Removed the old admin hero/description block.
- Admin default view is now the **Expiry quick list**.
  - It only shows the asset name/basic details.
  - It follows the default expiry order from the backend: expired first, then closest to expiring.
- Admin Builder, Requests, and Approved Assets are now opened by buttons instead of all showing at once.
- Layout is smaller and cleaner from the root CSS, with fixed-height panels to avoid full-page scrolling.
- Each new registration gets a `REF-XXXXXXXX` Reference ID for checking Pending / Accepted / Rejected status.
- Admin Builder supports an `image` field type stored as base64 in the JSON DB.

## What is included

- User registration
  - User selects a category.
  - User fills the admin-defined fields.
  - User submits a request for admin approval.
  - System returns a Reference ID that the user can check later.

- QR scanning
  - Built-in camera scanner using `html5-qrcode`.
  - Manual QR input fallback.
  - Scanning the QR opens the item detail page.
  - Detail page clearly shows GOOD, EXPIRED, or ARCHIVED.

- Admin console
  - Password gate.
  - Expiry quick list.
  - Add/edit categories such as Machines, Devices, Tools.
  - Add custom fields per category.
  - Mandatory rule: each category must have at least one required date field.
  - Add image fields; images are saved as base64 in `server/data/db.json` for now.
  - View pending requests.
  - Approve request and generate a permanent QR code.
  - Reject request with note.
  - View approved/registered list.
  - Filter by search, category, site, status, date/expiry sorting.
  - Update expiry/validity date while keeping the same QR code.
  - Archive and restore registered items.

- Backend JSON storage
  - Data is stored in `server/data/db.json`.
  - This is the temporary local JSON database you can replace with PostgreSQL/MongoDB later.

- Caddy-ready
  - Includes a `Caddyfile` for serving the frontend on HTTPS and proxying `/api` to the backend.
  - This helps mobile phones use the camera scanner over the local network.

## Install

```bash
npm install
```

## Run in development

```bash
npm run dev
```

Frontend:

```txt
http://localhost:5173
```

Backend:

```txt
http://localhost:5057
```

Open the frontend from another device on the same network by using your PC IP:

```txt
http://YOUR_PC_IP:5173
```

For mobile camera scanning, HTTPS is usually required. Use Caddy for that.

## Important before approving real QR codes

Set the public app URL before approving real assets, because the QR image stores the URL that will be scanned.

Create a `.env` file based on `.env.example`:

```env
PORT=5057
PUBLIC_APP_URL=https://YOUR_PC_IP:8443
```

If you approve QR codes while using `localhost`, the QR image will point to `localhost`, which will not work from phones.

## Run with Caddy for LAN/mobile camera

Build frontend:

```bash
npm run build
```

Run backend:

```bash
npm run server
```

In another terminal, from the project folder:

```bash
caddy run
```

Open this on your phone:

```txt
https://YOUR_PC_IP:8443
```

Caddy uses `tls internal`, so some devices may warn about the certificate unless your device trusts Caddy's local CA.

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
