import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  SlidersHorizontal,
  Menu,
  Plus,
  ChevronRight,
  Settings,
  ImagePlus,
  Trash2,
  Pencil,
  Check,
  Eye,
  Lock,
  MessageCircle,
  UtensilsCrossed,
} from "lucide-react";

const THEME = {
  primary: "#D32F2F",
  primaryDark: "#B71C1C",
  cream: "#FBF7F2",
  ink: "#2A2018",
  sub: "#8A7D6E",
};

const DEFAULT_CATEGORIES = ["برجر", "ساندويتش", "بطاطس", "مشروبات", "حلويات"];
const STORAGE_KEY = "resto-app:rest-products-v2";
const CATEGORIES_STORAGE_KEY = "resto-app:rest-categories-v1";
const PIN_STORAGE_KEY = "resto-app:rest-admin-pin-v1";
const RESTAURANT_NAME = "REST";
const CURRENCY = "د.ع"; // غيّرها لعملتك: ر.س / د.ع / $ ...

// أوقات الدوام: من 3 العصر لين 12:30 بالليل (يمتد بعد منتصف الليل)
const OPEN_MINUTES = 15 * 60; // 3:00 PM
const CLOSE_MINUTES = 24 * 60 + 30; // 12:30 AM (اليوم التالي)

function isRestaurantOpen(date) {
  const mins = date.getHours() * 60 + date.getMinutes();
  const closeWrapped = CLOSE_MINUTES % (24 * 60); // 30
  return mins >= OPEN_MINUTES || mins < closeWrapped;
}
const WHATSAPP_NUMBER = "9647702342678"; // بدون + أو مسافات

function whatsappLink(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function formatPrice(price) {
  const num = Number(price);
  if (isNaN(num)) return price;
  return num.toLocaleString("en-US");
}

const SEED_PRODUCTS = [
  { id: "p1", name: "برجر لحم مشوي", price: "7000", category: "برجر", img: "", featured: true },
  { id: "p2", name: "برجر دجاج مقرمش", price: "6000", category: "برجر", img: "", featured: true },
  { id: "p3", name: "ساندويتش شاورما دجاج", price: "4000", category: "ساندويتش", img: "", featured: false },
  { id: "p4", name: "بطاطس مقلية", price: "3000", category: "بطاطس", img: "", featured: false },
  { id: "p5", name: "بيبسي بارد", price: "1500", category: "مشروبات", img: "", featured: false },
  { id: "p6", name: "آيس كريم فانيلا", price: "2500", category: "حلويات", img: "", featured: false },
];

function uid() {
  return "p-" + Math.random().toString(36).slice(2, 9);
}

function resizeImage(file, maxSize = 500) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatPrice(price) {
  const num = Number(price);
  if (isNaN(num)) return price;
  return num.toLocaleString("en-US");
}

export default function OrderApp() {
  const [mode, setMode] = useState("customer"); // customer | admin
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [adminPin, setAdminPin] = useState("1234");
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);
  function handleLogoTap() {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      setMode("admin");
      setPinInput("");
      setPinError(false);
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 1200);
  }
  const [products, setProducts] = useState(SEED_PRODUCTS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [loaded, setLoaded] = useState(false);
  const [activeCat, setActiveCat] = useState("الكل");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // load persisted products + categories
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) setProducts(JSON.parse(res.value));
      } catch (e) {
        // no data yet, keep seed
      }
      try {
        const resCat = await window.storage.get(CATEGORIES_STORAGE_KEY, false);
        if (resCat && resCat.value) setCategories(JSON.parse(resCat.value));
      } catch (e) {
        // no data yet, keep defaults
      }
      try {
        const resPin = await window.storage.get(PIN_STORAGE_KEY, false);
        if (resPin && resPin.value) setAdminPin(resPin.value);
      } catch (e) {
        // no saved pin yet, keep default
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.storage.set(PIN_STORAGE_KEY, adminPin, false).catch((e) => console.error("pin save failed", e));
  }, [adminPin, loaded]);

  const saveTimer = useRef(null);
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify(products), false);
      } catch (e) {
        console.error("save failed", e);
      }
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [products, loaded]);

  const catSaveTimer = useRef(null);
  useEffect(() => {
    if (!loaded) return;
    if (catSaveTimer.current) clearTimeout(catSaveTimer.current);
    catSaveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set(CATEGORIES_STORAGE_KEY, JSON.stringify(categories), false);
      } catch (e) {
        console.error("save failed", e);
      }
    }, 400);
    return () => clearTimeout(catSaveTimer.current);
  }, [categories, loaded]);

  const allCats = ["الكل", ...categories];
  const filtered = useMemo(
    () => (activeCat === "الكل" ? products : products.filter((p) => p.category === activeCat)),
    [activeCat, products]
  );
  const featured = products.filter((p) => p.featured);

  return (
    <div dir="rtl" style={{ fontFamily: "'Tajawal', sans-serif" }} className="min-h-screen bg-neutral-200 flex items-center justify-center sm:py-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');
        @keyframes rest-shimmer {
          0% { background-position: -120% 0; }
          100% { background-position: 220% 0; }
        }
        .rest-logo {
          background: linear-gradient(90deg, #ffffff 0%, #ffffff 40%, #FFE9C7 50%, #ffffff 60%, #ffffff 100%);
          background-size: 250% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: rest-shimmer 3.2s ease-in-out infinite;
          letter-spacing: 0.06em;
        }
      `}</style>

      <div
        className="relative w-full h-screen sm:h-[820px] sm:max-w-[420px] sm:my-6 sm:rounded-[2.5rem] sm:shadow-2xl overflow-hidden sm:border-[10px]"
        style={{ borderColor: "#1a1a1a", background: THEME.cream }}
      >
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-30" />

        {/* mode switch - only visible while already in admin mode, to exit back to customer view */}
        {mode === "admin" && (
          <button
            onClick={() => {
              setMode("customer");
              setAdminUnlocked(false);
            }}
            className="absolute top-9 left-4 z-30 bg-white/90 rounded-full p-1.5 shadow-md"
            title="معاينة كعميل"
          >
            <Eye size={15} style={{ color: THEME.primaryDark }} />
          </button>
        )}

        {mode === "admin" && !adminUnlocked ? (
          <div className="h-full flex flex-col items-center justify-center px-8" style={{ background: THEME.ink }}>
            <Lock size={28} className="text-white/70 mb-4" />
            <p className="text-white font-bold text-sm mb-1">دخول صاحب المطعم</p>
            <p className="text-white/50 text-xs mb-5">أدخل الرمز السري لإدارة أصناف {RESTAURANT_NAME}</p>
            <input
              type="password"
              inputMode="numeric"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setPinError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (pinInput === adminPin) setAdminUnlocked(true);
                  else setPinError(true);
                }
              }}
              placeholder="••••"
              className="w-32 text-center tracking-[0.5em] text-lg bg-white/10 text-white rounded-xl py-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-white/30"
              autoFocus
            />
            {pinError && <p className="text-red-400 text-xs mb-3">رمز غير صحيح، حاول مرة ثانية</p>}
            <button
              onClick={() => {
                if (pinInput === adminPin) setAdminUnlocked(true);
                else setPinError(true);
              }}
              className="text-white text-xs font-bold px-6 py-2.5 rounded-full mb-2"
              style={{ background: THEME.primary }}
            >
              دخول
            </button>
            <button onClick={() => setMode("customer")} className="text-white/40 text-[11px] underline">
              رجوع كعميل
            </button>
          </div>
        ) : mode === "admin" ? (
          <AdminPanel
            products={products}
            setProducts={setProducts}
            categories={categories}
            setCategories={setCategories}
            adminPin={adminPin}
            setAdminPin={setAdminPin}
            onExit={() => {
              setMode("customer");
              setAdminUnlocked(false);
            }}
          />
        ) : (
          <div className="h-full overflow-y-auto pb-24">
            {/* header */}
            <div
              className="px-5 pt-8 pb-3 sticky top-0 z-20"
              style={{ background: `linear-gradient(180deg, ${THEME.primary}, ${THEME.primaryDark})` }}
            >
              <div className="flex items-center justify-between">
                <Menu size={22} className="text-white/90" />
                <h1 onClick={handleLogoTap} className="rest-logo font-black text-xl select-none">
                  مطعم - {RESTAURANT_NAME}
                </h1>
                <div className="flex items-center gap-4">
                  <SlidersHorizontal size={19} className="text-white/90" />
                  <Search size={19} className="text-white/90" />
                </div>
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: isRestaurantOpen(now) ? "#4ADE80" : "#F87171" }}
                />
                <span className="text-white/85 text-[11px] font-bold">
                  {isRestaurantOpen(now) ? "مفتوح الآن" : "مغلق حالياً"}
                </span>
                <span className="text-white/50 text-[11px]">· من 3 العصر إلى 12:30 بالليل</span>
              </div>
            </div>

            {/* categories */}
            <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
              {allCats.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  className="shrink-0 text-xs font-bold px-4 py-2 rounded-full transition"
                  style={
                    activeCat === cat
                      ? { background: THEME.primary, color: "white" }
                      : { background: "#F3D9D9", color: "#B45252" }
                  }
                >
                  {cat}
                </button>
              ))}
            </div>

            {activeCat === "الكل" && featured.length > 0 && (
              <div className="px-4 mb-2">
                <div className="flex items-center gap-2 mb-3">
                  <ChevronRight size={16} style={{ color: THEME.primary }} className="rotate-180" />
                  <h2 className="font-black text-sm" style={{ color: THEME.ink }}>
                    الأكثر مبيعاً
                  </h2>
                </div>
              </div>
            )}

            {/* product grid */}
            <div className="px-4 grid grid-cols-2 gap-3.5">
              {(activeCat === "الكل" ? featured.concat(products.filter((p) => !p.featured)) : filtered).map(
                (product) => (
                  <div key={product.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <ProductImage product={product} />
                    <div className="py-3 px-2 text-center">
                      <p className="text-[13.5px] font-bold truncate" style={{ color: THEME.ink }}>
                        {product.name}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: THEME.sub }}>
                        السعر: {formatPrice(product.price)} {CURRENCY}
                      </p>
                    </div>
                  </div>
                )
              )}
              {filtered.length === 0 && (
                <p className="col-span-2 text-center text-xs py-10" style={{ color: THEME.sub }}>
                  لا توجد أصناف بهذا القسم بعد
                </p>
              )}
            </div>
          </div>
        )}

        {mode === "customer" && (
          <a
            href={whatsappLink(`مرحباً، أبي أطلب من ${RESTAURANT_NAME}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-5 left-5 right-5 rounded-full shadow-lg flex items-center justify-center gap-2 py-3.5 z-20"
            style={{ background: THEME.primary }}
          >
            <MessageCircle size={19} className="text-white" />
            <span className="text-white font-bold text-sm">اطلب الآن عبر الواتساب</span>
          </a>
        )}

      </div>
    </div>
  );
}

const CATEGORY_EMOJI = {
  "برجر": "🍔",
  "ساندويتش": "🥙",
  "بطاطس": "🍟",
  "مشروبات": "🥤",
  "حلويات": "🍨",
};

function ProductImage({ product }) {
  const [failed, setFailed] = useState(false);
  const showImg = product.img && !failed;
  const emoji = CATEGORY_EMOJI[product.category] || "🍽️";
  return (
    <div
      className="relative aspect-square flex items-center justify-center"
      style={
        showImg
          ? { background: "#F2F2F2" }
          : { background: "linear-gradient(135deg, #FBEDED, #F6D9D9)" }
      }
    >
      {showImg ? (
        <img
          src={product.img}
          alt={product.name}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl leading-none">{emoji}</span>
          <span className="text-[9px]" style={{ color: THEME.sub }}>
            بدون صورة
          </span>
        </div>
      )}
    </div>
  );
}

function AdminPanel({ products, setProducts, categories, setCategories, adminPin, setAdminPin, onExit }) {
  const [newPin, setNewPin] = useState("");
  const [pinSaved, setPinSaved] = useState(false);

  function changePin() {
    const trimmed = newPin.trim();
    if (trimmed.length < 4) return;
    setAdminPin(trimmed);
    setNewPin("");
    setPinSaved(true);
    setTimeout(() => setPinSaved(false), 1800);
  }

  const [form, setForm] = useState({ name: "", price: "", category: categories[0] || "", img: "", featured: false });
  const [editingId, setEditingId] = useState(null);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [editingCat, setEditingCat] = useState(null);
  const [editingCatValue, setEditingCatValue] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await resizeImage(file);
      setForm((f) => ({ ...f, img: dataUrl }));
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  function resetForm() {
    setForm({ name: "", price: "", category: categories[0] || "", img: "", featured: false });
    setEditingId(null);
  }

  function submit() {
    if (!form.name.trim() || !form.price) return;
    if (editingId) {
      setProducts((ps) => ps.map((p) => (p.id === editingId ? { ...p, ...form } : p)));
    } else {
      setProducts((ps) => [...ps, { id: uid(), ...form }]);
    }
    resetForm();
  }

  function editItem(p) {
    setForm({ name: p.name, price: p.price, category: p.category, img: p.img || "", featured: !!p.featured });
    setEditingId(p.id);
  }

  function deleteItem(id) {
    setProducts((ps) => ps.filter((p) => p.id !== id));
    if (editingId === id) resetForm();
  }

  function addCategory() {
    const name = newCat.trim();
    if (!name || categories.includes(name)) return;
    setCategories((c) => [...c, name]);
    setNewCat("");
  }

  function startEditCategory(cat) {
    setEditingCat(cat);
    setEditingCatValue(cat);
  }

  function saveEditCategory() {
    const newName = editingCatValue.trim();
    if (!newName) return;
    setCategories((c) => c.map((cat) => (cat === editingCat ? newName : cat)));
    setProducts((ps) => ps.map((p) => (p.category === editingCat ? { ...p, category: newName } : p)));
    setEditingCat(null);
    setEditingCatValue("");
  }

  function deleteCategory(cat) {
    setCategories((c) => c.filter((x) => x !== cat));
  }

  return (
    <div className="h-full overflow-y-auto pb-6">
      <div className="px-5 pt-8 pb-4 sticky top-0 z-20" style={{ background: THEME.ink }}>
        <div className="flex items-center justify-between">
          <h1 className="text-white font-black text-base">لوحة تحكم {RESTAURANT_NAME}</h1>
          <button onClick={onExit} className="text-white/80 text-xs underline">
            معاينة العميل
          </button>
        </div>
      </div>

      {/* form */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-xs font-bold" style={{ color: THEME.ink }}>
            {editingId ? "تعديل الصنف" : "إضافة صنف جديد"}
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="w-16 h-16 rounded-xl border-2 border-dashed flex items-center justify-center shrink-0 overflow-hidden"
              style={{ borderColor: "#e5ddd3" }}
            >
              {form.img ? (
                <img src={form.img} className="w-full h-full object-cover" />
              ) : uploading ? (
                <span className="text-[10px] text-neutral-400">...</span>
              ) : (
                <ImagePlus size={20} style={{ color: THEME.sub }} />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            <input
              value={form.img.startsWith("data:") ? "" : form.img}
              onChange={(e) => setForm((f) => ({ ...f, img: e.target.value }))}
              placeholder="أو الصق رابط صورة"
              className="flex-1 text-xs border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-300"
            />
          </div>

          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="اسم الصنف"
            className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-300"
          />

          <div className="flex gap-2">
            <input
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value.replace(/[^0-9.]/g, "") }))}
              placeholder={`السعر (${CURRENCY})`}
              className="w-28 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-300"
            />
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-300"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs" style={{ color: THEME.sub }}>
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
            />
            إظهار ضمن "الأكثر مبيعاً"
          </label>

          <div className="flex gap-2">
            <button
              onClick={submit}
              className="flex-1 text-white text-sm font-bold py-2.5 rounded-lg flex items-center justify-center gap-1"
              style={{ background: THEME.primary }}
            >
              {editingId ? <Check size={15} /> : <Plus size={15} />}
              {editingId ? "حفظ التعديل" : "إضافة الصنف"}
            </button>
            {editingId && (
              <button onClick={resetForm} className="px-4 text-sm rounded-lg border border-neutral-200 text-neutral-500">
                إلغاء
              </button>
            )}
          </div>
        </div>
      </div>

      {/* change admin pin */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-xs font-bold" style={{ color: THEME.ink }}>
            تغيير الرمز السري للوحة الإدارة
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="رمز سري جديد (4 أرقام أو أكثر)"
              className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-300"
            />
            <button
              onClick={changePin}
              className="px-4 rounded-lg text-white text-xs font-bold"
              style={{ background: THEME.primary }}
            >
              حفظ
            </button>
          </div>
          {pinSaved && <p className="text-[11px] text-green-600">تم تغيير الرمز السري ✓</p>}
          <p className="text-[10px]" style={{ color: THEME.sub }}>
            الرمز الحالي: {adminPin}
          </p>
        </div>
      </div>

      {/* category management */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-xs font-bold" style={{ color: THEME.ink }}>
            إدارة الأقسام (الشريط العلوي للأكلات)
          </p>

          <div className="flex gap-2">
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
              placeholder="اسم قسم جديد"
              className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-300"
            />
            <button
              onClick={addCategory}
              className="px-3 rounded-lg text-white flex items-center justify-center"
              style={{ background: THEME.primary }}
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-1.5">
            {categories.map((cat) => (
              <div key={cat} className="flex items-center gap-2 bg-neutral-50 rounded-lg px-2.5 py-1.5">
                {editingCat === cat ? (
                  <>
                    <input
                      value={editingCatValue}
                      onChange={(e) => setEditingCatValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEditCategory()}
                      autoFocus
                      className="flex-1 text-xs border border-neutral-200 rounded-md px-2 py-1 focus:outline-none"
                    />
                    <button onClick={saveEditCategory}>
                      <Check size={14} style={{ color: THEME.primary }} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-xs font-bold" style={{ color: THEME.ink }}>
                      {cat}
                    </span>
                    <button onClick={() => startEditCategory(cat)}>
                      <Pencil size={13} style={{ color: THEME.sub }} />
                    </button>
                    <button onClick={() => deleteCategory(cat)}>
                      <Trash2 size={13} className="text-red-400" />
                    </button>
                  </>
                )}
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-[11px] text-center py-2" style={{ color: THEME.sub }}>
                ما فيه أقسام بعد، ضيف أول قسم فوق
              </p>
            )}
          </div>
        </div>
      </div>

      {/* list */}
      <div className="px-4 mt-5 space-y-2">
        <p className="text-xs font-bold" style={{ color: THEME.sub }}>
          الأصناف الحالية ({products.length})
        </p>
        {products.map((p) => (
          <div key={p.id} className="bg-white rounded-xl p-2 flex items-center gap-3 shadow-sm">
            {p.img ? (
              <img src={p.img} className="w-11 h-11 rounded-lg object-cover" />
            ) : (
              <div className="w-11 h-11 rounded-lg bg-neutral-100" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: THEME.ink }}>
                {p.name}
              </p>
              <p className="text-[11px]" style={{ color: THEME.sub }}>
                {formatPrice(p.price)} {CURRENCY} · {p.category}
              </p>
            </div>
            <button onClick={() => editItem(p)} className="p-1.5">
              <Pencil size={14} style={{ color: THEME.sub }} />
            </button>
            <button onClick={() => deleteItem(p.id)} className="p-1.5">
              <Trash2 size={14} className="text-red-400" />
            </button>
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-xs text-center py-8" style={{ color: THEME.sub }}>
            ما فيه أصناف بعد، ضيف أول صنف من الفورم فوق
          </p>
        )}
      </div>
    </div>
  );
}
