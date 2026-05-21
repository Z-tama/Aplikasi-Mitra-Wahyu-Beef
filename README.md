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
- `POST /api/v1/orders/:id/invoices`
- `POST /api/v1/orders/:id/delivery-notes`
- `POST /api/v1/invoices/:id/payments`

## Implemented Guardrails

- Mitra hanya menerima snapshot data miliknya.
- Admin/internal menerima snapshot penuh sesuai role.
- Order price dihitung ulang server-side dari tier pricing.
- Order menyimpan snapshot harga, SKU, nama produk, unit, dan tier.
- Status order mengikuti transition valid.
- Invoice/surat jalan hanya dibuat dari order valid.
- Payment tidak boleh melebihi outstanding invoice.
- Accounting event log tidak hardcode jurnal final; finance mapping menyusul sesuai kebijakan.
