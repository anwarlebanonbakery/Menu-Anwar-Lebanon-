/* ══════════════════════════════════════
   FIREBASE APP — إعدادات المشروع
   خد القيم دي من: Firebase Console → Project Settings → Your apps → SDK setup and config
══════════════════════════════════════ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp
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

    const [catsSnap, prodsSnap] = await Promise.all([getDocs(catsQ), getDocs(prodsQ)]);

    const categories = catsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const productsByCategory = {};
    prodsSnap.docs.forEach(d => {
      const p = { id: d.id, ...d.data() };
      (productsByCategory[p.categoryId] ||= []).push(p);
    });

    liveState.categories = categories;
    liveState.products = productsByCategory;
    liveState.lastGoodAt = new Date();

    if (!liveState.isOnline) { liveState.isOnline = true; onConnectionChange(true); }
    onDataRefreshed();
    return true;
  } catch (err) {
    console.error("Firestore fetch failed:", err);
    if (liveState.isOnline) { liveState.isOnline = false; onConnectionChange(false); }
    // مهم: مبنمسحش liveState.categories/products القديمة — بتفضل معروضة زي ما هي (آخر نسخة شغالة)
    return false;
  }
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
