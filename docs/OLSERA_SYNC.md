# Olsera Member Sync

This app can import Olsera customer/member records into the Membership App database through a protected Cloudflare Pages Function endpoint.

## Endpoint

`POST /api/v1/integrations/olsera/sync-members`

Header:

```http
x-sync-token: <OLSERA_SYNC_TOKEN>
```

The endpoint fetches customers from Olsera, maps them into app `users` and `partners`, then persists the updated `AppState` in Cloudflare D1 (`app_state` table).

## Required Cloudflare env vars

Set these on the Cloudflare Pages project `aplikasi-member-wahyu-beef`:

```text
OLSERA_APP_ID=<from Olsera console>
OLSERA_SECRET_KEY=<from Olsera console, keep secret>
OLSERA_STORE_ID=wahyubeeftuban
OLSERA_SYNC_TOKEN=<random internal sync password>
```

Optional, because Olsera docs/paths may vary by account/API version:

```text
OLSERA_API_BASE_URL=https://api.olsera.co.id
OLSERA_CUSTOMERS_PATH=/api/open-api/v1/customers
```

If Olsera documentation shows a different customer/member path, set `OLSERA_CUSTOMERS_PATH` without code changes. `{storeId}` is replaced with `OLSERA_STORE_ID`.

## Mapping

The importer accepts flexible field names from Olsera:

- External ID: `id`, `customer_id`, `customerId`, `member_id`, `memberId`
- Name: `name`, `customer_name`, `fullname`, `full_name`
- Phone: `phone`, `mobile`, `mobile_phone`, `customer_phone`, `whatsapp`
- Email: `email`, `customer_email`
- Address: `address`, `customer_address`, `shipping_address`
- City: `city`, `customer_city`
- Province: `province`, `state`

Created users get role `partner`, status `active`, and default password `password` until real auth is finalized.

## Manual test

```sh
curl -X POST 'https://member.wahyubeef.id/api/v1/integrations/olsera/sync-members' \
  -H 'x-sync-token: <OLSERA_SYNC_TOKEN>'
```

Expected response:

```json
{
  "fetched": 0,
  "created": 0,
  "updated": 0,
  "skipped": [],
  "source": "olsera",
  "storeId": "wahyubeeftuban"
}
```


## Current live status — 2026-05-31

- Token endpoint confirmed:
  `POST https://api-open.olsera.co.id/api/open-api/v1/auth/token`
- Token request body:
  `grant_type=secret_key&app_id=<OLSERA_APP_ID>&secret_key=<OLSERA_SECRET_KEY>`
- Secret key OCR caveat from screenshot: the middle segment uses lowercase `l` in `RowKl2`, not uppercase `I`.
- Bearer token generation is working.
- Customer/member endpoint is still not confirmed. Tested common paths (`customers`, `customer`, `members`, `member`, product/order/category variants) and Olsera returns 404 `Not Found Resource`.
- Next requirement: official Olsera Open Platform documentation for the customer/member list resource, or a screenshot of the docs page showing the endpoint path.
