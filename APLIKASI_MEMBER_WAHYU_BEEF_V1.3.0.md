# Aplikasi Member Wahyu Beef V1.3.0

Backup version for the current Wahyu Beef Member app production state.

## Version name

Aplikasi Member Wahyu Beef V1.3.0

## Production target

- Cloudflare Pages project: `aplikasi-member-wahyu-beef`
- Production domain: `https://member.wahyubeef.id`
- Latest deployment at backup time: `451fc1a6`
- Latest assets at backup time:
  - `index-BcY9lhEm.js`
  - `index-Dgc4NqMR.css`

## Main scope included

### Olsera integration

- MEMBER customer import from Olsera.
- Imported members can login by phone number with default password `member`.
- Member profile displays Olsera points and transaction metrics.
- Papan Peringkat Member pulls Olsera top 10 ranking.
- Product catalog sync from Olsera:
  - archives existing active products/categories/prices
  - imports Olsera products
  - maps categories from Olsera Grup/product group
  - uses Olsera store selling price (`sell_price`) for member app prices
  - stores stock as `Stok Olsera: N` in product description

### Catalog/product UI

- Active category order:
  1. DAGING
  2. TULANG
  3. JEROAN
  4. OLAHAN
  5. BERKAH CHICKEN
  6. Remaining categories alphabetically
- Legacy categories hidden/archived from dropdown:
  - Daging Sapi
  - Tulang Sapi
  - Jeroan Sapi
  - Olahan Daging
  - Seafood Series
- Product card copy:
  - badge says `Member`
  - removed `Harga khusus Member Basic`
  - rating/sold row replaced with `Stok Produk • N pcs`

### Member UX

- Login/register header uses uploaded Wahyu Beef Membership header image.
- Login CTA says `Daftar Menjadi Member`.
- Registration page is simplified to Biodata only:
  - Nama Lengkap
  - Nomor WhatsApp
  - Email
  - Alamat Lengkap
- Bottom nav for members uses:
  - Peringkat
  - Katalog
  - Order Saya
  - Tukar Poin
  - Profil
- Tukar Poin page uses extracted PDF poster and gift icon.

## Key live routes

- `POST /api/v1/integrations/olsera/sync-members`
- `POST /api/v1/integrations/olsera/sync-products`
- `POST /api/v1/integrations/olsera/archive-legacy-categories`
- `GET /api/v1/profile/olsera-stats`
- `GET /api/v1/leaderboard/olsera`

## Verification at backup time

Passed during latest changes:

```sh
HOME=/home/node/.openclaw/workspace npm run typecheck
HOME=/home/node/.openclaw/workspace npm test
HOME=/home/node/.openclaw/workspace GOMAXPROCS=2 npm run build:all
```

Live checks passed:

- Production HTML loads `index-BcY9lhEm.js` / `index-Dgc4NqMR.css`.
- Member snapshot after Olsera product sync showed 421 active products and 16 active categories.
- Product cards parse synced stock from `Stok Olsera: N`.
- Login/member routes remained operational during verification.

## Rollback notes

Use Cloudflare Pages deployment `451fc1a6` for V1.3.0 rollback.

Git backup should be available as:

- Branch: `aplikasi-member-wahyu-beef-v1.3.0`
- Tag: `aplikasi-member-wahyu-beef-v1.3.0`
