import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart3, Bell, ClipboardList, Eye, EyeOff, FileText, IceCreamBowl, LayoutDashboard, LogOut, MapPinned, Medal, Menu, Package, Printer, ReceiptText, ShieldCheck, ShoppingCart, Truck, UserCog, Users, X } from 'lucide-react';
import './styles.css';
import { AccountingEvent, CartItem, ExpeditionType, Invoice, Order, OrderStatus, Partner, Role, User, defaultExpedition, expeditionLabels, formatIdr, orderWorkflowStatuses, statusLabels, thermalTruckExpedition } from './domain';
import { AppState, createSeedState } from './seed';
import { api, type Session } from './apiClient';
import { calculateCartWeightGram, calculateStyrofoamPlan, findPartnerForUser, getCatalogForPartner, getLeaderboard, parseProductWeightGram } from './services';

const stateSingleton = createSeedState();
const emptyRuntimeState: AppState = { ...stateSingleton, orders: [], statusHistories: [], invoices: [], deliveryNotes: [], payments: [], leaderboardRows: [] };
const sessionStorageKey = 'wahyu-beef-session-v1';
const demoOrdersStorageKey = 'wahyu-beef-demo-orders-v1';
const expeditionOptions = Object.entries(expeditionLabels) as [ExpeditionType, string][];
const sessionTtlMs = 30 * 60 * 1000;

type View = 'dashboard' | 'catalog' | 'checkout' | 'orders' | 'products' | 'partners' | 'pricing' | 'documents' | 'leaderboard' | 'areas' | 'profile' | 'reports' | 'audit' | 'accounting';

const adminViews: View[] = ['dashboard', 'orders', 'products', 'partners', 'areas', 'pricing', 'documents', 'leaderboard', 'reports', 'accounting', 'audit'];
const partnerViews: View[] = ['catalog', 'checkout', 'orders', 'documents', 'leaderboard', 'areas', 'profile'];
const pathToView: Record<string, View> = {
  '/dashboard': 'dashboard',
  '/katalog': 'catalog',
  '/checkout': 'checkout',
  '/order-saya': 'orders',
  '/orders': 'orders',
  '/order': 'orders',
  '/produk': 'products',
  '/products': 'products',
  '/mitra': 'partners',
  '/partners': 'partners',
  '/harga-tier': 'pricing',
  '/pricing': 'pricing',
  '/invoice': 'documents',
  '/documents': 'documents',
  '/peringkat': 'leaderboard',
  '/leaderboard': 'leaderboard',
  '/area-mitra': 'areas',
  '/areas': 'areas',
  '/profil': 'profile',
  '/profile': 'profile',
  '/reports': 'reports',
  '/accounting': 'accounting',
  '/audit-trail': 'audit',
  '/audit': 'audit',
};
const adminViewPaths: Record<View, string> = {
  dashboard: '/dashboard',
  catalog: '/katalog',
  checkout: '/checkout',
  orders: '/orders',
  products: '/produk',
  partners: '/mitra',
  pricing: '/harga-tier',
  documents: '/invoice',
  leaderboard: '/peringkat',
  areas: '/area-mitra',
  profile: '/profil',
  reports: '/reports',
  audit: '/audit-trail',
  accounting: '/accounting',
};
const partnerViewPaths: Record<View, string> = {
  ...adminViewPaths,
  catalog: '/katalog',
  orders: '/order-saya',
  documents: '/invoice',
  leaderboard: '/peringkat',
  areas: '/area-mitra',
  profile: '/profil',
};
function normalizePath(pathname: string) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return clean.toLowerCase();
}
function defaultViewForUser(user: User): View { return user.role === 'partner' ? 'catalog' : 'dashboard'; }
function isViewAllowedForUser(view: View, user: User) {
  const allowed = user.role === 'partner' ? partnerViews : adminViews;
  return allowed.includes(view);
}
function viewFromCurrentPath(user: User) {
  const view = pathToView[normalizePath(window.location.pathname)];
  return view && isViewAllowedForUser(view, user) ? view : null;
}
function pathForView(view: View, user: User) {
  return (user.role === 'partner' ? partnerViewPaths : adminViewPaths)[view] ?? '/dashboard';
}
function updateBrowserRoute(pathname: string, mode: 'push' | 'replace' = 'push') {
  if (typeof window === 'undefined' || window.location.pathname === pathname) return;
  window.history[mode === 'replace' ? 'replaceState' : 'pushState']({}, '', pathname);
}

function readDemoOrders() {
  try { return JSON.parse(localStorage.getItem(demoOrdersStorageKey) || '[]') as Order[]; } catch { return []; }
}

function rememberDemoOrder(order: Order) {
  if (typeof localStorage === 'undefined') return;
  const orders = readDemoOrders().filter((item) => item.id !== order.id && item.orderNumber !== order.orderNumber);
  localStorage.setItem(demoOrdersStorageKey, JSON.stringify([order, ...orders].slice(0, 30)));
}

function mergeDemoOrders(snapshot: AppState): AppState {
  if (typeof localStorage === 'undefined') return snapshot;
  const demoOrders = readDemoOrders().filter((order) => snapshot.partners.some((partner) => partner.id === order.partnerId));
  if (!demoOrders.length) return snapshot;
  const existing = new Set(snapshot.orders.map((order) => order.id));
  const missing = demoOrders.filter((order) => !existing.has(order.id));
  return missing.length ? { ...snapshot, orders: [...missing, ...snapshot.orders] } : snapshot;
}

function App() {
  const [state, setState] = useState<AppState>(emptyRuntimeState);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [view, setViewState] = useState<View>('dashboard');
  const [authPage, setAuthPage] = useState<'login' | 'register'>(() => normalizePath(window.location.pathname) === '/daftar-mitra' ? 'register' : 'login');
  const [restoringSession, setRestoringSession] = useState(true);

  async function refresh(nextToken = token) {
    const snapshot = await api.snapshot(nextToken);
    setState(mergeDemoOrders(snapshot));
  }

  function clearSavedSession() {
    localStorage.removeItem(sessionStorageKey);
  }

  function navigateView(nextView: View, mode: 'push' | 'replace' = 'push', userOverride = currentUser) {
    if (!userOverride || !isViewAllowedForUser(nextView, userOverride)) return;
    setViewState(nextView);
    updateBrowserRoute(pathForView(nextView, userOverride), mode);
  }

  function showAuthPage(nextPage: 'login' | 'register') {
    setAuthPage(nextPage);
    updateBrowserRoute(nextPage === 'register' ? '/daftar-mitra' : '/login');
  }

  async function activateSession(session: Session, remember = true) {
    const nextView = viewFromCurrentPath(session.user) ?? defaultViewForUser(session.user);
    setToken(session.token);
    setCurrentUser(session.user);
    setViewState(nextView);
    updateBrowserRoute(pathForView(nextView, session.user), 'replace');
    if (remember) localStorage.setItem(sessionStorageKey, JSON.stringify({ token: session.token, user: session.user, expiresAt: session.expiresAt ?? Date.now() + sessionTtlMs }));
    await refresh(session.token);
  }

  useEffect(() => {
    const saved = localStorage.getItem(sessionStorageKey);
    if (!saved) { setRestoringSession(false); return; }
    try {
      const session = JSON.parse(saved) as Session & { expiresAt?: number };
      if (!session.token || !session.user || Number(session.expiresAt ?? 0) <= Date.now()) throw new Error('expired');
      api.me(session.token).then(() => activateSession(session, true)).catch(() => clearSavedSession()).finally(() => setRestoringSession(false));
    } catch {
      clearSavedSession();
      setRestoringSession(false);
    }
  }, []);

  useEffect(() => setState((current) => mergeDemoOrders(current)), []);

  useEffect(() => {
    function onPopState() {
      if (!currentUser) {
        setAuthPage(normalizePath(window.location.pathname) === '/daftar-mitra' ? 'register' : 'login');
        return;
      }
      setViewState(viewFromCurrentPath(currentUser) ?? defaultViewForUser(currentUser));
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [currentUser]);

  if (restoringSession) return <div className="login-page"><div className="login-card"><div className="login-form"><h2>Memuat session...</h2><p>Jarvis sedang mengecek login terakhir.</p></div></div></div>;
  if (!currentUser) return authPage === 'register'
    ? <PartnerRegistration onBack={() => showAuthPage('login')} />
    : <Login onRegister={() => showAuthPage('register')} onLogin={(session) => activateSession(session)} state={state} />;
  return <Shell state={state} user={currentUser} setUser={setCurrentUser} token={token} view={view} setView={navigateView} setState={setState} refresh={refresh} onLogout={() => { clearSavedSession(); setCurrentUser(null); setToken(''); showAuthPage('login'); }} />;
}

function Login({ state, onLogin, onRegister }: { state: AppState; onLogin: (session: Session) => Promise<void>; onRegister: () => void }) {
  const [loginMode, setLoginMode] = useState<'phone' | 'email'>('phone');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const session = await api.login(identifier, password);
      await onLogin(session);
    } catch {
      setError(loginMode === 'phone' ? 'Nomor HP atau password salah.' : 'Email atau password salah.');
    }
  }
  function switchMode(nextMode: 'phone' | 'email') {
    setLoginMode(nextMode);
    setIdentifier('');
    setPassword('');
    setError('');
  }
  return <main className="login-page">
    <section className="login-card">
      <div className="hero-panel wb-css-hero">
        <img className="wb-css-logo" src="/assets/logo-wahyu-beef.png" alt="Logo Wahyu Beef" />
        <p className="wb-script-title">Sukses Berjamaah</p>
        <h1><span>Bersinergi</span><span>Bersama</span></h1>
        <p className="wb-social">@wahyubeef.id</p>
        <span className="wb-join-button">Join Now!</span>
      </div>
      <form className="login-form compact-login-form" onSubmit={submit}>
        <div className="login-mode-toggle"><button className={loginMode === 'phone' ? 'active' : ''} type="button" onClick={() => switchMode('phone')}>Masuk dengan<br /><span>Nomor HP</span></button><button className={loginMode === 'email' ? 'active' : ''} type="button" onClick={() => switchMode('email')}>Masuk dengan<br /><span>Email</span></button></div>
        <div className="field"><label>{loginMode === 'phone' ? 'Nomor HP / WhatsApp' : 'Email'}</label><input className="input" inputMode={loginMode === 'phone' ? 'tel' : 'email'} value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={loginMode === 'phone' ? '08xxxxxxxxxx' : 'nama@email.com'} /></div>
        <div className="field"><label>Password</label><div className="password-input-wrap"><input className="input" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /><button className="password-eye" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}>{showPassword ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}</button></div></div>
        {error && <div className="notice warning">{error}</div>}
        <button className="btn primary" type="submit">Masuk</button>
        <button className="btn register-cta" type="button" onClick={onRegister}>Daftar Menjadi Mitra</button>
      </form>
    </section>
  </main>;
}

function PartnerRegistration({ onBack }: { onBack: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [form, setForm] = useState({
    businessName: '', ownerName: '', phone: '', email: '', province: '', city: '', address: '',
    businessType: 'Reseller frozen food', salesChannel: '', currentSales: '', interestedTier: 'Reseller', notes: '',
  });
  function update(field: keyof typeof form, value: string) { setForm({ ...form, [field]: value }); }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await api.submitPartnerRegistration(form);
      const waUrl = `https://wa.me/${result.adminWhatsapp}?text=${encodeURIComponent(result.whatsappMessage)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Pendaftaran gagal dikirim.');
    } finally {
      setSubmitting(false);
    }
  }
  if (submitted) return <main className="login-page registration-page"><section className="registration-shell success-shell"><div className="registration-hero"><span className="badge"><IceCreamBowl size={16} /> Pendaftaran Mitra</span><h1>Terima kasih, data pendaftaran sudah diterima.</h1><p>Tim Wahyu Beef akan menghubungi calon mitra untuk verifikasi data, area distribusi, dan tier harga yang sesuai.</p><button className="btn primary" type="button" onClick={onBack}>Kembali ke Login</button></div></section></main>;
  return <main className="login-page registration-page">
    <section className="registration-shell">
      <div className="registration-hero wb-css-hero">
        <img className="wb-css-logo" src="/assets/logo-wahyu-beef.png" alt="Logo Wahyu Beef" />
        <p className="wb-script-title">Sukses Berjamaah</p>
        <h1><span>Bersinergi</span><span>Bersama</span></h1>
        <p className="wb-social">@wahyubeef.id</p>
        <span className="wb-join-button">Daftar Mitra</span>
      </div>
      <form className="registration-form" onSubmit={submit}>
        <div className="registration-form-head compact"><button className="btn" type="button" onClick={onBack}>Kembali</button></div>
        <div className="form-section"><h3>Identitas Usaha</h3><div className="grid cols-2"><div className="field"><label>Nama Usaha / Toko</label><input className="input" required value={form.businessName} onChange={(e) => update('businessName', e.target.value)} placeholder="Contoh: Toko Frozen Makmur" /></div><div className="field"><label>Nama Pemilik / PIC</label><input className="input" required value={form.ownerName} onChange={(e) => update('ownerName', e.target.value)} placeholder="Nama lengkap" /></div><div className="field"><label>Nomor WhatsApp</label><input className="input" required value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="08xxxxxxxxxx" /></div><div className="field"><label>Email</label><input className="input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="email@contoh.com" /></div></div></div>
        <div className="form-section"><h3>Lokasi & Area</h3><div className="grid cols-2"><div className="field"><label>Provinsi</label><input className="input" required value={form.province} onChange={(e) => update('province', e.target.value)} placeholder="Jawa Barat" /></div><div className="field"><label>Kota / Kabupaten</label><input className="input" required value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Bandung" /></div><div className="field registration-wide"><label>Alamat Lengkap</label><textarea required value={form.address} onChange={(e) => update('address', e.target.value)} rows={3} placeholder="Alamat toko/gudang/pickup point" /></div></div></div>
        <div className="form-section"><h3>Profil Penjualan</h3><div className="grid cols-2"><div className="field"><label>Jenis Usaha</label><select value={form.businessType} onChange={(e) => update('businessType', e.target.value)}><option>Reseller frozen food</option><option>Agen / distributor</option><option>Retail / minimarket</option><option>Horeca / restoran / katering</option><option>Komunitas / dropshipper</option></select></div><div className="field"><label>Channel Penjualan</label><input className="input" value={form.salesChannel} onChange={(e) => update('salesChannel', e.target.value)} placeholder="Offline, WhatsApp, marketplace, Instagram" /></div><div className="field"><label>Estimasi Penjualan per Bulan</label><select value={form.currentSales} onChange={(e) => update('currentSales', e.target.value)}><option value="">Pilih estimasi</option><option>&lt; 50 kg / bulan</option><option>50 - 200 kg / bulan</option><option>200 - 500 kg / bulan</option><option>&gt; 500 kg / bulan</option></select></div><div className="field"><label>Minat Level Mitra</label><select value={form.interestedTier} onChange={(e) => update('interestedTier', e.target.value)}><option>Reseller</option><option>Agen</option><option>Distributor</option><option>Belum tahu / minta rekomendasi</option></select></div><div className="field registration-wide"><label>Catatan Tambahan</label><textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={3} placeholder="Produk yang diminati, area target, kebutuhan khusus, dll." /></div></div></div>
        <div className="notice">Dengan mengirim form ini, calon mitra setuju untuk dihubungi oleh tim Wahyu Beef untuk proses verifikasi dan onboarding.</div>
        {submitError && <div className="notice warning">{submitError}</div>}
        <button className="btn primary" type="submit" disabled={submitting}>{submitting ? 'Mengirim...' : 'Kirim Pendaftaran'}</button>
      </form>
    </section>
  </main>;
}

function Shell({ state, user, setUser, token, view, setView, setState, refresh, onLogout }: { state: AppState; user: User; setUser: (user: User) => void; token: string; view: View; setView: (view: View) => void; setState: (state: AppState) => void; refresh: () => Promise<void>; onLogout: () => void }) {
  const isPartner = user.role === 'partner';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const nav = isPartner
    ? [['catalog', 'Katalog', ShoppingCart], ['orders', 'Order Saya', ClipboardList], ['documents', 'Invoice', FileText], ['leaderboard', 'Peringkat', Medal], ['areas', 'Area Mitra', MapPinned], ['profile', 'Profil', UserCog]] as const
    : [['dashboard', 'Dashboard', LayoutDashboard], ['orders', 'Order', ClipboardList], ['products', 'Produk', Package], ['partners', 'Mitra', Users], ['areas', 'Area Mitra', MapPinned], ['pricing', 'Harga Tier', ReceiptText], ['documents', 'Invoice', FileText], ['leaderboard', 'Peringkat', Medal], ['reports', 'Reports', BarChart3], ['accounting', 'Accounting Events', ShieldCheck], ['audit', 'Audit Trail', ShieldCheck]] as const;
  const bottomNav = isPartner
    ? nav.filter(([key]) => ['catalog', 'orders', 'documents', 'leaderboard', 'profile'].includes(key))
    : nav.filter(([key]) => ['dashboard', 'orders', 'products', 'partners', 'documents'].includes(key));
  function go(nextView: View) {
    setView(nextView);
    setIsMobileMenuOpen(false);
  }
  return <div className={`app-shell layout ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
    <button className="mobile-menu-scrim" aria-label="Tutup menu" onClick={() => setIsMobileMenuOpen(false)} />
    <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
      <div className="mobile-sidebar-head"><div className="brand"><div className="logo logo-image"><img src="/assets/logo-wahyu-beef.png" alt="Logo Wahyu Beef" /></div><div><h2>Wahyu Beef</h2><span>Mitra App</span></div></div><button className="mobile-close-btn" aria-label="Tutup menu" onClick={() => setIsMobileMenuOpen(false)}><X size={20} /></button></div>
      <nav className="nav">{nav.map(([key, label, Icon]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => go(key)}><Icon size={18} /> {label}</button>)}</nav>
      <div className="user-box"><b>{user.name}</b><br /><span>{roleLabel(user.role)}</span><br /><br /><button className="btn sidebar-logout-btn" onClick={onLogout}><LogOut size={18} /> Keluar</button></div>
      <p className="app-version-note">Versi Aplikasi v1.4.0</p>
    </aside>
    <main className="main">
      <MobileAppBar state={state} user={user} view={view} onMenu={() => setIsMobileMenuOpen(true)} onNavigate={go} />
      <Topbar state={state} user={user} view={view} onNavigate={go} />
      {view === 'dashboard' && <Dashboard state={state} />}
      {(view === 'catalog' || view === 'checkout') && <Catalog state={state} user={user} token={token} refresh={refresh} setView={setView} currentView={view} />}
      {view === 'orders' && <Orders state={state} user={user} token={token} refresh={refresh} />}
      {view === 'products' && <Products state={state} user={user} token={token} refresh={refresh} />}
      {view === 'partners' && <Partners state={state} />}
      {view === 'pricing' && <Pricing state={state} />}
      {view === 'documents' && <Documents state={state} user={user} token={token} refresh={refresh} />}
      {view === 'leaderboard' && <Leaderboard state={state} />}
      {view === 'areas' && <PartnerAreas state={state} user={user} />}
      {view === 'profile' && <ProfileSettings state={state} user={user} token={token} setUser={setUser} setState={setState} />}
      {view === 'reports' && <Reports state={state} />}
      {view === 'audit' && <Audit state={state} />}
      {view === 'accounting' && <Accounting state={state} />}
    </main>
    <nav className="mobile-bottom-nav" aria-label="Menu utama mobile">{bottomNav.map(([key, label, Icon]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => go(key)}><span><Icon size={21} /></span><b>{label}</b></button>)}</nav>
  </div>;
}

type AppNotification = { id: string; targetView: View; title: string; body: string; meta: string };

function getAppNotifications(state: AppState, user: User): AppNotification[] {
  const visibleOrders = user.role === 'partner' ? state.orders.filter((order) => order.createdBy === user.id || findPartnerForUser(state, user)?.id === order.partnerId) : state.orders;
  const activeOrders = visibleOrders.filter((order) => !['delivered', 'cancelled'].includes(order.status));
  const recentInvoices = state.invoices.filter((invoice) => invoice.status !== 'void' && (user.role !== 'partner' || visibleOrders.some((order) => order.id === invoice.orderId))).slice(0, 2);
  return [
    ...activeOrders.slice(0, 4).map((order) => ({ id: `order-${order.id}`, targetView: 'orders' as View, title: statusLabels[order.status], body: `${order.orderNumber} • ${partnerName(state, order.partnerId)}`, meta: new Date(order.orderDate).toLocaleDateString('id-ID') })),
    ...recentInvoices.map((invoice) => ({ id: `invoice-${invoice.id}`, targetView: 'documents' as View, title: invoice.amountDue > 0 ? 'Invoice belum lunas' : 'Invoice lunas', body: `${invoice.invoiceNumber} • ${formatIdr(invoice.amountDue > 0 ? invoice.amountDue : invoice.grandTotal)}`, meta: invoice.invoiceDate })),
  ];
}

function useNotificationReadState(userId: string, notifications: AppNotification[]) {
  const readStorageKey = `wahyu-beef-read-notifications-${userId}`;
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(readStorageKey) || '[]') as string[]; } catch { return []; }
  });
  const visibleReadNotificationIds = readNotificationIds.filter((id) => notifications.some((item) => item.id === id));
  const unreadCount = notifications.filter((item) => !visibleReadNotificationIds.includes(item.id)).length;
  function markNotificationAsRead(id: string) {
    setReadNotificationIds((current) => {
      const next = current.includes(id) ? current : [...current, id];
      localStorage.setItem(readStorageKey, JSON.stringify(next));
      return next;
    });
  }
  return { visibleReadNotificationIds, unreadCount, markNotificationAsRead };
}

function NotificationDropdown({ notifications, unreadCount, readIds, onRead, onNavigate, onClose }: { notifications: AppNotification[]; unreadCount: number; readIds: string[]; onRead: (id: string) => void; onNavigate: (view: View) => void; onClose: () => void }) {
  return <div className="notification-panel"><div className="notification-head"><div><b>Notifikasi</b><small>{unreadCount} belum dibaca</small></div><button className="notification-x" type="button" aria-label="Tutup notifikasi" onClick={onClose}><X size={18} /></button></div>{notifications.length ? <div className="notification-list">{notifications.map((item) => { const isRead = readIds.includes(item.id); return <button type="button" className={`notification-item ${isRead ? 'read' : 'unread'}`} key={item.id} onClick={() => onRead(item.id)} onDoubleClick={() => onNavigate(item.targetView)}><span className="notification-dot" /><div><b>{item.title}</b><p>{item.body}</p><small>{isRead ? 'Sudah dibaca' : item.meta}</small></div></button>; })}</div> : <div className="notification-empty">Belum ada notifikasi baru.</div>}<button className="notification-close" type="button" onClick={onClose}>Tutup</button></div>;
}

function MobileAppBar({ state, user, view, onMenu, onNavigate }: { state: AppState; user: User; view: View; onMenu: () => void; onNavigate: (view: View) => void }) {
  const [open, setOpen] = useState(false);
  const title: Record<View, string> = { dashboard: 'Dashboard', catalog: 'Katalog', checkout: 'Checkout', orders: user.role === 'partner' ? 'Order Saya' : 'Order', products: 'Produk', partners: 'Mitra', pricing: 'Harga Tier', documents: 'Invoice', leaderboard: 'Papan Peringkat Mitra', areas: 'Area Mitra', profile: 'Profil', reports: 'Reports', audit: 'Audit Trail', accounting: 'Accounting' };
  const notifications = getAppNotifications(state, user);
  const { visibleReadNotificationIds, unreadCount, markNotificationAsRead } = useNotificationReadState(user.id, notifications);
  return <header className="mobile-appbar"><button type="button" aria-label="Buka menu" onClick={onMenu}><Menu size={25} /></button><h1>{title[view]}</h1><div className="mobile-notification-wrap"><button type="button" className="mobile-bell" aria-expanded={open} aria-label="Buka notifikasi" onClick={() => setOpen((value) => !value)}><Bell size={22} />{unreadCount > 0 && <span>{Math.min(unreadCount, 9)}</span>}</button>{open && <NotificationDropdown notifications={notifications} unreadCount={unreadCount} readIds={visibleReadNotificationIds} onRead={markNotificationAsRead} onNavigate={onNavigate} onClose={() => setOpen(false)} />}</div></header>;
}

function Topbar({ state, user, view, onNavigate }: { state: AppState; user: User; view: View; onNavigate: (view: View) => void }) {
  const [open, setOpen] = useState(false);
  const partner = findPartnerForUser(state, user);
  const title: Record<View, string> = { dashboard: 'Dashboard Operasional', catalog: 'Katalog Mitra', checkout: 'Checkout Pesanan', orders: user.role === 'partner' ? 'Order Saya' : 'Order Management', products: 'Product Catalog', partners: 'Mitra Management', pricing: 'Tier Pricing', documents: 'Invoice', leaderboard: 'Papan Peringkat Mitra', areas: 'Area Mitra', profile: 'Setting Profil', reports: 'Basic Reports', audit: 'Audit Trail', accounting: 'Accounting Event Log' };
  const notifications = getAppNotifications(state, user);
  const { visibleReadNotificationIds, unreadCount, markNotificationAsRead } = useNotificationReadState(user.id, notifications);
  return <header className="topbar"><div><h1>{title[view]}</h1><p>{partner ? `${partner.businessName} • ${tierName(state, partner.tierId)}` : 'Admin workspace Wahyu Beef'}</p></div><div className="desktop-topbar-actions"><div className="desktop-notification-wrap"><button type="button" className="desktop-bell" aria-expanded={open} aria-label="Buka notifikasi" onClick={() => setOpen((value) => !value)}><Bell size={21} />{unreadCount > 0 && <span>{Math.min(unreadCount, 99)}</span>}</button>{open && <NotificationDropdown notifications={notifications} unreadCount={unreadCount} readIds={visibleReadNotificationIds} onRead={markNotificationAsRead} onNavigate={onNavigate} onClose={() => setOpen(false)} />}</div><div className="badge" style={{ background: '#fff8e8', color: '#8f121b', border: '1px solid #ead7ae' }}>{roleLabel(user.role)}</div></div></header>;
}

function Dashboard({ state }: { state: AppState }) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const deliveredGmv = state.orders.filter((o) => o.status === 'delivered').reduce((s, o) => s + o.grandTotal, 0);
  const monthlyRevenue = state.invoices.filter((invoice) => invoice.invoiceDate.startsWith(monthKey) && invoice.status !== 'void').reduce((sum, invoice) => sum + invoice.amountPaid, 0);
  const totalPaid = state.invoices.filter((invoice) => invoice.status !== 'void').reduce((sum, invoice) => sum + invoice.amountPaid, 0);
  const totalDue = state.invoices.filter((invoice) => invoice.status !== 'void').reduce((sum, invoice) => sum + invoice.amountDue, 0);
  const invoiceTotal = totalPaid + totalDue;
  const activeOrders = state.orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length;
  return <div className="grid">
    <div className="grid cols-4">
      <Metric label="GMV Delivered" value={formatIdr(deliveredGmv)} />
      <Metric label="Order Aktif" value={String(activeOrders)} />
      <Metric label="Mitra Aktif" value={String(state.partners.filter((p) => p.status === 'active').length)} />
      <Metric label="Invoice Outstanding" value={formatIdr(totalDue)} />
    </div>
    <div className="grid cols-2">
      <div className="card"><h3>Order by Status</h3><StatusSummary orders={state.orders} /></div>
      <FinanceChartCard monthlyRevenue={monthlyRevenue} paid={totalPaid} due={totalDue} total={invoiceTotal} monthLabel={now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} />
    </div>
    <OrdersTable state={state} orders={state.orders.slice(0, 5)} compact />
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="card metric"><span className="label">{label}</span><span className="value">{value}</span></div>; }

function FinanceChartCard({ monthlyRevenue, paid, due, total, monthLabel }: { monthlyRevenue: number; paid: number; due: number; total: number; monthLabel: string }) {
  const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const duePct = total > 0 ? Math.round((due / total) * 100) : 0;
  const maxValue = Math.max(monthlyRevenue, paid, due, 1);
  const revenueHeight = Math.max(8, Math.round((monthlyRevenue / maxValue) * 100));
  const paidHeight = Math.max(8, Math.round((paid / maxValue) * 100));
  const dueHeight = Math.max(8, Math.round((due / maxValue) * 100));
  return <div className="card finance-chart-card"><div className="chart-head"><div><h3>Grafik Keuangan</h3><p>Total omzet bulan ini & status tagihan</p></div><span className="area-pill">{monthLabel}</span></div><div className="revenue-highlight"><span>Total Omzet Bulan Ini</span><b>{formatIdr(monthlyRevenue)}</b></div><div className="mini-bar-chart" aria-label="Grafik omzet dan tagihan"><ChartBar label="Omzet" value={monthlyRevenue} height={revenueHeight} tone="revenue" /><ChartBar label="Terbayar" value={paid} height={paidHeight} tone="paid" /><ChartBar label="Belum" value={due} height={dueHeight} tone="due" /></div><div className="invoice-split"><div className="split-track"><span className="paid" style={{ width: `${paidPct}%` }} /><span className="due" style={{ width: `${duePct}%` }} /></div><div className="split-grid"><div><span className="legend-dot paid-dot" />Sudah terbayar<b>{formatIdr(paid)}</b><small>{paidPct}%</small></div><div><span className="legend-dot due-dot" />Belum terbayar<b>{formatIdr(due)}</b><small>{duePct}%</small></div></div></div></div>;
}

function ChartBar({ label, value, height, tone }: { label: string; value: number; height: number; tone: 'revenue' | 'paid' | 'due' }) {
  return <div className={`chart-bar ${tone}`}><div className="bar-shell"><span style={{ height: `${height}%` }} /></div><b>{formatIdr(value)}</b><small>{label}</small></div>;
}

type CatalogProduct = ReturnType<typeof getCatalogForPartner>[number];

const preferredCategoryIds = ['cat-daging-sapi', 'cat-tulang-sapi', 'cat-jerohan-sapi', 'cat-processed-meat', 'cat-seafood-series'];
function orderedCategories(state: AppState) {
  return [...state.categories].sort((a, b) => {
    const ai = preferredCategoryIds.indexOf(a.id);
    const bi = preferredCategoryIds.indexOf(b.id);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.name.localeCompare(b.name);
  });
}
function categoryName(state: AppState, categoryId: string) {
  return state.categories.find((category) => category.id === categoryId)?.name ?? '-';
}
function productsByCategory<T extends { categoryId: string }>(state: AppState, products: T[]) {
  return orderedCategories(state).map((category) => ({ category, products: products.filter((product) => product.categoryId === category.id) })).filter((group) => group.products.length > 0);
}
type PackageOption = { weightGram: 250 | 500 | 1000; label: string; ratio: number };
const packageOptions: PackageOption[] = [
  { weightGram: 250, label: '250 gr', ratio: 0.25 },
  { weightGram: 500, label: '500 gr', ratio: 0.5 },
  { weightGram: 1000, label: '1000 gr', ratio: 1 },
];
const packagingCategoryIds = new Set(['cat-daging-sapi', 'cat-tulang-sapi', 'cat-jerohan-sapi']);

function Catalog({ state, user, token, refresh, setView, currentView }: { state: AppState; user: User; token: string; refresh: () => Promise<void>; setView: (view: View) => void; currentView: View }) {
  const partner = findPartnerForUser(state, user);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartNotes, setCartNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [isCheckout, setIsCheckout] = useState(currentView === 'checkout');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  if (!partner) return <div className="notice warning">User ini tidak punya data mitra.</div>;
  const activePartner = partner;
  const catalog = getCatalogForPartner(state, activePartner.id);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredCatalog = catalog.filter((product) => {
    const matchesCategory = categoryFilter === 'all' || product.categoryId === categoryFilter;
    const haystack = `${product.name} ${product.sku} ${product.description ?? ''} ${categoryName(state, product.categoryId)}`.toLowerCase();
    return matchesCategory && (!normalizedSearch || haystack.includes(normalizedSearch));
  });
  const catalogGroups = productsByCategory(state, filteredCatalog);
  const activeCategoryName = categoryFilter === 'all' ? 'Semua Kategori' : categoryName(state, categoryFilter);
  const items: CartItem[] = Object.entries(cart).filter(([, qty]) => qty > 0).map(([key, qty]) => ({ ...cartKeyToItem(key, qty), notes: cartNotes[key]?.trim() || undefined }));
  const total = items.reduce((sum, item) => {
    const product = catalog.find((p) => p.id === item.productId);
    return sum + getPackagePrice(product?.price ?? 0, item.packageWeightGram) * item.qty;
  }, 0);
  const cartQty = items.reduce((sum, item) => sum + item.qty, 0);
  function addToCart(product: CatalogProduct, qty = product.minimumOrderQty, option?: PackageOption) {
    const key = cartKey(product.id, option?.weightGram);
    setCart((current) => ({ ...current, [key]: (current[key] ?? 0) + Math.max(qty, product.minimumOrderQty) }));
  }
  function updateCartQty(key: string, qty: number) {
    setCart((current) => {
      const next = { ...current };
      if (qty <= 0) {
        delete next[key];
        setCartNotes((currentNotes) => {
          const nextNotes = { ...currentNotes };
          delete nextNotes[key];
          return nextNotes;
        });
      }
      else next[key] = qty;
      return next;
    });
  }
  async function placeOrder(requestedDeliveryDate?: string, expedition: ExpeditionType = defaultExpedition) {
    try {
      const createdOrder = await api.createOrder(token, { shippingAddress: activePartner.address, requestedDeliveryDate, expedition, notes: 'Order dari portal mitra', items });
      rememberDemoOrder(createdOrder as Order);
      await refresh();
      setCart({});
      setCartNotes({});
      setMessage('Order berhasil dibuat. Status awal: pending.');
      setView('orders');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Checkout gagal'); }
  }
  if (isCheckout) return <CheckoutPage state={state} catalog={catalog} partnerAddress={activePartner.address} cart={cart} cartNotes={cartNotes} message={message} onBack={() => { setIsCheckout(false); setView('catalog'); }} onUpdateQty={updateCartQty} onUpdateNote={(key, note) => setCartNotes((current) => ({ ...current, [key]: note }))} onPlaceOrder={placeOrder} />;
  return <div className="grid">
    <div className="card"><b>Tier aktif: {tierName(state, activePartner.tierId)}</b></div>
    {message && <div className="notice">{message}</div>}
    <div className="catalog-filter-bar marketplace-filter-bar"><div className="field catalog-search-field"><label>Cari Produk</label><input className="input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cari nama produk, SKU, deskripsi..." /></div><div className="field"><label>Filter Kategori</label><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Semua Kategori</option>{orderedCategories(state).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>{(categoryFilter !== 'all' || searchQuery) && <button type="button" className="btn small" onClick={() => { setCategoryFilter('all'); setSearchQuery(''); }}>Reset Filter</button>}</div>
    <div className="catalog-toolbar"><div><b>{filteredCatalog.length} / {catalog.length} Produk</b><span>Harga {tierName(state, activePartner.tierId)} • {activeCategoryName}{normalizedSearch ? ` • “${searchQuery.trim()}”` : ''}</span></div><div className="catalog-view-label">Tampilan <span className="grid-icon">▦</span></div></div>
    {catalogGroups.length ? <div className="catalog-category-stack">{catalogGroups.map(({ category, products }) => <section className="catalog-category-section" key={category.id}>
      <div className="category-section-head"><div><span>Kategori</span><h3>{category.name}</h3></div><b>{products.length} Produk</b></div>
      <div className="catalog marketplace-catalog">{products.map((product) => {
        const hasPackageOptions = canChoosePackaging(product);
        return <div className="product-card marketplace-card" key={product.id} onClick={() => hasPackageOptions && setSelectedProduct(product)} role={hasPackageOptions ? 'button' : undefined} tabIndex={hasPackageOptions ? 0 : undefined} onKeyDown={(event) => { if (hasPackageOptions && (event.key === 'Enter' || event.key === ' ')) setSelectedProduct(product); }}>
          <div className={`product-visual marketplace-visual ${product.imageUrl ? 'has-photo' : ''}`}>{product.imageUrl && <img src={product.imageUrl} alt={product.name} loading="lazy" />}<span className="discount-badge">Mitra</span><div className="placeholder-brand">Wahyu Beef</div>{!product.imageUrl && <div className="placeholder-title">{product.name}</div>}<div className="placeholder-pack">{hasPackageOptions ? '250g • 500g • 1kg' : product.unit}</div></div>
          <div className="product-info"><h3>{product.name}</h3><span className="product-meta">{product.sku} • {hasPackageOptions ? 'Pilih kemasan' : `MOQ ${product.minimumOrderQty} ${product.unit}`}</span><div className="price-row"><span className="voucher-tag">%</span><div className="price">{product.price ? formatIdr(product.price) : 'Belum ada harga'}</div></div><div className="deal-note">{hasPackageOptions ? 'Klik untuk pilih ukuran kemasan' : `Harga khusus ${tierName(state, activePartner.tierId)}`}</div><div className="rating-row"><span>★ 5.0</span><span>•</span><span>{Math.max(10, product.minimumOrderQty * 10)}+ terjual</span></div>{hasPackageOptions ? <button className="btn small product-pick-btn" onClick={(event) => { event.stopPropagation(); setSelectedProduct(product); }}>Pilih</button> : <div className="qty-row compact" onClick={(event) => event.stopPropagation()}><input className="input" type="number" min="0" placeholder="Qty" value={cart[cartKey(product.id)] ?? ''} onChange={(e) => setCart({ ...cart, [cartKey(product.id)]: Number(e.target.value) })} /><button className="btn small" onClick={() => addToCart(product)}>Tambah</button></div>}</div>
        </div>;
      })}</div>
    </section>)}</div> : <div className="notice warning">Produk tidak ditemukan. Coba ubah kategori atau kata kunci pencarian.</div>}
    <button className="floating-cart" type="button" disabled={items.length === 0} onClick={() => { setIsCheckout(true); setView('checkout'); }} aria-label={`Checkout ${cartQty} item dengan total ${formatIdr(total)}`}>
      <span className="floating-cart-icon"><ShoppingCart size={23} strokeWidth={2.8} /><span className="floating-cart-badge">{cartQty > 99 ? '99+' : cartQty}</span></span>
      <span className="floating-cart-copy"><span>Total Harga</span><b>{formatIdr(total)}</b></span>
    </button>
    <div className="card cart-sticky"><b>Keranjang:</b> {items.length} item • <b>{formatIdr(total)}</b> <button className="btn primary" style={{ marginLeft: 12 }} disabled={items.length === 0} onClick={() => { setIsCheckout(true); setView('checkout'); }}>Checkout</button></div>
    {selectedProduct && <PackageModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={(option, qty) => { addToCart(selectedProduct, qty, option); setSelectedProduct(null); }} />}
  </div>;
}

function CheckoutPage({ state, catalog, partnerAddress, assistedPartner, cart, cartNotes, message, onBack, onUpdateQty, onUpdateNote, onPlaceOrder }: { state: AppState; catalog: CatalogProduct[]; partnerAddress: string; assistedPartner?: Partner; cart: Record<string, number>; cartNotes: Record<string, string>; message: string; onBack: () => void; onUpdateQty: (key: string, qty: number) => void; onUpdateNote: (key: string, note: string) => void; onPlaceOrder: (requestedDeliveryDate?: string, expedition?: ExpeditionType) => Promise<void> }) {
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
  const [expedition, setExpedition] = useState<ExpeditionType>(defaultExpedition);
  const rows = Object.entries(cart).filter(([, qty]) => qty > 0).map(([key, qty]) => {
    const item = cartKeyToItem(key, qty);
    const product = catalog.find((p) => p.id === item.productId)!;
    const unitPrice = getPackagePrice(product?.price ?? 0, item.packageWeightGram);
    return { key, item, product, unitPrice, lineTotal: unitPrice * qty };
  }).filter((row) => row.product);
  const totalPesanan = rows.reduce((sum, row) => sum + row.lineTotal, 0);
  const totalBeratGram = calculateCartWeightGram(catalog, rows.map((row) => row.item));
  const shouldUseStyrofoam = expedition !== thermalTruckExpedition;
  const styrofoamPlan = shouldUseStyrofoam ? calculateStyrofoamPlan(totalBeratGram) : [];
  const packingTotal = styrofoamPlan.reduce((sum, item) => sum + item.lineTotal, 0);
  const diskon = 0;
  const totalTagihan = totalPesanan - diskon + packingTotal;
  return <div className="grid checkout-page">
    <div className="card checkout-head"><div><h3>Ringkasan Keranjang</h3><p className="footer-note">Cek ulang produk, ekspedisi, kemasan, qty, sterofoam otomatis, dan catatan sebelum menekan tombol Selesaikan Pesanan.</p>{assistedPartner && <p className="footer-note"><b>Order dibantu admin untuk:</b> {assistedPartner.businessName} • {tierName(state, assistedPartner.tierId)}</p>}</div><button className="btn" onClick={onBack}>Kembali ke Katalog</button></div>
    {message && <div className="notice">{message}</div>}
    <div className="card checkout-card">
      {rows.length === 0 ? <div className="notice warning">Keranjang masih kosong.</div> : <div className="checkout-items">{rows.map((row) => {
        const weightGram = parseProductWeightGram(row.product, row.item.packageWeightGram);
        return <div className="checkout-item" key={row.key}>
          <div className={`checkout-thumb ${row.product.imageUrl ? 'has-photo' : ''}`}>{row.product.imageUrl ? <img src={row.product.imageUrl} alt={row.product.name} /> : <span>WB</span>}</div>
          <div className="checkout-info"><b>{row.item.packageWeightGram ? `${row.product.name} ${row.item.packageWeightGram} gr` : row.product.name}</b><span>{row.product.sku} • {row.item.packageLabel ?? row.product.unit}</span><small>{formatIdr(row.unitPrice)} / item • Berat {formatWeightGram(weightGram * row.item.qty)}</small><label className="checkout-note"><span>Catatan</span><textarea value={cartNotes[row.key] ?? ''} onChange={(event) => onUpdateNote(row.key, event.target.value)} rows={2} placeholder="Contoh: potong kecil, kirim pagi, pilih yang minim lemak" /></label></div>
          <div className="qty-stepper checkout-stepper"><button type="button" onClick={() => onUpdateQty(row.key, row.item.qty - 1)}>−</button><input className="input" type="number" min="0" value={row.item.qty} onChange={(event) => onUpdateQty(row.key, Number(event.target.value) || 0)} /><button type="button" onClick={() => onUpdateQty(row.key, row.item.qty + 1)}>+</button></div>
          <div className="checkout-line-total"><b>{formatIdr(row.lineTotal)}</b><button className="btn small" onClick={() => onUpdateQty(row.key, 0)}>Hapus</button></div>
        </div>;
      })}{!shouldUseStyrofoam && rows.length > 0 && <div className="checkout-item checkout-packaging-item checkout-packaging-free"><div className="checkout-thumb checkout-packaging-thumb"><Truck size={23} /></div><div className="checkout-info"><b>Tanpa Sterofoam</b><span>Truk Thermal Wahyu Beef</span><small>Packaging sterofoam tidak dikenakan untuk armada thermal.</small></div><div className="checkout-stepper checkout-packaging-qty"><b>Rp0</b></div><div className="checkout-line-total"><b>{formatIdr(0)}</b><small>Otomatis</small></div></div>}{styrofoamPlan.map((item) => <div className="checkout-item checkout-packaging-item" key={item.size}>
        <div className="checkout-thumb checkout-packaging-thumb"><span>SF</span></div>
        <div className="checkout-info"><b>{item.label}</b><span>Kemasan otomatis • Kapasitas {item.capacityLabel}</span><small>{formatIdr(item.unitPrice)} / pcs • Qty {item.qty} pcs</small></div>
        <div className="checkout-stepper checkout-packaging-qty"><b>{item.qty} pcs</b></div>
        <div className="checkout-line-total"><b>{formatIdr(item.lineTotal)}</b><small>Otomatis</small></div>
      </div>)}</div>}
    </div>
    <div className="card checkout-summary proper-checkout-summary"><div className="checkout-address-block"><b>Alamat Kirim</b><p>{partnerAddress}</p></div><div className="field checkout-expedition-field"><label>Ekspedisi</label><select value={expedition} onChange={(event) => setExpedition(event.target.value as ExpeditionType)}>{expeditionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small>{expedition === thermalTruckExpedition ? 'Truk thermal: biaya sterofoam otomatis Rp0.' : 'Pilih ekspedisi untuk pengiriman order.'}</small></div><div className="field checkout-delivery-date"><label>Tanggal Kirim</label><input className="input" type="date" value={requestedDeliveryDate} onChange={(event) => setRequestedDeliveryDate(event.target.value)} /><small>Diisi oleh mitra saat membuat order.</small></div><div className="checkout-total-panel"><div><span>Total Pesanan</span><b>{formatIdr(totalPesanan)}</b></div><div><span>Total Berat</span><b>{formatWeightGram(totalBeratGram)}</b></div><div><span>Ekspedisi</span><b>{expeditionLabels[expedition]}</b></div><div><span>Biaya Sterofoam</span><b>{formatIdr(packingTotal)}</b></div><div><span>Diskon</span><b>{formatIdr(diskon)}</b></div><div className="checkout-grand-total"><span>Total Tagihan</span><strong>{formatIdr(totalTagihan)}</strong></div></div><button className="btn primary" disabled={rows.length === 0} onClick={() => onPlaceOrder(requestedDeliveryDate, expedition)}>Selesaikan Pesanan</button></div>
  </div>;
}

function PackageModal({ product, onClose, onAdd }: { product: CatalogProduct; onClose: () => void; onAdd: (option: PackageOption, qty: number) => void }) {
  const [selected, setSelected] = useState<PackageOption>(packageOptions[2]);
  const [qty, setQty] = useState(product.minimumOrderQty);
  return <div className="modal-backdrop package-modal-backdrop" onClick={onClose}><div className="modal package-modal" onClick={(event) => event.stopPropagation()}><div className="topbar"><div><h2>{product.name}</h2><p>Pilih ukuran kemasan produk</p></div><button className="btn" onClick={onClose}>Tutup</button></div>
    <div className={`package-modal-hero ${product.imageUrl ? 'has-photo' : ''}`}>{product.imageUrl && <img src={product.imageUrl} alt={product.name} />}<span>{product.name}</span></div>
    <div className="package-option-grid">{packageOptions.map((option) => <button type="button" key={option.weightGram} className={`package-option ${selected.weightGram === option.weightGram ? 'active' : ''}`} onClick={() => setSelected(option)}><b>{product.name} {option.label}</b><span>{formatIdr(getPackagePrice(product.price ?? 0, option.weightGram))}</span></button>)}</div>
    <div className="package-modal-footer"><div className="field"><label>Qty</label><div className="qty-stepper"><button type="button" onClick={() => setQty(Math.max(product.minimumOrderQty, qty - 1))}>−</button><input className="input" type="number" min={product.minimumOrderQty} value={qty} onChange={(event) => setQty(Math.max(product.minimumOrderQty, Number(event.target.value) || product.minimumOrderQty))} /><button type="button" onClick={() => setQty(qty + 1)}>+</button></div></div><button className="btn primary" onClick={() => onAdd(selected, Math.max(qty || product.minimumOrderQty, product.minimumOrderQty))}>Tambah {selected.label} • {formatIdr(getPackagePrice(product.price ?? 0, selected.weightGram) * Math.max(qty || product.minimumOrderQty, product.minimumOrderQty))}</button></div>
  </div></div>;
}

function canChoosePackaging(product: CatalogProduct) { return packagingCategoryIds.has(product.categoryId); }
function getPackagePrice(basePrice: number, weightGram?: number) { return Math.round(basePrice * (weightGram === 250 ? 0.25 : weightGram === 500 ? 0.5 : 1)); }
function formatWeightGram(value: number) { return `${Math.round(value).toLocaleString('id-ID')} Gram`; }
function cartKey(productId: string, weightGram?: number) { return weightGram ? `${productId}__${weightGram}` : productId; }
function cartKeyToItem(key: string, qty: number): CartItem { const [productId, weight] = key.split('__'); const packageWeightGram = Number(weight) as 250 | 500 | 1000; return weight ? { productId, qty, packageWeightGram, packageLabel: `${packageWeightGram} GR` } : { productId, qty }; }

function Orders({ state, user, token, refresh }: { state: AppState; user: User; token: string; refresh: () => Promise<void> }) {
  const partner = findPartnerForUser(state, user);
  const orders = user.role === 'partner' && partner ? state.orders.filter((o) => o.partnerId === partner.id) : state.orders;
  return <div className="grid"><OrdersTable state={state} orders={orders} user={user} token={token} refresh={refresh} /></div>;
}


const packingOptions = [
  { value: 'none', label: 'Tanpa packing tambahan', fee: 0 },
  { value: 'small_styrofoam', label: 'Sterofoam kecil', fee: 20000 },
  { value: 'medium_styrofoam', label: 'Sterofoam sedang', fee: 30000 },
  { value: 'large_styrofoam', label: 'Sterofoam besar', fee: 50000 },
] as const;

function packingLabel(value?: Order['packingType']) {
  return packingOptions.find((item) => item.value === (value ?? 'none'))?.label ?? '-';
}
function packingQty(order: Order) {
  return order.packingType && order.packingType !== 'none' ? Math.max(1, order.packingQuantity ?? 1) : 0;
}
function packingSummary(order: Order) {
  const qty = packingQty(order);
  return qty ? `${packingLabel(order.packingType)} × ${qty} pcs` : packingLabel(order.packingType);
}

function OrderShippingPanel({ order, token, refresh }: { order: Order; token: string; refresh: () => Promise<void> }) {
  const [shippingCost, setShippingCost] = useState(String(order.shippingCost ?? 0));
  const [packingType, setPackingType] = useState<Order['packingType']>(order.packingType ?? 'none');
  const [packingQuantity, setPackingQuantity] = useState(String(order.packingQuantity ?? (order.packingType && order.packingType !== 'none' ? 1 : 0)));
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? '');
  const [trackingReceiptUrl, setTrackingReceiptUrl] = useState(order.trackingReceiptUrl ?? '');
  const [message, setMessage] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const selectedPacking = packingOptions.find((item) => item.value === packingType) ?? packingOptions[0];
  const normalizedPackingQty = packingType === 'none' ? 0 : Math.max(1, Math.round(Number(packingQuantity || 1)));
  const packingTotal = selectedPacking.fee * normalizedPackingQty;
  async function chooseReceipt(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setMessage('File resi harus gambar atau PDF.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setMessage('Ukuran file resi maksimal 1 MB.');
      return;
    }
    setUploadingReceipt(true);
    setMessage('Mengupload resi pengiriman...');
    try {
      const result = await api.uploadTrackingReceipt(token, file);
      setTrackingReceiptUrl(result.trackingReceiptUrl);
      setMessage('Resi berhasil diupload. Klik Simpan Ongkir / Resi untuk menyimpan ke order.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload resi gagal.');
    } finally {
      setUploadingReceipt(false);
    }
  }
  async function save() {
    setMessage('');
    try {
      await api.updateOrderShipping(token, order.id, { shippingCost: Number(shippingCost || 0), packingFee: packingTotal, packingType, packingQuantity: normalizedPackingQty, trackingNumber, trackingReceiptUrl });
      await refresh();
      setMessage('Info ongkir, packing, dan resi berhasil disimpan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Info pengiriman gagal disimpan.');
    }
  }
  return <div className="shipping-panel">
    <b>Biaya Packing, Ongkir & Resi</b>
    {order.status === 'in_production' && <div className="notice">Tahap packing: pilih jenis sterofoam di bawah. Biaya packing otomatis masuk ke total tagihan saat disimpan.</div>}
    <div className="packing-choice-grid">
      {packingOptions.filter((item) => item.value !== 'none').map((item) => <button key={item.value} type="button" className={`packing-choice ${packingType === item.value ? 'active' : ''}`} onClick={() => { setPackingType(item.value); setPackingQuantity((current) => Number(current || 0) > 0 ? current : '1'); }}><b>{item.label}</b><span>{formatIdr(item.fee)} / pcs</span></button>)}
    </div>
    <div className="grid cols-2">
      <div className="field"><label>Ongkir sesuai total resi</label><input className="input" type="number" min="0" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} placeholder="Contoh: 45000" /></div>
      <div className="field"><label>Qty packing / pcs</label><input className="input" type="number" min={packingType === 'none' ? 0 : 1} value={packingQuantity} disabled={packingType === 'none'} onChange={(e) => setPackingQuantity(e.target.value)} placeholder="Contoh: 3" /><small>{packingType === 'none' ? 'Pilih jenis packing dari kartu di atas' : `${selectedPacking.label}: ${formatIdr(selectedPacking.fee)} × ${normalizedPackingQty} pcs = ${formatIdr(packingTotal)}`}</small></div>
      <div className="field"><label>Nomor resi untuk tracking customer</label><input className="input" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Nomor resi ekspedisi" /></div>
      <div className="field"><label>Upload foto resi</label><label className="upload-box receipt-upload"><input type="file" accept="image/*,.pdf" onChange={(e) => chooseReceipt(e.target.files?.[0])} /><span>{uploadingReceipt ? 'Mengupload...' : trackingReceiptUrl ? 'Ganti Foto Resi' : 'Upload Foto Resi'}</span><small>JPG/PNG/PDF, maksimal 1 MB</small></label></div>
      {trackingReceiptUrl && <div className="field shipping-wide"><label>File resi tersimpan</label><div className="uploaded-receipt-row"><span>Resi sudah diupload dan siap disimpan ke order.</span><button className="btn small" type="button" onClick={() => setTrackingReceiptUrl('')}>Hapus Upload</button></div></div>}
    </div>
    <div className="notice">Tambahan tagihan: ongkir {formatIdr(Number(shippingCost || 0))} + packing {formatIdr(selectedPacking.fee)} × {normalizedPackingQty} pcs = <b>{formatIdr(Number(shippingCost || 0) + packingTotal)}</b></div>
    {message && <div className={`notice ${message.includes('berhasil') ? '' : 'warning'}`}>{message}</div>}
    <div className="actions"><button className="btn primary" type="button" onClick={save}>Simpan Ongkir / Resi</button></div>
  </div>;
}

function orderProductItems(order: Order) {
  return order.items.filter((item) => !item.productId.startsWith('packaging-'));
}
function orderRequestedQty(order: Order) {
  return orderProductItems(order).reduce((sum, item) => sum + item.qty, 0);
}
function orderQcDeliveredQty(order: Order) {
  return orderProductItems(order).reduce((sum, item) => sum + (item.qcDeliveredQty ?? item.qty), 0);
}
function orderSuitabilityPercent(order: Order) {
  const requested = orderRequestedQty(order);
  if (!requested) return 100;
  return Math.max(0, Math.min(100, Math.round((orderQcDeliveredQty(order) / requested) * 100)));
}
function suitabilityClass(value: number) {
  return value >= 100 ? 'delivered' : value >= 80 ? 'ready_to_ship' : 'cancelled';
}

function OrdersTable({ state, orders, user, token, refresh, compact }: { state: AppState; orders: Order[]; user?: User; token?: string; refresh?: () => Promise<void>; compact?: boolean }) {
  const [selected, setSelected] = useState<Order | null>(null);
  const selectedOrder = selected ? state.orders.find((order) => order.id === selected.id) ?? selected : null;
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const canPartnerCancel = (order: Order) => user?.role === 'partner' && ['pending', 'confirmed'].includes(order.status);
  const canPartnerEdit = canPartnerCancel;
  return <div className="card orders-card"><h3>{compact ? 'Order Terbaru' : 'Daftar Order'}</h3>{actionMessage && <div className={`notice ${actionMessage.includes('berhasil') ? '' : 'warning'}`}>{actionMessage}</div>}<div className="table-wrap orders-table"><table><thead><tr><th>No Order</th><th>Mitra</th><th>Status</th><th>Total</th><th>Packing</th><th>Item</th><th>% Kesesuaian</th><th>Aksi</th></tr></thead><tbody>{orders.map((order) => {
    const suitability = orderSuitabilityPercent(order);
    return <tr key={order.id}><td data-label="No Order"><b>{order.orderNumber}</b><br /><small>{new Date(order.orderDate).toLocaleString('id-ID')}</small></td><td data-label="Mitra">{partnerName(state, order.partnerId)}<br /><small>{tierName(state, state.partners.find((p) => p.id === order.partnerId)?.tierId ?? '')}</small></td><td data-label="Status"><span className={`status ${order.status}`}>{statusLabels[order.status]}</span></td><td data-label="Total"><b>{formatIdr(order.grandTotal)}</b><br /><small>{(order.shippingCost || order.packingFee) ? `+ ${formatIdr((order.shippingCost ?? 0) + (order.packingFee ?? 0))} ongkir/packing` : 'Belum ada tambahan'}</small></td><td data-label="Packing">{packingSummary(order)}<br /><small>{formatIdr(order.packingFee ?? 0)}</small></td><td data-label="Item">{order.items.length} item</td><td data-label="% Kesesuaian"><span className={`status ${suitabilityClass(suitability)}`}>{suitability}%</span><br /><small>{orderQcDeliveredQty(order)} / {orderRequestedQty(order)} qty</small></td><td data-label="Aksi"><div className="actions"><button className="btn small" onClick={() => setSelected(order)}>Detail</button></div></td></tr>;
  })}</tbody></table></div>{selectedOrder && <OrderModal state={state} order={selectedOrder} user={user} token={token} refresh={refresh} onClose={() => setSelected(null)} onEditOrder={(orderToEdit) => setEditingOrder(orderToEdit)} />}{editingOrder && user && token && refresh && <EditOrderModal state={state} order={editingOrder} token={token} refresh={refresh} onClose={() => setEditingOrder(null)} onSaved={(updated) => { setEditingOrder(null); setSelected(updated); setActionMessage(`${updated.orderNumber} berhasil direvisi.`); }} />}</div>;
}


function cartItemsFromOrder(order: Order): CartItem[] {
  return order.items
    .filter((item) => !item.productId.startsWith('packaging-'))
    .map((item) => {
      const gramMatch = item.unitSnapshot.match(/^(250|500|1000)\s*GR$/i);
      const packageWeightGram = gramMatch ? Number(gramMatch[1]) as 250 | 500 | 1000 : undefined;
      return { productId: item.productId, qty: item.qty, packageWeightGram, packageLabel: packageWeightGram ? `${packageWeightGram} GR` : undefined, notes: item.notes };
    });
}
function editKeyForCartItem(item: CartItem, index: number) { return `${item.productId}__${item.packageWeightGram ?? 'unit'}__${index}`; }

function EditOrderModal({ state, order, token, refresh, onClose, onSaved }: { state: AppState; order: Order; token: string; refresh: () => Promise<void>; onClose: () => void; onSaved: (order: Order) => void }) {
  const partner = state.partners.find((item) => item.id === order.partnerId);
  const catalog = getCatalogForPartner(state, order.partnerId);
  const [items, setItems] = useState<CartItem[]>(cartItemsFromOrder(order));
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState(order.requestedDeliveryDate ?? '');
  const [expedition, setExpedition] = useState<ExpeditionType>(order.expedition ?? defaultExpedition);
  const [selectedProductId, setSelectedProductId] = useState(catalog[0]?.id ?? '');
  const [selectedPackageWeight, setSelectedPackageWeight] = useState<'unit' | '250' | '500' | '1000'>('unit');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const rows = items.map((item, index) => {
    const product = catalog.find((product) => product.id === item.productId);
    const unitPrice = getPackagePrice(product?.price ?? 0, item.packageWeightGram);
    return { key: editKeyForCartItem(item, index), item, index, product, unitPrice, lineTotal: unitPrice * item.qty };
  }).filter((row) => row.product);
  const totalPesanan = rows.reduce((sum, row) => sum + row.lineTotal, 0);
  const totalBeratGram = calculateCartWeightGram(catalog, items);
  const styrofoamPlan = expedition === thermalTruckExpedition ? [] : calculateStyrofoamPlan(totalBeratGram);
  const packingTotal = styrofoamPlan.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalTagihan = totalPesanan + packingTotal + (order.shippingCost ?? 0);

  function updateItem(index: number, patch: Partial<CartItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item).filter((item) => item.qty > 0));
  }
  function addProduct() {
    const product = catalog.find((item) => item.id === selectedProductId);
    if (!product) return;
    const packageWeightGram = selectedPackageWeight === 'unit' ? undefined : Number(selectedPackageWeight) as 250 | 500 | 1000;
    setItems((current) => [...current, { productId: product.id, qty: product.minimumOrderQty, packageWeightGram, packageLabel: packageWeightGram ? `${packageWeightGram} GR` : undefined }]);
  }
  async function saveRevision() {
    if (!items.length) {
      setMessage('Pesanan wajib memiliki minimal 1 item produk.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const updated = await api.reviseOrder(token, order.id, { requestedDeliveryDate, expedition, notes: order.notes, items });
      await refresh();
      onSaved(updated as Order);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan revisi pesanan.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="modal-backdrop"><div className="modal edit-order-modal"><button className="modal-x" type="button" aria-label="Tutup edit pesanan" onClick={onClose}><X size={20} /></button><div className="topbar"><div><h2>Edit Pesanan</h2><p>{order.orderNumber} • {partner?.businessName ?? partnerName(state, order.partnerId)}</p></div><button className="btn desktop-modal-close" onClick={onClose}>Tutup</button></div><div className="notice">Revisi hanya bisa dilakukan sebelum order diproses. Nomor order tetap sama, item dan total akan dihitung ulang.</div>{message && <div className="notice warning">{message}</div>}<div className="edit-order-items">{rows.map((row) => <div className="edit-order-item" key={row.key}><div><b>{row.product?.name}</b><span>{row.product?.sku} • {row.item.packageLabel ?? row.product?.unit}</span><small>{formatIdr(row.unitPrice)} / item • Subtotal {formatIdr(row.lineTotal)}</small><label className="checkout-note"><span>Catatan</span><textarea rows={2} value={row.item.notes ?? ''} onChange={(event) => updateItem(row.index, { notes: event.target.value })} /></label></div><div className="qty-stepper checkout-stepper"><button type="button" onClick={() => updateItem(row.index, { qty: row.item.qty - 1 })}>−</button><input className="input" type="number" min="0" value={row.item.qty} onChange={(event) => updateItem(row.index, { qty: Number(event.target.value) || 0 })} /><button type="button" onClick={() => updateItem(row.index, { qty: row.item.qty + 1 })}>+</button></div><button className="btn small danger" type="button" onClick={() => updateItem(row.index, { qty: 0 })}>Hapus</button></div>)}</div><div className="card edit-order-add-panel"><b>Tambah Produk</b><div className="grid cols-3"><div className="field"><label>Produk</label><select value={selectedProductId} onChange={(event) => { setSelectedProductId(event.target.value); setSelectedPackageWeight('unit'); }}>{catalog.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div><div className="field"><label>Kemasan</label><select value={selectedPackageWeight} onChange={(event) => setSelectedPackageWeight(event.target.value as typeof selectedPackageWeight)}><option value="unit">Unit asli</option>{catalog.find((product) => product.id === selectedProductId && canChoosePackaging(product)) && <><option value="250">250 GR</option><option value="500">500 GR</option><option value="1000">1000 GR</option></>}</select></div><button className="btn" type="button" onClick={addProduct}>Tambah ke Pesanan</button></div></div><div className="card checkout-summary proper-checkout-summary"><div className="checkout-address-block"><b>Alamat Kirim</b><p>{order.shippingAddress}</p></div><div className="field"><label>Ekspedisi</label><select value={expedition} onChange={(event) => setExpedition(event.target.value as ExpeditionType)}>{expeditionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small>{expedition === thermalTruckExpedition ? 'Truk thermal: biaya sterofoam otomatis Rp0.' : 'Pilih ekspedisi untuk pengiriman order.'}</small></div><div className="field"><label>Tanggal Kirim</label><input className="input" type="date" value={requestedDeliveryDate} onChange={(event) => setRequestedDeliveryDate(event.target.value)} /></div><div className="checkout-total-panel"><div><span>Total Pesanan</span><b>{formatIdr(totalPesanan)}</b></div><div><span>Total Berat</span><b>{formatWeightGram(totalBeratGram)}</b></div><div><span>Biaya Sterofoam</span><b>{formatIdr(packingTotal)}</b></div>{order.shippingCost ? <div><span>Ongkir tersimpan</span><b>{formatIdr(order.shippingCost)}</b></div> : null}<div className="checkout-grand-total"><span>Total Tagihan</span><strong>{formatIdr(totalTagihan)}</strong></div></div><button className="btn primary" disabled={saving || rows.length === 0} onClick={saveRevision}>{saving ? 'Menyimpan...' : 'Simpan Revisi Pesanan'}</button></div></div></div>;
}

function OrderStatusPanel({ order, token, refresh }: { order: Order; token: string; refresh: () => Promise<void> }) {
  const [targetStatus, setTargetStatus] = useState<OrderStatus>(order.status === 'delivered' || order.status === 'cancelled' ? 'pending' : order.status);
  const [message, setMessage] = useState('');
  async function saveStatus() {
    setMessage('');
    try {
      await api.updateOrderStatus(token, order.id, targetStatus, `Update status order ke ${statusLabels[targetStatus]}`);
      await refresh();
      setMessage(`Status berhasil diubah ke ${statusLabels[targetStatus]}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Status gagal disimpan.');
    }
  }
  return <div className="shipping-panel status-panel"><b>Status Order</b><div className="grid cols-2"><div className="field"><label>Pilih Tahapan Status</label><select value={targetStatus} onChange={(event) => setTargetStatus(event.target.value as OrderStatus)}>{orderWorkflowStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select><small>Status utama disederhanakan menjadi 5 tahap operasional.</small></div><div className="field"><label>Status Saat Ini</label><span className={`status ${order.status}`}>{statusLabels[order.status]}</span></div></div>{message && <div className={`notice ${message.includes('berhasil') ? '' : 'warning'}`}>{message}</div>}<div className="actions"><button className="btn primary" type="button" disabled={targetStatus === order.status} onClick={saveStatus}>Simpan Status</button></div></div>;
}

function OrderQcPanel({ order, token, refresh, onEditOrder }: { order: Order; token: string; refresh: () => Promise<void>; onEditOrder?: (order: Order) => void }) {
  const qcItems = order.items;
  const productItems = orderProductItems(order);
  const [qtyMap, setQtyMap] = useState<Record<string, string>>(() => Object.fromEntries(qcItems.map((item) => [item.id, String(item.qcDeliveredQty ?? item.qty)])));
  const [message, setMessage] = useState('');
  useEffect(() => {
    setQtyMap(Object.fromEntries(qcItems.map((item) => [item.id, String(item.qcDeliveredQty ?? item.qty)])));
  }, [order.id, order.items.map((item) => `${item.id}:${item.qty}:${item.qcDeliveredQty ?? ''}`).join('|')]);
  const requestedQty = orderRequestedQty(order);
  const deliveredQty = productItems.reduce((sum, item) => sum + Math.max(0, Math.min(item.qty, Number(qtyMap[item.id] || 0))), 0);
  const suitability = requestedQty ? Math.round((deliveredQty / requestedQty) * 100) : 100;
  const packagingQcTotal = qcItems.filter((item) => item.productId.startsWith('packaging-')).reduce((sum, item) => sum + Math.max(0, Math.min(item.qty, Number(qtyMap[item.id] || 0))) * item.unitPrice, 0);
  async function saveQc() {
    setMessage('');
    try {
      await api.updateOrderQc(token, order.id, { items: qcItems.map((item) => ({ itemId: item.id, qcDeliveredQty: Math.max(0, Math.min(item.qty, Number(qtyMap[item.id] || 0))) })) });
      await refresh();
      setMessage('Hasil QC berhasil disimpan. Qty produk, packaging, packing fee, dan total order sudah disesuaikan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Hasil QC gagal disimpan.');
    }
  }
  return <div className="shipping-panel qc-panel"><b>Hasil QC Pesanan</b><div className="notice">Input qty yang benar-benar lolos QC / dikirim, termasuk packaging/sterofoam. Jika packaging dikurangi atau 0, biaya packing dan total order ikut menyesuaikan.</div><div className="qc-items">{qcItems.map((item) => {
    const isPackaging = item.productId.startsWith('packaging-');
    return <div className={`qc-item ${isPackaging ? 'qc-packaging-item' : ''}`} key={item.id}><div><b>{item.productNameSnapshot}</b><small>{item.skuSnapshot} • Permintaan {item.qty} {item.unitSnapshot}{isPackaging ? ' • Packaging/Sterofoam' : ''}</small></div><div className="field"><label>{isPackaging ? 'Qty packaging QC' : 'Qty dikirim'}</label><input className="input" type="number" min="0" max={item.qty} value={qtyMap[item.id] ?? String(item.qty)} onChange={(event) => setQtyMap((current) => ({ ...current, [item.id]: event.target.value }))} /></div></div>;
  })}</div><div className="notice">% Kesesuaian produk: <b>{suitability}%</b> ({deliveredQty} / {requestedQty} qty) • Estimasi packing QC: <b>{formatIdr(packagingQcTotal)}</b></div>{message && <div className={`notice ${message.includes('berhasil') ? '' : 'warning'}`}>{message}</div>}<div className="actions"><button className="btn primary" type="button" onClick={saveQc}>Simpan Hasil QC</button>{onEditOrder && <button className="btn" type="button" onClick={() => onEditOrder(order)}>Edit Pesanan Sesuai Hasil QC</button>}</div></div>;
}

function OrderModal({ state, order, user, token, refresh, onClose, onEditOrder }: { state: AppState; order: Order; user?: User; token?: string; refresh?: () => Promise<void>; onClose: () => void; onEditOrder?: (order: Order) => void }) {
  const documentRef = useRef<HTMLDivElement>(null);
  const isAdmin = Boolean(user && user.role !== 'partner' && token && refresh);
  return <div className="modal-backdrop print-backdrop"><div className="modal order-modal print-modal"><button className="modal-x" type="button" aria-label="Tutup detail order" onClick={onClose}><X size={20} /></button><div className="topbar"><div><h2>{order.orderNumber}</h2><p>{partnerName(state, order.partnerId)} • {statusLabels[order.status]}</p></div><div className="actions desktop-modal-actions"><button className="btn" type="button" onClick={() => printDocumentOnly(documentRef.current)}><Printer size={16} /> Cetak Order</button><button className="btn desktop-modal-close" onClick={onClose}>Tutup</button></div></div><div ref={documentRef}><DocumentOrder state={state} order={order} /></div><div className="actions mobile-print-actions"><button className="btn primary" type="button" onClick={() => printDocumentOnly(documentRef.current)}><Printer size={16} /> Cetak Order</button></div>{isAdmin && <><OrderStatusPanel order={order} token={token!} refresh={refresh!} />{order.status === 'ready_to_ship' && <OrderQcPanel order={order} token={token!} refresh={refresh!} onEditOrder={onEditOrder} />}<OrderShippingPanel order={order} token={token!} refresh={refresh!} /></>}</div></div>;
}



type AreaPoint = { id: string; label: string; province: string; island: string; x: number; y: number; note: string; cities?: string[] };

const areaPoints: AreaPoint[] = [
  { id: 'aceh', label: 'Aceh', province: 'Aceh', island: 'Sumatera', x: 8.5, y: 25, note: 'Sebaran mitra Aceh dan wilayah barat Indonesia.', cities: ['Banda Aceh'] },
  { id: 'sumatera-utara', label: 'Sumut', province: 'Sumatera Utara', island: 'Sumatera', x: 14, y: 34, note: 'Mitra Sumatera bagian utara.', cities: ['Medan'] },
  { id: 'riau', label: 'Riau', province: 'Riau', island: 'Sumatera', x: 21.5, y: 47, note: 'Mitra koridor Riau dan sekitarnya.', cities: ['Pekanbaru', 'Tampan'] },
  { id: 'sumatera-barat', label: 'Sumbar', province: 'Sumatera Barat', island: 'Sumatera', x: 19, y: 52, note: 'Mitra Sumatera Barat dan sekitarnya.', cities: ['Bukittinggi'] },
  { id: 'jambi', label: 'Jambi', province: 'Jambi', island: 'Sumatera', x: 25, y: 57, note: 'Mitra Jambi dan area Sumatera tengah.', cities: ['Jambi'] },
  { id: 'sumatera-selatan', label: 'Sumsel', province: 'Sumatera Selatan', island: 'Sumatera', x: 29, y: 64, note: 'Mitra Sumatera bagian selatan.', cities: ['Palembang'] },
  { id: 'lampung', label: 'Lampung', province: 'Lampung', island: 'Sumatera', x: 34, y: 71, note: 'Mitra pintu masuk Sumatera-Jawa.', cities: ['Bandar Lampung'] },
  { id: 'bangka-belitung', label: 'Babel', province: 'Kepulauan Bangka Belitung', island: 'Sumatera', x: 37, y: 58, note: 'Mitra Kepulauan Bangka Belitung.', cities: ['Pangkalpinang'] },
  { id: 'dki-jakarta', label: 'Jakarta', province: 'DKI Jakarta', island: 'Jawa', x: 40.5, y: 75, note: 'Mitra Jabodetabek dan pusat distribusi kota.', cities: ['Gading Arcadia', 'Jakarta Selatan', 'Jakarta Timur', 'Jakarta Utara', 'Jaksel', 'Kelapa Gading', 'Pesanggrahan', 'Ulujami'] },
  { id: 'jawa-barat', label: 'Jawa Barat', province: 'Jawa Barat', island: 'Jawa', x: 45, y: 77, note: 'Bandung, Bekasi, Bogor, Depok, dan koridor Jawa Barat.', cities: ['Bekasi Timur', 'Bekasi Utara', 'Harapan Jaya', 'Bogor', 'Bogor Barat', 'Cimahi', 'Depok', 'Sukmajaya', 'Indramayu', 'Kabupaten Bandung', 'Kota Bandung', 'Karawang', 'Cikampek', 'Jatisari'] },
  { id: 'banten', label: 'Banten', province: 'Banten', island: 'Jawa', x: 38, y: 75, note: 'Tangerang, Cilegon, BSD, dan area penyangga Jabodetabek.', cities: ['BSD', 'Cilegon', 'Tangerang', 'Tangerang Selatan'] },
  { id: 'jawa-tengah', label: 'Jawa Tengah', province: 'Jawa Tengah', island: 'Jawa', x: 53, y: 78, note: 'Semarang, Solo, Banjarnegara, dan area Jawa Tengah.', cities: ['Banjarnegara', 'Blora', 'Semarang', 'Solo', 'Ungaran', 'Ungaran Barat'] },
  { id: 'diy', label: 'DIY', province: 'DIY', island: 'Jawa', x: 56.5, y: 80.5, note: 'Mitra Yogyakarta dan sekitarnya.', cities: ['Banguntapan', 'Bantul', 'Jogja', 'Yogyakarta'] },
  { id: 'jawa-timur', label: 'Jawa Timur', province: 'Jawa Timur', island: 'Jawa', x: 64, y: 78, note: 'Surabaya, Sidoarjo, Malang, Gresik, Jember, dan Mojokerto.', cities: ['Buduran', 'Darmo', 'Darmo Permai', 'Gresik', 'Jember', 'Malang', 'Mojokerto', 'Sidoarjo', 'Surabaya', 'Surabaya Barat', 'Surabaya Selatan'] },
  { id: 'bali', label: 'Bali', province: 'Bali', island: 'Bali-Nusa Tenggara', x: 70.5, y: 81, note: 'Mitra Bali dan area horeca/retail sehat.', cities: ['Denpasar Bali', 'Kuta Bali'] },
  { id: 'ntb', label: 'NTB', province: 'Nusa Tenggara Barat', island: 'Bali-Nusa Tenggara', x: 75.5, y: 82, note: 'Mitra Nusa Tenggara Barat.', cities: ['Mataram'] },
  { id: 'kalimantan-timur', label: 'Kaltim', province: 'Kalimantan Timur', island: 'Kalimantan', x: 56.5, y: 43, note: 'Balikpapan, Samarinda, Kutai Kartanegara, dan IKN.', cities: ['Balikpapan', 'Kutai Kartanegara', 'Samarinda'] },
  { id: 'kalimantan-selatan', label: 'Kalsel', province: 'Kalimantan Selatan', island: 'Kalimantan', x: 52, y: 59, note: 'Mitra Kalimantan Selatan.', cities: ['Banjarmasin'] },
  { id: 'sulawesi-selatan', label: 'Sulsel', province: 'Sulawesi Selatan', island: 'Sulawesi', x: 72, y: 65, note: 'Mitra Indonesia timur via Makassar.', cities: ['Makassar'] },
  { id: 'area-belum-diisi', label: 'Belum Diisi', province: 'Area belum diisi', island: 'Data perlu dilengkapi', x: 82, y: 28, note: 'Mitra asli yang data kota/provinsinya belum lengkap. Lengkapi profil agar marker pindah ke wilayah sebenarnya.' },
];

function isRealPartner(partner: AppState['partners'][number]) {
  return partner.partnerCode?.startsWith('MWB-');
}
function tierCode(state: AppState, tierId: string) {
  return state.tiers.find((tier) => tier.id === tierId)?.code ?? 'RESELLER';
}
function tierSummary(state: AppState, partners: AppState['partners']) {
  return state.tiers.map((tier) => ({ tier, count: partners.filter((partner) => partner.tierId === tier.id).length }));
}
function areaForPartner(partner: AppState['partners'][number]) {
  const city = normalizeAreaName(partner.city);
  const province = normalizeAreaName(partner.province);
  const address = normalizeAreaName(partner.address);
  return areaPoints.find((point) => point.cities?.some((item) => address.includes(normalizeAreaName(item))))
    ?? areaPoints.find((point) => point.cities?.some((item) => normalizeAreaName(item) === city))
    ?? areaPoints.find((point) => normalizeAreaName(point.province) === province)
    ?? areaPoints.find((point) => point.id === 'area-belum-diisi')!;
}
function normalizeAreaName(value?: string) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function PartnerAreas({ state, user }: { state: AppState; user: User }) {
  const realPartners = state.partners.filter(isRealPartner);
  const visiblePartners = user.role === 'partner' ? realPartners.filter((partner) => partner.userId === user.id) : realPartners;
  const firstArea = visiblePartners[0] ? areaForPartner(visiblePartners[0]).id : 'jawa-barat';
  const [selectedId, setSelectedId] = useState(firstArea);
  const [expandedTierId, setExpandedTierId] = useState<string | null>(null);
  const selected = areaPoints.find((point) => point.id === selectedId) ?? areaPoints[0];
  const partnersInArea = visiblePartners.filter((partner) => areaForPartner(partner).id === selected.id);
  const activePartners = visiblePartners.filter((partner) => partner.status === 'active').length;
  const coveredAreas = new Set(visiblePartners.map((partner) => areaForPartner(partner).province).filter((province) => province !== 'Area belum diisi')).size;
  const summary = tierSummary(state, visiblePartners);
  const tierMarkerGroups = areaPoints.flatMap((point) => state.tiers.map((tier) => {
    const partners = visiblePartners.filter((partner) => areaForPartner(partner).id === point.id && partner.tierId === tier.id);
    return { point, tier, partners, tierCode: tier.code.toLowerCase() };
  })).filter((group) => group.partners.length > 0);
  const offsetForTier = (code: string) => code === 'DISTRIBUTOR' ? { x: -0.75, y: -0.95 } : code === 'AGEN' ? { x: 0.75, y: -0.95 } : { x: 0, y: 0.95 };

  return <div className="area-layout">
    <div className="card area-map-card">
      <div className="area-head"><div><h3>Peta Sebaran Wilayah</h3><p>Data diambil dari database mitra asli Wahyu Beef. Mitra dummy tidak ditampilkan.</p></div><span className="area-pill">{visiblePartners.length} Mitra</span></div>
      <div className={`indonesia-map map-focus-${selected.id}`} aria-label="Peta sebaran mitra Indonesia">
        <img className="map-image" src="/assets/peta-indonesia-wb.png" alt="Peta Indonesia Wahyu Beef" />
        {tierMarkerGroups.map(({ point, tier, partners, tierCode: code }) => {
          const offset = offsetForTier(tier.code);
          return <button key={`${point.id}-${tier.id}`} className={`map-marker ${selected.id === point.id ? 'active' : ''} has-partners tier-${code}`} style={{ left: `${point.x + offset.x}%`, top: `${point.y + offset.y}%` }} onClick={() => setSelectedId(point.id)} title={`${point.label} • ${tier.name}: ${partners.length} mitra`}>
            <span className="pin-dot" />
            <span className="pin-count">{partners.length}</span>
          </button>;
        })}
      </div>
      <div className="area-legend"><span><i className="legend-dot distributor" /> Distributor</span><span><i className="legend-dot agen" /> Agen</span><span><i className="legend-dot reseller" /> Reseller</span></div>
    </div>
    <div className="grid area-side">
      <div className="grid cols-3 area-stats">
        <Metric label="Mitra Aktif" value={String(activePartners)} />
        <Metric label="Area Tercover" value={String(coveredAreas)} />
        <Metric label="Area Dipilih" value={String(partnersInArea.length)} />
      </div>
      <div className="card tier-summary tier-accordion"><h3>Rekap Jumlah Mitra</h3><p className="footer-note">Klik tier untuk membuka rincian nama mitra.</p>{summary.map(({ tier, count }) => {
        const tierPartners = visiblePartners.filter((partner) => partner.tierId === tier.id).sort((a, b) => a.businessName.localeCompare(b.businessName));
        const isOpen = expandedTierId === tier.id;
        return <div key={tier.id} className={`tier-accordion-item tier-${tier.code.toLowerCase()} ${isOpen ? 'open' : ''}`}><button className="tier-summary-row" onClick={() => setExpandedTierId(isOpen ? null : tier.id)}><span>{tier.name}</span><b>{count}</b><i>{isOpen ? '−' : '+'}</i></button>{isOpen && <div className="tier-partner-dropdown">{tierPartners.map((partner) => <button key={partner.id} className="tier-partner-row" onClick={() => setSelectedId(areaForPartner(partner).id)}><span><b>{partner.businessName}</b><small>{partner.partnerCode} • {areaForPartner(partner).label}</small></span><em>{partner.city || '-'}</em></button>)}</div>}</div>;
      })}<p className="footer-note">Total dihitung dari database mitra asli yang aktif di app.</p></div>
      <div className="card selected-area-card">
        <div className="area-title"><div><span className="area-kicker">{selected.island}</span><h3>{selected.label}</h3><p>{selected.note}</p></div><span className="area-pill strong">{partnersInArea.length} mitra</span></div>
        {partnersInArea.length ? <div className="partner-area-list">{partnersInArea.map((partner) => <div className="partner-area-item" key={partner.id}>
          <div><b>{partner.businessName}</b><br /><small>{partner.partnerCode} • {tierName(state, partner.tierId)}</small></div>
          <div><span className={`status ${partner.status === 'active' ? 'delivered' : 'cancelled'}`}>{partner.status}</span><br /><small>{partner.city} • {partner.phone}</small></div>
        </div>)}</div> : <div className="notice warning">Belum ada mitra asli di area ini.</div>}
      </div>
    </div>
  </div>;
}

function ProfileSettings({ state, user, token, setUser, setState }: { state: AppState; user: User; token: string; setUser: (user: User) => void; setState: (state: AppState) => void }) {
  const partner = findPartnerForUser(state, user);
  const [name, setName] = useState(user.name);
  const [address, setAddress] = useState(partner?.address ?? '');
  const [phone, setPhone] = useState(partner?.phone ?? user.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('mitrawahyubeef');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  async function chooseProfilePhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('File harus berupa gambar.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setMessage('Ukuran foto maksimal 1 MB. Pilih foto yang lebih kecil.');
      return;
    }
    setSaving(true);
    setMessage('Mengupload foto profil...');
    try {
      const result = await api.uploadProfilePhoto(token, file);
      setAvatarUrl(result.avatarUrl);
      setUser(result.user);
      setState(result.state);
      setMessage('Foto profil berhasil diupload.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Foto gagal diupload.');
    } finally {
      setSaving(false);
    }
  }

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

  async function savePassword() {
    setSavingPassword(true);
    setPasswordMessage('');
    try {
      const result = await api.updatePassword(token, { currentPassword, newPassword, confirmPassword });
      setUser(result.user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('Password berhasil diganti. Login berikutnya gunakan password baru.');
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : 'Password gagal diganti.');
    } finally {
      setSavingPassword(false);
    }
  }

  return <div className="profile-layout">
    <div className="card profile-card">
      <div className="profile-hero">
        <div className="avatar-preview">{avatarUrl ? <img src={avatarUrl} alt={name} /> : <span>{initials(name)}</span>}</div>
        <div><h3>Profil Mitra</h3><p className="footer-note">Update identitas yang tampil di akun mitra dan dokumen operasional.</p></div>
      </div>
      <div className="grid cols-2">
        <div className="field profile-photo-field"><label>Foto Profil</label><label className="upload-box"><input type="file" accept="image/*" onChange={(e) => chooseProfilePhoto(e.target.files?.[0])} /><span>Pilih Foto dari Perangkat</span><small>JPG/PNG, maksimal 1 MB</small></label>{avatarUrl && <button type="button" className="btn small" onClick={() => setAvatarUrl('')}>Hapus Foto</button>}</div>
        <div className="field"><label>Nama</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Nomor WA</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" /></div>
        <div className="field"><label>Kode Mitra</label><input className="input" value={partner?.partnerCode ?? '-'} disabled /></div>
        <div className="field profile-address"><label>Alamat</label><textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={4} /></div>
      </div>
      {message && <div className={`notice ${message.includes('berhasil') ? '' : 'warning'}`}>{message}</div>}
      <div className="actions"><button className="btn primary" disabled={saving} onClick={saveProfile}>{saving ? 'Menyimpan...' : 'Simpan Profil'}</button></div>
    </div>
    <div className="card profile-card password-card">
      <div><h3>Ganti Password</h3><p className="footer-note">Gunakan fitur ini setelah login pertama agar password default tidak dipakai terus.</p></div>
      <div className="grid cols-2">
        <div className="field"><label>Password Saat Ini</label><input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Password lama/default" /></div>
        <div className="field"><label>Password Baru</label><input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 8 karakter" /></div>
        <div className="field"><label>Ulangi Password Baru</label><input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ketik ulang password baru" /></div>
      </div>
      {passwordMessage && <div className={`notice ${passwordMessage.includes('berhasil') ? '' : 'warning'}`}>{passwordMessage}</div>}
      <div className="actions"><button className="btn primary" disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword} onClick={savePassword}>{savingPassword ? 'Menyimpan...' : 'Ganti Password'}</button></div>
    </div>
    <div className="card profile-summary"><h3>Ringkasan Akun</h3><p><b>{partner?.businessName ?? name}</b><br />{partner ? tierName(state, partner.tierId) : 'Mitra'}</p><p>WA: {phone || '-'}</p><p>{address || '-'}</p></div>
  </div>;
}

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'M'; }

function AdminOrderCatalog({ state, user, token, refresh }: { state: AppState; user: User; token: string; refresh: () => Promise<void> }) {
  const partners = state.partners.filter((partner) => partner.status === 'active');
  const [selectedPartnerId, setSelectedPartnerId] = useState(partners[0]?.id ?? '');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartNotes, setCartNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [isCheckout, setIsCheckout] = useState(false);
  const selectedPartner = partners.find((partner) => partner.id === selectedPartnerId) ?? partners[0];
  if (!selectedPartner) return <div className="notice warning">Belum ada mitra aktif untuk dibuatkan order.</div>;
  const catalog = getCatalogForPartner(state, selectedPartner.id);
  const activeProducts = catalog.filter((product) => product.isActive);
  const items: CartItem[] = Object.entries(cart).filter(([, qty]) => qty > 0).map(([key, qty]) => ({ ...cartKeyToItem(key, qty), notes: cartNotes[key]?.trim() || undefined }));
  const total = items.reduce((sum, item) => {
    const product = catalog.find((p) => p.id === item.productId);
    return sum + getPackagePrice(product?.price ?? 0, item.packageWeightGram) * item.qty;
  }, 0);
  const cartQty = items.reduce((sum, item) => sum + item.qty, 0);
  function addToCart(product: CatalogProduct, qty = product.minimumOrderQty, option?: PackageOption) {
    const key = cartKey(product.id, option?.weightGram);
    setCart((current) => ({ ...current, [key]: (current[key] ?? 0) + Math.max(qty, product.minimumOrderQty) }));
  }
  function updateCartQty(key: string, qty: number) {
    setCart((current) => {
      const next = { ...current };
      if (qty <= 0) delete next[key]; else next[key] = qty;
      return next;
    });
  }
  async function placeOrder(requestedDeliveryDate?: string, expedition: ExpeditionType = defaultExpedition) {
    setMessage('');
    try {
      const createdOrder = await api.createOrder(token, { partnerId: selectedPartner.id, shippingAddress: selectedPartner.address, requestedDeliveryDate, expedition, notes: `Order dibuat admin (${user.name}) untuk ${selectedPartner.businessName}`, items });
      rememberDemoOrder(createdOrder as Order);
      await refresh();
      setCart({});
      setCartNotes({});
      setIsCheckout(false);
      setMessage('Order mitra berhasil dibuat oleh admin. Notifikasi WA dan email tetap diproses setelah order tersimpan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Order admin gagal dibuat.');
    }
  }
  if (isCheckout) return <CheckoutPage state={state} catalog={catalog} partnerAddress={selectedPartner.address} assistedPartner={selectedPartner} cart={cart} cartNotes={cartNotes} message={message} onBack={() => setIsCheckout(false)} onUpdateQty={updateCartQty} onUpdateNote={(key, note) => setCartNotes((current) => ({ ...current, [key]: note }))} onPlaceOrder={placeOrder} />;
  return <div className="grid"><div className="card admin-assisted-order"><div className="products-catalog-head"><div><h3>Buat Order untuk Mitra</h3><p className="footer-note">Admin bisa membantu transaksi order mitra. Pilih mitra dulu agar harga tier, alamat kirim, WA, dan email notification tetap sesuai data mitra.</p></div><span className="area-pill">{cartQty} item • {formatIdr(total)}</span></div><div className="grid cols-2"><div className="field"><label>Mitra yang dibantu order</label><select value={selectedPartner.id} onChange={(event) => { setSelectedPartnerId(event.target.value); setCart({}); setCartNotes({}); }}>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.businessName} • {tierName(state, partner.tierId)}</option>)}</select><small>{selectedPartner.address}</small></div><div className="field"><label>Ringkasan Keranjang</label><button className="btn primary" disabled={items.length === 0} onClick={() => setIsCheckout(true)}>Checkout Order Mitra</button><small>{items.length} produk • {formatIdr(total)}</small></div></div>{message && <div className={`notice ${message.includes('berhasil') ? '' : 'warning'}`}>{message}</div>}</div><div className="catalog marketplace-catalog">{activeProducts.map((product) => {
    const hasPackageOptions = canChoosePackaging(product);
    return <div className="product-card marketplace-card" key={product.id} onClick={() => hasPackageOptions && setSelectedProduct(product)} role={hasPackageOptions ? 'button' : undefined}><div className={`product-visual marketplace-visual ${product.imageUrl ? 'has-photo' : ''}`}>{product.imageUrl && <img src={product.imageUrl} alt={product.name} loading="lazy" />}<span className="discount-badge">Admin</span><div className="placeholder-brand">Wahyu Beef</div><div className="placeholder-pack">{hasPackageOptions ? '250g • 500g • 1kg' : product.unit}</div></div><div className="product-info"><h3>{product.name}</h3><span className="product-meta">{product.sku} • {hasPackageOptions ? 'Pilih kemasan' : `MOQ ${product.minimumOrderQty} ${product.unit}`}</span><div className="price-row"><span className="voucher-tag">%</span><div className="price">{product.price ? formatIdr(product.price) : 'Belum ada harga'}</div></div><div className="deal-note">Harga {tierName(state, selectedPartner.tierId)}</div>{hasPackageOptions ? <button className="btn small product-pick-btn" onClick={(event) => { event.stopPropagation(); setSelectedProduct(product); }}>Pilih</button> : <div className="qty-row compact" onClick={(event) => event.stopPropagation()}><input className="input" type="number" min="0" placeholder="Qty" value={cart[cartKey(product.id)] ?? ''} onChange={(e) => setCart({ ...cart, [cartKey(product.id)]: Number(e.target.value) })} /><button className="btn small" onClick={() => addToCart(product)}>Tambah</button></div>}</div></div>;
  })}</div>{selectedProduct && <PackageModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={(option, qty) => { addToCart(selectedProduct, qty, option); setSelectedProduct(null); }} />}</div>;
}

function Products({ state, user, token, refresh }: { state: AppState; user: User; token: string; refresh: () => Promise<void> }) {
  return <AdminOrderCatalog state={state} user={user} token={token} refresh={refresh} />;
}

function Partners({ state }: { state: AppState }) { const partners = state.partners.filter(isRealPartner); return <div className="card mobile-card-table"><h3>Data Mitra</h3><p className="footer-note">Menampilkan database mitra asli Wahyu Beef. Mitra dummy sudah dihapus dari data live.</p><div className="table-wrap responsive-table"><table><thead><tr><th>Kode</th><th>Nama Bisnis</th><th>Tier</th><th>Kontak</th><th>Area</th><th>Termin</th><th>Status</th></tr></thead><tbody>{partners.map((p) => <tr key={p.id}><td data-label="Kode">{p.partnerCode}</td><td data-label="Nama Bisnis"><b>{p.businessName}</b><br /><small>{p.address}</small></td><td data-label="Tier">{tierName(state, p.tierId)}</td><td data-label="Kontak">{p.contactPerson}<br /><small>{p.phone}</small></td><td data-label="Area">{p.city}<br /><small>{p.province || '-'}</small></td><td data-label="Termin">{p.paymentTermDays} hari</td><td data-label="Status"><span className={`status ${p.status === 'active' ? 'delivered' : 'cancelled'}`}>{p.status}</span></td></tr>)}</tbody></table></div></div>; }
function Pricing({ state }: { state: AppState }) { const activeProducts = state.products.filter((product) => product.isActive); return <div className="card mobile-card-table"><h3>Harga Produk per Tier</h3><div className="table-wrap responsive-table"><table><thead><tr><th>Produk</th>{state.tiers.map((t) => <th key={t.id}>{t.name}</th>)}</tr></thead><tbody>{activeProducts.map((p) => <tr key={p.id}><td data-label="Produk"><b>{p.name}</b><br /><small>{p.sku}</small></td>{state.tiers.map((t) => <td data-label={t.name} key={t.id}>{formatIdr(state.prices.find((price) => price.productId === p.id && price.tierId === t.id)?.price ?? 0)}</td>)}</tr>)}</tbody></table></div></div>; }

function Documents({ state, user, token, refresh }: { state: AppState; user: User; token: string; refresh: () => Promise<void> }) {
  const [doc, setDoc] = useState<{ invoice: Invoice } | null>(null);
  const partner = findPartnerForUser(state, user);
  const orders = user.role === 'partner' && partner ? state.orders.filter((o) => o.partnerId === partner.id) : state.orders;
  return <div className="grid"><div className="card documents-card"><h3>Generate & Print Invoice</h3><div className="table-wrap documents-table"><table><thead><tr><th>Order</th><th>Mitra</th><th>Invoice</th><th>Aksi</th></tr></thead><tbody>{orders.map((order) => { const inv = state.invoices.find((i) => i.orderId === order.id && i.status !== 'void'); return <tr key={order.id}><td data-label="Order"><b>{order.orderNumber}</b><br /><span className={`status ${order.status}`}>{statusLabels[order.status]}</span></td><td data-label="Mitra">{partnerName(state, order.partnerId)}</td><td data-label="Invoice">{inv ? <button className="btn small" onClick={() => setDoc({ invoice: inv })}>{inv.invoiceNumber}</button> : '-'}</td><td data-label="Aksi"><div className="actions">{user.role !== 'partner' && <><button className="btn small" onClick={async () => { await api.createInvoice(token, order.id); await refresh(); }}>Generate Invoice</button>{inv && inv.amountDue > 0 && <button className="btn small success" onClick={async () => { await api.recordPayment(token, inv.id, { amount: Math.min(500000, inv.amountDue), method: 'bank_transfer', referenceNumber: 'PAY-DEMO' }); await refresh(); }}>Catat Bayar</button>}</>}</div></td></tr>; })}</tbody></table></div></div>{doc && <DocumentModal state={state} doc={doc} onClose={() => setDoc(null)} />}</div>;
}

function DocumentModal({ state, doc, onClose }: { state: AppState; doc: { invoice: Invoice }; onClose: () => void }) {
  const order = state.orders.find((o) => o.id === doc.invoice.orderId)!;
  const documentRef = useRef<HTMLDivElement>(null);
  return <div className="modal-backdrop print-backdrop"><div className="modal print-modal"><div className="actions no-print" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={() => printDocumentOnly(documentRef.current)}>Print / PDF</button><button className="btn" onClick={onClose}>Tutup</button></div><div ref={documentRef}><InvoiceDocument state={state} invoice={doc.invoice} order={order} /></div></div></div>;
}

function printDocumentOnly(container: HTMLDivElement | null) {
  const documentEls = Array.from(container?.querySelectorAll('.a4-document') ?? []);
  if (!documentEls.length) return window.print();
  const printWindow = window.open('', '_blank', 'width=900,height=1200');
  if (!printWindow) return window.print();
  const printableDocuments = documentEls.map((documentEl) => documentEl.outerHTML).join('');
  printWindow.document.write(`<!doctype html><html lang="id"><head><meta charset="UTF-8" /><title>Print Dokumen Wahyu Beef</title><style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #1f2933; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 10px; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-export-page { width: 194mm; margin: 0 auto; padding: 0; background: #fff; }
    .a4-document { width: 194mm; min-height: auto; margin: 0 auto; padding: 0; background: #fff; overflow: visible; page-break-after: always; break-after: page; break-inside: avoid; page-break-inside: avoid; }
    .a4-document:last-child { page-break-after: auto; break-after: auto; }
    .doc-brand-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding-bottom: 6px; border-bottom: 3px solid #8f121b; margin-bottom: 7px; }
    .doc-brand { display: flex; align-items: center; gap: 10px; }
    .doc-brand img { width: 40px; height: 40px; object-fit: contain; }
    .doc-brand b { display: block; font-size: 16px; color: #8f121b; letter-spacing: -.02em; }
    .doc-brand span, .doc-title b, .doc-meta-grid span, .doc-total-box span, .doc-footer span { color: #7c6754; font-weight: 800; }
    .doc-title { text-align: right; }
    .doc-title h2 { margin: 0 0 4px; font-size: 21px; letter-spacing: .08em; color: #2d2118; }
    .doc-title b { font-size: 12px; }
    .doc-page-label { margin: -4px 0 8px; text-align: right; color: #7c6754; font-size: 9px; font-weight: 900; }
    .doc-meta-grid { display: grid; grid-template-columns: 1.25fr .75fr; gap: 8px; margin-bottom: 7px; }
    .doc-meta-grid > div { border: 1px solid #ead7ae; border-radius: 8px; padding: 6px; background: #fffaf0; display: grid; gap: 2px; align-content: start; }
    .doc-meta-grid b { font-size: 12px; color: #2d2118; }
    .doc-meta-grid p { margin: 4px 0 0; line-height: 1.4; color: #4f3c2d; }
    .table-wrap { margin-top: 6px !important; border: 1px solid #d9c8a7; border-radius: 8px; overflow: visible; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; table-layout: fixed; }
    th { background: #8f121b; color: #fff8e8; border: 1px solid #7e1018; padding: 4px 5px; text-align: left; }
    td { border: 1px solid #ead7ae; padding: 2.5px 4.5px; vertical-align: top; overflow-wrap: anywhere; line-height: 1.12; }
    small { color: #7c6754; font-size: 8px; font-weight: 700; }
    .line-item-notes-cell { max-width: 20mm; }
    .line-item-qc-cell { width: 9mm; min-width: 9mm; }
    .order-print-document th:nth-child(1), .order-print-document td:nth-child(1) { width: 17%; }
    .order-print-document th:nth-child(2), .order-print-document td:nth-child(2) { width: 32%; }
    .order-print-document th:nth-child(3), .order-print-document td:nth-child(3) { width: 10%; }
    .order-print-document th:nth-child(4), .order-print-document td:nth-child(4) { width: 13%; }
    .order-print-document th:nth-child(5), .order-print-document td:nth-child(5) { width: 15%; }
    .order-print-document th:nth-child(6), .order-print-document td:nth-child(6) { width: 8%; }
    .order-print-document th:nth-child(7), .order-print-document td:nth-child(7) { width: 5%; }
    .doc-total-box { width: 82mm; margin: 12px 0 0 auto; border: 1px solid #ead7ae; border-radius: 10px; overflow: hidden; }
    .doc-total-box > div { display: flex; justify-content: space-between; gap: 12px; padding: 7px 10px; border-bottom: 1px solid #ead7ae; background: #fffaf0; }
    .doc-total-box > div:last-child { border-bottom: 0; }
    .doc-total-box .grand { background: #8f121b; color: #fff8e8; }
    .doc-total-box .grand span, .doc-total-box .grand b { color: #fff8e8; }
    .doc-footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid #ead7ae; display: flex; justify-content: space-between; gap: 12px; color: #7c6754; font-size: 10px; }
  </style></head><body><main class="print-export-page">${printableDocuments}</main><script>window.onload=function(){setTimeout(function(){window.focus();window.print();},350)};<\/script></body></html>`);
  printWindow.document.close();
}

function DocumentOrder({ state, order }: { state: AppState; order: Order }) {
  const partner = state.partners.find((item) => item.id === order.partnerId);
  const pages = chunkOrderItemsForPrint(order.items);
  const totalPages = pages.length;
  return <>{pages.map((items, index) => {
    const isFirstPage = index === 0;
    const isLastPage = index === totalPages - 1;
    return <div className="document a4-document order-print-document" key={`${order.id}-print-page-${index}`}>
      <DocHeader title="ORDER" number={order.orderNumber} />
      <div className="doc-page-label">Halaman {index + 1} dari {totalPages}{!isFirstPage ? ' • Lanjutan item order' : ''}</div>
      {isFirstPage && <div className="doc-meta-grid"><div><span>Order Untuk</span><b>{partner?.businessName ?? partnerName(state, order.partnerId)}</b><p>{order.shippingAddress}<br />PIC: {partner?.contactPerson ?? '-'} • {partner?.phone ?? '-'}</p></div><div><span>Tanggal Order</span><b>{new Date(order.orderDate).toLocaleString('id-ID')}</b><span>Tanggal Kirim</span><b>{order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate).toLocaleDateString('id-ID') : '-'}</b><span>Ekspedisi</span><b>{expeditionLabels[order.expedition ?? defaultExpedition]}</b><span>Status</span><b>{statusLabels[order.status]}</b><span>No Resi</span><b>{order.trackingNumber ?? '-'}</b></div></div>}
      <LineItems order={order} items={items} showNotesColumn qtyUnitOverride="PCS" />
      {isLastPage && <><div className="doc-total-box"><div><span>Subtotal Produk</span><b>{formatIdr(order.subtotal)}</b></div><div><span>Ongkir</span><b>{formatIdr(order.shippingCost ?? 0)}</b></div><div><span>Packing</span><b>{packingSummary(order)} • {formatIdr(order.packingFee ?? 0)}</b></div><div className="grand"><span>Total Order</span><b>{formatIdr(order.grandTotal)}</b></div></div><DocFooter /></>}
    </div>;
  })}</>;
}
function estimatePrintRowUnits(item: Order['items'][number]) {
  const textLength = `${item.skuSnapshot} ${item.productNameSnapshot} ${item.tierNameSnapshot} ${item.notes ?? ''}`.length;
  const noteUnits = item.notes ? Math.ceil(item.notes.length / 42) * 0.75 : 0;
  const nameUnits = Math.max(0, Math.ceil((textLength - 62) / 54) * 0.35);
  return 1 + noteUnits + nameUnits;
}
function chunkOrderItemsForPrint(items: Order['items']) {
  const pages: Order['items'][] = [];
  const firstPageUnits = 23.5;
  const nextPageUnits = 31;
  let currentPage: Order['items'] = [];
  let currentUnits = 0;
  let pageCapacity = firstPageUnits;
  for (const item of items) {
    const rowUnits = estimatePrintRowUnits(item);
    if (currentPage.length && currentUnits + rowUnits > pageCapacity) {
      pages.push(currentPage);
      currentPage = [];
      currentUnits = 0;
      pageCapacity = nextPageUnits;
    }
    currentPage.push(item);
    currentUnits += rowUnits;
  }
  if (currentPage.length) pages.push(currentPage);
  return pages.length ? pages : [[]];
}
function InvoiceDocument({ state, invoice, order }: { state: AppState; invoice: Invoice; order: Order }) { const partner = state.partners.find((item) => item.id === invoice.partnerId); return <div className="document a4-document invoice-document"><DocHeader title="INVOICE" number={invoice.invoiceNumber} /><div className="doc-meta-grid"><div><span>Ditagihkan Kepada</span><b>{partner?.businessName ?? partnerName(state, invoice.partnerId)}</b><p>{partner?.address ?? order.shippingAddress}<br />{partner?.city ?? '-'}{partner?.province ? `, ${partner.province}` : ''}<br />PIC: {partner?.contactPerson ?? '-'} • {partner?.phone ?? '-'}</p></div><div><span>Tanggal Invoice</span><b>{invoice.invoiceDate}</b><span>Jatuh Tempo</span><b>{invoice.dueDate}</b><span>Status</span><b>{invoice.status}</b></div></div><LineItems order={order} /><div className="doc-total-box"><div><span>Subtotal Produk</span><b>{formatIdr(order.subtotal)}</b></div><div><span>Ongkir</span><b>{formatIdr(order.shippingCost ?? 0)}</b></div><div><span>Packing</span><b>{packingSummary(order)} • {formatIdr(order.packingFee ?? 0)}</b></div><div className="grand"><span>Total Invoice</span><b>{formatIdr(invoice.grandTotal)}</b></div><div><span>Dibayar</span><b>{formatIdr(invoice.amountPaid)}</b></div><div><span>Sisa Tagihan</span><b>{formatIdr(invoice.amountDue)}</b></div></div><DocFooter /></div>; }
function DocHeader({ title, number }: { title: string; number: string }) { return <div className="doc-brand-head"><div className="doc-brand"><img src="/assets/logo-wahyu-beef.png" alt="Wahyu Beef" /><div><b>Wahyu Beef</b><span>Frozen Food & Meat Supplier</span></div></div><div className="doc-title"><h2>{title}</h2><b>{number}</b></div></div>; }
function DocFooter() { return <div className="doc-footer"><b>Wahyu Beef</b><span>Dokumen dicetak otomatis dari Mitra App Wahyu Beef.</span></div>; }
function LineItems({ order, items = order.items, showPrice = true, showNotesColumn = false, qtyUnitOverride }: { order: Order; items?: Order['items']; showPrice?: boolean; showNotesColumn?: boolean; qtyUnitOverride?: string }) { return <div className="table-wrap" style={{ marginTop: 18 }}><table><thead><tr><th>SKU</th><th>Produk</th><th>Qty</th>{showPrice && <><th>Harga</th><th>Total</th></>}{showNotesColumn && <><th>Catatan</th><th>QC</th></>}</tr></thead><tbody>{items.map((item) => { const qcQty = item.productId.startsWith('packaging-') ? undefined : item.qcDeliveredQty; return <tr key={item.id}><td>{item.skuSnapshot}</td><td>{item.productNameSnapshot}<br /><small>{item.tierNameSnapshot}</small>{!showNotesColumn && item.notes && <div className="line-item-note"><b>Catatan:</b> {item.notes}</div>}</td><td>{item.qty} {qtyUnitOverride ?? item.unitSnapshot}</td>{showPrice && <><td>{formatIdr(item.unitPrice)}</td><td>{formatIdr(item.lineTotal)}</td></>}{showNotesColumn && <><td className="line-item-notes-cell">{item.notes || '-'}</td><td className="line-item-qc-cell">{qcQty === undefined ? '-' : `${qcQty} ${qtyUnitOverride ?? item.unitSnapshot}`}</td></>}</tr>; })}</tbody></table></div>; }

function Leaderboard({ state }: { state: AppState }) { const rows = (state.leaderboardRows ?? getLeaderboard(state)).slice(0, 10); return <div className="card mobile-card-table"><h3>Papan Peringkat Mitra</h3><div className="table-wrap responsive-table"><table><thead><tr><th>Rank</th><th>Mitra</th><th>Tier</th><th>Delivered GMV</th><th>Total Qty</th><th>Order</th><th>Poin</th></tr></thead><tbody>{rows.map((row) => <tr key={row.partnerId}><td data-label="Rank"><b className={`rank-badge rank-${row.rank <= 3 ? row.rank : 'default'}`}>{rankMedal(row.rank)} #{row.rank}</b></td><td data-label="Mitra">{row.partnerName}</td><td data-label="Tier">{row.tier}</td><td data-label="Delivered GMV">{formatIdr(row.totalOrderValue)}</td><td data-label="Total Qty">{row.totalOrderQty}</td><td data-label="Order">{row.totalOrders}</td><td data-label="Poin"><b>{row.points}</b></td></tr>)}</tbody></table></div><p className="footer-note">Menampilkan 10 besar mitra. Hanya order delivered yang dihitung agar ranking tidak dimanipulasi dari pending/cancelled.</p></div>; }
function rankMedal(rank: number) { return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : ''; }
function Reports({ state }: { state: AppState }) { const topProducts = state.products.map((p) => ({ p, qty: state.orders.flatMap((o) => o.items).filter((i) => i.productId === p.id).reduce((s, i) => s + i.qty, 0) })).sort((a, b) => b.qty - a.qty).slice(0, 5); return <div className="grid cols-2"><div className="card"><h3>Sales Summary</h3><StatusSummary orders={state.orders} /></div><div className="card"><h3>Top Products</h3>{topProducts.map((row) => <p key={row.p.id}><b>{row.p.name}</b><br />{row.qty} pack terjual/order</p>)}</div><div className="card"><h3>Invoice Aging</h3>{state.invoices.map((i) => <p key={i.id}><b>{i.invoiceNumber}</b> • {partnerName(state, i.partnerId)}<br />Outstanding {formatIdr(i.amountDue)} • due {i.dueDate}</p>)}</div><div className="card"><h3>Export Ready</h3><div className="notice">Data report sudah dipisah untuk sales, produk, aging invoice, audit, dan accounting event export.</div></div></div>; }
function Audit({ state }: { state: AppState }) { return <LogTable logs={state.auditLogs.map((log) => ({ id: log.id, type: log.action, ref: `${log.entityType}:${log.entityId}`, amount: '', time: log.timestamp, meta: JSON.stringify(log.newValue ?? {}) }))} />; }
function Accounting({ state }: { state: AppState }) { return <LogTable logs={state.accountingEvents.map((log: AccountingEvent) => ({ id: log.id, type: log.eventType, ref: `${log.referenceType}:${log.referenceId}`, amount: log.amount ? formatIdr(log.amount) : '-', time: log.eventDate, meta: JSON.stringify(log.metadata) }))} />; }
function LogTable({ logs }: { logs: { id: string; type: string; ref: string; amount: string; time: string; meta: string }[] }) { return <div className="card mobile-card-table"><div className="table-wrap responsive-table"><table><thead><tr><th>Type</th><th>Reference</th><th>Amount</th><th>Time</th><th>Metadata</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td data-label="Type"><b>{log.type}</b></td><td data-label="Reference">{log.ref}</td><td data-label="Amount">{log.amount}</td><td data-label="Time">{new Date(log.time).toLocaleString('id-ID')}</td><td data-label="Metadata"><small>{log.meta}</small></td></tr>)}</tbody></table></div></div>; }
function StatusSummary({ orders }: { orders: Order[] }) { return <div className="grid">{Object.keys(statusLabels).map((key) => { const status = key as OrderStatus; const count = orders.filter((o) => o.status === status).length; return <div key={status} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #edf2f7', padding: '8px 0' }}><span>{statusLabels[status]}</span><b>{count}</b></div>; })}</div>; }

function partnerName(state: AppState, partnerId: string) { return state.partners.find((p) => p.id === partnerId)?.businessName ?? '-'; }
function tierName(state: AppState, tierId: string) { return state.tiers.find((t) => t.id === tierId)?.name ?? '-'; }
function roleLabel(role: Role) { return ({ super_admin: 'Super Admin', sales_admin: 'Admin Sales', finance_admin: 'Admin Finance', warehouse: 'Warehouse', partner: 'Mitra' } satisfies Record<Role, string>)[role]; }

createRoot(document.getElementById('root')!).render(<App />);
