import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart3, ClipboardList, FileText, IceCreamBowl, LayoutDashboard, LogOut, Medal, Package, ReceiptText, ShieldCheck, ShoppingCart, Truck, UserCog, Users } from 'lucide-react';
import './styles.css';
import { AccountingEvent, CartItem, DeliveryNote, Invoice, Order, OrderStatus, Role, User, formatIdr, statusLabels, validTransitions } from './domain';
import { AppState, createSeedState, demoPasswords } from './seed';
import { api, type Session } from './apiClient';
import { findPartnerForUser, getCatalogForPartner, getLeaderboard } from './services';

const stateSingleton = createSeedState();

type View = 'dashboard' | 'catalog' | 'orders' | 'products' | 'partners' | 'pricing' | 'documents' | 'leaderboard' | 'profile' | 'reports' | 'audit' | 'accounting';

function App() {
  const [state, setState] = useState<AppState>(stateSingleton);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [view, setView] = useState<View>('dashboard');

  async function refresh(nextToken = token) {
    const snapshot = await api.snapshot(nextToken);
    setState(snapshot);
  }

  if (!currentUser) return <Login onLogin={async (session) => { setToken(session.token); setCurrentUser(session.user); setView(session.user.role === 'partner' ? 'catalog' : 'dashboard'); await refresh(session.token); }} state={state} />;
  return <Shell state={state} user={currentUser} setUser={setCurrentUser} token={token} view={view} setView={setView} setState={setState} refresh={refresh} onLogout={() => { setCurrentUser(null); setToken(''); }} />;
}

function Login({ state, onLogin }: { state: AppState; onLogin: (session: Session) => Promise<void> }) {
  const [email, setEmail] = useState('admin@frozen.local');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const demo = Object.keys(demoPasswords);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const session = await api.login(email, password);
      await onLogin(session);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login gagal. Pastikan backend berjalan.');
    }
  }
  return <main className="login-page">
    <section className="login-card">
      <div className="hero-panel">
        <span className="badge"><IceCreamBowl size={16} /> Mitra Wahyu Beef</span>
        <h1>Portal mitra Wahyu Beef yang hangat dan rapi.</h1>
        <p>Kelola order, invoice, surat jalan, harga tier, dan status mitra dalam satu dashboard yang mudah dipakai.</p>
        <div className="notice" style={{ background: 'rgba(255,255,255,.14)', color: 'white', borderColor: 'rgba(255,255,255,.24)' }}>Tone baru mengikuti brand Wahyu Beef: hangat, premium, dan mudah dibaca di mobile.</div>
      </div>
      <form className="login-form" onSubmit={submit}>
        <div>
          <h2>Masuk Demo</h2>
          <p style={{ color: '#8a6a37' }}>Pilih role untuk mencoba flow admin atau mitra.</p>
        </div>
        <div className="field"><label>Email</label><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {error && <div className="notice warning">{error}</div>}
        <button className="btn primary" type="submit">Masuk</button>
        <div className="demo-grid">{demo.map((item) => <button type="button" className="demo-account" key={item} onClick={() => { setEmail(item); setPassword('password'); }}><b>{item}</b><br />password</button>)}</div>
      </form>
    </section>
  </main>;
}

function Shell({ state, user, setUser, token, view, setView, setState, refresh, onLogout }: { state: AppState; user: User; setUser: (user: User) => void; token: string; view: View; setView: (view: View) => void; setState: (state: AppState) => void; refresh: () => Promise<void>; onLogout: () => void }) {
  const isPartner = user.role === 'partner';
  const nav = isPartner
    ? [['catalog', 'Katalog', ShoppingCart], ['orders', 'Order Saya', ClipboardList], ['documents', 'Dokumen', FileText], ['leaderboard', 'Leaderboard', Medal], ['profile', 'Profil', UserCog]] as const
    : [['dashboard', 'Dashboard', LayoutDashboard], ['orders', 'Order', ClipboardList], ['products', 'Produk', Package], ['partners', 'Mitra', Users], ['pricing', 'Harga Tier', ReceiptText], ['documents', 'Invoice & SJ', FileText], ['leaderboard', 'Leaderboard', Medal], ['reports', 'Reports', BarChart3], ['accounting', 'Accounting Events', ShieldCheck], ['audit', 'Audit Trail', ShieldCheck]] as const;
  return <div className="app-shell layout">
    <aside className="sidebar">
      <div className="brand"><div className="logo">WB</div><div><h2>Wahyu Beef</h2><span>Mitra App</span></div></div>
      <nav className="nav">{nav.map(([key, label, Icon]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)}><Icon size={18} /> {label}</button>)}</nav>
      <div className="user-box"><b>{user.name}</b><br /><span>{roleLabel(user.role)}</span><br /><br /><button className="btn small" onClick={onLogout}><LogOut size={14} /> Keluar</button></div>
    </aside>
    <main className="main">
      <Topbar state={state} user={user} view={view} />
      {view === 'dashboard' && <Dashboard state={state} />}
      {view === 'catalog' && <Catalog state={state} user={user} token={token} refresh={refresh} />}
      {view === 'orders' && <Orders state={state} user={user} token={token} refresh={refresh} />}
      {view === 'products' && <Products state={state} />}
      {view === 'partners' && <Partners state={state} />}
      {view === 'pricing' && <Pricing state={state} />}
      {view === 'documents' && <Documents state={state} user={user} token={token} refresh={refresh} />}
      {view === 'leaderboard' && <Leaderboard state={state} />}
      {view === 'profile' && <ProfileSettings state={state} user={user} token={token} setUser={setUser} setState={setState} />}
      {view === 'reports' && <Reports state={state} />}
      {view === 'audit' && <Audit state={state} />}
      {view === 'accounting' && <Accounting state={state} />}
    </main>
  </div>;
}

function Topbar({ state, user, view }: { state: AppState; user: User; view: View }) {
  const partner = findPartnerForUser(state, user);
  const title: Record<View, string> = { dashboard: 'Dashboard Operasional', catalog: 'Katalog Mitra', orders: user.role === 'partner' ? 'Order Saya' : 'Order Management', products: 'Product Catalog', partners: 'Mitra Management', pricing: 'Tier Pricing', documents: 'Invoice & Surat Jalan', leaderboard: 'Leaderboard Mitra', profile: 'Setting Profil', reports: 'Basic Reports', audit: 'Audit Trail', accounting: 'Accounting Event Log' };
  return <header className="topbar"><div><h1>{title[view]}</h1><p>{partner ? `${partner.businessName} • ${tierName(state, partner.tierId)}` : 'Admin workspace Wahyu Beef'}</p></div><div className="badge" style={{ background: '#fff8e8', color: '#8f121b', border: '1px solid #ead7ae' }}>{roleLabel(user.role)}</div></header>;
}

function Dashboard({ state }: { state: AppState }) {
  const deliveredGmv = state.orders.filter((o) => o.status === 'delivered').reduce((s, o) => s + o.grandTotal, 0);
  const activeOrders = state.orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length;
  return <div className="grid">
    <div className="grid cols-4">
      <Metric label="GMV Delivered" value={formatIdr(deliveredGmv)} />
      <Metric label="Order Aktif" value={String(activeOrders)} />
      <Metric label="Mitra Aktif" value={String(state.partners.filter((p) => p.status === 'active').length)} />
      <Metric label="Invoice Outstanding" value={formatIdr(state.invoices.reduce((s, i) => s + i.amountDue, 0))} />
    </div>
    <div className="grid cols-2">
      <div className="card"><h3>Order by Status</h3><StatusSummary orders={state.orders} /></div>
      <div className="card"><h3>PSAK-oriented Reminder</h3><div className="notice warning">Order dibuat belum otomatis menjadi revenue. Sistem mencatat accounting_events agar finance bisa mapping jurnal saat invoice, pengiriman, penerimaan barang, dan pembayaran.</div></div>
    </div>
    <OrdersTable state={state} orders={state.orders.slice(0, 5)} compact />
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="card metric"><span className="label">{label}</span><span className="value">{value}</span></div>; }

function Catalog({ state, user, token, refresh }: { state: AppState; user: User; token: string; refresh: () => Promise<void> }) {
  const partner = findPartnerForUser(state, user);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');
  if (!partner) return <div className="notice warning">User ini tidak punya data mitra.</div>;
  const activePartner = partner;
  const catalog = getCatalogForPartner(state, activePartner.id);
  const items: CartItem[] = Object.entries(cart).filter(([, qty]) => qty > 0).map(([productId, qty]) => ({ productId, qty }));
  const total = items.reduce((sum, item) => sum + (catalog.find((p) => p.id === item.productId)?.price ?? 0) * item.qty, 0);
  async function checkout() {
    try {
      await api.createOrder(token, { shippingAddress: activePartner.address, notes: 'Order dari portal mitra', items });
      await refresh();
      setCart({}); setMessage('Order berhasil dibuat. Status awal: pending.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Checkout gagal'); }
  }
  return <div className="grid">
    <div className="card"><b>Tier aktif: {tierName(state, activePartner.tierId)}</b><p className="footer-note">Harga di bawah dihitung server-side berdasarkan tier mitra. Frontend tidak menjadi source of truth harga.</p></div>
    {message && <div className="notice">{message}</div>}
    <div className="catalog">{catalog.map((product) => <div className="card product-card" key={product.id}><div className="product-visual">❄️</div><h3>{product.name}</h3><span>{product.sku} • MOQ {product.minimumOrderQty} {product.unit}</span><div className="price">{product.price ? formatIdr(product.price) : 'Belum ada harga'}</div><div className="qty-row"><input className="input" type="number" min="0" placeholder="Qty" value={cart[product.id] ?? ''} onChange={(e) => setCart({ ...cart, [product.id]: Number(e.target.value) })} /><button className="btn small" onClick={() => setCart({ ...cart, [product.id]: (cart[product.id] ?? 0) + product.minimumOrderQty })}>Tambah</button></div></div>)}</div>
    <div className="card" style={{ position: 'sticky', bottom: 16 }}><b>Keranjang:</b> {items.length} item • <b>{formatIdr(total)}</b> <button className="btn primary" style={{ marginLeft: 12 }} disabled={items.length === 0} onClick={checkout}>Checkout</button></div>
  </div>;
}

function Orders({ state, user, token, refresh }: { state: AppState; user: User; token: string; refresh: () => Promise<void> }) {
  const partner = findPartnerForUser(state, user);
  const orders = user.role === 'partner' && partner ? state.orders.filter((o) => o.partnerId === partner.id) : state.orders;
  return <div className="grid"><OrdersTable state={state} orders={orders} user={user} token={token} refresh={refresh} /></div>;
}

function OrdersTable({ state, orders, user, token, refresh, compact }: { state: AppState; orders: Order[]; user?: User; token?: string; refresh?: () => Promise<void>; compact?: boolean }) {
  const [selected, setSelected] = useState<Order | null>(null);
  return <div className="card orders-card"><h3>{compact ? 'Order Terbaru' : 'Daftar Order'}</h3><div className="table-wrap orders-table"><table><thead><tr><th>No Order</th><th>Mitra</th><th>Status</th><th>Total</th><th>Item</th><th>Aksi</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td data-label="No Order"><b>{order.orderNumber}</b><br /><small>{new Date(order.orderDate).toLocaleString('id-ID')}</small></td><td data-label="Mitra">{partnerName(state, order.partnerId)}<br /><small>{tierName(state, state.partners.find((p) => p.id === order.partnerId)?.tierId ?? '')}</small></td><td data-label="Status"><span className={`status ${order.status}`}>{statusLabels[order.status]}</span></td><td data-label="Total"><b>{formatIdr(order.grandTotal)}</b></td><td data-label="Item">{order.items.length} item</td><td data-label="Aksi"><div className="actions"><button className="btn small" onClick={() => setSelected(order)}>Detail</button>{user && token && refresh && user.role !== 'partner' && validTransitions[order.status].map((target) => <button key={target} className="btn small" onClick={async () => { await api.updateOrderStatus(token, order.id, target, `Update ke ${target}`); await refresh(); }}>{statusLabels[target]}</button>)}</div></td></tr>)}</tbody></table></div>{selected && <OrderModal state={state} order={selected} onClose={() => setSelected(null)} />}</div>;
}

function OrderModal({ state, order, onClose }: { state: AppState; order: Order; onClose: () => void }) { return <div className="modal-backdrop"><div className="modal"><div className="topbar"><div><h2>{order.orderNumber}</h2><p>{partnerName(state, order.partnerId)} • {statusLabels[order.status]}</p></div><button className="btn" onClick={onClose}>Tutup</button></div><DocumentOrder state={state} order={order} /></div></div>; }


function ProfileSettings({ state, user, token, setUser, setState }: { state: AppState; user: User; token: string; setUser: (user: User) => void; setState: (state: AppState) => void }) {
  const partner = findPartnerForUser(state, user);
  const [name, setName] = useState(user.name);
  const [address, setAddress] = useState(partner?.address ?? '');
  const [phone, setPhone] = useState(partner?.phone ?? user.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function saveProfile() {
    setSaving(true);
    setMessage('');
    try {
      const result = await api.updateProfile(token, { name, address, phone, avatarUrl });
      setUser(result.user);
      setState(result.state);
      setMessage('Profil berhasil disimpan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Profil gagal disimpan.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="profile-layout">
    <div className="card profile-card">
      <div className="profile-hero">
        <div className="avatar-preview">{avatarUrl ? <img src={avatarUrl} alt={name} /> : <span>{initials(name)}</span>}</div>
        <div><h3>Profil Mitra</h3><p className="footer-note">Update identitas yang tampil di akun mitra dan dokumen operasional.</p></div>
      </div>
      <div className="grid cols-2">
        <div className="field"><label>Foto Profil URL</label><input className="input" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://.../foto.jpg" /></div>
        <div className="field"><label>Nama</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Nomor WA</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" /></div>
        <div className="field"><label>Kode Mitra</label><input className="input" value={partner?.partnerCode ?? '-'} disabled /></div>
        <div className="field profile-address"><label>Alamat</label><textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={4} /></div>
      </div>
      {message && <div className={`notice ${message.includes('berhasil') ? '' : 'warning'}`}>{message}</div>}
      <div className="actions"><button className="btn primary" disabled={saving} onClick={saveProfile}>{saving ? 'Menyimpan...' : 'Simpan Profil'}</button></div>
    </div>
    <div className="card profile-summary"><h3>Ringkasan Akun</h3><p><b>{partner?.businessName ?? name}</b><br />{partner ? tierName(state, partner.tierId) : 'Mitra'}</p><p>WA: {phone || '-'}</p><p>{address || '-'}</p></div>
  </div>;
}

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'M'; }

function Products({ state }: { state: AppState }) { return <div className="card mobile-card-table"><h3>Produk Frozen Food</h3><div className="table-wrap responsive-table"><table><thead><tr><th>SKU</th><th>Produk</th><th>Kategori</th><th>MOQ</th><th>Status</th></tr></thead><tbody>{state.products.map((p) => <tr key={p.id}><td data-label="SKU"><b>{p.sku}</b></td><td data-label="Produk">{p.name}<br /><small>{p.description}</small></td><td data-label="Kategori">{state.categories.find((c) => c.id === p.categoryId)?.name}</td><td data-label="MOQ">{p.minimumOrderQty} {p.unit}</td><td data-label="Status"><span className="status delivered">Aktif</span></td></tr>)}</tbody></table></div></div>; }
function Partners({ state }: { state: AppState }) { return <div className="card mobile-card-table"><h3>Data Mitra</h3><div className="table-wrap responsive-table"><table><thead><tr><th>Kode</th><th>Nama Bisnis</th><th>Tier</th><th>Kontak</th><th>Termin</th><th>Status</th></tr></thead><tbody>{state.partners.map((p) => <tr key={p.id}><td data-label="Kode">{p.partnerCode}</td><td data-label="Nama Bisnis"><b>{p.businessName}</b><br /><small>{p.address}</small></td><td data-label="Tier">{tierName(state, p.tierId)}</td><td data-label="Kontak">{p.contactPerson}<br /><small>{p.phone}</small></td><td data-label="Termin">{p.paymentTermDays} hari</td><td data-label="Status"><span className={`status ${p.status === 'active' ? 'delivered' : 'cancelled'}`}>{p.status}</span></td></tr>)}</tbody></table></div></div>; }
function Pricing({ state }: { state: AppState }) { return <div className="card mobile-card-table"><h3>Harga Produk per Tier</h3><div className="table-wrap responsive-table"><table><thead><tr><th>Produk</th>{state.tiers.map((t) => <th key={t.id}>{t.name}</th>)}</tr></thead><tbody>{state.products.map((p) => <tr key={p.id}><td data-label="Produk"><b>{p.name}</b><br /><small>{p.sku}</small></td>{state.tiers.map((t) => <td data-label={t.name} key={t.id}>{formatIdr(state.prices.find((price) => price.productId === p.id && price.tierId === t.id)?.price ?? 0)}</td>)}</tr>)}</tbody></table></div></div>; }

function Documents({ state, user, token, refresh }: { state: AppState; user: User; token: string; refresh: () => Promise<void> }) {
  const [doc, setDoc] = useState<{ type: 'invoice'; invoice: Invoice } | { type: 'dn'; deliveryNote: DeliveryNote } | null>(null);
  const partner = findPartnerForUser(state, user);
  const orders = user.role === 'partner' && partner ? state.orders.filter((o) => o.partnerId === partner.id) : state.orders;
  return <div className="grid"><div className="card documents-card"><h3>Generate & Print Dokumen</h3><div className="table-wrap documents-table"><table><thead><tr><th>Order</th><th>Mitra</th><th>Invoice</th><th>Surat Jalan</th><th>Aksi</th></tr></thead><tbody>{orders.map((order) => { const inv = state.invoices.find((i) => i.orderId === order.id && i.status !== 'void'); const dn = state.deliveryNotes.find((d) => d.orderId === order.id && d.status !== 'void'); return <tr key={order.id}><td data-label="Order"><b>{order.orderNumber}</b><br /><span className={`status ${order.status}`}>{statusLabels[order.status]}</span></td><td data-label="Mitra">{partnerName(state, order.partnerId)}</td><td data-label="Invoice">{inv ? <button className="btn small" onClick={() => setDoc({ type: 'invoice', invoice: inv })}>{inv.invoiceNumber}</button> : '-'}</td><td data-label="Surat Jalan">{dn ? <button className="btn small" onClick={() => setDoc({ type: 'dn', deliveryNote: dn })}>{dn.deliveryNoteNumber}</button> : '-'}</td><td data-label="Aksi"><div className="actions">{user.role !== 'partner' && <><button className="btn small" onClick={async () => { await api.createInvoice(token, order.id); await refresh(); }}>Generate Invoice</button><button className="btn small" onClick={async () => { await api.createDeliveryNote(token, order.id, { driverName: 'Driver Demo', vehicleNumber: 'B 1234 XYZ' }); await refresh(); }}>Generate SJ</button>{inv && inv.amountDue > 0 && <button className="btn small success" onClick={async () => { await api.recordPayment(token, inv.id, { amount: Math.min(500000, inv.amountDue), method: 'bank_transfer', referenceNumber: 'PAY-DEMO' }); await refresh(); }}>Catat Bayar</button>}</>}</div></td></tr>; })}</tbody></table></div></div>{doc && <DocumentModal state={state} doc={doc} onClose={() => setDoc(null)} />}</div>;
}

function DocumentModal({ state, doc, onClose }: { state: AppState; doc: { type: 'invoice'; invoice: Invoice } | { type: 'dn'; deliveryNote: DeliveryNote }; onClose: () => void }) { const order = state.orders.find((o) => o.id === (doc.type === 'invoice' ? doc.invoice.orderId : doc.deliveryNote.orderId))!; return <div className="modal-backdrop"><div className="modal"><div className="actions no-print" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={() => window.print()}>Print / PDF</button><button className="btn" onClick={onClose}>Tutup</button></div>{doc.type === 'invoice' ? <InvoiceDocument state={state} invoice={doc.invoice} order={order} /> : <DeliveryDocument state={state} deliveryNote={doc.deliveryNote} order={order} />}</div></div>; }

function DocumentOrder({ state, order }: { state: AppState; order: Order }) { return <div className="document"><div className="doc-head"><div><h2>Detail Order</h2><b>{order.orderNumber}</b></div><div><span className={`status ${order.status}`}>{statusLabels[order.status]}</span></div></div><div className="kv"><b>Mitra</b><span>{partnerName(state, order.partnerId)}</span><b>Alamat</b><span>{order.shippingAddress}</span><b>Tanggal</b><span>{new Date(order.orderDate).toLocaleString('id-ID')}</span></div><LineItems order={order} /></div>; }
function InvoiceDocument({ state, invoice, order }: { state: AppState; invoice: Invoice; order: Order }) { return <div className="document"><div className="doc-head"><div><h2>INVOICE</h2><b>{invoice.invoiceNumber}</b></div><div><b>{partnerName(state, invoice.partnerId)}</b><br />Tanggal: {invoice.invoiceDate}<br />Jatuh tempo: {invoice.dueDate}</div></div><LineItems order={order} /><div className="kv"><b>Total</b><span>{formatIdr(invoice.grandTotal)}</span><b>Dibayar</b><span>{formatIdr(invoice.amountPaid)}</span><b>Sisa</b><span>{formatIdr(invoice.amountDue)}</span><b>Status</b><span>{invoice.status}</span></div><p className="footer-note">Invoice berasal dari snapshot order; invoice issued tidak diedit langsung tanpa void/revisi.</p></div>; }
function DeliveryDocument({ state, deliveryNote, order }: { state: AppState; deliveryNote: DeliveryNote; order: Order }) { return <div className="document"><div className="doc-head"><div><h2>SURAT JALAN</h2><b>{deliveryNote.deliveryNoteNumber}</b></div><div><b>{partnerName(state, order.partnerId)}</b><br />Tanggal: {deliveryNote.deliveryDate}<br />Driver: {deliveryNote.driverName ?? '-'}</div></div><LineItems order={order} showPrice={false} /><div className="grid cols-2" style={{ marginTop: 28 }}><div>Pengirim<br /><br /><br />(................)</div><div>Penerima<br /><br /><br />(................)</div></div></div>; }
function LineItems({ order, showPrice = true }: { order: Order; showPrice?: boolean }) { return <div className="table-wrap" style={{ marginTop: 18 }}><table><thead><tr><th>SKU</th><th>Produk</th><th>Qty</th>{showPrice && <><th>Harga</th><th>Total</th></>}</tr></thead><tbody>{order.items.map((item) => <tr key={item.id}><td>{item.skuSnapshot}</td><td>{item.productNameSnapshot}<br /><small>{item.tierNameSnapshot}</small></td><td>{item.qty} {item.unitSnapshot}</td>{showPrice && <><td>{formatIdr(item.unitPrice)}</td><td>{formatIdr(item.lineTotal)}</td></>}</tr>)}</tbody></table></div>; }

function Leaderboard({ state }: { state: AppState }) { return <div className="card mobile-card-table"><h3>Leaderboard Bulan Berjalan</h3><div className="table-wrap responsive-table"><table><thead><tr><th>Rank</th><th>Mitra</th><th>Tier</th><th>Delivered GMV</th><th>Total Qty</th><th>Order</th><th>Poin</th></tr></thead><tbody>{getLeaderboard(state).map((row) => <tr key={row.partnerId}><td data-label="Rank"><b>#{row.rank}</b></td><td data-label="Mitra">{row.partnerName}</td><td data-label="Tier">{row.tier}</td><td data-label="Delivered GMV">{formatIdr(row.totalOrderValue)}</td><td data-label="Total Qty">{row.totalOrderQty}</td><td data-label="Order">{row.totalOrders}</td><td data-label="Poin"><b>{row.points}</b></td></tr>)}</tbody></table></div><p className="footer-note">Hanya order delivered yang dihitung agar ranking tidak dimanipulasi dari pending/cancelled.</p></div>; }
function Reports({ state }: { state: AppState }) { const topProducts = state.products.map((p) => ({ p, qty: state.orders.flatMap((o) => o.items).filter((i) => i.productId === p.id).reduce((s, i) => s + i.qty, 0) })).sort((a, b) => b.qty - a.qty).slice(0, 5); return <div className="grid cols-2"><div className="card"><h3>Sales Summary</h3><StatusSummary orders={state.orders} /></div><div className="card"><h3>Top Products</h3>{topProducts.map((row) => <p key={row.p.id}><b>{row.p.name}</b><br />{row.qty} pack terjual/order</p>)}</div><div className="card"><h3>Invoice Aging</h3>{state.invoices.map((i) => <p key={i.id}><b>{i.invoiceNumber}</b> • {partnerName(state, i.partnerId)}<br />Outstanding {formatIdr(i.amountDue)} • due {i.dueDate}</p>)}</div><div className="card"><h3>Export Ready</h3><div className="notice">Data report sudah dipisah untuk sales, produk, aging invoice, audit, dan accounting event export.</div></div></div>; }
function Audit({ state }: { state: AppState }) { return <LogTable logs={state.auditLogs.map((log) => ({ id: log.id, type: log.action, ref: `${log.entityType}:${log.entityId}`, amount: '', time: log.timestamp, meta: JSON.stringify(log.newValue ?? {}) }))} />; }
function Accounting({ state }: { state: AppState }) { return <LogTable logs={state.accountingEvents.map((log: AccountingEvent) => ({ id: log.id, type: log.eventType, ref: `${log.referenceType}:${log.referenceId}`, amount: log.amount ? formatIdr(log.amount) : '-', time: log.eventDate, meta: JSON.stringify(log.metadata) }))} />; }
function LogTable({ logs }: { logs: { id: string; type: string; ref: string; amount: string; time: string; meta: string }[] }) { return <div className="card mobile-card-table"><div className="table-wrap responsive-table"><table><thead><tr><th>Type</th><th>Reference</th><th>Amount</th><th>Time</th><th>Metadata</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td data-label="Type"><b>{log.type}</b></td><td data-label="Reference">{log.ref}</td><td data-label="Amount">{log.amount}</td><td data-label="Time">{new Date(log.time).toLocaleString('id-ID')}</td><td data-label="Metadata"><small>{log.meta}</small></td></tr>)}</tbody></table></div></div>; }
function StatusSummary({ orders }: { orders: Order[] }) { return <div className="grid">{Object.keys(statusLabels).map((key) => { const status = key as OrderStatus; const count = orders.filter((o) => o.status === status).length; return <div key={status} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #edf2f7', padding: '8px 0' }}><span>{statusLabels[status]}</span><b>{count}</b></div>; })}</div>; }

function partnerName(state: AppState, partnerId: string) { return state.partners.find((p) => p.id === partnerId)?.businessName ?? '-'; }
function tierName(state: AppState, tierId: string) { return state.tiers.find((t) => t.id === tierId)?.name ?? '-'; }
function roleLabel(role: Role) { return ({ super_admin: 'Super Admin', sales_admin: 'Admin Sales', finance_admin: 'Admin Finance', warehouse: 'Warehouse', partner: 'Mitra' } satisfies Record<Role, string>)[role]; }

createRoot(document.getElementById('root')!).render(<App />);
