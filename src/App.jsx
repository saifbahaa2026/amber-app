import { useState, useEffect, useCallback } from 'react';
import {
  Zap, Lock, Phone, MapPin, Users, Wallet, Home as HomeIcon,
  LogOut, Plus, Check, X, Power, Edit2, Trash2, ChevronLeft, ArrowRight,
  UserPlus, Building2, Clock, AlertCircle, User, Eye, EyeOff, Wrench, RefreshCw,
  Sun, Moon, Search
} from 'lucide-react';

/* ---------------------------------------------------------------------- */
/* Constants & helpers                                                     */
/* ---------------------------------------------------------------------- */

const ADMIN_PASSWORD = 'saif';

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${ARABIC_MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

function newId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US');
}

/* ---------------------------------------------------------------------- */
/* Storage helpers (with automatic in-memory fallback)                     */
/* ---------------------------------------------------------------------- */

// If the platform storage service is unavailable/broken, we fall back to
// this in-memory store so the app remains usable within the session.
// Data in the fallback store is lost on page reload/close.
const memoryStore = {};
let usingFallback = false;
function isUsingFallbackStorage() { return usingFallback; }

function storageAvailable() {
  return typeof window !== 'undefined' && !!window.storage && typeof window.storage.set === 'function';
}

async function storageGet(key) {
  if (storageAvailable()) {
    try {
      const res = await window.storage.get(key, true);
      return res ? res.value : null;
    } catch (e) {
      console.warn(`storage.get(${key}) failed, using memory fallback`, e);
      usingFallback = true;
    }
  } else {
    usingFallback = true;
  }
  return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
}

async function storageSet(key, value) {
  if (storageAvailable()) {
    try {
      const result = await window.storage.set(key, value, true);
      if (result) return true;
    } catch (e) {
      console.warn(`storage.set(${key}) failed, using memory fallback`, e);
    }
    usingFallback = true;
  } else {
    usingFallback = true;
  }
  memoryStore[key] = value;
  return true;
}

async function loadOwners() {
  try {
    const raw = await storageGet('owners-list');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveOwners(list) {
  try {
    await storageSet('owners-list', JSON.stringify(list));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

async function loadOwnerData(phone) {
  try {
    const raw = await storageGet(`owner-data:${phone}`);
    return raw ? JSON.parse(raw) : { subscribers: [], months: {} };
  } catch {
    return { subscribers: [], months: {} };
  }
}

async function saveOwnerData(phone, data) {
  try {
    await storageSet(`owner-data:${phone}`, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('save owner data failed', e);
    return false;
  }
}

async function loadAdminPassword() {
  const raw = await storageGet('admin-password');
  return raw || ADMIN_PASSWORD;
}

async function saveAdminPassword(password) {
  await storageSet('admin-password', password);
  return true;
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// Re-reads the shared owners list to confirm a new registration truly
// landed in shared storage (and would therefore be visible to the admin),
// rather than trusting the write call's return value alone.
async function verifyOwnerReachedAdmin(phone, attempts = 3, delayMs = 700) {
  for (let i = 0; i < attempts; i++) {
    await sleep(delayMs);
    const list = await loadOwners();
    if (list.some(o => o.phone === phone)) return true;
  }
  return false;
}

/* ---------------------------------------------------------------------- */
/* Small UI atoms                                                          */
/* ---------------------------------------------------------------------- */

function BreakerSwitch({ on, onToggle, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex items-center w-16 h-9 rounded-full border-2 transition-colors duration-300 flex-shrink-0
        ${on ? 'bg-teal-600 border-teal-600' : 'bg-slate-700 border-slate-700'}
        ${disabled ? 'opacity-50' : 'active:scale-95'}`}
    >
      <span
        className={`absolute top-0.5 flex items-center justify-center w-7 h-7 rounded-full shadow transition-all duration-300 bg-white
          ${on ? 'right-0.5' : 'right-7'}`}
      >
        <Zap className={`w-3.5 h-3.5 ${on ? 'text-teal-400' : 'text-slate-500'}`} />
      </span>
    </button>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: { label: 'قيد المراجعة', cls: 'bg-amber-950 text-amber-400 border-amber-800' },
    approved: { label: 'مفعّل', cls: 'bg-emerald-950 text-emerald-400 border-emerald-800' },
    rejected: { label: 'مرفوض', cls: 'bg-rose-950 text-rose-400 border-rose-800' },
    stopped: { label: 'موقوف', cls: 'bg-rose-950 text-rose-400 border-rose-800' },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${s.cls}`}>
      {s.label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  const accentMap = {
    teal: 'text-teal-400 bg-teal-950',
    emerald: 'text-emerald-400 bg-emerald-950',
    rose: 'text-rose-400 bg-rose-950',
    amber: 'text-amber-400 bg-amber-950',
    slate: 'text-slate-300 bg-slate-800',
  };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accentMap[accent]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-xl font-extrabold text-slate-50 tabular-nums">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function Field({ icon: Icon, label, ...props }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-400 mb-1.5 block">{label}</span>
      <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 focus-within:border-teal-500 focus-within:bg-slate-900 transition-colors">
        {Icon && <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />}
        <input
          {...props}
          className="bg-transparent outline-none text-slate-100 w-full placeholder-slate-400 text-sm"
        />
      </div>
    </label>
  );
}

function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`w-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-extrabold py-3 rounded-xl transition-all duration-150 disabled:opacity-40 disabled:active:scale-100 shadow-sm ${className}`}
    >
      {children}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800 flex-shrink-0">
        <h2 className="font-extrabold text-slate-50">{title}</h2>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 active:scale-95">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Login & Register                                                        */
/* ---------------------------------------------------------------------- */

function LoginScreen({ onLogin, goRegister, loading, error, onAdminLogin, adminLoading, adminError, theme, onToggleTheme }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  const handleLogoTap = () => {
    const next = tapCount + 1;
    if (next >= 5) {
      setTapCount(0);
      setShowAdmin(true);
    } else {
      setTapCount(next);
    }
  };

  return (
    <div className="relative flex flex-col h-full px-6 bg-gradient-to-b from-slate-950 via-slate-900 to-black overflow-hidden">
      <button
        onClick={onToggleTheme}
        className="absolute top-4 left-4 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-slate-800/80 backdrop-blur active:scale-95"
      >
        {theme === 'light' ? <Moon className="w-4 h-4 text-slate-300" /> : <Sun className="w-4 h-4 text-slate-300" />}
      </button>
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-56 h-56 bg-amber-500 rounded-full blur-3xl opacity-20 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-40 h-40 bg-yellow-500 rounded-full blur-3xl opacity-20 pointer-events-none" />


      <div className="relative flex-1 flex flex-col items-center justify-center gap-2">
        <div
          onClick={handleLogoTap}
          className="logo-pulse w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center mb-3 shadow-lg shadow-amber-950 border-2 border-amber-300 select-none"
        >
          <Zap className="w-9 h-9 text-white" strokeWidth={2.5} fill="white" />
        </div>
        <h1 className="text-2xl font-extrabold text-white select-none">أمبير</h1>
        <p className="text-slate-500 text-xs -mt-1">نظام إدارة المولدات</p>
        <p className="text-slate-400 text-sm">تسجيل دخول صاحب المولدة</p>
      </div>

      <div className="relative bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl flex flex-col gap-3 mb-6">
        <Field icon={Phone} label="رقم الهاتف" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07xxxxxxxxx" type="tel" inputMode="numeric" />

        <label className="block">
          <span className="text-xs font-bold text-slate-400 mb-1.5 block">كلمة المرور</span>
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 focus-within:border-amber-500">
            <Lock className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="ادخل كلمة المرور"
              className="bg-transparent outline-none text-slate-100 w-full placeholder-slate-600 text-sm"
            />
            <button type="button" onClick={() => setShowPassword(s => !s)} className="flex-shrink-0 text-slate-500">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </label>

        <div className="flex items-center justify-between text-xs pt-0.5">
          <button type="button" onClick={() => setRemember(r => !r)} className="flex items-center gap-1.5 text-slate-400 font-bold">
            <span className={`w-4 h-4 rounded flex items-center justify-center border ${remember ? 'bg-amber-500 border-amber-500' : 'border-slate-600'}`}>
              {remember && <Check className="w-3 h-3 text-white" />}
            </span>
            تذكرني
          </button>
          <button type="button" onClick={() => setShowForgot(s => !s)} className="text-amber-400 font-bold">
            نسيت كلمة المرور؟
          </button>
        </div>

        {showForgot && (
          <div className="text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
            تواصل مع الإدارة لإعادة تعيين كلمة المرور.
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-rose-950 border border-rose-800 text-rose-400 text-sm rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          disabled={loading || !phone || !password}
          onClick={() => onLogin(phone.trim(), password)}
          className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 active:scale-95 text-slate-950 font-extrabold py-3 rounded-xl transition-all duration-150 disabled:opacity-40 disabled:active:scale-100 shadow-lg shadow-amber-950 mt-1"
        >
          {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
        </button>

        <button
          onClick={goRegister}
          className="flex items-center justify-center gap-2 text-amber-400 font-bold text-sm py-1"
        >
          <UserPlus className="w-4 h-4" />
          تسجيل دخول صاحب مولد جديد
        </button>
      </div>

      <div className="relative flex flex-col items-center gap-1 pb-4">
        <a
          href="tel:07713279825"
          className="support-glow flex items-center gap-1.5 text-xs text-amber-400 font-bold active:scale-95"
        >
          <Wrench className="w-3.5 h-3.5" /> الدعم الفني
        </a>
        <p className="text-center text-xs text-slate-600">تطوير: المهندس سيف بهاء عبد اللطيف</p>
      </div>

      {showAdmin && (
        <Modal title="دخول المدير" onClose={() => { setShowAdmin(false); setAdminPassword(''); }}>
          <div className="flex flex-col gap-3">
            <Field icon={Lock} label="كلمة مرور المدير" type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="••••••" />
            {adminError && (
              <div className="flex items-start gap-2 bg-rose-950 border border-rose-800 text-rose-400 text-sm rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{adminError}</span>
              </div>
            )}
          </div>
          <div className="pt-5">
            <PrimaryButton disabled={adminLoading || !adminPassword} onClick={() => onAdminLogin(adminPassword)}>
              {adminLoading ? 'جاري الدخول...' : 'دخول'}
            </PrimaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RegisterScreen({ onSubmit, goBack, loading, verifying, error, theme, onToggleTheme }) {
  const [form, setForm] = useState({ fullName: '', phone: '', address: '', password: '', confirm: '' });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const valid = form.fullName && form.phone && form.address && form.password && form.password === form.confirm;

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <button onClick={goBack} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 active:scale-95">
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </button>
          <h2 className="font-extrabold text-slate-50">حساب صاحب مولد جديد</h2>
        </div>
        <button onClick={onToggleTheme} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 active:scale-95">
          {theme === 'light' ? <Moon className="w-4 h-4 text-slate-400" /> : <Sun className="w-4 h-4 text-slate-400" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <Field icon={User} label="الاسم الكامل" value={form.fullName} onChange={set('fullName')} placeholder="مثال: أحمد كريم" />
        <Field icon={Phone} label="رقم الهاتف" value={form.phone} onChange={set('phone')} placeholder="07xxxxxxxxx" type="tel" inputMode="numeric" />
        <Field icon={Building2} label="عنوان المولد" value={form.address} onChange={set('address')} placeholder="مثال: حي الأمل، شارع 5" />
        <Field icon={Lock} label="كلمة المرور" type="password" value={form.password} onChange={set('password')} placeholder="كلمة مرور" />
        <Field icon={Lock} label="تأكيد كلمة المرور" type="password" value={form.confirm} onChange={set('confirm')} placeholder="أعد كتابة كلمة المرور" />

        {form.password && form.confirm && form.password !== form.confirm && (
          <div className="text-rose-400 text-xs font-bold">كلمتا المرور غير متطابقتين</div>
        )}
        {error && (
          <div className="flex items-start gap-2 bg-rose-950 border border-rose-800 text-rose-400 text-sm rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800">
        <PrimaryButton disabled={!valid || loading} onClick={() => onSubmit(form)}>
          {verifying ? 'جاري التأكد من وصول الطلب للإدارة...' : loading ? 'جاري الإرسال...' : 'إرسال طلب التسجيل'}
        </PrimaryButton>
      </div>
    </div>
  );
}

function PendingNotice({ goLogin, theme, onToggleTheme }) {
  return (
    <div className="relative flex flex-col h-full items-center justify-center px-8 text-center gap-4 bg-slate-900">
      <button onClick={onToggleTheme} className="absolute top-4 left-4 w-9 h-9 flex items-center justify-center rounded-full bg-slate-800 active:scale-95">
        {theme === 'light' ? <Moon className="w-4 h-4 text-slate-400" /> : <Sun className="w-4 h-4 text-slate-400" />}
      </button>
      <div className="w-16 h-16 rounded-full bg-amber-950 border border-amber-800 flex items-center justify-center">
        <Clock className="w-8 h-8 text-amber-400" />
      </div>
      <h2 className="text-xl font-extrabold text-slate-50">حسابك قيد المراجعة</h2>
      <p className="text-slate-400 text-sm">✅ تم تأكيد وصول طلبك للإدارة، وهو الآن بانتظار الموافقة. راجع الطلب لاحقاً بمحاولة تسجيل الدخول.</p>
      <PrimaryButton onClick={goLogin} className="mt-2">الذهاب لتسجيل الدخول</PrimaryButton>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Admin dashboard                                                         */
/* ---------------------------------------------------------------------- */

function AdminDashboard({ owners, onAction, onLogout, onRefresh, theme, onToggleTheme, onChangePassword }) {
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const filtered = owners.filter(o => {
    if (filter === 'all') return true;
    if (filter === 'pending') return o.status === 'pending';
    if (filter === 'approved') return o.status === 'approved' && o.active;
    if (filter === 'stopped') return o.status === 'approved' && !o.active;
    if (filter === 'rejected') return o.status === 'rejected';
    return true;
  });

  const pendingCount = owners.filter(o => o.status === 'pending').length;
  const approvedCount = owners.filter(o => o.status === 'approved' && o.active).length;
  const stoppedCount = owners.filter(o => o.status === 'approved' && !o.active).length;
  const rejectedCount = owners.filter(o => o.status === 'rejected').length;

  const tabs = [
    { k: 'all', label: 'الكل', count: owners.length, icon: Users },
    { k: 'pending', label: 'قيد المراجعة', count: pendingCount, icon: Clock },
    { k: 'approved', label: 'مفعّل', count: approvedCount, icon: Check },
    { k: 'stopped', label: 'موقوف', count: stoppedCount, icon: Power },
    { k: 'rejected', label: 'مرفوض', count: rejectedCount, icon: X },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex items-center justify-between px-4 py-4 bg-slate-900 border-b border-slate-800">
        <div>
          <h2 className="font-extrabold text-slate-50">لوحة المدير</h2>
          <p className="text-xs text-slate-400">إدارة حسابات أصحاب المولدات</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggleTheme} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-800 active:scale-95">
            {theme === 'light' ? <Moon className="w-4 h-4 text-slate-400" /> : <Sun className="w-4 h-4 text-slate-400" />}
          </button>
          <button onClick={handleRefresh} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-800 active:scale-95">
            <RefreshCw className={`w-4 h-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowChangePwd(true)} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-800 active:scale-95">
            <Lock className="w-4 h-4 text-slate-400" />
          </button>
          <button onClick={onLogout} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-800 active:scale-95">
            <LogOut className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 py-3 bg-slate-900 border-b border-slate-800">
        {tabs.map(t => (
          <button
            key={t.k}
            onClick={() => setFilter(t.k)}
            className={`aspect-square rounded-2xl border flex flex-col items-center justify-center gap-1 transition-colors
              ${filter === t.k ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-950 text-slate-400 border-slate-800'}`}
          >
            <t.icon className="w-5 h-5" />
            <span className="text-lg font-extrabold tabular-nums">{t.count}</span>
            <span className="text-[11px] font-bold text-center leading-tight px-1">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {filtered.length === 0 && (
          <div className="text-center text-slate-500 text-sm mt-10">لا يوجد حسابات في هذا التصنيف</div>
        )}
        {filtered.map(o => (
          <div key={o.phone} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-extrabold text-slate-50">{o.fullName}</div>
                <div className="text-xs text-slate-500" dir="ltr">{o.phone}</div>
              </div>
              <StatusBadge status={o.status === 'approved' && !o.active ? 'stopped' : o.status} />
            </div>
            <div className="flex flex-col gap-1 text-sm text-slate-400">
              <div className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5" />{o.address}</div>
            </div>
            <div className="flex gap-2 pt-1">
              {o.status === 'pending' && (
                <>
                  <button onClick={() => onAction(o.phone, 'approve')} className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 active:scale-95 text-white text-xs font-bold py-2 rounded-lg">
                    <Check className="w-3.5 h-3.5" /> موافقة
                  </button>
                  <button onClick={() => onAction(o.phone, 'reject')} className="flex-1 flex items-center justify-center gap-1 bg-rose-600 active:scale-95 text-white text-xs font-bold py-2 rounded-lg">
                    <X className="w-3.5 h-3.5" /> رفض
                  </button>
                </>
              )}
              {o.status === 'approved' && o.active && (
                <button onClick={() => onAction(o.phone, 'stop')} className="flex-1 flex items-center justify-center gap-1 bg-rose-600 active:scale-95 text-white text-xs font-bold py-2 rounded-lg">
                  <Power className="w-3.5 h-3.5" /> إيقاف الحساب
                </button>
              )}
              {o.status === 'approved' && !o.active && (
                <button onClick={() => onAction(o.phone, 'start')} className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 active:scale-95 text-white text-xs font-bold py-2 rounded-lg">
                  <Power className="w-3.5 h-3.5" /> تشغيل الحساب
                </button>
              )}
              {o.status === 'rejected' && (
                <button onClick={() => onAction(o.phone, 'approve')} className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 active:scale-95 text-white text-xs font-bold py-2 rounded-lg">
                  <Check className="w-3.5 h-3.5" /> موافقة على الحساب
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {showChangePwd && (
        <ChangePasswordModal
          title="تغيير كلمة مرور المدير"
          onSubmit={onChangePassword}
          onClose={() => setShowChangePwd(false)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Owner: modals                                                           */
/* ---------------------------------------------------------------------- */

function SubscriberModal({ initial, defaultPrice, onSave, onClose }) {
  const [form, setForm] = useState(initial || { name: '', phone: '', address: '', amperes: '', price: defaultPrice ? String(defaultPrice) : '' });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const valid = form.name && form.phone && form.address && Number(form.amperes) > 0 && Number(form.price) > 0;

  return (
    <Modal title={initial ? 'تعديل بيانات المشترك' : 'إضافة مشترك جديد'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Field icon={User} label="الاسم" value={form.name} onChange={set('name')} placeholder="اسم المشترك" />
        <Field icon={Phone} label="رقم الهاتف" value={form.phone} onChange={set('phone')} placeholder="07xxxxxxxxx" type="tel" />
        <Field icon={MapPin} label="العنوان / رقم الدار" value={form.address} onChange={set('address')} placeholder="مثال: زقاق 3، دار 12" />
        <Field icon={Zap} label="عدد الأمبيرات" value={form.amperes} onChange={set('amperes')} placeholder="مثال: 5" type="number" inputMode="decimal" />
        <Field icon={Wallet} label="سعر الأمبير" value={form.price} onChange={set('price')} placeholder="مثال: 8000" type="number" inputMode="decimal" />
        <p className="text-xs text-slate-500 -mt-1">سعر الأمبير يتغيّر تلقائياً لو غيّرت "سعر الأمبير العام" من الصفحة الرئيسية.</p>
      </div>
      <div className="pt-5">
        <PrimaryButton disabled={!valid} onClick={() => onSave({ ...form, amperes: Number(form.amperes), price: Number(form.price) })}>
          حفظ
        </PrimaryButton>
      </div>
    </Modal>
  );
}

function ChangePasswordModal({ title, onSubmit, onClose }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const valid = current && next && confirm && next === confirm;

  const handleSave = async () => {
    setSaving(true); setError('');
    const result = await onSubmit(current, next);
    setSaving(false);
    if (!result || !result.ok) {
      setError((result && result.error) || 'تعذر تغيير كلمة المرور');
      return;
    }
    onClose();
  };

  return (
    <Modal title={title || 'تغيير كلمة المرور'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Field icon={Lock} label="كلمة المرور الحالية" type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="••••••" />
        <Field icon={Lock} label="كلمة المرور الجديدة" type="password" value={next} onChange={e => setNext(e.target.value)} placeholder="••••••" />
        <Field icon={Lock} label="تأكيد كلمة المرور الجديدة" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••" />
        {next && confirm && next !== confirm && (
          <div className="text-rose-400 text-xs font-bold">كلمتا المرور غير متطابقتين</div>
        )}
        {error && (
          <div className="flex items-start gap-2 bg-rose-950 border border-rose-800 text-rose-400 text-sm rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
      <div className="pt-5">
        <PrimaryButton disabled={!valid || saving} onClick={handleSave}>
          {saving ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
        </PrimaryButton>
      </div>
    </Modal>
  );
}

function GlobalPriceModal({ current, onSave, onClose }) {
  const [price, setPrice] = useState(current ? String(current) : '');
  const valid = Number(price) > 0;

  return (
    <Modal title="سعر الأمبير العام" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-slate-400 leading-relaxed">
          حدّد سعر الأمبير هنا وراح ينطبق فوراً على كل المشتركين الحاليين، وراح يكون السعر الافتراضي لأي مشترك جديد تضيفه.
        </p>
        <Field icon={Wallet} label="سعر الأمبير (لكل المشتركين)" value={price} onChange={e => setPrice(e.target.value)} placeholder="مثال: 8000" type="number" inputMode="decimal" />
      </div>
      <div className="pt-5">
        <PrimaryButton disabled={!valid} onClick={() => onSave(Number(price))}>
          تطبيق على كل المشتركين
        </PrimaryButton>
      </div>
    </Modal>
  );
}

function MonthModal({ subscriber, initial, onSave, onClose }) {
  const [ym, setYm] = useState(initial?.ym || currentYM());
  const [amperes, setAmperes] = useState(initial?.amperes ?? subscriber.amperes);
  const [price, setPrice] = useState(initial?.price ?? subscriber.price);
  const [paid, setPaid] = useState(initial?.paid ?? '');

  const due = (Number(amperes) || 0) * (Number(price) || 0);
  const remaining = due - (Number(paid) || 0);

  return (
    <Modal title={initial ? 'تعديل سجل الشهر' : 'إضافة سجل شهر'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="text-xs font-bold text-slate-400 mb-1.5 block">الشهر</span>
          <input
            type="month"
            value={ym}
            onChange={e => setYm(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 w-full outline-none focus:border-teal-500"
          />
        </label>
        <Field icon={Zap} label="عدد الأمبيرات" value={amperes} onChange={e => setAmperes(e.target.value)} type="number" inputMode="decimal" />
        <Field icon={Wallet} label="سعر الأمبير" value={price} onChange={e => setPrice(e.target.value)} type="number" inputMode="decimal" />
        <Field icon={Wallet} label="المبلغ المدفوع" value={paid} onChange={e => setPaid(e.target.value)} placeholder="0" type="number" inputMode="decimal" />

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">المبلغ المطلوب</span><span className="text-slate-100 font-bold tabular-nums">{money(due)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">المتبقي</span><span className={`font-bold tabular-nums ${remaining > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{money(Math.max(remaining, 0))}</span></div>
        </div>
      </div>
      <div className="pt-5">
        <PrimaryButton
          disabled={!ym || !amperes || !price}
          onClick={() => onSave({
            id: initial?.id || newId(),
            ym,
            amperes: Number(amperes),
            price: Number(price),
            due,
            paid: Number(paid) || 0,
            remaining: Math.max(remaining, 0),
            status: remaining <= 0 ? 'paid' : 'unpaid',
          })}
        >
          حفظ السجل
        </PrimaryButton>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Owner: subscriber detail                                                */
/* ---------------------------------------------------------------------- */

function ReceiptModal({ profile, subscriber, month, onClose }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800 flex-shrink-0 no-print">
        <h2 className="font-extrabold text-slate-50">وصل الدفع</h2>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 active:scale-95">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="receipt-print bg-white text-slate-900 rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
          <div className="flex flex-col items-center gap-1 pb-3 border-b-2 border-dashed border-slate-300">
            <div className="w-12 h-12 rounded-full bg-teal-600 flex items-center justify-center mb-1">
              <Zap className="w-6 h-6 text-white" fill="white" />
            </div>
            <h3 className="font-extrabold text-lg">{profile.address}</h3>
            <p className="text-xs text-slate-500">صاحب المولد: {profile.fullName}</p>
          </div>

          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">اسم المشترك</span><span className="font-bold">{subscriber.name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">رقم الهاتف</span><span className="font-bold" dir="ltr">{subscriber.phone}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">العنوان</span><span className="font-bold">{subscriber.address}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">الشهر</span><span className="font-bold">{formatMonthLabel(month.ym)}</span></div>
          </div>

          <div className="border-t-2 border-dashed border-slate-300 pt-3 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">عدد الأمبيرات</span><span className="font-bold tabular-nums">{month.amperes}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">سعر الأمبير</span><span className="font-bold tabular-nums">{money(month.price)} د.ع</span></div>
            <div className="flex justify-between"><span className="text-slate-500">المبلغ المطلوب</span><span className="font-bold tabular-nums">{money(month.due)} د.ع</span></div>
            <div className="flex justify-between"><span className="text-slate-500">المبلغ المدفوع</span><span className="font-bold tabular-nums text-emerald-600">{money(month.paid)} د.ع</span></div>
            <div className="flex justify-between"><span className="text-slate-500">المتبقي</span><span className="font-bold tabular-nums text-rose-600">{money(month.remaining)} د.ع</span></div>
          </div>

          <div className="border-t-2 border-dashed border-slate-300 pt-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">الحالة</span>
            <span className={`text-sm font-extrabold ${month.status === 'paid' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {month.status === 'paid' ? '✅ مدفوع بالكامل' : '❌ غير مدفوع بالكامل'}
            </span>
          </div>

          <p className="text-center text-xs text-slate-400 pt-2">شكراً لتعاملكم معنا</p>
        </div>
      </div>

      <div className="p-4 border-t border-slate-800 no-print">
        <PrimaryButton onClick={handlePrint}>طباعة الوصل</PrimaryButton>
      </div>
    </div>
  );
}

function SubscriberDetail({ subscriber, months, profile, onBack, onToggleActive, onEdit, onDelete, onSaveMonth, onDeleteMonth }) {
  const [showEditSub, setShowEditSub] = useState(false);
  const [monthModal, setMonthModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteMonth, setConfirmDeleteMonth] = useState(null);
  const [receiptFor, setReceiptFor] = useState(null);
  const [monthSearch, setMonthSearch] = useState('');

  const sorted = [...months].sort((a, b) => b.ym.localeCompare(a.ym));
  const searched = monthSearch.trim()
    ? sorted.filter(m => formatMonthLabel(m.ym).includes(monthSearch.trim()))
    : sorted;
  const paidCount = months.filter(m => m.status === 'paid').length;
  const unpaidCount = months.length - paidCount;

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex items-center gap-2 px-4 py-4 bg-slate-900 border-b border-slate-800">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 active:scale-95">
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </button>
        <h2 className="font-extrabold text-slate-50 truncate">{subscriber.name}</h2>
      </div>

      <div className="flex items-center justify-center gap-4 px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs font-bold">
        <span className="text-slate-300">عدد الأشهر المسجلة: <span className="text-slate-50 tabular-nums">{months.length}</span></span>
        <span className="text-emerald-400">مدفوع: <span className="tabular-nums">{paidCount}</span></span>
        <span className="text-rose-400">غير مدفوع: <span className="tabular-nums">{unpaidCount}</span></span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-400 font-bold"><Power className="w-4 h-4" /> حالة الاشتراك</div>
            <BreakerSwitch on={subscriber.active} onToggle={onToggleActive} />
          </div>
          <div className="flex flex-col gap-1.5 text-sm text-slate-300">
            <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-500" />{subscriber.phone}</div>
            <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-slate-500" />{subscriber.address}</div>
            <div className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-slate-500" />{subscriber.amperes} أمبير × {money(subscriber.price)} د.ع</div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowEditSub(true)} className="flex-1 flex items-center justify-center gap-1 bg-slate-800 active:scale-95 text-slate-200 text-xs font-bold py-2 rounded-lg">
              <Edit2 className="w-3.5 h-3.5" /> تعديل
            </button>
            <button
              onClick={() => confirmDelete ? onDelete() : setConfirmDelete(true)}
              className={`flex-1 flex items-center justify-center gap-1 active:scale-95 text-xs font-bold py-2 rounded-lg ${confirmDelete ? 'bg-rose-600 text-white' : 'bg-slate-800 text-rose-400'}`}
            >
              <Trash2 className="w-3.5 h-3.5" /> {confirmDelete ? 'تأكيد الحذف؟' : 'حذف المشترك'}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-100 text-sm">سجل الأشهر</h3>
          <button onClick={() => setMonthModal('new')} className="flex items-center gap-1 text-teal-400 text-xs font-bold">
            <Plus className="w-3.5 h-3.5" /> إضافة شهر
          </button>
        </div>

        {months.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 focus-within:border-amber-500">
            <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <input
              value={monthSearch}
              onChange={e => setMonthSearch(e.target.value)}
              placeholder="بحث عن شهر (مثال: يوليو)"
              className="bg-transparent outline-none text-slate-100 w-full placeholder-slate-500 text-sm"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {sorted.length === 0 && <div className="col-span-2 text-center text-slate-500 text-sm py-6">لا يوجد سجلات أشهر بعد</div>}
          {sorted.length > 0 && searched.length === 0 && <div className="col-span-2 text-center text-slate-500 text-sm py-6">ما لكيت شهر مطابق للبحث</div>}
          {searched.map(m => (
            <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col gap-2 shadow-sm">
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-100 text-sm">{formatMonthLabel(m.ym)}</span>
                <span className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full border ${m.status === 'paid' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-rose-950 text-rose-400 border-rose-800'}`}>
                  {m.status === 'paid' ? '✅ مدفوع' : '❌ غير مدفوع'}
                </span>
              </div>
              <div className="flex flex-col gap-1 text-xs text-slate-400">
                <div className="flex justify-between"><span>المطلوب</span><span className="text-slate-100 font-bold tabular-nums">{money(m.due)}</span></div>
                <div className="flex justify-between"><span>المدفوع</span><span className="text-emerald-400 font-bold tabular-nums">{money(m.paid)}</span></div>
                <div className="flex justify-between"><span>المتبقي</span><span className="text-rose-400 font-bold tabular-nums">{money(m.remaining)}</span></div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button onClick={() => setMonthModal(m)} className="flex items-center justify-center text-slate-300 bg-slate-800 rounded-lg py-1.5 active:scale-95">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setReceiptFor(m)} className="flex items-center justify-center text-teal-400 bg-slate-800 rounded-lg py-1.5 active:scale-95">
                  <Wallet className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => confirmDeleteMonth === m.id ? onDeleteMonth(m.id) : setConfirmDeleteMonth(m.id)}
                  className={`flex items-center justify-center rounded-lg py-1.5 active:scale-95 ${confirmDeleteMonth === m.id ? 'bg-rose-600 text-white' : 'bg-slate-800 text-rose-400'}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {confirmDeleteMonth === m.id && (
                <span className="text-[10px] text-rose-400 font-bold text-center -mt-1">اضغط 🗑 مرة ثانية للتأكيد</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {showEditSub && (
        <SubscriberModal
          initial={subscriber}
          onClose={() => setShowEditSub(false)}
          onSave={(data) => { onEdit(data); setShowEditSub(false); }}
        />
      )}
      {monthModal && (
        <MonthModal
          subscriber={subscriber}
          initial={monthModal === 'new' ? null : monthModal}
          onClose={() => setMonthModal(null)}
          onSave={(data) => { onSaveMonth(data); setMonthModal(null); }}
        />
      )}
      {receiptFor && (
        <ReceiptModal
          profile={profile}
          subscriber={subscriber}
          month={receiptFor}
          onClose={() => setReceiptFor(null)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Owner app                                                                */
/* ---------------------------------------------------------------------- */

function MonthOverview({ ym, subscribers, months, onBack, onSelectSubscriber }) {
  const rows = subscribers.map(s => {
    const list = months[s.id] || [];
    const rec = list.find(m => m.ym === ym);
    return { s, rec };
  });
  const totalDue = rows.reduce((sum, r) => sum + (r.rec ? r.rec.due : 0), 0);
  const totalPaid = rows.reduce((sum, r) => sum + (r.rec ? r.rec.paid : 0), 0);
  const totalRemaining = rows.reduce((sum, r) => sum + (r.rec ? r.rec.remaining : 0), 0);

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex items-center gap-2 px-4 py-4 bg-slate-900 border-b border-slate-800">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 active:scale-95">
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </button>
        <h2 className="font-extrabold text-slate-50">{formatMonthLabel(ym)}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <StatCard icon={Wallet} label="المطلوب" value={money(totalDue)} accent="slate" />
          <StatCard icon={Check} label="المدفوع" value={money(totalPaid)} accent="emerald" />
          <StatCard icon={AlertCircle} label="المتبقي" value={money(totalRemaining)} accent="rose" />
        </div>

        {rows.map(({ s, rec }) => (
          <button
            key={s.id}
            onClick={() => onSelectSubscriber(s.id)}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 text-right active:scale-98 shadow-sm"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              !rec ? 'bg-slate-800 text-slate-500' : rec.status === 'paid' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
            }`}>
              <Zap className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-50 truncate">{s.name}</div>
              {rec ? (
                <div className={`text-xs font-bold ${rec.status === 'paid' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {rec.status === 'paid' ? '✅ مدفوع بالكامل' : `❌ متبقي ${money(rec.remaining)} د.ع`}
                </div>
              ) : (
                <div className="text-xs text-slate-500">لا يوجد سجل لهذا الشهر</div>
              )}
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-500 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

function OwnerApp({ profile, data, setData, onLogout, theme, onToggleTheme, onChangePassword }) {
  const [tab, setTab] = useState('subscribers');
  const [activeSubId, setActiveSubId] = useState(null);
  const [showAddSub, setShowAddSub] = useState(false);
  const [showGlobalPrice, setShowGlobalPrice] = useState(false);
  const [acctFilter, setAcctFilter] = useState('all');
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [activeMonthYm, setActiveMonthYm] = useState(null);

  const subscribers = data.subscribers;
  const monthsFor = (id) => data.months[id] || [];

  const persist = (next) => {
    setData(next);
    saveOwnerData(profile.phone, next);
  };

  const addSubscriber = (sub) => {
    const s = { id: newId(), active: true, ...sub };
    persist({ ...data, subscribers: [s, ...subscribers] });
  };

  const editSubscriber = (id, updates) => {
    persist({ ...data, subscribers: subscribers.map(s => s.id === id ? { ...s, ...updates } : s) });
  };

  const deleteSubscriber = (id) => {
    const { [id]: _, ...restMonths } = data.months;
    persist({ ...data, subscribers: subscribers.filter(s => s.id !== id), months: restMonths });
    setActiveSubId(null);
  };

  const toggleSubscriberActive = (id) => {
    persist({ ...data, subscribers: subscribers.map(s => s.id === id ? { ...s, active: !s.active } : s) });
  };

  const saveMonth = (subId, monthObj) => {
    const list = data.months[subId] || [];
    const exists = list.some(m => m.id === monthObj.id);
    const nextList = exists ? list.map(m => m.id === monthObj.id ? monthObj : m) : [monthObj, ...list];
    persist({ ...data, months: { ...data.months, [subId]: nextList } });
  };

  const deleteMonth = (subId, monthId) => {
    const list = (data.months[subId] || []).filter(m => m.id !== monthId);
    persist({ ...data, months: { ...data.months, [subId]: list } });
  };

  const setGlobalPrice = (price) => {
    persist({ ...data, defaultPrice: price, subscribers: subscribers.map(s => ({ ...s, price })) });
  };

  const generateCurrentMonthForAll = () => {
    const thisYm = currentYM();
    const nextMonths = { ...data.months };
    subscribers.forEach(s => {
      const list = nextMonths[s.id] || [];
      const already = list.some(m => m.ym === thisYm);
      if (already) return;
      const due = Number(s.amperes || 0) * Number(s.price || 0);
      const record = {
        id: newId(),
        ym: thisYm,
        amperes: s.amperes,
        price: s.price,
        due,
        paid: 0,
        remaining: due,
        status: due <= 0 ? 'paid' : 'unpaid',
      };
      nextMonths[s.id] = [record, ...list];
    });
    persist({ ...data, months: nextMonths });
  };

  const totalAmperes = subscribers.reduce((sum, s) => sum + Number(s.amperes || 0), 0);
  const ym = currentYM();
  let receivedThisMonth = 0, remainingThisMonth = 0;
  let totalDue = 0, totalPaid = 0, totalDebt = 0;
  Object.values(data.months).forEach(list => {
    list.forEach(m => {
      totalDue += m.due; totalPaid += m.paid; totalDebt += m.remaining;
      if (m.ym === ym) { receivedThisMonth += m.paid; remainingThisMonth += m.remaining; }
    });
  });

  const activeSub = subscribers.find(s => s.id === activeSubId);
  const missingThisMonthCount = subscribers.filter(s => !(data.months[s.id] || []).some(m => m.ym === ym)).length;
  const allYms = Array.from(new Set(Object.values(data.months).flat().map(m => m.ym))).sort((a, b) => b.localeCompare(a));

  if (activeMonthYm) {
    return (
      <MonthOverview
        ym={activeMonthYm}
        subscribers={subscribers}
        months={data.months}
        onBack={() => setActiveMonthYm(null)}
        onSelectSubscriber={(id) => { setActiveMonthYm(null); setActiveSubId(id); }}
      />
    );
  }

  if (activeSub) {
    return (
      <SubscriberDetail
        subscriber={activeSub}
        months={monthsFor(activeSub.id)}
        profile={profile}
        onBack={() => setActiveSubId(null)}
        onToggleActive={() => toggleSubscriberActive(activeSub.id)}
        onEdit={(updates) => editSubscriber(activeSub.id, updates)}
        onDelete={() => deleteSubscriber(activeSub.id)}
        onSaveMonth={(m) => saveMonth(activeSub.id, m)}
        onDeleteMonth={(mid) => deleteMonth(activeSub.id, mid)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex items-center justify-between px-4 py-4 bg-slate-900 border-b border-slate-800">
        <div>
          <h2 className="font-extrabold text-slate-50">{profile.address}</h2>
          <p className="text-xs text-slate-400">صاحب المولد: {profile.fullName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggleTheme} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-800 active:scale-95">
            {theme === 'light' ? <Moon className="w-4 h-4 text-slate-400" /> : <Sun className="w-4 h-4 text-slate-400" />}
          </button>
          <button onClick={() => setShowChangePwd(true)} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-800 active:scale-95">
            <Lock className="w-4 h-4 text-slate-400" />
          </button>
          <button onClick={onLogout} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-800 active:scale-95">
            <LogOut className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'home' && (
          <div className="flex flex-col gap-4">
            <div className="text-xs text-slate-400 font-bold">الشهر الحالي: {formatMonthLabel(ym)}</div>
            {missingThisMonthCount > 0 && (
              <button
                onClick={generateCurrentMonthForAll}
                className="flex items-center justify-between gap-3 bg-gradient-to-l from-amber-500 to-yellow-400 text-slate-950 rounded-2xl p-4 active:scale-98 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-slate-950/10 flex items-center justify-center flex-shrink-0">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-sm">بدء تحصيل {formatMonthLabel(ym)}</div>
                    <div className="text-xs font-bold opacity-80">{missingThisMonthCount} مشترك لسه ما انفتح إلهم سجل هذا الشهر</div>
                  </div>
                </div>
                <ChevronLeft className="w-4 h-4 flex-shrink-0" />
              </button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Users} label="عدد المشتركين" value={subscribers.length} accent="teal" />
              <StatCard icon={Zap} label="مجموع الأمبيرات" value={totalAmperes} accent="amber" />
              <StatCard icon={Wallet} label="المستلم هذا الشهر" value={money(receivedThisMonth)} accent="emerald" />
              <StatCard icon={AlertCircle} label="المتبقي هذا الشهر" value={money(remainingThisMonth)} accent="rose" />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2 mt-1 shadow-sm">
              <h3 className="font-extrabold text-slate-100 text-sm mb-1">إجمالي عام</h3>
              <div className="flex justify-between text-sm"><span className="text-slate-400">مجموع المطلوب</span><span className="font-bold text-slate-100 tabular-nums">{money(totalDue)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">مجموع المدفوع</span><span className="font-bold text-emerald-400 tabular-nums">{money(totalPaid)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">مجموع الديون</span><span className="font-bold text-rose-400 tabular-nums">{money(totalDebt)}</span></div>
            </div>
            <button
              onClick={() => setShowGlobalPrice(true)}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between active:scale-98 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-950 text-amber-400 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-100 text-sm">سعر الأمبير العام</div>
                  <div className="text-xs text-slate-400">
                    {data.defaultPrice ? `${money(data.defaultPrice)} د.ع لكل أمبير` : 'غير محدد بعد'}
                  </div>
                </div>
              </div>
              <Edit2 className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        )}

        {tab === 'subscribers' && (
          <div className="flex flex-col gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-300 font-bold">
                <Zap className="w-4 h-4 text-amber-400" /> مجموع الأمبيرات
              </div>
              <span className="text-lg font-extrabold text-slate-50 tabular-nums">{totalAmperes}</span>
            </div>
            <button onClick={() => setShowAddSub(true)} className="flex items-center justify-center gap-2 bg-amber-500 active:scale-95 text-slate-950 font-extrabold py-3 rounded-xl shadow-sm">
              <Plus className="w-4 h-4" /> إضافة مشترك
            </button>
            {subscribers.length === 0 && <div className="text-center text-slate-500 text-sm py-8">لا يوجد مشتركين بعد</div>}
            {subscribers.map((s, idx) => {
              const debt = monthsFor(s.id).reduce((sum, m) => sum + m.remaining, 0);
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSubId(s.id)}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 text-right active:scale-98 shadow-sm"
                >
                  <div className="w-6 flex-shrink-0 text-center text-xs font-extrabold text-slate-500 tabular-nums">{idx + 1}</div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${s.active ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-50 truncate">{s.name}</div>
                    <div className="text-xs text-slate-400 truncate">{s.address} · {s.amperes} أمبير</div>
                    {debt > 0 && <div className="text-xs text-rose-400 font-bold mt-0.5">دين: {money(debt)} د.ع</div>}
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-500 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {tab === 'months' && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { generateCurrentMonthForAll(); setActiveMonthYm(ym); }}
              className="flex items-center justify-center gap-2 bg-amber-500 active:scale-95 text-slate-950 font-extrabold py-3 rounded-xl shadow-sm"
            >
              <Plus className="w-4 h-4" /> شهر جديد ({formatMonthLabel(ym)})
            </button>
            {allYms.length === 0 && <div className="text-center text-slate-500 text-sm py-8">لا يوجد أشهر مسجلة بعد</div>}
            {allYms.map(mYm => {
              const recs = subscribers.map(s => (data.months[s.id] || []).find(m => m.ym === mYm)).filter(Boolean);
              const paidCount = recs.filter(r => r.status === 'paid').length;
              const totalCollected = recs.reduce((sum, r) => sum + r.paid, 0);
              return (
                <button
                  key={mYm}
                  onClick={() => setActiveMonthYm(mYm)}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 text-right active:scale-98 shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-950 text-teal-400 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-50">{formatMonthLabel(mYm)}</div>
                    <div className="text-xs text-slate-400">{recs.length} سجل · {paidCount} دافع · {money(totalCollected)} د.ع محصّل</div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-500 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {tab === 'accounts' && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3">
              <StatCard icon={Wallet} label="مجموع المطلوب (كل الفترات)" value={money(totalDue)} accent="slate" />
              <StatCard icon={Check} label="مجموع المدفوع (كل الفترات)" value={money(totalPaid)} accent="emerald" />
              <StatCard icon={AlertCircle} label="مجموع الديون (كل الفترات)" value={money(totalDebt)} accent="rose" />
            </div>

            {(() => {
              const rows = subscribers.map(s => {
                const list = monthsFor(s.id);
                const debt = list.reduce((sum, m) => sum + m.remaining, 0);
                const thisMonth = list.find(m => m.ym === ym);
                const paidThisMonth = !!thisMonth && thisMonth.status === 'paid';
                return { s, debt, thisMonth, paidThisMonth };
              });

              const tabs = [
                { k: 'all', label: 'الكل' },
                { k: 'paid', label: 'المدافعين هذا الشهر' },
                { k: 'debt', label: 'المدينون' },
              ];

              const filtered = rows.filter(r => {
                if (acctFilter === 'paid') return r.paidThisMonth;
                if (acctFilter === 'debt') return r.debt > 0;
                return true;
              });

              return (
                <>
                  <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
                    {tabs.map(t => (
                      <button
                        key={t.k}
                        onClick={() => setAcctFilter(t.k)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 border
                          ${acctFilter === t.k ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <h3 className="font-extrabold text-slate-100 text-sm mt-1">
                    {acctFilter === 'paid' ? 'المشتركون الدافعون هذا الشهر' : acctFilter === 'debt' ? 'المشتركون المدينون' : 'كل المشتركين'}
                  </h3>

                  {filtered.length === 0 && (
                    <div className="text-center text-slate-500 text-sm py-6">
                      {acctFilter === 'paid' ? 'لا يوجد دفعات مسجلة هذا الشهر بعد' : acctFilter === 'debt' ? 'لا يوجد ديون مسجلة 🎉' : 'لا يوجد مشتركين بعد'}
                    </div>
                  )}

                  {filtered
                    .sort((a, b) => b.debt - a.debt)
                    .map(({ s, debt, thisMonth, paidThisMonth }) => (
                      <button key={s.id} onClick={() => setActiveSubId(s.id)} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-right active:scale-98 shadow-sm">
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="text-slate-100 font-bold text-sm">{s.name}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                            paidThisMonth
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                              : thisMonth
                                ? 'bg-rose-950 text-rose-400 border-rose-800'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {paidThisMonth ? '✅ دافع هذا الشهر' : thisMonth ? '❌ غير مكتمل هذا الشهر' : 'لا يوجد سجل هذا الشهر'}
                          </span>
                        </div>
                        <span className={`font-bold text-sm tabular-nums ${debt > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {debt > 0 ? `${money(debt)} د.ع` : 'لا يوجد دين'}
                        </span>
                      </button>
                    ))}
                </>
              );
            })()}
          </div>
        )}
      </div>

      <div className="flex items-stretch border-t border-slate-800 bg-slate-900 flex-shrink-0">
        {[
          { k: 'home', label: 'الرئيسية', icon: HomeIcon },
          { k: 'subscribers', label: 'المشتركين', icon: Users },
          { k: 'months', label: 'الأشهر', icon: Clock },
          { k: 'accounts', label: 'الحسابات', icon: Wallet },
        ].map(t => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 ${tab === t.k ? 'text-teal-400' : 'text-slate-500'}`}
          >
            <t.icon className="w-5 h-5" />
            <span className="text-xs font-bold">{t.label}</span>
          </button>
        ))}
      </div>

      {showAddSub && (
        <SubscriberModal
          defaultPrice={data.defaultPrice}
          onClose={() => setShowAddSub(false)}
          onSave={(sub) => { addSubscriber(sub); setShowAddSub(false); }}
        />
      )}
      {showGlobalPrice && (
        <GlobalPriceModal
          current={data.defaultPrice}
          onClose={() => setShowGlobalPrice(false)}
          onSave={(price) => { setGlobalPrice(price); setShowGlobalPrice(false); }}
        />
      )}
      {showChangePwd && (
        <ChangePasswordModal
          title="تغيير كلمة المرور"
          onSubmit={onChangePassword}
          onClose={() => setShowChangePwd(false)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Root App                                                                 */
/* ---------------------------------------------------------------------- */

export default function App() {
  const [screen, setScreen] = useState('login');
  const [owners, setOwners] = useState([]);
  const [session, setSession] = useState(null);
  const [ownerData, setOwnerData] = useState({ subscribers: [], months: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [ready, setReady] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [theme, setTheme] = useState('dark');
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  const [adminPassword, setAdminPassword] = useState(ADMIN_PASSWORD);

  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
      .font-app { font-family: 'Tajawal', system-ui, sans-serif; }
      @media print {
        body * { visibility: hidden; }
        .receipt-print, .receipt-print * { visibility: visible; }
        .receipt-print { position: absolute; top: 0; left: 0; width: 100%; box-shadow: none !important; }
        .no-print { display: none !important; }
      }
      @keyframes supportGlow {
        0%, 100% { text-shadow: 0 0 4px rgba(245, 158, 11, 0.4), 0 0 10px rgba(245, 158, 11, 0.15); }
        50% { text-shadow: 0 0 10px rgba(245, 158, 11, 0.9), 0 0 22px rgba(245, 158, 11, 0.5); }
      }
      .support-glow { animation: supportGlow 2s ease-in-out infinite; }
      @keyframes logoPulse {
        0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55); }
        70% { box-shadow: 0 0 0 22px rgba(245, 158, 11, 0); }
        100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
      }
      .logo-pulse { animation: logoPulse 2.2s ease-out infinite; }

      /* Light theme overrides (scoped, only applied when .light-theme is present) */
      .light-theme { background-color: #f1f5f9 !important; }
      .light-theme .bg-slate-950 { background-color: #f8fafc !important; }
      .light-theme .bg-slate-900 { background-color: #ffffff !important; }
      .light-theme .bg-slate-800 { background-color: #e2e8f0 !important; }
      .light-theme .border-slate-700 { border-color: #cbd5e1 !important; }
      .light-theme .border-slate-800 { border-color: #cbd5e1 !important; }
      .light-theme .text-slate-50 { color: #0f172a !important; }
      .light-theme .text-slate-100 { color: #1e293b !important; }
      .light-theme .text-slate-200 { color: #334155 !important; }
      .light-theme .text-slate-300 { color: #475569 !important; }
      .light-theme .text-slate-400 { color: #64748b !important; }
      .light-theme .text-slate-500 { color: #94a3b8 !important; }
      .light-theme .text-slate-600 { color: #94a3b8 !important; }
      .light-theme .placeholder-slate-400::placeholder { color: #94a3b8 !important; }
      .light-theme .placeholder-slate-600::placeholder { color: #cbd5e1 !important; }
      .light-theme .bg-gradient-to-b.from-slate-950.via-slate-900.to-black {
        background-image: linear-gradient(to bottom, #f8fafc, #f1f5f9, #e2e8f0) !important;
      }
      .light-theme .text-white { color: #0f172a !important; }
    `;
    document.head.appendChild(styleTag);
    (async () => {
      const list = await loadOwners();
      setOwners(list);
      const pwd = await loadAdminPassword();
      setAdminPassword(pwd);
      setFallbackMode(isUsingFallbackStorage());
      setReady(true);
    })();
  }, []);

  const refreshOwners = useCallback(async () => {
    const list = await loadOwners();
    setOwners(list);
    setFallbackMode(isUsingFallbackStorage());
    return list;
  }, []);

  useEffect(() => {
    if (screen !== 'admin') return;
    const interval = setInterval(() => {
      refreshOwners();
    }, 6000);
    return () => clearInterval(interval);
  }, [screen, refreshOwners]);

  const handleLogin = async (phone, password) => {
    setLoading(true); setError('');
    const list = await refreshOwners();
    const owner = list.find(o => o.phone === phone);
    if (!owner || owner.password !== password) {
      setError('بيانات الدخول غير صحيحة');
      setLoading(false);
      return;
    }
    if (owner.status === 'pending') {
      setError('⏳ حسابك قيد المراجعة، بانتظار موافقة الإدارة');
      setLoading(false);
      return;
    }
    if (owner.status === 'rejected') {
      setError('تم رفض طلب حسابك، تواصل مع الإدارة');
      setLoading(false);
      return;
    }
    if (!owner.active) {
      setError('🔴 حسابك موقوف حالياً، تواصل مع الإدارة');
      setLoading(false);
      return;
    }
    const data = await loadOwnerData(owner.phone);
    setOwnerData(data);
    setSession({ role: 'owner', phone: owner.phone, profile: owner });
    setScreen('owner');
    setLoading(false);
  };

  const handleAdminLogin = async (password) => {
    setAdminLoading(true); setAdminError('');
    const currentAdminPwd = await loadAdminPassword();
    setAdminPassword(currentAdminPwd);
    if (password !== currentAdminPwd) {
      setAdminError('كلمة المرور غير صحيحة');
      setAdminLoading(false);
      return;
    }
    setSession({ role: 'admin' });
    await refreshOwners();
    setAdminError('');
    setAdminLoading(false);
    setScreen('admin');
  };

  const handleChangeAdminPassword = async (current, next) => {
    const currentAdminPwd = await loadAdminPassword();
    if (current !== currentAdminPwd) {
      return { ok: false, error: 'كلمة المرور الحالية غير صحيحة' };
    }
    await saveAdminPassword(next);
    setAdminPassword(next);
    return { ok: true };
  };

  const handleChangeOwnerPassword = async (current, next) => {
    if (!session || session.role !== 'owner') {
      return { ok: false, error: 'الجلسة غير صالحة' };
    }
    if (current !== session.profile.password) {
      return { ok: false, error: 'كلمة المرور الحالية غير صحيحة' };
    }
    const list = await loadOwners();
    const updated = list.map(o => o.phone === session.profile.phone ? { ...o, password: next } : o);
    const result = await saveOwners(updated);
    if (!result.ok) {
      return { ok: false, error: result.error || 'تعذر حفظ كلمة المرور الجديدة' };
    }
    setOwners(updated);
    setSession(s => ({ ...s, profile: { ...s.profile, password: next } }));
    return { ok: true };
  };

  const [verifying, setVerifying] = useState(false);

  const handleRegister = async (form) => {
    setLoading(true); setError('');
    const list = await refreshOwners();
    if (list.some(o => o.phone === form.phone)) {
      setError('رقم الهاتف مسجل مسبقاً، جرب تسجيل الدخول');
      setLoading(false);
      return;
    }
    const newOwner = {
      phone: form.phone,
      password: form.password,
      fullName: form.fullName,
      address: form.address,
      status: 'pending',
      active: false,
      createdAt: Date.now(),
    };
    const next = [newOwner, ...list];
    const result = await saveOwners(next);
    if (!result.ok) {
      setError(`تعذر إرسال الطلب (${result.error || 'خطأ غير معروف'})`);
      setLoading(false);
      return;
    }
    setOwners(next);

    // Confirm the request actually reached shared storage (i.e. the admin
    // can see it) before telling the person it's pending approval.
    if (!isUsingFallbackStorage()) {
      setVerifying(true);
      const confirmed = await verifyOwnerReachedAdmin(form.phone);
      setVerifying(false);
      if (!confirmed) {
        setError('تم الحفظ لكن تعذر التأكد من وصول الطلب للإدارة، تأكد من الاتصال وحاول إرسال الطلب مرة أخرى');
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    setScreen('pending');
  };

  const handleAdminAction = async (phone, action) => {
    const next = owners.map(o => {
      if (o.phone !== phone) return o;
      if (action === 'approve') return { ...o, status: 'approved', active: true };
      if (action === 'reject') return { ...o, status: 'rejected', active: false };
      if (action === 'stop') return { ...o, active: false };
      if (action === 'start') return { ...o, active: true };
      return o;
    });
    setOwners(next);
    await saveOwners(next);
  };

  const handleLogout = () => {
    setSession(null);
    setOwnerData({ subscribers: [], months: {} });
    setError('');
    setAdminError('');
    setScreen('login');
  };

  return (
    <div className="w-full min-h-screen bg-black flex items-center justify-center font-app">
      <div className={`w-full sm:max-w-sm sm:my-6 sm:rounded-3xl sm:border sm:border-slate-800 overflow-hidden bg-slate-950 flex flex-col h-screen sm:h-full sm:shadow-xl ${theme === 'light' ? 'light-theme' : ''}`} style={{ minHeight: '640px' }}>
        {ready && fallbackMode && (
          <div className="flex-shrink-0 bg-amber-950 border-b border-amber-800 text-amber-300 text-xs font-bold px-4 py-2 flex items-center gap-2 no-print">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>وضع تجريبي: خدمة الحفظ الدائم غير متوفرة حالياً، البيانات تنمسح عند إغلاق الصفحة</span>
          </div>
        )}
        {!ready ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">جاري التحميل...</div>
        ) : screen === 'login' ? (
          <LoginScreen onLogin={handleLogin} goRegister={() => { setError(''); setScreen('register'); }} loading={loading} error={error} onAdminLogin={handleAdminLogin} adminLoading={adminLoading} adminError={adminError} theme={theme} onToggleTheme={toggleTheme} />
        ) : screen === 'register' ? (
          <RegisterScreen onSubmit={handleRegister} goBack={() => { setError(''); setScreen('login'); }} loading={loading} verifying={verifying} error={error} theme={theme} onToggleTheme={toggleTheme} />
        ) : screen === 'pending' ? (
          <PendingNotice goLogin={() => { setError(''); setScreen('login'); }} theme={theme} onToggleTheme={toggleTheme} />
        ) : screen === 'admin' ? (
          <AdminDashboard owners={owners} onAction={handleAdminAction} onLogout={handleLogout} onRefresh={refreshOwners} theme={theme} onToggleTheme={toggleTheme} onChangePassword={handleChangeAdminPassword} />
        ) : screen === 'owner' ? (
          <OwnerApp profile={session.profile} data={ownerData} setData={setOwnerData} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} onChangePassword={handleChangeOwnerPassword} />
        ) : null}
      </div>
    </div>
  );
}
