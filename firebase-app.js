/* ══════════════════════════════════════
   FIREBASE APP — إعدادات المشروع
   خد القيم دي من: Firebase Console → Project Settings → Your apps → SDK setup and config
══════════════════════════════════════ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, writeBatch
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
export const liveState = {
  categories: [],   // كل التصنيفات (visible فقط للعميل العادي)
  products: {},     // { categoryId: [products...] }
  offers: [],       // عروضنا — منفصلة عن المنتجات، مرتبطة بقسم displayType:'offers'
  lastGoodAt: null,
  isOnline: navigator.onLine,
  isAdmin: false,
};

let pollTimer = null;
let onDataRefreshed = () => {}; // بتتحدد من الملف الرئيسي بعد ما يجهز الـ DOM
let onConnectionChange = () => {};
let onAdminAuthChange = () => {}; // بتتحدد من index.html — استدعاء واحد بس بعد ما liveState.isAdmin يتحدث

export function setCallbacks({ onRefresh, onConnection, onAdminAuth }) {
  if (onRefresh) onDataRefreshed = onRefresh;
  if (onConnection) onConnectionChange = onConnection;
  if (onAdminAuth) onAdminAuthChange = onAdminAuth;
}

/* ══════════════════════════════════════
   قراءة البيانات (عام + أدمن)
══════════════════════════════════════ */
export async function fetchMenuData() {
  try {
    const catsQ = liveState.isAdmin
      ? query(collection(db, "categories"), orderBy("displayOrder"))
      : query(collection(db, "categories"), where("visible", "==", true), orderBy("displayOrder"));

    const prodsQ = liveState.isAdmin
      ? query(collection(db, "products"), orderBy("displayOrder"))
      : query(collection(db, "products"), where("visible", "==", true), orderBy("displayOrder"));

    // العروض لا تدخل في Promise.all مع الأقسام والمنتجات.
    // لو Collection offers غير مسموح بها في Rules، المنيو الأساسية تفضل شغالة.
    const [catsSnap, prodsSnap] = await Promise.all([
      getDocs(catsQ),
      getDocs(prodsQ)
    ]);

    const categories = catsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const productsByCategory = {};
    prodsSnap.docs.forEach(d => {
      const p = { id: d.id, ...d.data() };
      (productsByCategory[p.categoryId] ||= []).push(p);
    });

    liveState.categories = categories;
    liveState.products = productsByCategory;

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
    offers = offers.map(o => ({ ...o, _storage: 'embedded' }));
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
    offers = offers.map(o => ({ ...o, _storage: 'embedded' }));

    if (!liveState.isAdmin) {
      offers = offers.filter(o => o.visible !== false);
    }

    return sortOffers(offers);
  }
}

async function saveEmbeddedOffers(offers) {
  const cat = getOffersCategoryFromState();
  if (!cat) {
    throw new Error('قسم عروضنا غير موجود في المنيو. أضف قسم عروضنا أولاً.');
  }

  const clean = offers.map(o => {
    const copy = { ...o };
    delete copy.id;
    delete copy._storage;
    return copy;
  });

  await updateDoc(doc(db, "categories", cat.id), {
    offers: clean,
    offersStorage: 'embedded',
    updatedAt: serverTimestamp()
  });
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
   رفع صورة إلى Cloudinary → يرجع الرابط
   (unsigned upload — من المتصفح مباشرة، من غير سيرفر)
══════════════════════════════════════ */
export async function uploadMenuImage(file) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const formData = new FormData();
  formData.append("file", file);
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
  try {
    // نجرب التخزين الطبيعي أولاً.
    return await addDoc(collection(db, "offers"), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    // لو Rules تمنع Collection offers، استخدم fallback داخل قسم عروضنا.
    console.warn("createOffer collection failed; using embedded fallback.", err);

    const existing = Array.isArray(liveState.offers)
      ? liveState.offers.map(o => ({ ...o }))
      : [];

    const id = makeEmbeddedOfferId();
    const offer = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _storage: 'embedded'
    };

    existing.push(offer);
    await saveEmbeddedOffers(sortOffers(existing));
    return { id, embedded: true };
  }
}

export async function updateOffer(id, data) {
  const current = liveState.offers.find(o => o.id === id);

  if (current?._storage === 'embedded') {
    const offers = liveState.offers.map(o =>
      o.id === id
        ? { ...o, ...data, updatedAt: new Date().toISOString(), _storage: 'embedded' }
        : { ...o }
    );
    await saveEmbeddedOffers(sortOffers(offers));
    return true;
  }

  try {
    return await updateDoc(doc(db, "offers", id), {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn("updateOffer collection failed; trying embedded fallback.", err);

    // لو كان موجودًا فعلاً في offers لكن الكتابة ممنوعة، لا نحوله بصمت.
    // نستخدم fallback فقط لو العرض موجود في الذاكرة ويمكن حفظه داخل category.
    if (!current) throw err;

    const offers = liveState.offers.map(o =>
      o.id === id
        ? { ...o, ...data, updatedAt: new Date().toISOString(), _storage: 'embedded' }
        : { ...o }
    );
    await saveEmbeddedOffers(sortOffers(offers));
    return true;
  }
}

export async function deleteOffer(id) {
  const current = liveState.offers.find(o => o.id === id);

  if (current?._storage === 'embedded') {
    await saveEmbeddedOffers(
      liveState.offers.filter(o => o.id !== id)
    );
    return true;
  }

  try {
    return await deleteDoc(doc(db, "offers", id));
  } catch (err) {
    console.warn("deleteOffer collection failed; trying embedded fallback.", err);
    if (!current) throw err;

    await saveEmbeddedOffers(
      liveState.offers
        .filter(o => o.id !== id)
        .map(o => ({ ...o, _storage: 'embedded' }))
    );
    return true;
  }
}

export async function reorderOffers(orderedIds) {
  const current = liveState.offers || [];

  if (current.some(o => o._storage === 'embedded')) {
    const byId = new Map(current.map(o => [o.id, o]));
    const reordered = orderedIds
      .map((id, i) => byId.has(id) ? { ...byId.get(id), displayOrder: i, _storage: 'embedded' } : null)
      .filter(Boolean);
    await saveEmbeddedOffers(reordered);
    return true;
  }

  try {
    const batch = writeBatch(db);
    orderedIds.forEach((id, i) => {
      batch.update(doc(db, "offers", id), {
        displayOrder: i,
        updatedAt: serverTimestamp()
      });
    });
    return await batch.commit();
  } catch (err) {
    console.warn("reorderOffers collection failed; using embedded fallback.", err);

    const byId = new Map(current.map(o => [o.id, o]));
    const reordered = orderedIds
      .map((id, i) => byId.has(id) ? { ...byId.get(id), displayOrder: i, _storage: 'embedded' } : null)
      .filter(Boolean);
    await saveEmbeddedOffers(reordered);
    return true;
  }
}

