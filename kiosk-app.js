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
  if (cat.displayType === 'gallery') return '✨ معرض صور';
  if (cat.displayType === 'offers') return '🎁 عروض وخصومات خاصة';
  const n = (liveState.products[cat.id] || []).length;
  return n + ' صنف';
}

/* ── تقسيم الأعمدة ديناميكيًا حسب المساحة وعدد العناصر (يمنع صف أخير فاضي) ──
   ملحوظة: من موبايل لحد آخر مقاس آيباد (لغاية 1499px) الـCSS هو اللي بيتحكم
   في عدد الأعمدة (3 بورتريه / 4 لاندسكيب) — الدالة دي بتشتغل بس على الديسك
   توب الحقيقي (1500px فأكتر) عشان الجافاسكريبت مايكتبش فوق الـCSS ويبهدل
   الشبكة لما الآيباد يتلف. */
function fitGridColumns(grid, itemCount, minCardPx) {
  if (!grid || itemCount === 0) return;
  if (window.innerWidth < 1500) { grid.style.gridTemplateColumns = ''; return; } // موبايل + آيباد: سيب الـ CSS الثابت
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
      `<span class="prod-sizeprice-chip"><span class="sz-name">${s.name}</span><span class="sz-val">${s.price} <span class="prod-currency">AED</span></span></span>`
    ).join('')}</div>`;
  }
  if (item.price !== undefined && item.price !== null)
    return `<div class="prod-price">${item.price}<span class="prod-currency">AED</span></div>`;
  return `<div class="prod-price dash">—</div>`;
}
function buildBadgeHTML(item) {
  if (item.sizePrices && item.sizePrices.length) {
    // في وضع الأحجام المتعددة، الأسعار كاملة بتتعرض تحت اسم الصنف بوضوح (وسط/كبير)، فمفيش داعي لبادچ ملخّص فوق الصورة ممكن يوهم إنه سعر واحد
    return '';
  }
  if (item.price !== undefined && item.price !== null)
    return `<div class="prod-badge">${item.price} <span class="badge-currency">AED</span></div>`;
  return `<div class="prod-badge no-price">—</div>`;
}

let currentCategoryId = null;
let sectionObserver = null;

/* ── بناء كارت صنف واحد (بيتستخدم في الوضع العادي ووضع الأقسام الفرعية) ── */
function buildProductCard(item) {
  const card = document.createElement('div');
  card.className = 'prod-card' + (item.wide ? ' wide' : '') + (item.tall ? ' tall' : '') + (item.hideInfo ? ' photo-only' : '');
  card.onclick = () => openImageMenu(item.imageUrl, item.name);

  /* ── صنف "صورة بس" (بدون اسم أو سعر) — بيعرض الصورة لوحدها من غير أي نص ── */
  if (item.hideInfo) {
    card.innerHTML = `
      <div class="prod-img-wrap photo-only-wrap">
        <img class="prod-img" src="${item.imageUrl}" alt="${item.name || ''}" loading="lazy" decoding="async"/>
      </div>`;
    return card;
  }

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

/* ── معرض صور (وضع "gallery") — صور طولية واحدة تحت التانية، بدون اسم أو سعر، بحركة ظهور ناعمة ── */
let galleryObserver = null;
function renderGalleryView(wrap, images) {
  wrap.classList.remove('products-grid', 'products-wrap');
  wrap.innerHTML = `<div class="gallery-view" id="galleryView"></div>`;
  const galleryEl = wrap.querySelector('#galleryView');
  galleryEl.innerHTML = images.map((url, i) => `
    <div class="gallery-item" data-idx="${i}">
      <img src="${url}" alt="" loading="lazy" decoding="async"/>
    </div>`).join('');

  galleryEl.querySelectorAll('img').forEach(img => setupImageLoading(img, fallbackImg));
  galleryEl.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => openImageMenu(images[+item.dataset.idx], '', images, +item.dataset.idx));
  });

  if (galleryObserver) galleryObserver.disconnect();
  galleryObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('show');
        galleryObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -60px 0px', threshold: 0.05 });
  galleryEl.querySelectorAll('.gallery-item').forEach(item => galleryObserver.observe(item));
}

/* ══════════════════════════════════════
   عروضنا — Offers Experience
   كاروسيل عمق أفقي: عرض واحد كبير نشط في النص، وعروض جانبية أصغر
   تظهر جزئيًا على الجانبين. بدون سكرول رأسي طويل — التنقل كله جوا
   الكاروسيل نفسه (أسهم، سحب باللمس، كيبورد، نقر على عرض جانبي).
══════════════════════════════════════ */
let offersState = null; // { items, activeIndex, autoplayTimer, countdownTimer, reducedMotion }

function teardownOffersShowcase() {
  if (!offersState) return;
  if (offersState.autoplayTimer) clearInterval(offersState.autoplayTimer);
  if (offersState.countdownTimer) clearInterval(offersState.countdownTimer);
  offersState = null;
}

function offerIsLive(o) {
  const now = Date.now();
  if (o.startAt) {
    const s = new Date(o.startAt).getTime();
    if (!isNaN(s) && now < s) return false;
  }
  if (o.endAt) {
    const e = new Date(o.endAt).getTime();
    if (!isNaN(e) && now > e) return false;
  }
  return true;
}

function offerDiscountPercent(o) {
  if (o.discountPercent != null && o.discountPercent !== '') return Math.round(o.discountPercent);
  const orig = Number(o.originalPrice), disc = Number(o.discountPrice);
  if (orig > 0 && disc >= 0 && disc <= orig) return Math.round(((orig - disc) / orig) * 100);
  return null;
}

function formatCountdownParts(msLeft) {
  if (msLeft <= 0) return null;
  const totalSec = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return { days, hours, mins, secs };
}

function pad2(n) { return String(n).padStart(2, '0'); }

function buildOfferCardHTML(o) {
  const pct = offerDiscountPercent(o);
  const hasOldPrice = o.originalPrice != null && o.originalPrice !== '';
  const priceHTML = `
    <div class="offer-price-block">
      ${hasOldPrice ? `<div class="offer-old-price">${o.originalPrice}<span class="offer-currency">AED</span></div>` : ''}
      <div class="offer-new-price">${o.discountPrice != null ? o.discountPrice : '—'}<span class="offer-currency">AED</span></div>
      ${pct != null ? `<div class="offer-pct-chip">خصم ${pct}%</div>` : ''}
    </div>`;
  const badgeHTML = o.badge ? `<div class="offer-badge">${o.badge}</div>` : '';
  const limitedHTML = o.limited ? `<div class="offer-limited">⚡ كمية محدودة</div>` : '';
  const descHTML = o.descriptionAr || o.description ? `<div class="offer-desc">${o.descriptionAr || o.description}</div>` : '';
  const subTextHTML = o.subText ? `<div class="offer-subtext">${o.subText}</div>` : '';
  const ctaHTML = o.ctaText ? `<button type="button" class="offer-cta-btn" data-cta="${o.id}">${o.ctaText}</button>` : '';
  const countdownHTML = (o.countdownEnabled && o.endAt) ? `<div class="offer-countdown" data-offer-countdown="${o.id}" aria-live="off"></div>` : '';

  return `
    <div class="offer-card-inner">
      <div class="offer-img-wrap">
        <img class="offer-img" src="${o.image || o.imageUrl || ''}" alt="${(o.titleAr || o.titleEn || '').replace(/"/g,'&quot;')}" loading="lazy" decoding="async"/>
        ${badgeHTML}
        ${limitedHTML}
      </div>
      <div class="offer-body">
        <div class="offer-title">${o.titleAr || o.titleEn || ''}</div>
        ${descHTML}
        ${priceHTML}
        ${countdownHTML}
        ${subTextHTML}
        ${ctaHTML}
      </div>
    </div>`;
}

function updateOfferCountdowns() {
  if (!offersState) return;
  offersState.items.forEach(o => {
    if (!(o.countdownEnabled && o.endAt)) return;
    const el = document.querySelector(`[data-offer-countdown="${o.id}"]`);
    if (!el) return;
    const endTime = new Date(o.endAt).getTime();
    if (isNaN(endTime)) { el.innerHTML = ''; return; }
    const parts = formatCountdownParts(endTime - Date.now());
    if (!parts) {
      el.innerHTML = `<span class="offer-expired-tag">⏳ انتهى العرض</span>`;
      return;
    }
    el.innerHTML = `
      <span class="cd-unit"><span class="cd-num">${pad2(parts.days)}</span><span class="cd-lbl">يوم</span></span>
      <span class="cd-unit"><span class="cd-num">${pad2(parts.hours)}</span><span class="cd-lbl">ساعة</span></span>
      <span class="cd-unit"><span class="cd-num">${pad2(parts.mins)}</span><span class="cd-lbl">دقيقة</span></span>
      <span class="cd-unit"><span class="cd-num">${pad2(parts.secs)}</span><span class="cd-lbl">ثانية</span></span>`;
  });
}

function layoutOffersTrack() {
  if (!offersState) return;
  const { items, activeIndex } = offersState;
  const track = document.getElementById('offersTrack');
  if (!track) return;
  const cards = track.querySelectorAll('.offer-card');
  cards.forEach((card, i) => {
    const rawDelta = i - activeIndex;
    // نلف للطرف التاني لو فيه أكتر من عرضين، عشان الكاروسيل يبان دايري ومريح
    let delta = rawDelta;
    if (items.length > 2) {
      if (delta > items.length / 2) delta -= items.length;
      if (delta < -items.length / 2) delta += items.length;
    }
    const abs = Math.abs(delta);
    card.classList.toggle('is-active', delta === 0);
    card.setAttribute('aria-hidden', delta === 0 ? 'false' : 'true');
    card.tabIndex = delta === 0 ? 0 : -1;
    if (abs > 2) {
      card.style.opacity = '0';
      card.style.pointerEvents = 'none';
      card.style.transform = `translateX(${delta > 0 ? 1 : -1} * 100%) scale(0.7)`;
      card.style.zIndex = '0';
      return;
    }
    const xPct = delta * 62;
    const scale = delta === 0 ? 1 : (abs === 1 ? 0.8 : 0.66);
    const opacity = delta === 0 ? 1 : (abs === 1 ? 0.62 : 0.32);
    card.style.transform = `translateX(${xPct}%) scale(${scale})`;
    card.style.opacity = String(opacity);
    card.style.zIndex = String(10 - abs);
    card.style.pointerEvents = 'auto';
  });
  const dots = document.querySelectorAll('#offersDots .offers-dot');
  dots.forEach((d, i) => d.classList.toggle('active', i === activeIndex));
  const counter = document.getElementById('offersCounter');
  if (counter) counter.textContent = `${activeIndex + 1} / ${items.length}`;
}

function goToOfferIndex(idx, { userInitiated } = {}) {
  if (!offersState) return;
  const n = offersState.items.length;
  if (!n) return;
  offersState.activeIndex = ((idx % n) + n) % n;
  layoutOffersTrack();
  if (userInitiated) pauseOffersAutoplay();
}

function pauseOffersAutoplay() {
  if (!offersState || !offersState.autoplayTimer) return;
  clearInterval(offersState.autoplayTimer);
  offersState.autoplayTimer = null;
}

function startOffersAutoplay() {
  if (!offersState || offersState.reducedMotion || offersState.items.length < 2) return;
  pauseOffersAutoplay();
  offersState.autoplayTimer = setInterval(() => {
    goToOfferIndex(offersState.activeIndex + 1);
  }, 5500);
}

function renderOffersShowcase(wrap) {
  const now = Date.now();
  const items = (liveState.offers || [])
    .filter(o => o.visible !== false)
    .filter(o => offerIsLive(o))
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  // العروض المميّزة (featured) تتقدّم الصف عشان تبقى هي النشطة الافتراضية
  const featuredIdx = items.findIndex(o => o.featured);

  if (!items.length) {
    wrap.innerHTML = `
      <div class="offers-empty">
        <div class="offers-empty-ic">🎁</div>
        <div class="offers-empty-txt">لسه مفيش عروض حالياً — تابعونا قريباً!</div>
      </div>`;
    return;
  }

  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  offersState = { items, activeIndex: featuredIdx >= 0 ? featuredIdx : 0, autoplayTimer: null, countdownTimer: null, reducedMotion };

  wrap.innerHTML = `
    <div class="offers-showcase" id="offersShowcase" tabindex="0" role="region" aria-roledescription="carousel" aria-label="عروضنا">
      <div class="offers-track" id="offersTrack">
        ${items.map((o, i) => `<div class="offer-card" data-idx="${i}">${buildOfferCardHTML(o)}</div>`).join('')}
      </div>
      <button type="button" class="offers-nav-btn prev" id="offersPrevBtn" aria-label="العرض السابق">›</button>
      <button type="button" class="offers-nav-btn next" id="offersNextBtn" aria-label="العرض التالي">‹</button>
      <div class="offers-footer-row">
        <div class="offers-dots" id="offersDots">${items.map((_, i) => `<button type="button" class="offers-dot" data-idx="${i}" aria-label="عرض ${i + 1}"></button>`).join('')}</div>
        <div class="offers-counter" id="offersCounter"></div>
      </div>
    </div>`;

  const showcaseEl = document.getElementById('offersShowcase');
  const trackEl = document.getElementById('offersTrack');

  // الصور: نفس نمط التحميل التدريجي المستخدم في باقي الموقع
  trackEl.querySelectorAll('.offer-img').forEach(img => setupImageLoading(img, fallbackImg));

  // نقر على أي عرض (خصوصًا الجانبي) يخليه هو النشط
  trackEl.querySelectorAll('.offer-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const idx = +card.dataset.idx;
      if (idx === offersState.activeIndex) return; // نقرة على الكارت النشط نفسه (زي زرار الـCTA) متتعاملش كتنقل
      // ما نستهدفش النقرات جوا زرار CTA
      if (e.target.closest('.offer-cta-btn')) return;
      goToOfferIndex(idx, { userInitiated: true });
    });
  });

  // زرار الـCTA — لو معرّف ctaAction (رابط) يفتحه، وإلا مفيش سلوك افتراضي غير بصري
  trackEl.querySelectorAll('.offer-cta-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const offer = items.find(o => o.id === btn.dataset.cta);
      if (offer && offer.ctaAction) {
        if (/^https?:\/\//i.test(offer.ctaAction)) window.open(offer.ctaAction, '_blank', 'noopener');
      }
    });
  });

  document.getElementById('offersPrevBtn').addEventListener('click', () => goToOfferIndex(offersState.activeIndex - 1, { userInitiated: true }));
  document.getElementById('offersNextBtn').addEventListener('click', () => goToOfferIndex(offersState.activeIndex + 1, { userInitiated: true }));

  document.querySelectorAll('#offersDots .offers-dot').forEach(dot => {
    dot.addEventListener('click', () => goToOfferIndex(+dot.dataset.idx, { userInitiated: true }));
  });

  // كيبورد
  showcaseEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { goToOfferIndex(offersState.activeIndex - 1, { userInitiated: true }); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { goToOfferIndex(offersState.activeIndex + 1, { userInitiated: true }); e.preventDefault(); }
  });

  // سحب باللمس — نفس منطق سحب معرض الصور بالظبط
  let swipeStartX = 0, swipeStartY = 0, swiping = false;
  showcaseEl.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    swipeStartX = e.touches[0].clientX; swipeStartY = e.touches[0].clientY; swiping = true;
  }, { passive: true });
  showcaseEl.addEventListener('touchend', (e) => {
    if (!swiping) return;
    swiping = false;
    const dx = e.changedTouches[0].clientX - swipeStartX;
    const dy = e.changedTouches[0].clientY - swipeStartY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      goToOfferIndex(offersState.activeIndex + (dx < 0 ? 1 : -1), { userInitiated: true });
    }
  }, { passive: true });

  layoutOffersTrack();
  updateOfferCountdowns();
  offersState.countdownTimer = setInterval(updateOfferCountdowns, 1000);
  startOffersAutoplay();
}

function openCategory(catId) {
  const cat = liveState.categories.find(c => c.id === catId);
  if (!cat) return;
  currentCategoryId = catId;

  const innerView = document.getElementById('view-inner');
  const isGallery = cat.displayType === 'gallery';
  const isOffers = cat.displayType === 'offers';
  innerView.classList.toggle('gallery-mode', isGallery);
  innerView.classList.toggle('offers-mode', isOffers);
  document.getElementById('galleryBackBtn').style.display = isGallery ? 'flex' : 'none';

  document.getElementById('inner-emoji').textContent = cat.emoji || '🍽️';
  document.getElementById('inner-title').textContent = cat.name;
  const bannerImg = document.getElementById('inner-banner');
  bannerImg.classList.remove('img-loaded');
  bannerImg.src = cat.bannerImageUrl || cat.imageUrl;
  setupImageLoading(bannerImg, fallbackImg);
  const innerTagEl = document.getElementById('inner-tag');
  const isWesternSweets = (cat.name || '').includes('حلويات غربية');
  innerTagEl.textContent = cat.tag || (isWesternSweets ? 'Baked with Love, Since Forever' : '');
  innerTagEl.classList.toggle('no-bg', isWesternSweets);
  const galleryLabel = document.getElementById('galleryViewLabel');
  if (galleryLabel) galleryLabel.textContent = cat.name || '';

  const wrap = document.getElementById('products-grid');

  if (sectionObserver) { sectionObserver.disconnect(); sectionObserver = null; }
  if (galleryObserver) { galleryObserver.disconnect(); galleryObserver = null; }
  teardownOffersShowcase();

  if (isOffers) {
    wrap.classList.remove('products-wrap', 'products-grid');
    renderOffersShowcase(wrap);
  } else if (isGallery) {
    renderGalleryView(wrap, cat.galleryImages || []);
  } else {
    const items = (liveState.products[catId] || []);
    if (cat.sections && cat.sections.length) {
      renderSectionedCategory(wrap, cat, items);
    } else {
      wrap.classList.remove('products-wrap');
      wrap.classList.add('products-grid');
      fillProductsGrid(wrap, items);
    }
  }

  document.getElementById('view-home').classList.remove('active');
  document.getElementById('view-inner').classList.add('active');
  window.scrollTo(0, 0);
}
window.openCategory = openCategory;

let imageMenuReturnView = 'view-home';
let galleryNavImages = [];
let galleryNavIndex = 0;

function renderImageMenuFrame() {
  const photo = document.getElementById('image-menu-photo');
  photo.classList.remove('img-loaded');
  photo.src = galleryNavImages[galleryNavIndex] || '';
  setupImageLoading(photo, fallbackImg);
  const multi = galleryNavImages.length > 1;
  const counter = document.getElementById('image-menu-counter');
  const prevBtn = document.getElementById('imgNavPrev');
  const nextBtn = document.getElementById('imgNavNext');
  if (counter) { counter.style.display = multi ? 'block' : 'none'; counter.textContent = multi ? `${galleryNavIndex + 1} / ${galleryNavImages.length}` : ''; }
  if (prevBtn) prevBtn.style.display = multi ? 'flex' : 'none';
  if (nextBtn) nextBtn.style.display = multi ? 'flex' : 'none';
}

function navImageMenu(dir) {
  if (galleryNavImages.length < 2) return;
  galleryNavIndex = (galleryNavIndex + dir + galleryNavImages.length) % galleryNavImages.length;
  renderImageMenuFrame();
}
window.navImageMenu = navImageMenu;

/* imagesList + index اختياريين — لو اتبعتوا، بيبقى فيه تنقل بين أكتر من صورة (زي المعرض) */
function openImageMenu(imgUrl, title, imagesList, index) {
  imageMenuReturnView = document.getElementById('view-inner').classList.contains('active') ? 'view-inner' : 'view-home';
  galleryNavImages = (Array.isArray(imagesList) && imagesList.length) ? imagesList : [imgUrl];
  galleryNavIndex = Number.isInteger(index) ? ((index % galleryNavImages.length) + galleryNavImages.length) % galleryNavImages.length : 0;

  document.getElementById('view-image').classList.toggle('gallery-lightbox', galleryNavImages.length > 1);
  document.getElementById('image-title').textContent = title || '';
  renderImageMenuFrame();

  document.getElementById('view-home').classList.remove('active');
  document.getElementById('view-inner').classList.remove('active');
  document.getElementById('view-image').classList.add('active');
  window.scrollTo(0, 0);
}
window.openImageMenu = openImageMenu;

function closeImageMenu() {
  document.getElementById('view-image').classList.remove('active');
  document.getElementById(imageMenuReturnView).classList.add('active');
  window.scrollTo(0, 0);
  if (imageMenuReturnView === 'view-home') setTimeout(checkScrollIndicator, 200);
}
window.closeImageMenu = closeImageMenu;

/* سحب باللمس بين صور المعرض — سحب لليسار = التالي، لليمين = السابق (زي أي عارض صور) */
(function setupImageMenuSwipe() {
  const wrap = document.querySelector('.image-menu-wrap');
  if (!wrap) return;
  let startX = 0, startY = 0, tracking = false;
  wrap.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY; tracking = true;
  }, { passive: true });
  wrap.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      navImageMenu(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
})();

function goHome() {
  if (sectionObserver) { sectionObserver.disconnect(); sectionObserver = null; }
  teardownOffersShowcase();
  document.getElementById('view-inner').classList.remove('active');
  document.getElementById('view-image').classList.remove('active');
  document.getElementById('view-product').classList.remove('active');
  document.getElementById('view-home').classList.add('active');
  window.scrollTo(0, 0);
  setTimeout(checkScrollIndicator, 200);
}
window.goHome = goHome;

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
  document.getElementById('pd-price').innerHTML = hasSizePrices
    ? `${item.sizePrices.map(s => `${s.name} ${s.price}`).join(' / ')} <span class="prod-currency">AED</span>`
    : ((item.price !== undefined && item.price !== null) ? `${item.price}<span class="prod-currency">AED</span>` : '—');

  const sizePricesBlock = document.getElementById('pd-sizeprices-block');
  if (hasSizePrices) {
    document.getElementById('pd-sizeprices-list').innerHTML = item.sizePrices.map(s =>
      `<div class="pd-sizeprice-row"><span class="pd-sizeprice-name">${s.name}</span><span class="pd-sizeprice-value">${s.price} <span class="prod-currency">AED</span></span></div>`
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
function setupLogoTapGesture() {
  const logoEl = document.getElementById('logoTapTarget');
  if (!logoEl) return; // element must exist before attaching the listener

  // Prevent duplicate listeners if this script/init runs more than once.
  if (logoEl.dataset.tapGestureAttached === 'true') return;
  logoEl.dataset.tapGestureAttached = 'true';

  let logoTapCount = 0;
  let logoTapTimer = null;

  function registerLogoTap() {
    logoTapCount++;
    if (logoTapTimer) clearTimeout(logoTapTimer);
    logoTapTimer = setTimeout(() => { logoTapCount = 0; }, 1500);

    if (logoTapCount >= 3) {
      logoTapCount = 0;
      if (logoTapTimer) { clearTimeout(logoTapTimer); logoTapTimer = null; }
      if (typeof window.openAdminOverlay === 'function') {
        window.openAdminOverlay();
      }
    }
  }

  // Some embedded/older tablet browsers expose `window.PointerEvent` but
  // don't reliably dispatch pointer events, so we can't just trust feature
  // detection alone. Instead we listen for BOTH 'pointerup' (best for
  // touchscreens) and 'click' (always supported), and use a short-lived
  // flag to swallow the 'click' that a browser fires right after a
  // pointerup for the same physical tap. This means:
  //  - If pointerup fires correctly -> it counts the tap, and the
  //    following click (if any) is ignored, so the tap isn't counted twice.
  //  - If pointerup never fires on a given device -> the plain click still
  //    counts the tap, so the gesture keeps working either way.
  let suppressNextClick = false;
  let suppressResetTimer = null;

  logoEl.addEventListener('pointerup', (e) => {
    // Ignore non-primary mouse buttons (e.g. right-click) as a tap.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    suppressNextClick = true;
    if (suppressResetTimer) clearTimeout(suppressResetTimer);
    // Safety valve: if no 'click' follows (varies by browser), don't let a
    // stuck flag block a later, unrelated tap.
    suppressResetTimer = setTimeout(() => { suppressNextClick = false; }, 400);
    registerLogoTap();
  });

  logoEl.addEventListener('click', () => {
    if (suppressNextClick) {
      suppressNextClick = false;
      if (suppressResetTimer) { clearTimeout(suppressResetTimer); suppressResetTimer = null; }
      return; // this click is just the compatibility echo of the pointerup above
    }
    registerLogoTap();
  });
}

// The logo element may not exist yet if this script runs before the DOM
// has finished parsing (e.g. loaded in <head> without 'defer'). Wait for
// DOMContentLoaded in that case; otherwise attach right away.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupLogoTapGesture);
} else {
  setupLogoTapGesture();
}

/* ══════════════════════════════════════
   البداية
══════════════════════════════════════ */
(async function init() {
  await fetchMenuData();
  startPolling();
  setTimeout(checkScrollIndicator, 600);
})();
