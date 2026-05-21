# DATA MODEL

## 1. Core Tables

### users
- id UUID PK
- name VARCHAR
- email VARCHAR UNIQUE
- phone VARCHAR UNIQUE NULL
- password_hash VARCHAR
- role ENUM: super_admin, sales_admin, finance_admin, warehouse, partner
- status ENUM: active, suspended, inactive
- created_at TIMESTAMP
- updated_at TIMESTAMP

### partner_tiers
- id UUID PK
- code VARCHAR UNIQUE: DISTRIBUTOR, AGEN, RESELLER
- name VARCHAR
- rank_order INT
- description TEXT
- is_active BOOLEAN
- created_at TIMESTAMP
- updated_at TIMESTAMP

### partners
- id UUID PK
- user_id UUID FK users.id
- tier_id UUID FK partner_tiers.id
- partner_code VARCHAR UNIQUE
- business_name VARCHAR
- contact_person VARCHAR
- phone VARCHAR
- email VARCHAR
- address TEXT
- city VARCHAR
- province VARCHAR
- postal_code VARCHAR
- tax_id VARCHAR NULL
- credit_limit DECIMAL NULL
- payment_term_days INT DEFAULT 0
- status ENUM: active, suspended, inactive
- created_at TIMESTAMP
- updated_at TIMESTAMP

### product_categories
- id UUID PK
- name VARCHAR
- slug VARCHAR UNIQUE
- is_active BOOLEAN

### products
- id UUID PK
- category_id UUID FK product_categories.id
- sku VARCHAR UNIQUE
- name VARCHAR
- description TEXT
- unit VARCHAR
- weight_gram INT NULL
- image_url TEXT NULL
- minimum_order_qty INT DEFAULT 1
- base_cost DECIMAL NULL
- is_active BOOLEAN
- created_at TIMESTAMP
- updated_at TIMESTAMP

### product_tier_prices
- id UUID PK
- product_id UUID FK products.id
- tier_id UUID FK partner_tiers.id
- price DECIMAL
- effective_from DATE
- effective_to DATE NULL
- is_active BOOLEAN
- created_by UUID FK users.id
- created_at TIMESTAMP

Constraint:
- Unique active price per product-tier-date range.
- price > 0.

## 2. Order Tables

### orders
- id UUID PK
- order_number VARCHAR UNIQUE
- partner_id UUID FK partners.id
- order_date TIMESTAMP
- status ENUM: pending, confirmed, in_production, ready_to_ship, shipped, delivered, cancelled
- subtotal DECIMAL
- discount_total DECIMAL DEFAULT 0
- tax_total DECIMAL DEFAULT 0
- grand_total DECIMAL
- shipping_address TEXT
- notes TEXT NULL
- cancelled_reason TEXT NULL
- delivered_at TIMESTAMP NULL
- created_by UUID FK users.id
- created_at TIMESTAMP
- updated_at TIMESTAMP

### order_items
- id UUID PK
- order_id UUID FK orders.id
- product_id UUID FK products.id
- sku_snapshot VARCHAR
- product_name_snapshot VARCHAR
- unit_snapshot VARCHAR
- tier_id_snapshot UUID
- tier_name_snapshot VARCHAR
- qty INT
- unit_price DECIMAL
- discount_amount DECIMAL DEFAULT 0
- line_total DECIMAL
- created_at TIMESTAMP

Rule:
- unit_price berasal dari product_tier_prices saat checkout.
- Snapshot tidak berubah walaupun produk/harga berubah.

### order_status_histories
- id UUID PK
- order_id UUID FK orders.id
- from_status VARCHAR NULL
- to_status VARCHAR
- note TEXT NULL
- changed_by UUID FK users.id
- changed_at TIMESTAMP

## 3. Delivery Note

### delivery_notes
- id UUID PK
- delivery_note_number VARCHAR UNIQUE
- order_id UUID FK orders.id
- delivery_date DATE
- driver_name VARCHAR NULL
- vehicle_number VARCHAR NULL
- recipient_name VARCHAR NULL
- status ENUM: draft, issued, received, void
- notes TEXT NULL
- issued_by UUID FK users.id
- issued_at TIMESTAMP NULL
- created_at TIMESTAMP
- updated_at TIMESTAMP

### delivery_note_items
- id UUID PK
- delivery_note_id UUID FK delivery_notes.id
- order_item_id UUID FK order_items.id
- product_name_snapshot VARCHAR
- sku_snapshot VARCHAR
- qty INT
- unit_snapshot VARCHAR

## 4. Invoice & Payment

### invoices
- id UUID PK
- invoice_number VARCHAR UNIQUE
- order_id UUID FK orders.id
- partner_id UUID FK partners.id
- invoice_date DATE
- due_date DATE
- status ENUM: draft, issued, partial, paid, void
- subtotal DECIMAL
- discount_total DECIMAL
- tax_total DECIMAL
- grand_total DECIMAL
- amount_paid DECIMAL DEFAULT 0
- amount_due DECIMAL
- void_reason TEXT NULL
- issued_by UUID FK users.id NULL
- issued_at TIMESTAMP NULL
- created_at TIMESTAMP
- updated_at TIMESTAMP

### invoice_items
- id UUID PK
- invoice_id UUID FK invoices.id
- order_item_id UUID FK order_items.id
- description VARCHAR
- qty INT
- unit VARCHAR
- unit_price DECIMAL
- line_total DECIMAL

### payments
- id UUID PK
- invoice_id UUID FK invoices.id
- payment_date DATE
- amount DECIMAL
- method ENUM: cash, bank_transfer, other
- reference_number VARCHAR NULL
- notes TEXT NULL
- received_by UUID FK users.id
- created_at TIMESTAMP

## 5. Leaderboard

### leaderboard_snapshots
- id UUID PK
- period_start DATE
- period_end DATE
- partner_id UUID FK partners.id
- total_order_value DECIMAL
- total_order_qty INT
- total_orders INT
- points INT
- rank INT
- generated_at TIMESTAMP

Leaderboard dapat juga dihitung real-time dari orders delivered, tetapi snapshot berguna untuk mengunci hasil periode.

## 6. Inventory MVP

### inventory_movements
- id UUID PK
- product_id UUID FK products.id
- reference_type ENUM: order, delivery_note, adjustment
- reference_id UUID
- movement_type ENUM: in, out, adjustment
- qty INT
- unit_cost DECIMAL NULL
- total_cost DECIMAL NULL
- note TEXT NULL
- created_by UUID FK users.id
- created_at TIMESTAMP

## 7. Accounting Event Log

### accounting_events
- id UUID PK
- event_type ENUM: ORDER_CREATED, INVOICE_ISSUED, DELIVERY_NOTE_CREATED, GOODS_SHIPPED, GOODS_DELIVERED, PAYMENT_RECEIVED, ORDER_CANCELLED, INVOICE_VOIDED, INVENTORY_OUT, REVERSAL
- reference_type VARCHAR
- reference_id UUID
- partner_id UUID NULL
- event_date TIMESTAMP
- amount DECIMAL NULL
- currency VARCHAR DEFAULT 'IDR'
- status ENUM: pending_mapping, mapped, exported, reversed
- metadata JSONB
- created_by UUID FK users.id NULL
- created_at TIMESTAMP

Rule:
- Immutable.
- Jika salah, buat REVERSAL event.

## 8. Audit Trail

### audit_logs
- id UUID PK
- actor_user_id UUID FK users.id
- action VARCHAR
- entity_type VARCHAR
- entity_id UUID
- old_value JSONB NULL
- new_value JSONB NULL
- ip_address VARCHAR NULL
- user_agent TEXT NULL
- created_at TIMESTAMP

## 9. Suggested Indexes
- orders.partner_id, orders.status, orders.order_date
- order_items.order_id
- invoices.partner_id, invoices.status, invoices.due_date
- product_tier_prices.product_id, product_tier_prices.tier_id
- accounting_events.event_type, accounting_events.event_date
- audit_logs.entity_type, audit_logs.entity_id
