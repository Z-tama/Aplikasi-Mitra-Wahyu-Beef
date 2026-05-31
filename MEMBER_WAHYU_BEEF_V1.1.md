# Member Wahyu Beef v1.1

Rollback-safe production snapshot for `member.wahyubeef.id`.

## Cloudflare

- Project: `aplikasi-member-wahyu-beef`
- Production Functions deployment after member login patch: `973f69c4`
- Previous successful Olsera MEMBER import deployment: `264f90c4`
- Static UI assets intentionally preserved from rollback deployment `5897131a`:
  - `/assets/index-B7UeAxwF.js`
  - `/assets/index-CAxEsCAv.css`

## Included behavior

- `member.wahyubeef.id` loads rollback UI assets from version `f1c6fda`.
- Olsera Open API integration is configured through Cloudflare Pages secrets.
- `POST /api/v1/integrations/olsera/sync-members` imports only Olsera `MEMBER` customers.
- Imported Olsera MEMBER accounts can login with phone number + password `member`.
- First import result: `fetched=126`, `created=126`, `updated=0`, `skipped=0`.
- Password update sync result: `fetched=126`, `created=0`, `updated=126`, `skipped=0`.

## Rollback notes

For quick Cloudflare rollback, promote deployment `973f69c4` on project `aplikasi-member-wahyu-beef`.
If only UI rollback is needed, deployment `5897131a` contains the static UI baseline.

## Security note

Olsera Secret Key is intentionally not committed. It must remain in Cloudflare Pages secrets only.
