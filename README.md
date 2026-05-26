# Mitra Frozen Food Membership App

Full-stack MVP web app responsif untuk membership B2B frozen food: tier pricing, katalog mitra, checkout order, status tracking, invoice, surat jalan, leaderboard, report, audit trail, dan accounting event log PSAK-oriented.

## Status Implementasi

- Frontend: React + TypeScript + Vite.
- Backend: Node HTTP API di `src/server/server.ts`.
- Persistence: JSON file lokal di `data/app-state.json` via `src/server/persistence.ts`.
- Auth: token HMAC demo + role-based access control.
- API base: `/api/v1`.
- Source docs dari ZIP ada di `docs/`.

> Catatan: `DATABASE_URL` belum tersedia di tenant saat dibuat, jadi persistence production sementara memakai file JSON lokal. Struktur service/domain sudah dipisah agar adapter PostgreSQL/Prisma bisa ditambahkan saat managed database aktif.

## Login Demo

- Super Admin: `admin@frozen.local` / `password`
- Sales Admin: `sales@frozen.local` / `password`
- Finance: `finance@frozen.local` / `password`
- Warehouse: `warehouse@frozen.local` / `password`
- Mitra Distributor: `distributor@mitra.local` / `password`
- Mitra Agen: `agen@mitra.local` / `password`
- Mitra Reseller: `reseller@mitra.local` / `password`

## Jalankan Full-stack Lokal

```bash
npm install --cache "$PWD/.npm-cache"
npm run build
PORT=4180 npm run start
```

Buka:

```text
http://localhost:4180
```

## Development Frontend Saja

```bash
npm run dev
```

Frontend dev server butuh backend API terpisah jika ingin flow login/data nyata:

```bash
PORT=3000 npm run start
```

## Verifikasi

```bash
npm run test
npm run typecheck
npm run build:all
npm audit --audit-level=high
```

## API MVP

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/snapshot`
- `POST /api/v1/orders`
- `PATCH /api/v1/orders/:id/status`
- `PATCH /api/v1/orders/:id/shipping`
- `POST /api/v1/uploads/tracking-receipts`
- `POST /api/v1/profile/photo`
- `POST /api/v1/orders/:id/invoices`
- `POST /api/v1/orders/:id/delivery-notes`
- `POST /api/v1/invoices/:id/payments`

## Cloudflare R2 Storage

Upload foto resi dan foto profil sudah melalui backend upload endpoint. Jika credential R2 tersedia, file disimpan ke Cloudflare R2; jika belum, mode non-production masih fallback ke data URL untuk demo/UAT.

Environment production yang perlu diisi:

```bash
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET="wahyu-beef-uploads"
R2_PUBLIC_BASE_URL="https://uploads.wahyubeef.id"
R2_REQUIRED="true" # opsional; paksa error jika R2 belum lengkap di production
```

Catatan:

- Tracking receipt menerima JPG, PNG, WEBP, PDF.
- Foto profil menerima JPG, PNG, WEBP.
- Batas upload default 2 MB.
- Order/profil hanya menyimpan URL/path file, bukan isi file besar, ketika R2 aktif.

## Backup Otomatis

Backup production bisa dijalankan otomatis ke folder lokal `backups/` dan Cloudflare R2 path `backups/app-state/`.

Environment:

```bash
BACKUP_ENABLED="true"
BACKUP_INTERVAL_MS="86400000" # harian
BACKUP_RETENTION_DAYS="30"
BACKUP_DIR="backups"
```

Endpoint admin-only:

- `GET /api/v1/backup/status`
- `POST /api/v1/backup/run`

Rekomendasi: jalankan backup manual sebelum import data besar, perubahan harga massal, atau deployment sensitif.

## Implemented Guardrails

- Mitra hanya menerima snapshot data miliknya.
- Admin/internal menerima snapshot penuh sesuai role.
- Order price dihitung ulang server-side dari tier pricing.
- Order menyimpan snapshot harga, SKU, nama produk, unit, dan tier.
- Status order mengikuti transition valid.
- Invoice/surat jalan hanya dibuat dari order valid.
- Payment tidak boleh melebihi outstanding invoice.
- Accounting event log tidak hardcode jurnal final; finance mapping menyusul sesuai kebijakan.
