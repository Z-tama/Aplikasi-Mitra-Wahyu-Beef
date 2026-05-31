# Member Wahyu Beef v1.2

Backup version for the current production-ready Wahyu Beef Membership app.

## Version name

Member Wahyu Beef v1.2

## Production target

- Cloudflare Pages project: `aplikasi-member-wahyu-beef`
- Production domain: `https://member.wahyubeef.id`
- Latest deployment at backup time: `d118368f`
- Latest assets at backup time:
  - `index-C_O9_9qZ.js`
  - `index-DTIBXeGL.css`

## Main changes since v1.1

- Olsera member profile stats:
  - Poin Member
  - Jumlah Transaksi
  - Nominal Transaksi
  - Lunas
  - Hutang
- Olsera top 10 Papan Peringkat Member:
  - ranked by points, then transaction count, then nominal transaction
  - Tier removed from mobile leaderboard display
- Member menu updates:
  - `Invoice` replaced with `Tukar Poin` for member users
  - admin Invoice page remains unchanged
  - Tukar Poin uses extracted PDF assets from `TUKAR_POIN_MEMBER`
  - Tukar Poin icon changed to gift icon
- Mobile bottom nav for member users:
  - `Peringkat`, `Katalog`, `Order Saya`, `Tukar Poin`, `Profil`
  - Dashboard remains available in sidebar/full menu
- Preserved Olsera integration and imported member login via phone + password `member`.

## Key routes

- `GET /api/v1/profile/olsera-stats`
- `GET /api/v1/leaderboard/olsera`
- `POST /api/v1/integrations/olsera/sync-members`

## Included Tukar Poin assets

- `public/assets/tukar-poin/tukar-poin-member.pdf`
- `public/assets/tukar-poin/tukar-poin-member-page-1.png`
- `public/assets/tukar-poin/tukar-poin-member.txt`

## Verification at backup time

Passed:

```sh
HOME=/home/node/.openclaw/workspace npm run typecheck
HOME=/home/node/.openclaw/workspace npm test
HOME=/home/node/.openclaw/workspace npm run build:all
```

Live checks passed:

- `https://member.wahyubeef.id/?bottom-peringkat=1` loads assets `index-C_O9_9qZ.js` / `index-DTIBXeGL.css`.
- Member login `+6281230385000` / `member` works.
- Olsera leaderboard API returns top 10 rows.
- Tukar Poin PDF/PNG assets return 200.

## Rollback notes

Use Cloudflare Pages deployment `d118368f` for v1.2 rollback.

Git backup should be available as:

- Branch: `member-wahyu-beef-v1.2`
- Tag: `member-wahyu-beef-v1.2`
