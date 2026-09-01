/* ══════════════════════════════════════
   FIREBASE APP — إعدادات المشروع
   خد القيم دي من:
   Firebase Console → Project Settings → Your apps → SDK setup and config
══════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";


/* ══════════════════════════════════════
   Firebase Config
══════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "AIzaSyCde_rpDGJI8HIr03a1eKaRzPFPo3mrRjI",
  authDomain: "anwarlebanonbakery-5815b.firebaseapp.com",
  projectId: "anwarlebanonbakery-5815b",
  storageBucket: "anwarlebanonbakery-5815b.firebasestorage.app",
  messagingSenderId: "301016473650",
  appId: "1:301016473650:web:1fc3fb5ced7b446cd19c2b"
};


/* ══════════════════════════════════════
   Cloudinary
   تخزين الصور
══════════════════════════════════════ */

const CLOUDINARY_CLOUD_NAME = "ytihtzxj";
const CLOUDINARY_UPLOAD_PRESET = "Anwar-images";


/* ══════════════════════════════════════
   Firebase Initialization
══════════════════════════════════════ */

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


/* ══════════════════════════════════════
   إعدادات قابلة للتعديل
══════════════════════════════════════ */

const POLL_INTERVAL_MS = 2 * 60 * 1000;
const ADMIN_IDLE_LOGOUT_MS = 5 * 60 * 1000;


/* ══════════════════════════════════════
   الحالة المحلية
   مش localStorage
══════════════════════════════════════ */

export const liveState = {
  categories: [],
  products: {},
  offers: [],
  lastGoodAt: null,
  isOnline: navigator.onLine,
  isAdmin: false
};


/* ══════════════════════════════════════
   Callbacks
══════════════════════════════════════ */

let pollTimer = null;

let onDataRefreshed = () => {};

let onConnectionChange = () => {};

let onAdminAuthChange = () => {};


export function setCallbacks({
  onRefresh,
  onConnection,
  onAdminAuth
}) {
  if (onRefresh) {
    onDataRefreshed = onRefresh;
  }

  if (onConnection) {
    onConnectionChange = onConnection;
  }

  if (onAdminAuth) {
    onAdminAuthChange = onAdminAuth;
  }
}


/* ══════════════════════════════════════
   قراءة بيانات المنيو
══════════════════════════════════════

   مهم جدًا:

   categories + products هما النظام الأساسي
   للعروض.

   العروض منفصلة تمامًا.

   لو حصلت مشكلة في Collection "offers"
   لا نسمح أبدًا إنها تمنع المنيو الأساسية
   من الظهور.

══════════════════════════════════════ */

export async function fetchMenuData() {
  try {

    /* ─────────────────────────────────
       Categories
    ───────────────────────────────── */

    const catsQ = liveState.isAdmin
      ? query(
          collection(db, "categories"),
          orderBy("displayOrder")
        )
      : query(
          collection(db, "categories"),
          where("visible", "==", true),
          orderBy("displayOrder")
        );


    /* ─────────────────────────────────
       Products
    ───────────────────────────────── */

    const prodsQ = liveState.isAdmin
      ? query(
          collection(db, "products"),
          orderBy("displayOrder")
        )
      : query(
          collection(db, "products"),
          where("visible", "==", true),
          orderBy("displayOrder")
        );


    /* ─────────────────────────────────
       نجيب Categories + Products
       مع بعض لأنهم أساس المنيو
    ───────────────────────────────── */

    const [catsSnap, prodsSnap] = await Promise.all([
      getDocs(catsQ),
      getDocs(prodsQ)
    ]);


    /* ─────────────────────────────────
       تجهيز Categories
    ───────────────────────────────── */

    const categories = catsSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));


    /* ─────────────────────────────────
       تجهيز Products
    ───────────────────────────────── */

    const productsByCategory = {};

    prodsSnap.docs.forEach(d => {
      const product = {
        id: d.id,
        ...d.data()
      };

      if (!productsByCategory[product.categoryId]) {
        productsByCategory[product.categoryId] = [];
      }

      productsByCategory[product.categoryId].push(product);
    });


    /* ══════════════════════════════════
       حفظ المنيو الأساسية فورًا
    ══════════════════════════════════ */

    liveState.categories = categories;
    liveState.products = productsByCategory;


    /* ══════════════════════════════════
       تحميل العروض بشكل مستقل
       
       مهم:
       لا نستخدم:
       
       where("visible", "==", true)
       +
       orderBy("displayOrder")
       
       لأنها تحتاج Composite Index.

       بدل كده:
       نجيب offers عادي
       ثم نعمل filter/sort في JS.
    ══════════════════════════════════ */

    try {

      const offersSnap = await getDocs(
        collection(db, "offers")
      );


      let offers = offersSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));


      /* ───────────────────────────────
         الأدمن يشوف كل العروض

         العميل يشوف فقط visible
      ─────────────────────────────── */

      if (!liveState.isAdmin) {
        offers = offers.filter(
          offer => offer.visible !== false
        );
      }


      /* ───────────────────────────────
         ترتيب العروض
      ─────────────────────────────── */

      offers.sort((a, b) => {
        const orderA =
          typeof a.displayOrder === "number"
            ? a.displayOrder
            : 999999;

        const orderB =
          typeof b.displayOrder === "number"
            ? b.displayOrder
            : 999999;

        return orderA - orderB;
      });


      liveState.offers = offers;

    } catch (offersError) {

      /*
         مهم جدًا:

         لو Collection offers فيها مشكلة،
         أو Firestore رفض قراءتها،
         أو حصل أي خطأ فيها،

         لا نمسح categories
         ولا products
         ولا نوقع المنيو.

         فقط نخلي العروض فاضية.
      */

      console.error(
        "Offers fetch failed. Existing menu will continue working:",
        offersError
      );

      liveState.offers = [];
    }


    /* ══════════════════════════════════
       نجاح تحميل البيانات
    ══════════════════════════════════ */

    liveState.lastGoodAt = new Date();


    if (!liveState.isOnline) {
      liveState.isOnline = true;
      onConnectionChange(true);
    }


    /* ─────────────────────────────────
       إعادة رسم الواجهة
    ───────────────────────────────── */

    onDataRefreshed();

    return true;


  } catch (err) {

    /* ══════════════════════════════════
       خطأ في Categories / Products
       
       دول الأساس.
       
       لا نمسح البيانات القديمة.
    ══════════════════════════════════ */

    console.error(
      "Firestore menu fetch failed:",
      err
    );


    if (liveState.isOnline) {
      liveState.isOnline = false;
      onConnectionChange(false);
    }


    /*
       مهم:
       لا نمسح liveState.categories
       ولا liveState.products

       عشان آخر نسخة سليمة تفضل ظاهرة.
    */

    return false;
  }
}


/* ══════════════════════════════════════
   Polling
══════════════════════════════════════ */

export function startPolling() {
  stopPolling();

  pollTimer = setInterval(
    fetchMenuData,
    POLL_INTERVAL_MS
  );
}


export function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
  }

  pollTimer = null;
}


/* ══════════════════════════════════════
   Online / Visibility
══════════════════════════════════════ */

window.addEventListener(
  "online",
  () => {
    fetchMenuData();
  }
);


window.addEventListener(
  "visibilitychange",
  () => {
    if (document.visibilityState === "visible") {
      fetchMenuData();
    }
  }
);


/* ══════════════════════════════════════
   الأدمن — تسجيل الدخول والخروج
══════════════════════════════════════ */

let idleLogoutTimer = null;


export function resetAdminIdleTimer() {

  if (idleLogoutTimer) {
    clearTimeout(idleLogoutTimer);
  }

  if (!liveState.isAdmin) {
    return;
  }

  idleLogoutTimer = setTimeout(
    () => {
      adminLogout();
    },
    ADMIN_IDLE_LOGOUT_MS
  );
}


export async function adminLogin(
  email,
  password
) {
  await signInWithEmailAndPassword(
    auth,
    email,
    password
  );
}


export async function adminLogout() {
  await signOut(auth);
}


/* ══════════════════════════════════════
   Firebase Auth State
══════════════════════════════════════ */

onAuthStateChanged(
  auth,
  async (user) => {

    liveState.isAdmin = !!user;


    if (idleLogoutTimer) {
      clearTimeout(idleLogoutTimer);
    }


    /*
       إعادة تحميل البيانات بعد تغير حالة
       الأدمن عشان:

       الأدمن يشوف المخفي
       العميل لا يرى المخفي
    */

    await fetchMenuData();


    onAdminAuthChange(user);
  }
);


/* ══════════════════════════════════════
   رفع الصور إلى Cloudinary
══════════════════════════════════════ */

export async function uploadMenuImage(file) {

  const url =
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;


  const formData = new FormData();

  formData.append(
    "file",
    file
  );

  formData.append(
    "upload_preset",
    CLOUDINARY_UPLOAD_PRESET
  );


  const res = await fetch(
    url,
    {
      method: "POST",
      body: formData
    }
  );


  if (!res.ok) {
    throw new Error(
      "فشل رفع الصورة على Cloudinary"
    );
  }


  const data = await res.json();


  return {
    url: data.secure_url,
    publicId: data.public_id
  };
}


/* ══════════════════════════════════════
   حذف الصور
══════════════════════════════════════ */

export async function deleteMenuImage() {

  /*
     الحذف التلقائي يحتاج Cloudinary API Secret
     ومينفعش يتحط في كود المتصفح العام.

     لذلك الصور القديمة تفضل على Cloudinary
     ويمكن حذفها يدويًا من Media Library.
  */

}


/* ══════════════════════════════════════
   CRUD — التصنيفات
══════════════════════════════════════ */

export async function createCategory(data) {

  return addDoc(
    collection(db, "categories"),
    {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
  );
}


export async function updateCategory(
  id,
  data
) {

  return updateDoc(
    doc(db, "categories", id),
    {
      ...data,
      updatedAt: serverTimestamp()
    }
  );
}


export async function deleteCategory(id) {

  return deleteDoc(
    doc(db, "categories", id)
  );
}


/* ══════════════════════════════════════
   CRUD — المنتجات
══════════════════════════════════════ */

export async function createProduct(data) {

  return addDoc(
    collection(db, "products"),
    {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
  );
}


export async function updateProduct(
  id,
  data
) {

  return updateDoc(
    doc(db, "products", id),
    {
      ...data,
      updatedAt: serverTimestamp()
    }
  );
}


export async function deleteProduct(id) {

  return deleteDoc(
    doc(db, "products", id)
  );
}


/* ══════════════════════════════════════
   إعادة ترتيب التصنيفات
══════════════════════════════════════ */

export async function reorderCategories(
  orderedIds
) {

  const batch = writeBatch(db);


  orderedIds.forEach(
    (id, index) => {

      batch.update(
        doc(db, "categories", id),
        {
          displayOrder: index,
          updatedAt: serverTimestamp()
        }
      );

    }
  );


  return batch.commit();
}


/* ══════════════════════════════════════
   إعادة ترتيب المنتجات
══════════════════════════════════════ */

export async function reorderProducts(
  orderedIds
) {

  const batch = writeBatch(db);


  orderedIds.forEach(
    (id, index) => {

      batch.update(
        doc(db, "products", id),
        {
          displayOrder: index,
          updatedAt: serverTimestamp()
        }
      );

    }
  );


  return batch.commit();
}


/* ══════════════════════════════════════
   CRUD — العروض
══════════════════════════════════════

   العروض منفصلة عن products.

   مرتبطة بقسم:
   displayType: "offers"

══════════════════════════════════════ */

export async function createOffer(data) {

  return addDoc(
    collection(db, "offers"),
    {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
  );
}


export async function updateOffer(
  id,
  data
) {

  return updateDoc(
    doc(db, "offers", id),
    {
      ...data,
      updatedAt: serverTimestamp()
    }
  );
}


export async function deleteOffer(id) {

  return deleteDoc(
    doc(db, "offers", id)
  );
}


/* ══════════════════════════════════════
   إعادة ترتيب العروض
══════════════════════════════════════ */

export async function reorderOffers(
  orderedIds
) {

  const batch = writeBatch(db);


  orderedIds.forEach(
    (id, index) => {

      batch.update(
        doc(db, "offers", id),
        {
          displayOrder: index,
          updatedAt: serverTimestamp()
        }
      );

    }
  );


  return batch.commit();
       }
