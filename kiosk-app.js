/* ══════════════════════════════════════
   kiosk-app.js — منطق عرض المنيو (للعرض فقط)
   الأدمن بقى في صفحة منفصلة: admin.html
   بيقرا من firebase-app.js (liveState) بدل localStorage
══════════════════════════════════════ */
import {
  liveState, setCallbacks, fetchMenuData, startPolling,
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

let gridResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(gridResizeTimer);
  gridResizeTimer = setTimeout(() => {
    const homeGrid = document.getElementById('homeGrid');
    if (homeGrid) fitGridColumns(homeGrid, liveState.categories.length, 230);
    // في وضع الأقسام الفرعية بيبقى فيه أكتر من grid جوا الصفحة، كل واحد بعدد أصنافه
    document.querySelectorAll('#products-grid .products-grid').forEach(g => {
      fitGridColumns(g, g.children.length, 220);
    });
  }, 200);
}, { passive: true });

/* ══════════════════════════════════════
   عرض الصفحة الرئيسية (الأقسام)
══════════════════════════════════════ */
const fallbackImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23F5EDE3'/%3E%3Ccircle cx='200' cy='120' r='45' fill='%23EAD9C5'/%3E%3Ctext x='200' y='195' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%23B07040'%3Eالصورة غير متاحة%3C/text%3E%3C/svg%3E";

function countLabel(cat) {
  if (cat.displayType === 'image') return '📋 اضغط لعرض المنيو';
  const n = (liveState.products[cat.id] || []).length;
  return n + ' صنف';
}

/* ── تقسيم الأعمدة ديناميكيًا حسب المساحة وعدد العناصر (يمنع صف أخير فاضي) ── */
function fitGridColumns(grid, itemCount, minCardPx) {
  if (!grid || itemCount === 0) return;
  if (window.innerWidth < 600) { grid.style.gridTemplateColumns = ''; return; } // موبايل: سيب الـ CSS الثابت
  const cs = getComputedStyle(grid);
  const gap = parseFloat(cs.columnGap) || 20;
  const innerWidth = grid.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
  let maxCols = Math.max(1, Math.floor((innerWidth + gap) / (minCardPx + gap)));
  maxCols = Math.min(maxCols, itemCount);
  const minCols = Math.min(maxCols, 2);

  // دوري على عدد أعمدة يقسم العدد بالظبط (صفر فراغ)، وإلا اختاري اللي بيسيب أقل فراغ في الصف الأخير
  let best = maxCols;
  let bestGapSlots = (maxCols - (itemCount % maxCols)) % maxCols;
  for (let cols = maxCols; cols >= minCols; cols--) {
    const remainder = itemCount % cols;
    const gapSlots = remainder === 0 ? 0 : cols - remainder;
    if (gapSlots < bestGapSlots) { best = cols; bestGapSlots = gapSlots; }
    if (gapSlots === 0) { best = cols; bestGapSlots = 0; break; }
  }
  grid.style.gridTemplateColumns = `repeat(${best}, 1fr)`;
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
  fitGridColumns(grid, liveState.categories.length, 230);
}

/* ── أصناف بسعر واحد أو بأحجام (وسط/كبير...) ── */
function buildPriceHTML(item) {
  if (item.sizePrices && item.sizePrices.length) {
    return `<div class="prod-sizeprice-row">${item.sizePrices.map(s =>
      `<span class="prod-sizeprice-chip"><span class="sz-name">${s.name}</span><span class="sz-val">${s.price}</span></span>`
    ).join('')}</div>`;
  }
  if (item.price !== undefined && item.price !== null)
    return `<div class="prod-price"><span class="prod-currency">AED </span>${item.price}</div>`;
  return `<div class="prod-price dash">—</div>`;
}
function buildBadgeHTML(item) {
  if (item.sizePrices && item.sizePrices.length) {
    // في وضع الأحجام المتعددة، الأسعار كاملة بتتعرض تحت اسم الصنف بوضوح (وسط/كبير)، فمفيش داعي لبادچ ملخّص فوق الصورة ممكن يوهم إنه سعر واحد
    return '';
  }
  if (item.price !== undefined && item.price !== null)
    return `<div class="prod-badge">${item.price} AED</div>`;
  return `<div class="prod-badge no-price">—</div>`;
}

let currentCategoryId = null;
let sectionObserver = null;

/* ── بناء كارت صنف واحد (بيتستخدم في الوضع العادي ووضع الأقسام الفرعية) ── */
function buildProductCard(item) {
  const card = document.createElement('div');
  card.className = 'prod-card' + (item.wide ? ' wide' : '') + (item.tall ? ' tall' : '');
  card.onclick = () => openProduct(item.id);
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
  return card;
}

/* ── تعمير شبكة أصناف واحدة داخل حاوية معينة ── */
function fillProductsGrid(grid, items) {
  grid.innerHTML = '';
  const frag = document.createDocumentFragment();
  items.forEach(item => frag.appendChild(buildProductCard(item)));
  grid.appendChild(frag);
  grid.querySelectorAll('.prod-img').forEach(img => setupImageLoading(img, fallbackImg));
  fitGridColumns(grid, items.length, 220);
  const cards = grid.querySelectorAll('.prod-card');
  cards.forEach((c, i) => { c.style.transitionDelay = (Math.min(i, 10) * 50) + 'ms'; });
  requestAnimationFrame(() => requestAnimationFrame(() => cards.forEach(c => c.classList.add('show'))));
}

/* ── وضع الأقسام الفرعية: شريط تابز ثابت + سكرول خفيف لكل سكشن ── */
function renderSectionedCategory(wrap, cat, items) {
  const sections = cat.sections || [];
  const bySection = {};
  sections.forEach(s => { bySection[s.id] = []; });
  const others = [];
  items.forEach(item => {
    if (item.sectionId && bySection[item.sectionId]) bySection[item.sectionId].push(item);
    else others.push(item);
  });
  const allSections = others.length ? [...sections, { id: '__other', name: 'أصناف أخرى' }] : sections;
  if (others.length) bySection.__other = others;

  wrap.classList.remove('products-grid');
  wrap.classList.add('products-wrap');
  wrap.innerHTML = `
    <div class="section-tabs-bar" id="sectionTabsBar">
      ${allSections.map((s, i) => `<button class="section-tab${i === 0 ? ' active' : ''}" data-section="${s.id}">${s.name}</button>`).join('')}
    </div>
    ${allSections.map(s => `
      <div class="section-block" id="sec-${s.id}">
        <div class="section-block-title">${s.name}</div>
        <div class="products-grid" data-section="${s.id}"></div>
      </div>`).join('')}
  `;

  allSections.forEach(s => {
    const grid = wrap.querySelector(`.products-grid[data-section="${s.id}"]`);
    fillProductsGrid(grid, bySection[s.id] || []);
  });

  const tabsBar = wrap.querySelector('#sectionTabsBar');
  tabsBar.querySelectorAll('.section-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = document.getElementById('sec-' + tab.dataset.section);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  if (sectionObserver) sectionObserver.disconnect();
  sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id.replace('sec-', '');
      tabsBar.querySelectorAll('.section-tab').forEach(t => t.classList.toggle('active', t.dataset.section === id));
      const activeTab = tabsBar.querySelector('.section-tab.active');
      if (activeTab) activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  }, { rootMargin: '-160px 0px -65% 0px', threshold: 0 });
  wrap.querySelectorAll('.section-block').forEach(block => sectionObserver.observe(block));
}

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

  const wrap = document.getElementById('products-grid');
  const items = (liveState.products[catId] || []);

  if (sectionObserver) { sectionObserver.disconnect(); sectionObserver = null; }

  if (cat.sections && cat.sections.length) {
    renderSectionedCategory(wrap, cat, items);
  } else {
    wrap.classList.remove('products-wrap');
    wrap.classList.add('products-grid');
    fillProductsGrid(wrap, items);
  }

  document.getElementById('view-home').classList.remove('active');
  document.getElementById('view-inner').classList.add('active');
  window.scrollTo(0, 0);
}
window.openCategory = openCategory;

function goHome() {
  if (sectionObserver) { sectionObserver.disconnect(); sectionObserver = null; }
  document.getElementById('view-inner').classList.remove('active');
  document.getElementById('view-image').classList.remove('active');
  document.getElementById('view-product').classList.remove('active');
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

/* ══════════════════════════════════════
   صفحة تفاصيل الصنف
══════════════════════════════════════ */
let currentProductFav = false;

function findProductById(id) {
  for (const catId in liveState.products) {
    const found = (liveState.products[catId] || []).find(p => p.id === id);
    if (found) return found;
  }
  return null;
}

function openProduct(id) {
  const item = findProductById(id);
  if (!item) return;
  currentProductFav = false;

  document.getElementById('pd-fav-btn').textContent = '🤍';
  document.getElementById('pd-fav-btn').classList.remove('active');
  const heroImg = document.getElementById('pd-hero-img');
  heroImg.classList.remove('img-loaded');
  heroImg.src = item.imageUrl;
  setupImageLoading(heroImg, fallbackImg);

  document.getElementById('pd-name').textContent = item.name;
  const hasSizePrices = item.sizePrices && item.sizePrices.length;
  document.getElementById('pd-price').textContent = hasSizePrices
    ? item.sizePrices.map(s => `${s.name} ${s.price}`).join(' / ') + ' AED'
    : ((item.price !== undefined && item.price !== null) ? `${item.price} AED` : '—');

  const sizePricesBlock = document.getElementById('pd-sizeprices-block');
  if (hasSizePrices) {
    document.getElementById('pd-sizeprices-list').innerHTML = item.sizePrices.map(s =>
      `<div class="pd-sizeprice-row"><span class="pd-sizeprice-name">${s.name}</span><span class="pd-sizeprice-value">${s.price} AED</span></div>`
    ).join('');
    sizePricesBlock.style.display = 'block';
  } else {
    sizePricesBlock.style.display = 'none';
  }

  const ratingRow = document.getElementById('pd-rating-row');
  if (item.rating) {
    const full = Math.round(item.rating);
    document.getElementById('pd-stars').textContent = '★'.repeat(full) + '☆'.repeat(5 - full);
    document.getElementById('pd-rating-num').textContent = `(${item.rating})`;
    ratingRow.style.display = 'flex';
  } else {
    ratingRow.style.display = 'none';
  }

  let chipsHtml = '';
  if (item.sizes && item.sizes.length) chipsHtml += `<div class="prod-sizes">${item.sizes.map(s => `<span class="prod-size-chip">${s}</span>`).join('')}</div>`;
  if (item.flavors && item.flavors.length) chipsHtml += `<div class="prod-flavors">${item.flavors.map(f => `<span class="prod-flavor-chip">${f}</span>`).join('')}</div>`;
  if (item.manaeshTypes && item.manaeshTypes.length) chipsHtml += `<div class="manaesh-types">${item.manaeshTypes.map(t => `<span class="manaesh-chip">${t}</span>`).join('')}</div>`;
  document.getElementById('pd-chips').innerHTML = chipsHtml;

  const n = item.nutrition;
  const nutritionBlock = document.getElementById('pd-nutrition-block');
  if (n && (n.calories || n.protein || n.fat || n.carb)) {
    const grid = document.getElementById('pd-nutrition-grid');
    grid.innerHTML = [
      n.calories != null ? `<div class="pd-nutri-item"><div class="pd-nutri-value">${n.calories}</div><div class="pd-nutri-label">سعرة حرارية</div></div>` : '',
      n.protein != null ? `<div class="pd-nutri-item"><div class="pd-nutri-value">${n.protein}g</div><div class="pd-nutri-label">بروتين</div></div>` : '',
      n.fat != null ? `<div class="pd-nutri-item"><div class="pd-nutri-value">${n.fat}g</div><div class="pd-nutri-label">دهون</div></div>` : '',
      n.carb != null ? `<div class="pd-nutri-item"><div class="pd-nutri-value">${n.carb}g</div><div class="pd-nutri-label">كارب</div></div>` : '',
    ].join('');
    nutritionBlock.style.display = 'block';
  } else {
    nutritionBlock.style.display = 'none';
  }

  const descBlock = document.getElementById('pd-desc-block');
  if (item.description) {
    document.getElementById('pd-desc').textContent = item.description;
    descBlock.style.display = 'block';
  } else {
    descBlock.style.display = 'none';
  }

  document.querySelectorAll('.menu-view.active').forEach(v => v.classList.remove('active'));
  document.getElementById('view-product').classList.add('active');
  window.scrollTo(0, 0);
}
window.openProduct = openProduct;

function closeProduct() {
  document.getElementById('view-product').classList.remove('active');
  document.getElementById('view-inner').classList.add('active');
  setTimeout(checkScrollIndicator, 200);
}
window.closeProduct = closeProduct;

function toggleProductFav() {
  currentProductFav = !currentProductFav;
  const btn = document.getElementById('pd-fav-btn');
  btn.textContent = currentProductFav ? '❤️' : '🤍';
  btn.classList.toggle('active', currentProductFav);
}
window.toggleProductFav = toggleProductFav;

/* ── إعادة رسم كل حاجة بعد كل تحديث بيانات ── */
function renderAll() {
  renderHomeGrid();
  // لو المستخدم واقف جوه قسم مفتوح، حدّثه كمان بنفس اللحظة
  if (currentCategoryId && document.getElementById('view-inner').classList.contains('active')) {
    openCategory(currentCategoryId);
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
    const overlay = document.getElementById('adminOverlay');
    if (overlay && overlay.classList.contains('show')) return;
    goHome();
  }, KIOSK_IDLE_MS);
}
['click', 'touchstart', 'pointerdown', 'scroll'].forEach(evt => {
  window.addEventListener(evt, () => { resetKioskIdleTimer(); }, { passive: true });
});
resetKioskIdleTimer();

/* ══════════════════════════════════════
   دخول الأدمن — 3 لمسات على اللوجو تفتح لوحة التحكم المنفصلة
══════════════════════════════════════ */
let logoTapCount = 0;
let logoTapTimer = null;
document.getElementById('logoTapTarget').addEventListener('click', () => {
  logoTapCount++;
  if (logoTapTimer) clearTimeout(logoTapTimer);
  logoTapTimer = setTimeout(() => { logoTapCount = 0; }, 1500);
  if (logoTapCount >= 3) {
    logoTapCount = 0;
    if (window.openAdminOverlay) window.openAdminOverlay();
  }
});

/* ══════════════════════════════════════
   البداية
══════════════════════════════════════ */
(async function init() {
  await fetchMenuData();
  startPolling();
  setTimeout(checkScrollIndicator, 600);
})();
