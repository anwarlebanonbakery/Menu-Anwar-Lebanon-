/* ══════════════════════════════════════
   FIREBASE APP — إعدادات المشروع
   خد القيم دي من: Firebase Console → Project Settings → Your apps → SDK setup and config
══════════════════════════════════════ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, writeBatch, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCde_rpDGJI8HIr03a1eKaRzPFPo3mrRjI",
  authDomain: "anwarlebanonbakery-5815b.firebaseapp.com",
  projectId: "anwarlebanonbakery-5815b",
  storageBucket: "anwarlebanonbakery-5815b.firebasestorage.app",
  messagingSenderId: "301016473650",
  appId: "1:301016473650:web:1fc3fb5ced7b446cd19c2b"
};

// Cloudinary — تخزين الصور (بديل Firebase Storage، مجاني من غير كارت)
const CLOUDINARY_CLOUD_NAME = "ytihtzxj";
const CLOUDINARY_UPLOAD_PRESET = "Anwar-images";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* ── إعدادات قابلة للتعديل ── */
const POLL_INTERVAL_MS = 2 * 60 * 1000; // كل دقيقتين — التابلت مش محتاج real-time
const ADMIN_IDLE_LOGOUT_MS = 5 * 60 * 1000; // تسجيل خروج تلقائي بعد 5 دقايق بلا حركة داخل لوحة الأدمن

/* ══════════════════════════════════════
   حالة محلية في الذاكرة (مش localStorage)
   بتتحدث من Firestore وبتفضل موجودة طول ما الصفحة مفتوحة
══════════════════════════════════════ */
const DEFAULT_HERO_SETTINGS = {
  enabled: true,
  imageUrl: "https://raw.githubusercontent.com/anwarlebanonbakery/bakery-images/main/file_000000000ca481f4984eeedbbedbf2c1.png",
  imagePublicId: "",
  imageOriginalUrl: "",
  imageSize: { preset: 'original', width: null, height: null },
  imageFit: 'contain',
  backgroundPositionX: 50,
  backgroundPositionY: 0,
  // Defaults below intentionally preserve the original homepage Hero exactly:
  // image-only hero, original background position, original height behavior,
  // original dark bottom overlay, and NO extra title/logo/content injected.
  heightMobile: 320,
  heightDesktop: 340,
  overlay: {
    enabled: true,
    type: "linear",
    color: "#08100c",
    opacity: 0.55,
    direction: "to-bottom"
  },
  content: {
    title: "",
    tagline: "",
    since: ""
  },
  logo: {
    enabled: false,
    url: "logo.png",
    publicId: "",
    size: 108
  },
  contentPosition: { horizontal: "right", vertical: "bottom", x: 88, y: 86 },
  typography: { titleSize: 62, taglineSize: 15, sinceSize: 12 },
  animation: { imageZoom: false, glow: false, contentReveal: true },
  updatedAt: null
};

const HERO_SIZE_PRESETS_FOR_VALIDATION = new Set(['original','square','landscape32','portrait23','landscape43','portrait34','landscape54','portrait45','landscape169','portrait916','wide21','custom']);

function mergeHeroSettings(raw = {}) {
  const merged = {
    ...DEFAULT_HERO_SETTINGS,
    ...raw,
    imageSize: { ...DEFAULT_HERO_SETTINGS.imageSize, ...(raw.imageSize || {}) },
    overlay: { ...DEFAULT_HERO_SETTINGS.overlay, ...(raw.overlay || {}) },
    content: { ...DEFAULT_HERO_SETTINGS.content, ...(raw.content || {}) },
    logo: { ...DEFAULT_HERO_SETTINGS.logo, ...(raw.logo || {}) },
    contentPosition: { ...DEFAULT_HERO_SETTINGS.contentPosition, ...(raw.contentPosition || {}) },
    typography: { ...DEFAULT_HERO_SETTINGS.typography, ...(raw.typography || {}) },
    animation: { ...DEFAULT_HERO_SETTINGS.animation, ...(raw.animation || {}) }
  };

  // v6 introduced these values accidentally as defaults. If the document still
  // contains that untouched combination, treat it as legacy noise and restore
  // the real pre-Hero homepage state. The admin can add content/logo explicitly.
  const c = raw.content || {};
  const l = raw.logo || {};
  const isLegacyInjectedContent =
    c.title === "أنوار لبنان" &&
    c.tagline === "Anwar Lebanon Bakery & Sweets" &&
    c.since === "Since 1995" &&
    (l.url === "logo.png" || !l.url) &&
    l.enabled === true;
  if (isLegacyInjectedContent) {
    merged.content = { ...merged.content, title: "", tagline: "", since: "" };
    merged.logo = { ...merged.logo, enabled: false, url: "logo.png", size: 108 };
    merged.heightDesktop = 340;
    merged.animation = { ...merged.animation, imageZoom: false, glow: false };
  }

  // Keep old/manual Firestore values inside the same safe range used by the admin UI.
  merged.imageFit = ['cover','contain','fill'].includes(merged.imageFit) ? merged.imageFit : 'contain';
  merged.backgroundPositionX = Math.max(0, Math.min(100, Number(merged.backgroundPositionX ?? 50)));
  merged.backgroundPositionY = Math.max(0, Math.min(100, Number(merged.backgroundPositionY ?? 0)));
  merged.heightMobile = Math.max(180, Math.min(700, Number(merged.heightMobile || 320)));
  merged.heightDesktop = Math.max(260, Math.min(800, Number(merged.heightDesktop || 340)));
  merged.overlay.opacity = Math.max(0, Math.min(1, Number(merged.overlay.opacity ?? 0.55)));
  merged.logo.size = Math.max(40, Math.min(180, Number(merged.logo.size || 108)));
  merged.contentPosition.x = Math.max(0, Math.min(100, Number(merged.contentPosition.x ?? 88)));
  merged.contentPosition.y = Math.max(0, Math.min(100, Number(merged.contentPosition.y ?? 86)));
  merged.typography.titleSize = Math.max(34, Math.min(86, Number(merged.typography.titleSize || 62)));
  merged.typography.taglineSize = Math.max(10, Math.min(24, Number(merged.typography.taglineSize || 15)));
  merged.typography.sinceSize = Math.max(9, Math.min(18, Number(merged.typography.sinceSize || 12)));
  if (!HERO_SIZE_PRESETS_FOR_VALIDATION.has(merged.imageSize?.preset)) {
    merged.imageSize.preset = 'original';
    merged.imageSize.width = null;
    merged.imageSize.height = null;
  } else if (merged.imageSize.preset === 'custom') {
    merged.imageSize.width = Math.max(64, Math.min(4096, Number(merged.imageSize.width || 1536)));
    merged.imageSize.height = Math.max(64, Math.min(4096, Number(merged.imageSize.height || 864)));
  }
  return merged;
}

export const liveState = {
  categories: [],   // كل التصنيفات (visible فقط للعميل العادي)
  products: {},     // { categoryId: [products...] }
  offers: [],       // عروضنا — منفصلة عن المنتجات، مرتبطة بقسم displayType:'offers'
  heroSettings: mergeHeroSettings(),
  lastGoodAt: null,
  isOnline: navigator.onLine,
  isAdmin: false,
};

export const DEFAULT_HERO = DEFAULT_HERO_SETTINGS;

let pollTimer = null;
let onDataRefreshed = () => {}; // بتتحدد من الملف الرئيسي بعد ما يجهز الـ DOM
let onConnectionChange = () => {};
let onAdminAuthChange = () => {}; // بتتحدد من index.html — استدعاء واحد بس بعد ما liveState.isAdmin يتحدث

export function setCallbacks({ onRefresh, onConnection, onAdminAuth }) {
  if (onRefresh) onDataRefreshed = onRefresh;
  if (onConnection) onConnectionChange = onConnection;
  if (onAdminAuth) {
    onAdminAuthChange = onAdminAuth;
  }
}

/* ══════════════════════════════════════
   قراءة البيانات (عام + أدمن)
══════════════════════════════════════ */
export async function fetchMenuData() {
  try {
    // اقرأ بدون orderBy عشان المنيو ما تعتمدش على Composite Index،
    // وكمان عشان أي مستند قديم ناقص displayOrder ما يختفيش من النتيجة.
    // الترتيب بيتعمل محليًا بعد القراءة.
    const catsQ = liveState.isAdmin
      ? query(collection(db, "categories"))
      : query(collection(db, "categories"), where("visible", "==", true));

    const prodsQ = liveState.isAdmin
      ? query(collection(db, "products"))
      : query(collection(db, "products"), where("visible", "==", true));

    // العروض لا تدخل في Promise.all مع الأقسام والمنتجات.
    // لو Collection offers غير مسموح بها في Rules، المنيو الأساسية تفضل شغالة.
    const heroPromise = getDoc(doc(db, "siteSettings", "hero")).catch(err => {
      console.warn("Hero settings unavailable; using default hero.", err);
      return null;
    });
    const heroFallbackPromise = getDoc(doc(db, "categories", "system_hero_settings")).catch(() => null);
    const [catsSnap, prodsSnap, heroSnap, heroFallbackSnap] = await Promise.all([
      getDocs(catsQ),
      getDocs(prodsQ),
      heroPromise,
      heroFallbackPromise
    ]);

    const categories = catsSnap.docs
      .filter(d => d.id !== "system_hero_settings")
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ao = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : 999999;
        const bo = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : 999999;
        return ao - bo;
      });
    const productsByCategory = {};
    prodsSnap.docs.forEach(d => {
      const p = { id: d.id, ...d.data() };
      (productsByCategory[p.categoryId] ||= []).push(p);
    });
    Object.values(productsByCategory).forEach(items => items.sort((a, b) => {
      const ao = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : 999999;
      const bo = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : 999999;
      return ao - bo;
    }));

    liveState.categories = categories;
    liveState.products = productsByCategory;
    if (heroSnap?.exists()) liveState.heroSettings = mergeHeroSettings(heroSnap.data());
    else if (heroFallbackSnap?.exists()) liveState.heroSettings = mergeHeroSettings(heroFallbackSnap.data());

    // تحميل العروض منفصل. لو فشل، لا نعتبر المنيو Offline ولا نمسح الأقسام.
    try {
      liveState.offers = await loadOffersSafely();
    } catch (offersErr) {
      console.error("Offers fetch failed; keeping menu alive:", offersErr);
      liveState.offers = [];
    }

    liveState.lastGoodAt = new Date();
    if (!liveState.isOnline) {
      liveState.isOnline = true;
      onConnectionChange(true);
    }
    onDataRefreshed();
    return true;
  } catch (err) {
    console.error("Firestore menu fetch failed:", err);
    if (liveState.isOnline) {
      liveState.isOnline = false;
      onConnectionChange(false);
    }
    // لا نمسح آخر نسخة سليمة من categories/products.
    return false;
  }
}

/* ══════════════════════════════════════
   عروضنا — طبقة تخزين مقاومة لمشكلة Rules

   الاستخدام الأساسي: collection باسم offers.
   لو Rules الحالية للمشروع لا تسمح بـ offers، نستخدم نفس
   category document الخاص بعروضنا ونخزن العروض داخل field اسمه offers.
   بهذه الطريقة إضافة العروض لا تكسر المنيو ولا تتطلب Composite Index.
══════════════════════════════════════ */

function getOffersCategoryFromState() {
  return liveState.categories.find(c => c.displayType === 'offers') || null;
}

function sortOffers(items) {
  return [...items].sort((a, b) => {
    const ao = typeof a.displayOrder === 'number' ? a.displayOrder : 999999;
    const bo = typeof b.displayOrder === 'number' ? b.displayOrder : 999999;
    return ao - bo;
  });
}

async function loadOffersSafely() {
  const cat = getOffersCategoryFromState();

  // لو سبق واستخدمنا fallback بسبب Rules، نكمل عليه بعد إعادة تحميل الصفحة.
  if (cat?.offersStorage === 'embedded') {
    let offers = Array.isArray(cat.offers) ? cat.offers : [];
    // بعض العروض القديمة اتخزنت بدون id. نديها id ثابت في الذاكرة
    // عشان أزرار التعديل والحذف تشتغل، ويتم حفظ الـid مع أول تعديل/حذف/ترتيب.
    offers = offers.map(o => ({
      ...o,
      id: o?.id ? String(o.id) : makeEmbeddedOfferId(),
      _storage: 'embedded'
    }));
    if (!liveState.isAdmin) offers = offers.filter(o => o.visible !== false);
    return sortOffers(offers);
  }

  try {
    // لا where + orderBy هنا، حتى لا نحتاج Composite Index.
    const snap = await getDocs(collection(db, "offers"));
    let offers = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      _storage: 'collection'
    }));

    if (!liveState.isAdmin) {
      offers = offers.filter(o => o.visible !== false);
    }

    return sortOffers(offers);
  } catch (collectionErr) {
    console.warn("Offers collection unavailable; using embedded offers fallback.", collectionErr);

    if (!cat) return [];

    let offers = Array.isArray(cat.offers) ? cat.offers : [];
    // نفس حماية الـid في حالة الانتقال للـembedded fallback بعد فشل Collection.
    offers = offers.map(o => ({
      ...o,
      id: o?.id ? String(o.id) : makeEmbeddedOfferId(),
      _storage: 'embedded'
    }));

    if (!liveState.isAdmin) {
      offers = offers.filter(o => o.visible !== false);
    }

    return sortOffers(offers);
  }
}

function normalizeEmbeddedOffers(offers) {
  const seen = new Set();
  let featuredUsed = false;
  return (Array.isArray(offers) ? offers : []).map((raw) => {
    const o = { ...(raw || {}) };
    let id = o.id ? String(o.id).trim() : '';
    if (!id || seen.has(id)) {
      id = makeEmbeddedOfferId();
      while (seen.has(id)) id = makeEmbeddedOfferId();
    }
    seen.add(id);
    o.id = id;
    o.displayOrder = seen.size - 1;
    // نسمح بعرض مميّز واحد فقط. أول واحد في الترتيب هو الذي يحتفظ بالتمييز.
    if (o.featured && featuredUsed) o.featured = false;
    if (o.featured) featuredUsed = true;
    o._storage = 'embedded';
    return o;
  });
}

async function saveEmbeddedOffers(offers) {
  const cat = getOffersCategoryFromState();
  if (!cat) {
    throw new Error('قسم عروضنا غير موجود في المنيو. أضف قسم عروضنا أولاً.');
  }

  const clean = normalizeEmbeddedOffers(offers).map(o => {
    const copy = { ...o };
    delete copy._storage;
    return copy;
  });

  const payload = {
    offers: clean,
    offersStorage: 'embedded',
    updatedAt: serverTimestamp()
  };
  try {
    await updateDoc(doc(db, "categories", cat.id), payload);
  } catch (updateErr) {
    // بعض Rules القديمة تتعامل مع setDoc(merge) بشكل أفضل من updateDoc.
    // نجرب نفس المستند بدون استبدال باقي بيانات القسم.
    try {
      await setDoc(doc(db, "categories", cat.id), payload, { merge: true });
    } catch (mergeErr) {
      mergeErr.primaryCode = updateErr?.code || '';
      throw mergeErr;
    }
  }
}

function makeEmbeddedOfferId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'offer_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

export function startPolling() {
  stopPolling();
  pollTimer = setInterval(fetchMenuData, POLL_INTERVAL_MS);
}
export function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

window.addEventListener("online", () => fetchMenuData());
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") fetchMenuData();
});

/* ══════════════════════════════════════
   الأدمن — تسجيل دخول / خروج
══════════════════════════════════════ */
let idleLogoutTimer = null;
export function resetAdminIdleTimer() {
  if (idleLogoutTimer) clearTimeout(idleLogoutTimer);
  if (!liveState.isAdmin) return;
  idleLogoutTimer = setTimeout(() => {
    adminLogout();
  }, ADMIN_IDLE_LOGOUT_MS);
}

export async function adminLogin(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
  // onAuthStateChanged below بيحدث liveState.isAdmin تلقائي
}

export async function adminLogout() {
  await signOut(auth);
}

/* ══════════════════════════════════════
   المصدر الوحيد لحالة تسجيل دخول الأدمن.
   index.html ما بيعملش onAuthStateChanged بتاعه — بيسجل نفسه هنا
   عن طريق setCallbacks({ onAdminAuth }) عشان نتجنب أي تعارض/ازدواجية
   في التعامل مع حالة الـ auth.
══════════════════════════════════════ */
onAuthStateChanged(auth, async (user) => {
  liveState.isAdmin = !!user;
  if (idleLogoutTimer) clearTimeout(idleLogoutTimer);
  await fetchMenuData(); // إعادة تحميل بصلاحيات مختلفة (يشوف المخفي لو أدمن)
  onAdminAuthChange(user); // نبلّغ الواجهة بعد ما البيانات والصلاحية اتحدثوا فعلاً
});

/* ══════════════════════════════════════
   إعدادات الـ Hero — مستند واحد فقط siteSettings/hero
══════════════════════════════════════ */
export async function saveHeroSettings(settings) {
  const clean = mergeHeroSettings(settings);
  try {
    await setDoc(doc(db, "siteSettings", "hero"), { ...clean, updatedAt: serverTimestamp() });
  } catch (primaryErr) {
    // بعض مشاريع Firebase القديمة تسمح للأدمن بالكتابة على categories
    // لكنها لا تحتوي Rule لمسار siteSettings. نستخدم مستندًا عاديًا داخل
    // categories كـ fallback حتى لا يتعطل حفظ الـ Hero.
    try {
      await setDoc(doc(db, "categories", "system_hero_settings"), {
        ...clean,
        __isHeroSettings: true,
        // Keep the fallback readable even when Firestore rules only allow
        // public category reads where visible == true. It is filtered out
        // of the actual category list above by its reserved application ID.
        visible: true,
        displayOrder: 2147483647,
        updatedAt: serverTimestamp()
      });
    } catch (fallbackErr) {
      fallbackErr.primaryCode = primaryErr?.code || '';
      throw fallbackErr;
    }
  }
  liveState.heroSettings = clean;
  return clean;
}

export function getDefaultHeroSettings() {
  return mergeHeroSettings();
}

/* ══════════════════════════════════════
   رفع صورة إلى Cloudinary → يرجع الرابط
   (unsigned upload — من المتصفح مباشرة، من غير سيرفر)
══════════════════════════════════════ */

/* ── ضغط/تصغير الصورة في المتصفح قبل الرفع ──
   لو الصورة جاية من كاميرا موبايل ممكن تكون كذا ميجا وأبعاد ضخمة جدًا
   (أكبر بكتير من أي حاجة هتتعرض بيها في المنيو). الدالة دي بتصغّر أطول
   ضلع في الصورة لحد أقصى معقول وتضغطها لـ JPEG بجودة عالية قبل ما ترفع،
   فالرفع نفسه بيبقى أسرع (خصوصًا على نت موبايل)، ومساحة التخزين المجانية
   على Cloudinary بتفضل لفترة أطول. الشفافية (PNG بلوجو مثلاً) بتتحفظ. */
async function compressImageForUpload(file, maxDim = 2000, quality = 0.85) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file; // متحركة/متجهية — من غير ضغط
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size < 1_500_000) return file; // صغيرة بالفعل، مفيش داعي نضغط
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const hasAlpha = file.type === 'image/png';
    const blob = await new Promise(resolve => canvas.toBlob(resolve, hasAlpha ? 'image/png' : 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file; // لو الضغط ماوفرش حاجة، استخدمي الأصلية
    return new File([blob], file.name, { type: blob.type });
  } catch (err) {
    console.warn('تعذّر ضغط الصورة قبل الرفع، هترفع بحجمها الأصلي:', err);
    return file; // أي مشكلة (متصفح قديم مثلاً) — ارفعي الأصلية زي ما هي، منعطلش الرفع
  }
}

export async function uploadMenuImage(file) {
  const optimizedFile = await compressImageForUpload(file);
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const formData = new FormData();
  formData.append("file", optimizedFile);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(url, { method: "POST", body: formData });
  if (!res.ok) throw new Error("فشل رفع الصورة على Cloudinary");
  const data = await res.json();
  // public_id بيتسجل معانا لو حبينا نمسح الصورة بعدين (يدويًا من Cloudinary Console —
  // مفيش مسح تلقائي آمن من المتصفح من غير مفتاح سري)
  return { url: data.secure_url, publicId: data.public_id };
}

export async function deleteMenuImage() {
  // الحذف التلقائي محتاج مفتاح Cloudinary سري (API secret) ومينفعش يتحط في كود عام في المتصفح.
  // الصور القديمة بتفضل موجودة على Cloudinary من غير استخدام — مش مشكلة، الحد المجاني 25GB.
  // لو حبيت تمسح صور قديمة، ده بيتعمل يدوي من Cloudinary Console (Media Library).
}

/* ══════════════════════════════════════
   CRUD — التصنيفات (categories)
══════════════════════════════════════ */
export async function createCategory(data) {
  return addDoc(collection(db, "categories"), {
    ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
}
export async function updateCategory(id, data) {
  return updateDoc(doc(db, "categories", id), { ...data, updatedAt: serverTimestamp() });
}
export async function deleteCategory(id) {
  return deleteDoc(doc(db, "categories", id));
}

/* ══════════════════════════════════════
   CRUD — المنتجات (products)
══════════════════════════════════════ */
export async function createProduct(data) {
  return addDoc(collection(db, "products"), {
    ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
}
export async function updateProduct(id, data) {
  return updateDoc(doc(db, "products", id), { ...data, updatedAt: serverTimestamp() });
}
export async function deleteProduct(id) {
  return deleteDoc(doc(db, "products", id));
}

/* ══════════════════════════════════════
   إعادة الترتيب — حفظ ترتيب جديد لكذا عنصر مرة واحدة
══════════════════════════════════════ */
export async function reorderCategories(orderedIds) {
  const batch = writeBatch(db);
  orderedIds.forEach((id, i) => {
    batch.update(doc(db, "categories", id), { displayOrder: i, updatedAt: serverTimestamp() });
  });
  return batch.commit();
}
export async function reorderProducts(orderedIds) {
  const batch = writeBatch(db);
  orderedIds.forEach((id, i) => {
    batch.update(doc(db, "products", id), { displayOrder: i, updatedAt: serverTimestamp() });
  });
  return batch.commit();
}

/* ══════════════════════════════════════
   CRUD — العروض (offers)
   منفصلة عن products عشان مالهاش نفس شكل/سلوك المنتج العادي —
   بتتعرض جوا قسم من نوع displayType:'offers' بواجهة "Offers Experience"
   المخصوصة بدل الشبكة العادية.
══════════════════════════════════════ */
export async function createOffer(data) {
  const current = Array.isArray(liveState.offers) ? liveState.offers : [];
  const offersCat = getOffersCategoryFromState();
  // لو القسم معلّم صراحةً إن تخزين العروض Embedded، نلتزم بنفس المصدر
  // حتى لو القائمة الحالية فاضية؛ وإلا ممكن أول إضافة ترجع للـcollection بالغلط.
  const hasEmbedded = current.some(o => o?._storage === 'embedded') || offersCat?.offersStorage === 'embedded';
  if (hasEmbedded) {
    let existing = current.map(o => ({ ...o }));
    const id = makeEmbeddedOfferId();
    if (data?.featured) existing = existing.map(o => ({ ...o, featured: false }));
    existing.push({ id, ...data, displayOrder: existing.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _storage: 'embedded' });
    const normalized = normalizeEmbeddedOffers(existing);
    await saveEmbeddedOffers(normalized);
    liveState.offers = normalized;
    return { id, embedded: true };
  }

  try {
    if (data?.featured) {
      const batch = writeBatch(db);
      current.filter(o => o?._storage === 'collection' && o.featured).forEach(o => batch.update(doc(db, 'offers', String(o.id)), { featured: false, updatedAt: serverTimestamp() }));
      const ref = doc(collection(db, 'offers'));
      batch.set(ref, { ...data, displayOrder: current.length, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      await batch.commit();
      return { id: ref.id, embedded: false };
    }
    const ref = await addDoc(collection(db, 'offers'), { ...data, displayOrder: current.length, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { id: ref.id, embedded: false };
  } catch (err) {
    // Collection غير متاحة: استخدم fallback داخل مستند قسم عروضنا.
    let existing = current.map(o => ({ ...o }));
    const id = makeEmbeddedOfferId();
    if (data?.featured) existing = existing.map(o => ({ ...o, featured: false }));
    existing.push({ id, ...data, displayOrder: existing.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _storage: 'embedded' });
    const normalized = normalizeEmbeddedOffers(existing);
    await saveEmbeddedOffers(normalized);
    liveState.offers = normalized;
    return { id, embedded: true };
  }
}

export async function updateOffer(id, data) {
  const key = String(id ?? '').trim();
  if (!key) throw new Error('معرف العرض غير موجود');
  const current = Array.isArray(liveState.offers) ? liveState.offers : [];
  const offer = current.find(o => String(o?.id ?? '') === key);
  if (!offer) throw new Error('العرض غير موجود. حدّث الصفحة وحاول مرة أخرى.');

  if (offer._storage === 'embedded') {
    const normalized = normalizeEmbeddedOffers(current.map(o => String(o.id) === key
      ? { ...o, ...data, id: key, updatedAt: new Date().toISOString(), _storage: 'embedded' }
      : { ...o, featured: data?.featured ? false : o.featured, _storage: 'embedded' }));
    await saveEmbeddedOffers(normalized);
    liveState.offers = normalized;
    return true;
  }

  const batch = writeBatch(db);
  if (data?.featured) current.filter(o => o?._storage === 'collection' && String(o.id) !== key && o.featured)
    .forEach(o => batch.update(doc(db, 'offers', String(o.id)), { featured: false, updatedAt: serverTimestamp() }));
  batch.update(doc(db, 'offers', key), { ...data, updatedAt: serverTimestamp() });
  await batch.commit();
  return true;
}

export async function deleteOffer(id) {
  const key = String(id ?? '').trim();
  if (!key) throw new Error('معرف العرض غير موجود');
  const current = Array.isArray(liveState.offers) ? liveState.offers : [];
  const offer = current.find(o => String(o?.id ?? '') === key);
  if (!offer) throw new Error('العرض غير موجود. حدّث الصفحة وحاول مرة أخرى.');

  if (offer._storage === 'embedded') {
    const normalized = normalizeEmbeddedOffers(current.filter(o => String(o.id) !== key));
    await saveEmbeddedOffers(normalized);
    liveState.offers = normalized;
    return true;
  }
  await deleteDoc(doc(db, 'offers', key));
  return true;
}

export async function reorderOffers(orderedIds) {
  const current = Array.isArray(liveState.offers) ? liveState.offers : [];
  const byId = new Map(current.map(o => [String(o?.id ?? ''), o]));
  const seen = new Set();
  const ordered = [];

  (Array.isArray(orderedIds) ? orderedIds : []).forEach(id => {
    const key = String(id ?? '').trim();
    if (!key || seen.has(key) || !byId.has(key)) return;
    seen.add(key);
    ordered.push(byId.get(key));
  });
  current.forEach(o => {
    const key = String(o?.id ?? '').trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      ordered.push(o);
    }
  });

  const embedded = ordered.filter(o => o?._storage === 'embedded');
  const collectionOffers = ordered.filter(o => o?._storage !== 'embedded');

  // لو حصلت حالة انتقال/بيانات مختلطة، حافظ على مصدر كل عرض بدل ما نحوّل
  // عروض Collection إلى Embedded بالخطأ. كل مجموعة تحتفظ بنفس ترتيبها النسبي.
  if (embedded.length) {
    const normalized = normalizeEmbeddedOffers(embedded);
    await saveEmbeddedOffers(normalized);
  }

  if (collectionOffers.length) {
    const batch = writeBatch(db);
    collectionOffers.forEach((o, i) => {
      batch.update(doc(db, 'offers', String(o.id)), { displayOrder: i, updatedAt: serverTimestamp() });
    });
    await batch.commit();
  }

  // لا نحتاج لتحويل الحالة المختلطة إلى مصدر واحد؛ نحافظ على نفس الـstorage.
  liveState.offers = [
    ...embedded.map((o, i) => ({ ...o, displayOrder: i, _storage: 'embedded' })),
    ...collectionOffers.map((o, i) => ({ ...o, displayOrder: i, _storage: 'collection' }))
  ].sort((a, b) => {
    const aPos = ordered.findIndex(x => String(x?.id ?? '') === String(a?.id ?? ''));
    const bPos = ordered.findIndex(x => String(x?.id ?? '') === String(b?.id ?? ''));
    return aPos - bPos;
  });
  return true;
}
