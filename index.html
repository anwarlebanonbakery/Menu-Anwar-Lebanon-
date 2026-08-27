/* ══════════════════════════════════════
   kiosk-app.js — منطق عرض المنيو + لوحة الأدمن
   بيقرا من firebase-app.js (liveState) بدل localStorage
══════════════════════════════════════ */
import {
  liveState, setCallbacks, fetchMenuData, startPolling,
  adminLogin, adminLogout, resetAdminIdleTimer,
  uploadMenuImage,
  createCategory, updateCategory, deleteCategory,
  createProduct, updateProduct, deleteProduct,
} from "./firebase-app.js";

/* ── الساعة ── */
function updateKioskClock() {
  const el = document.getElementById('kioskClock');
  if (!el) return;
  const now = new Date();
  const uae = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
  el.textContent = uae.toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit' });
}
updateKioskClock();
setInterval(updateKioskClock, 15000);

/* ── تحميل الصور بشكل تدريجي (skeleton) ── */
const CAT_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='260' viewBox='0 0 400 260'%3E%3Crect width='400' height='260' fill='%23EAD9C5'/%3E%3Ccircle cx='200' cy='110' r='40' fill='%23D4A830' opacity='0.3'/%3E%3Ctext x='200' y='165' text-anchor='middle' font-family='sans-serif' font-size='13' fill='%23B07040'%3Eلا توجد صورة%3C/text%3E%3C/svg%3E";
function setupImageLoading(img, fallback) {
  const done = () => img.classList.add('img-loaded');
  const fail = () => { if (img.src !== fallback) img.src = fallback; img.classList.add('img-loaded'); };
  if (img.complete && img.naturalWidth > 0) done();
  else if (img.complete) fail();
  else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', fail, { once: true }); }
}

/* ── مؤشر "المزيد بالأسفل" ── */
let scrollTicking = false;
const scrollMoreIndicatorEl = document.getElementById('scrollMoreIndicator');
const viewHomeEl = document.getElementById('view-home');
function checkScrollIndicator() {
  if (!scrollMoreIndicatorEl) return;
  const atBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 24);
  const homeActive = viewHomeEl.classList.contains('active');
  scrollMoreIndicatorEl.classList.toggle('show', homeActive && !atBottom);
}
window.addEventListener('scroll', () => {
  if (!scrollTicking) { scrollTicking = true; requestAnimationFrame(() => { checkScrollIndicator(); scrollTicking = false; }); }
}, { passive: true });
window.addEventListener('resize', checkScrollIndicator, { passive: true });

/* ══════════════════════════════════════
   عرض الصفحة الرئيسية (الأقسام)
══════════════════════════════════════ */
const fallbackImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23F5EDE3'/%3E%3Ccircle cx='200' cy='120' r='45' fill='%23EAD9C5'/%3E%3Ctext x='200' y='195' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%23B07040'%3Eالصورة غير متاحة%3C/text%3E%3C/svg%3E";

function countLabel(cat) {
  if (cat.displayType === 'image') return '📋 اضغط لعرض المنيو';
  const n = (liveState.products[cat.id] || []).length;
  return n + ' صنف';
}

function renderHomeGrid() {
  const grid = document.getElementById('homeGrid');
  if (!grid) return;
  grid.innerHTML = liveState.categories.map(cat => {
    const onclick = cat.displayType === 'image'
      ? `openImageMenu('${(cat.menuImageUrl || '').replace(/'/g, "\\'")}','${(cat.name || '').replace(/'/g, "\\'")}')`
      : `openCategory('${cat.id}')`;
    return `
      <div class="cat-card" onclick="${onclick}">
        <div class="cat-img-wrap">
          <img class="cat-img" src="${cat.imageUrl}" alt="${cat.name}" loading="lazy" decoding="async"/>
          <div class="cat-img-overlay"></div>
        </div>
        <div class="cat-body">
          <div class="cat-name">${cat.name}</div>
          <div class="cat-meta"><div class="cat-arrow">←</div><div class="cat-count">${countLabel(cat)}</div></div>
        </div>
      </div>`;
  }).join('');
  grid.querySelectorAll('.cat-img').forEach(img => setupImageLoading(img, CAT_FALLBACK));
}

function buildPriceHTML(item) {
  if (item.price !== undefined && item.price !== null)
    return `<div class="prod-price"><span class="prod-currency">AED </span>${item.price}</div>`;
  return `<div class="prod-price dash">—</div>`;
}
function buildBadgeHTML(item) {
  if (item.price !== undefined && item.price !== null)
    return `<div class="prod-badge">${item.price} AED</div>`;
  return `<div class="prod-badge no-price">—</div>`;
}

let currentCategoryId = null;

function openCategory(catId) {
  const cat = liveState.categories.find(c => c.id === catId);
  if (!cat) return;
  currentCategoryId = catId;

  document.getElementById('inner-emoji').textContent = cat.emoji || '🍽️';
  document.getElementById('inner-title').textContent = cat.name;
  const bannerImg = document.getElementById('inner-banner');
  bannerImg.classList.remove('img-loaded');
  bannerImg.src = cat.imageUrl;
  setupImageLoading(bannerImg, fallbackImg);
  document.getElementById('inner-tag').textContent = cat.tag || '';

  const grid = document.getElementById('products-grid');
  grid.innerHTML = '';
  const items = (liveState.products[catId] || []);
  const frag = document.createDocumentFragment();
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'prod-card' + (item.wide ? ' wide' : '') + (item.tall ? ' tall' : '');
    let extras = '';
    if (item.sizes && item.sizes.length) extras += `<div class="prod-sizes">${item.sizes.map(s => `<span class="prod-size-chip">${s}</span>`).join('')}</div>`;
    if (item.flavors && item.flavors.length) extras += `<div class="prod-flavors">${item.flavors.map(f => `<span class="prod-flavor-chip">${f}</span>`).join('')}</div>`;
    if (item.description) extras += `<div class="prod-note">${item.description}</div>`;
    let manaesh = '';
    if (item.manaeshTypes && item.manaeshTypes.length) manaesh = `<div class="manaesh-types">${item.manaeshTypes.map(t => `<span class="manaesh-chip">${t}</span>`).join('')}</div>`;
    card.innerHTML = `
      <div class="prod-img-wrap">
        <img class="prod-img" src="${item.imageUrl}" alt="${item.name}" loading="lazy" decoding="async"/>
        ${buildBadgeHTML(item)}
      </div>
      <div class="prod-body">
        <div>
          <div class="prod-name">${item.name}</div>
          ${extras}${manaesh}
        </div>
        <div class="prod-price-row">
          ${buildPriceHTML(item)}
          <div class="prod-heart">🤍</div>
        </div>
      </div>`;
    frag.appendChild(card);
  });
  grid.appendChild(frag);
  grid.querySelectorAll('.prod-img').forEach(img => setupImageLoading(img, fallbackImg));

  const cards = grid.querySelectorAll('.prod-card');
  cards.forEach((c, i) => { c.style.transitionDelay = (Math.min(i, 10) * 50) + 'ms'; });
  requestAnimationFrame(() => requestAnimationFrame(() => cards.forEach(c => c.classList.add('show'))));

  document.getElementById('view-home').classList.remove('active');
  document.getElementById('view-inner').classList.add('active');
  window.scrollTo(0, 0);
}
window.openCategory = openCategory;

function goHome() {
  document.getElementById('view-inner').classList.remove('active');
  document.getElementById('view-image').classList.remove('active');
  document.getElementById('view-home').classList.add('active');
  window.scrollTo(0, 0);
  setTimeout(checkScrollIndicator, 200);
}
window.goHome = goHome;

function openImageMenu(imgUrl, title) {
  document.getElementById('image-title').textContent = title;
  document.getElementById('image-menu-photo').src = imgUrl;
  document.getElementById('view-home').classList.remove('active');
  document.getElementById('view-inner').classList.remove('active');
  document.getElementById('view-image').classList.add('active');
  window.scrollTo(0, 0);
}
window.openImageMenu = openImageMenu;

/* ── إعادة رسم كل حاجة بعد كل تحديث بيانات ── */
function renderAll() {
  renderHomeGrid();
  // لو المستخدم واقف جوه قسم مفتوح، حدّثه كمان بنفس اللحظة
  if (currentCategoryId && document.getElementById('view-inner').classList.contains('active')) {
    openCategory(currentCategoryId);
  }
  if (liveState.isAdmin && document.getElementById('adminPanel').classList.contains('show')) {
    renderAdminBody();
  }
}

/* ── مؤشر الاتصال ── */
function onConnectionChange(isOnline) {
  const dot = document.getElementById('connStatusDot');
  if (!dot) return;
  dot.classList.toggle('offline', !isOnline);
}

setCallbacks({ onRefresh: renderAll, onConnection: onConnectionChange });

/* ══════════════════════════════════════
   وضع الكيوسك — بدء / شاشة كاملة / رجوع تلقائي بعد خمول
══════════════════════════════════════ */
window.startKiosk = function () {
  document.getElementById('kioskStartOverlay').classList.add('hidden');
  const el = document.documentElement;
  const reqFS = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (reqFS) { try { reqFS.call(el); } catch (e) {} }
};

const KIOSK_IDLE_MS = 60000;
let kioskIdleTimer = null;
function resetKioskIdleTimer() {
  if (kioskIdleTimer) clearTimeout(kioskIdleTimer);
  kioskIdleTimer = setTimeout(() => {
    if (document.getElementById('adminPanel').classList.contains('show')) return;
    goHome();
  }, KIOSK_IDLE_MS);
}
['click', 'touchstart', 'pointerdown', 'scroll'].forEach(evt => {
  window.addEventListener(evt, () => { resetKioskIdleTimer(); resetAdminIdleTimer(); }, { passive: true });
});
resetKioskIdleTimer();

/* ══════════════════════════════════════
   دخول الأدمن — 3 لمسات على اللوجو
══════════════════════════════════════ */
let logoTapCount = 0;
let logoTapTimer = null;
document.getElementById('logoTapTarget').addEventListener('click', () => {
  logoTapCount++;
  if (logoTapTimer) clearTimeout(logoTapTimer);
  logoTapTimer = setTimeout(() => { logoTapCount = 0; }, 1500);
  if (logoTapCount >= 3) {
    logoTapCount = 0;
    openAdminLogin();
  }
});

function showAdminToast(msg) {
  const t = document.getElementById('adminToast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function openAdminLogin() {
  document.getElementById('adminEmailInput').value = '';
  document.getElementById('adminPinInput').value = '';
  document.getElementById('adminPinError').textContent = '';
  document.getElementById('adminPinBackdrop').classList.add('show');
}
window.closeAdminLogin = function () {
  document.getElementById('adminPinBackdrop').classList.remove('show');
};

window.checkAdminPin = async function () {
  const email = document.getElementById('adminEmailInput').value.trim();
  const password = document.getElementById('adminPinInput').value;
  const errEl = document.getElementById('adminPinError');
  if (!email || !password) { errEl.textContent = 'حط الإيميل والباسورد'; return; }
  try {
    await adminLogin(email, password);
    window.closeAdminLogin();
    openAdminPanel();
  } catch (e) {
    errEl.textContent = 'بيانات دخول غلط';
  }
};

window.handleAdminLogout = async function () {
  await adminLogout();
  closeAdminPanel();
  showAdminToast('تم الخروج');
};

/* ══════════════════════════════════════
   لوحة الأدمن — CRUD كامل عبر Firestore + Cloudinary
══════════════════════════════════════ */
let adminEditingCategoryId = null;

function openAdminPanel() {
  adminEditingCategoryId = null;
  renderAdminBody();
  document.getElementById('adminPanel').classList.add('show');
  resetAdminIdleTimer();
}
function closeAdminPanel() {
  document.getElementById('adminPanel').classList.remove('show');
}
window.closeAdminPanel = closeAdminPanel;

function escAttr(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function renderAdminBody() {
  const body = document.getElementById('adminBody');
  body.innerHTML = adminEditingCategoryId ? renderAdminItemsEditor(adminEditingCategoryId) : renderAdminCategoriesEditor();
  wireAdminFileInputs();
}

function renderAdminCategoriesEditor() {
  let html = '<div class="admin-section-title">الأقسام الرئيسية</div>';
  html += liveState.categories.map(cat => `
    <div class="admin-card-row">
      <img src="${cat.imageUrl}" alt=""/>
      <div class="admin-field-col">
        <input class="admin-name" value="${escAttr(cat.name)}" onchange="window.__adminUpdateCat('${cat.id}',{name:this.value})" placeholder="اسم القسم"/>
        <label class="admin-btn edit" style="text-align:center;display:block;">📷 غيّر الصورة
          <input type="file" accept="image/*" style="display:none" data-cat-img="${cat.id}"/>
        </label>
        <label style="font-size:12px;display:flex;align-items:center;gap:6px;">
          <input type="checkbox" ${cat.visible ? 'checked' : ''} onchange="window.__adminUpdateCat('${cat.id}',{visible:this.checked})"/> ظاهر في المنيو
        </label>
      </div>
      <div class="admin-row-actions">
        ${cat.displayType !== 'image' ? `<button class="admin-btn edit" onclick="window.__adminOpenCategory('${cat.id}')">الأصناف</button>` : ''}
        <button class="admin-btn del" onclick="window.__adminDeleteCategory('${cat.id}')">حذف 🗑</button>
      </div>
    </div>
  `).join('');
  html += `<button class="admin-btn add" onclick="window.__adminAddCategory()">+ إضافة قسم جديد</button>`;
  return html;
}

function renderAdminItemsEditor(catId) {
  const cat = liveState.categories.find(c => c.id === catId);
  if (!cat) { adminEditingCategoryId = null; return renderAdminCategoriesEditor(); }
  const items = liveState.products[catId] || [];
  let html = `<button class="admin-btn back-to-cats" onclick="window.__adminBackToCats()">→ رجوع للأقسام</button>`;
  html += `<div class="admin-section-title">أصناف: ${escAttr(cat.name)} (${items.length})</div>`;
  html += items.map(item => `
    <div class="admin-card-row">
      <img src="${item.imageUrl}" alt=""/>
      <div class="admin-field-col">
        <input class="admin-name" value="${escAttr(item.name)}" onchange="window.__adminUpdateProduct('${item.id}',{name:this.value})" placeholder="اسم الصنف"/>
        <input type="number" value="${item.price !== undefined && item.price !== null ? item.price : ''}" onchange="window.__adminUpdateProductPrice('${item.id}',this.value)" placeholder="السعر (فاضي = بدون سعر)"/>
        <label class="admin-btn edit" style="text-align:center;display:block;">📷 غيّر الصورة
          <input type="file" accept="image/*" style="display:none" data-prod-img="${item.id}"/>
        </label>
        <label style="font-size:12px;display:flex;align-items:center;gap:6px;">
          <input type="checkbox" ${item.visible ? 'checked' : ''} onchange="window.__adminUpdateProduct('${item.id}',{visible:this.checked})"/> ظاهر
        </label>
      </div>
      <div class="admin-row-actions">
        <button class="admin-btn del" onclick="window.__adminDeleteProduct('${item.id}')">حذف 🗑</button>
      </div>
    </div>
  `).join('');
  html += `<button class="admin-btn add" onclick="window.__adminAddProduct('${catId}')">+ إضافة صنف جديد</button>`;
  return html;
}

function wireAdminFileInputs() {
  document.querySelectorAll('[data-cat-img]').forEach(inp => {
    inp.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      showAdminToast('⏳ جاري رفع الصورة...');
      try {
        const { url } = await uploadMenuImage(file);
        await updateCategory(inp.dataset.catImg, { imageUrl: url });
        await fetchMenuData();
        showAdminToast('✅ اتحدثت الصورة');
      } catch (err) { showAdminToast('⚠️ فشل رفع الصورة'); }
    });
  });
  document.querySelectorAll('[data-prod-img]').forEach(inp => {
    inp.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      showAdminToast('⏳ جاري رفع الصورة...');
      try {
        const { url } = await uploadMenuImage(file);
        await updateProduct(inp.dataset.prodImg, { imageUrl: url });
        await fetchMenuData();
        showAdminToast('✅ اتحدثت الصورة');
      } catch (err) { showAdminToast('⚠️ فشل رفع الصورة'); }
    });
  });
}

window.__adminOpenCategory = (id) => { adminEditingCategoryId = id; renderAdminBody(); };
window.__adminBackToCats = () => { adminEditingCategoryId = null; renderAdminBody(); };

window.__adminUpdateCat = async (id, data) => {
  await updateCategory(id, data);
  await fetchMenuData();
  showAdminToast('✅ اتحفظ');
};
window.__adminDeleteCategory = async (id) => {
  if (!confirm('تأكيد حذف القسم ده وكل أصنافه؟')) return;
  const items = liveState.products[id] || [];
  for (const it of items) await deleteProduct(it.id);
  await deleteCategory(id);
  await fetchMenuData();
  renderAdminBody();
  showAdminToast('🗑 اتحذف');
};
window.__adminAddCategory = async () => {
  const maxOrder = liveState.categories.reduce((m, c) => Math.max(m, c.displayOrder || 0), -1);
  await createCategory({ name: 'قسم جديد', imageUrl: fallbackImg, displayType: 'category', menuImageUrl: '', displayOrder: maxOrder + 1, visible: true });
  await fetchMenuData();
  renderAdminBody();
};

window.__adminUpdateProduct = async (id, data) => {
  await updateProduct(id, data);
  await fetchMenuData();
  showAdminToast('✅ اتحفظ');
};
window.__adminUpdateProductPrice = async (id, value) => {
  await updateProduct(id, { price: value === '' ? null : Number(value) });
  await fetchMenuData();
  showAdminToast('✅ اتحفظ');
};
window.__adminDeleteProduct = async (id) => {
  if (!confirm('تأكيد حذف الصنف؟')) return;
  await deleteProduct(id);
  await fetchMenuData();
  renderAdminBody();
  showAdminToast('🗑 اتحذف');
};
window.__adminAddProduct = async (catId) => {
  const items = liveState.products[catId] || [];
  const maxOrder = items.reduce((m, p) => Math.max(m, p.displayOrder || 0), -1);
  await createProduct({ name: 'صنف جديد', categoryId: catId, imageUrl: fallbackImg, price: null, description: '', flavors: [], sizes: [], manaeshTypes: [], wide: false, tall: false, displayOrder: maxOrder + 1, visible: true });
  await fetchMenuData();
  renderAdminBody();
};

/* ══════════════════════════════════════
   البداية
══════════════════════════════════════ */
(async function init() {
  await fetchMenuData();
  startPolling();
  setTimeout(checkScrollIndicator, 600);
})();
