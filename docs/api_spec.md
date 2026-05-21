# API SPEC MVP

Base URL: `/api/v1`

## Auth
### POST /auth/login
Body:
```json
{
  "identifier": "mitra@example.com",
  "password": "secret"
}
```
Response:
```json
{
  "token": "jwt/session-token",
  "user": { "id": "uuid", "name": "Nama", "role": "partner" }
}
```

### POST /auth/logout
Logout current session.

## Tiers
### GET /tiers
List tiers.

### POST /tiers
Admin only.
```json
{
  "code": "DISTRIBUTOR",
  "name": "Distributor",
  "rank_order": 1,
  "description": "Tier utama"
}
```

## Products
### GET /products
Admin list products.

### POST /products
Admin only.
```json
{
  "sku": "FF-001",
  "name": "Nugget Ayam 500g",
  "category_id": "uuid",
  "unit": "pack",
  "minimum_order_qty": 1,
  "is_active": true
}
```

### GET /partner/catalog
Partner only. Returns active products with price based on partner tier.

Response item:
```json
{
  "product_id": "uuid",
  "sku": "FF-001",
  "name": "Nugget Ayam 500g",
  "unit": "pack",
  "price": 32000,
  "minimum_order_qty": 1
}
```

## Tier Prices
### POST /prices
Admin only.
```json
{
  "product_id": "uuid",
  "tier_id": "uuid",
  "price": 32000,
  "effective_from": "2026-01-01"
}
```

## Partners
### GET /partners
Admin only.

### POST /partners
Admin only.
```json
{
  "business_name": "Toko Frozen Makmur",
  "contact_person": "Budi",
  "phone": "08123456789",
  "email": "budi@example.com",
  "tier_id": "uuid",
  "address": "Jl. Contoh No. 1",
  "payment_term_days": 14
}
```

## Orders
### POST /orders
Partner creates order. Price must be recalculated on server.
```json
{
  "shipping_address": "Jl. Contoh No. 1",
  "notes": "Kirim pagi",
  "items": [
    { "product_id": "uuid", "qty": 10 }
  ]
}
```

Response:
```json
{
  "order_id": "uuid",
  "order_number": "ORD-202605-0001",
  "status": "pending",
  "grand_total": 320000
}
```

### GET /orders
Admin sees all; partner sees own orders.
Query: `status`, `date_from`, `date_to`, `partner_id`.

### GET /orders/:id
Order detail.

### PATCH /orders/:id/status
Admin/warehouse.
```json
{
  "status": "in_production",
  "note": "Mulai dipacking"
}
```

Valid transitions:
- pending -> confirmed/cancelled
- confirmed -> in_production/cancelled
- in_production -> ready_to_ship/cancelled
- ready_to_ship -> shipped
- shipped -> delivered
- delivered -> no normal transition
- cancelled -> no normal transition

## Delivery Notes
### POST /orders/:id/delivery-notes
Admin/warehouse.
```json
{
  "delivery_date": "2026-05-21",
  "driver_name": "Andi",
  "vehicle_number": "B 1234 XYZ"
}
```

### GET /delivery-notes/:id/pdf
Returns PDF/printable document.

## Invoices
### POST /orders/:id/invoices
Finance/admin.
```json
{
  "invoice_date": "2026-05-21",
  "due_date": "2026-06-04"
}
```

### PATCH /invoices/:id/issue
Set invoice to issued.

### PATCH /invoices/:id/void
```json
{
  "reason": "Salah data order"
}
```

### GET /invoices/:id/pdf
Returns PDF/printable invoice.

## Payments
### POST /invoices/:id/payments
Finance.
```json
{
  "payment_date": "2026-05-22",
  "amount": 320000,
  "method": "bank_transfer",
  "reference_number": "TRX123"
}
```

## Leaderboard
### GET /leaderboard
Query: `period=monthly`, `date=2026-05-01`, `metric=value|qty|orders|points`.

Response:
```json
{
  "period_start": "2026-05-01",
  "period_end": "2026-05-31",
  "rows": [
    {
      "rank": 1,
      "partner_name": "Toko Frozen Makmur",
      "tier": "Distributor",
      "total_order_value": 12500000,
      "total_orders": 12,
      "points": 125
    }
  ]
}
```

## Reports
### GET /reports/sales-summary
Admin.

### GET /reports/top-products
Admin.

### GET /reports/invoice-aging
Finance/admin.

## Accounting Events
### GET /accounting-events
Finance/admin.
Query: `event_type`, `date_from`, `date_to`, `status`.

### GET /accounting-events/export.csv
Export finance data.

## Audit Logs
### GET /audit-logs
Super admin only.
