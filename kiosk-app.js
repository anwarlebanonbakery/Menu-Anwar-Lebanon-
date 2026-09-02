/* ══════════════════════════════════════
   kiosk-app.js — منطق عرض المنيو (للعرض فقط)
   الأدمن بقى في صفحة منفصلة: admin.html
   بيقرا من firebase-app.js (liveState) بدل localStorage
══════════════════════════════════════ */
import {
  liveState, setCallbacks, fetchMenuData, startPolling,
} from "./firebase-app.js?v=20260902-32";

/* ── الساعة ── */
function updateKioskClock() {
  const el = document.getElementById('kioskClock');
  if (!el) return;
  const now = new Date();
  const uae = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
  const timeText = uae.toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateText = uae.toLocaleDateString('ar-AE', { day: '2-digit', month: 'short' });
  const timeEl = el.querySelector('.kiosk-clock-time');
  const dateEl = el.querySelector('.kiosk-clock-date');
  if (timeEl && dateEl) { timeEl.textContent = timeText; dateEl.textContent = dateText; }
  else { el.textContent = timeText; }
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


/* ── Homepage Hero — driven by siteSettings/hero with safe defaults ── */
function heroRgba(hex, opacity) {
  const h = String(hex || '#08100c').replace('#','');
  const full = h.length === 3 ? h.split('').map(x=>x+x).join('') : h.padEnd(6,'0').slice(0,6);
  const r=parseInt(full.slice(0,2),16)||0,g=parseInt(full.slice(2,4),16)||0,b=parseInt(full.slice(4,6),16)||0;
  return `rgba(${r},${g},${b},${Math.max(0,Math.min(1,Number(opacity)||0))})`;
}
function heroOverlayStyle(o) {
  if (!o?.enabled) return 'transparent';
  const color=heroRgba(o.color,o.opacity), transparent=heroRgba(o.color,0), type=o.type||'linear';
  if(type==='solid') return color;
  if(type==='radial') return `radial-gradient(circle at 50% 50%, ${color} 0%, ${transparent} 100%)`;
  return `linear-gradient(${o.direction||'to-bottom'}, ${transparent} 45%, ${color} 100%)`;
}
function renderHero() {
  const hero=document.getElementById('menuHero');
  if(!hero) return;
  const c=liveState.heroSettings || {};
  const o=c.overlay || {};
  const content=c.content || {};
  const logo=c.logo || {};
  const pos=c.contentPosition || {};
  const typo=c.typography || {};
  const anim=c.animation || {};
  const bg=document.getElementById('menuHeroBg'), overlay=document.getElementById('menuHeroOverlay'), glow=document.getElementById('menuHeroGlow'), contentEl=document.getElementById('menuHeroContent');
  hero.classList.toggle('hero-disabled', c.enabled === false);
  hero.style.setProperty('--hero-h-mobile', `${Number(c.heightMobile||320)}px`);
  hero.style.setProperty('--hero-h-desktop', `${Number(c.heightDesktop||340)}px`);
  hero.style.setProperty('--hero-bg-x', `${Number(c.backgroundPositionX ?? 50)}%`);
  hero.style.setProperty('--hero-bg-y', `${Number(c.backgroundPositionY ?? 0)}%`);
  if(bg){
    bg.style.backgroundImage = c.imageUrl ? `url(${JSON.stringify(String(c.imageUrl))})` : 'none';
    bg.style.backgroundPosition = `${Number(c.backgroundPositionX ?? 50)}% ${Number(c.backgroundPositionY ?? 0)}%`;
    bg.style.backgroundSize = c.imageFit === 'fill' ? '100% 100%' : (c.imageFit === 'contain' ? 'contain' : 'cover');
    const zoomEnabled = anim.imageZoom === true;
    bg.classList.toggle('hero-zoom-on', zoomEnabled);
    bg.classList.toggle('hero-zoom-off', !zoomEnabled);
    // Hard reset: if Zoom is switched OFF after an animation already ran,
    // never allow the previous transform/fill-mode to leave the image enlarged.
    if (!zoomEnabled) {
      bg.style.animation = 'none';
      bg.style.transform = 'none';
      bg.style.willChange = 'auto';
    } else {
      bg.style.animation = '';
      bg.style.transform = '';
      bg.style.willChange = 'transform';
    }
  }
  if(overlay) overlay.style.background=heroOverlayStyle(o);
  if(glow) glow.style.display=anim.glow===false?'none':'';
  if(contentEl){
    const h=pos.horizontal==='left'?12:pos.horizontal==='center'?50:pos.horizontal==='right'?88:Number(pos.x??88);
    const v=pos.vertical==='top'?14:pos.vertical==='center'?50:pos.vertical==='bottom'?86:Number(pos.y??86);
    contentEl.style.left=`${h}%`; contentEl.style.top=`${v}%`; contentEl.style.transform='translate(-50%,-50%)';
    contentEl.classList.toggle('hero-content-noanim', anim.contentReveal===false);
    const hasVisibleContent = logo.enabled !== false || !!content.title || !!content.tagline || !!content.since;
    contentEl.classList.toggle('hero-content-empty', !hasVisibleContent);
  }
  const img=document.getElementById('menuHeroLogo');
  if(img){ img.src=logo.url||'logo.png'; img.style.width=`${Number(logo.size||108)}px`; img.style.height=`${Number(logo.size||108)}px`; img.style.display=logo.enabled===false?'none':''; }
  const name=document.getElementById('menuHeroName'); if(name){name.textContent=content.title||'';name.style.fontSize=`clamp(42px, ${Math.min(15,Math.max(9,Number(typo.titleSize||62)/6))}vw, ${Number(typo.titleSize||62)}px)`;name.style.display=content.title?'block':'none';}
  const tagline=document.getElementById('menuHeroTagline'); if(tagline){tagline.textContent=content.tagline||'';tagline.style.fontSize=`${Number(typo.taglineSize||15)}px`;tagline.style.display=content.tagline?'block':'none';}
  const since=document.getElementById('menuHeroSince'); if(since){since.textContent=content.since||'';since.style.fontSize=`${Number(typo.sinceSize||12)}px`;since.style.display=content.since?'flex':'none';}
  const preload=document.getElementById('heroPreload'); if(preload && c.imageUrl && preload.href!==c.imageUrl) preload.href=c.imageUrl;
}

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
    const imageUrl = escapeHtml(cat.imageUrl || '');
    const name = escapeHtml(cat.name || '');
    const encodedId = encodeURIComponent(String(cat.id || ''));
    const encodedMenuUrl = encodeURIComponent(String(cat.menuImageUrl || ''));
    const encodedName = encodeURIComponent(String(cat.name || ''));
    const onclick = cat.displayType === 'image'
      ? `openImageMenu(decodeURIComponent('${encodedMenuUrl}'),decodeURIComponent('${encodedName}'))`
      : `openCategory(decodeURIComponent('${encodedId}'))`;
    return `
      <div class="cat-card" onclick="${onclick}">
        <div class="cat-img-wrap">
          <img class="cat-img" src="${imageUrl}" alt="${name}" loading="lazy" decoding="async"/>
          <div class="cat-img-overlay"></div>
        </div>
        <div class="cat-body">
          <div class="cat-name">${name}</div>
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
      `<span class="prod-sizeprice-chip"><span class="sz-name">${escapeHtml(s.name || '')}</span><span class="sz-val">${escapeHtml(s.price)}</span> <span class="prod-currency">AED</span></span></span>`
    ).join('')}</div>`;
  }
  if (item.price !== undefined && item.price !== null)
    return `<div class="prod-price">${escapeHtml(item.price)}<span class="prod-currency">AED</span></div>`;
  return `<div class="prod-price dash">—</div>`;
}
function buildBadgeHTML(item) {
  if (item.sizePrices && item.sizePrices.length) {
    // في وضع الأحجام المتعددة، الأسعار كاملة بتتعرض تحت اسم الصنف بوضوح (وسط/كبير)، فمفيش داعي لبادچ ملخّص فوق الصورة ممكن يوهم إنه سعر واحد
    return '';
  }
  if (item.price !== undefined && item.price !== null)
    return `<div class="prod-badge">${escapeHtml(item.price)} <span class="badge-currency">AED</span></div>`;
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
        <img class="prod-img" src="${escapeHtml(item.imageUrl || '')}" alt="${escapeHtml(item.name || '')}" loading="lazy" decoding="async"/>
      </div>`;
    return card;
  }

  let extras = '';
  if (item.sizes && item.sizes.length) extras += `<div class="prod-sizes">${item.sizes.map(s => `<span class="prod-size-chip">${escapeHtml(s)}</span>`).join('')}</div>`;
  if (item.flavors && item.flavors.length) extras += `<div class="prod-flavors">${item.flavors.map(f => `<span class="prod-flavor-chip">${escapeHtml(f)}</span>`).join('')}</div>`;
  if (item.description) extras += `<div class="prod-note">${escapeHtml(item.description)}</div>`;
  let manaesh = '';
  if (item.manaeshTypes && item.manaeshTypes.length) manaesh = `<div class="manaesh-types">${item.manaeshTypes.map(t => `<span class="manaesh-chip">${escapeHtml(t)}</span>`).join('')}</div>`;
  card.innerHTML = `
    <div class="prod-img-wrap">
      <img class="prod-img" src="${escapeHtml(item.imageUrl || '')}" alt="${escapeHtml(item.name || '')}" loading="lazy" decoding="async"/>
      ${buildBadgeHTML(item)}
    </div>
    <div class="prod-body">
      <div>
        <div class="prod-name">${escapeHtml(item.name || '')}</div>
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
      ${allSections.map((s, i) => `<button class="section-tab${i === 0 ? ' active' : ''}" data-section="${escapeHtml(s.id)}">${escapeHtml(s.name)}</button>`).join('')}
    </div>
    ${allSections.map(s => `
      <div class="section-block" id="sec-${escapeHtml(s.id)}">
        <div class="section-block-title">${escapeHtml(s.name)}</div>
        <div class="products-grid" data-section="${escapeHtml(s.id)}"></div>
      </div>`).join('')}
  `;

  allSections.forEach(s => {
    const grid = wrap.querySelector(`.products-grid[data-section="${CSS.escape(String(s.id))}"]`);
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

/* ══════════════════════════════════════
   معرض الصور — النظام الأساسي المشترك
   عروضنا + حلويات غربية يستخدمان نفس تجربة المعرض.
══════════════════════════════════════ */
let galleryObserver = null;

const SECTION_PHRASES = {
  gallery: 'لحظات حلوة… تُرى قبل أن تُذاق.',
  offers: 'لسنا الوحيدين… لكننا نسعى دائمًا لنكون الأفضل. ❤️'
};


function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function offerIsLive(o) {
  const now = Date.now();
  if (o?.startAt) {
    const start = new Date(o.startAt).getTime();
    if (!Number.isNaN(start) && now < start) return false;
  }
  if (o?.endAt) {
    const end = new Date(o.endAt).getTime();
    if (!Number.isNaN(end) && now > end) return false;
  }
  return true;
}

function teardownOffersShowcase() {
  if (offersCountdownTimer) clearInterval(offersCountdownTimer);
  offersCountdownTimer = null;
  offersState = null;
}

function renderSectionIntro(type) {
  const text = SECTION_PHRASES[type] || '';
  if (!text) return '';
  return `<div class="section-gallery-intro" aria-hidden="true"><span>${text}</span></div>`;
}

function safeOfferActionUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(raw)) return raw;
  return '';
}

function offerDiscountPercentPublic(o) {
  if (o?.discountPercent != null && o.discountPercent !== '') {
    const n = Number(o.discountPercent);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  const orig = Number(o?.originalPrice), disc = Number(o?.discountPrice);
  if (orig > 0 && disc >= 0 && disc <= orig) return Math.round(((orig - disc) / orig) * 100);
  return null;
}

function formatOfferCountdown(ms) {
  if (ms <= 0) return 'انتهى العرض';
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return days > 0
    ? `${days} يوم ${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
    : `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
}

function updateOfferCountdowns(root) {
  root.querySelectorAll('[data-offer-countdown-end]').forEach(el => {
    const end = Number(el.dataset.offerCountdownEnd);
    if (!Number.isFinite(end)) return;
    el.textContent = formatOfferCountdown(end - Date.now());
  });
}

function renderGalleryView(wrap, images, options = {}) {
  const type = options.type || 'gallery';
  const isOffers = type === 'offers';
  const safeImages = Array.isArray(images) ? images.filter(Boolean) : [];

  wrap.classList.remove('products-grid', 'products-wrap');
  wrap.innerHTML = `
    <div class="gallery-experience ${isOffers ? 'offers-gallery-experience' : ''}">
      ${renderSectionIntro(type)}
      <div class="gallery-view" id="galleryView"></div>
    </div>`;

  const galleryEl = wrap.querySelector('#galleryView');

  if (!safeImages.length) {
    galleryEl.innerHTML = `<div class="gallery-empty">لسه مفيش صور مضافة هنا.</div>`;
    return;
  }

  galleryEl.innerHTML = safeImages.map((item, i) => {
    const url = isOffers ? (item.image || item.imageUrl || '') : item;
    if (!url) return '';

    if (isOffers && !item.photoOnly) {
      const title = item.titleAr || item.titleEn || '';
      const desc = item.descriptionAr || item.description || '';
      const price = item.discountPrice ?? '';
      const old = item.originalPrice ?? '';
      const pct = offerDiscountPercentPublic(item);
      const action = safeOfferActionUrl(item.ctaAction);
      const countdownEnd = item.countdownEnabled && item.endAt ? new Date(item.endAt).getTime() : NaN;
      const details = (title || desc || price !== '' || old !== '' || item.badge || item.subText || pct != null || item.limited || action || Number.isFinite(countdownEnd)) ? `
        <div class="offer-gallery-details">
          ${item.badge ? `<div class="offer-gallery-badge">${escapeHtml(item.badge)}</div>` : ''}
          ${title ? `<div class="offer-gallery-title">${escapeHtml(title)}</div>` : ''}
          ${desc ? `<div class="offer-gallery-desc">${escapeHtml(desc)}</div>` : ''}
          ${item.subText ? `<div class="offer-gallery-desc">${escapeHtml(item.subText)}</div>` : ''}
          ${(price !== '' || old !== '' || pct != null) ? `<div class="offer-gallery-price">
            ${old !== '' ? `<span class="offer-gallery-old">${escapeHtml(old)} AED</span>` : ''}
            ${price !== '' ? `<strong>${escapeHtml(price)} AED</strong>` : ''}
            ${pct != null ? `<span class="offer-gallery-discount">خصم ${escapeHtml(pct)}%</span>` : ''}
          </div>` : ''}
          ${item.limited ? `<div class="offer-gallery-limited">⚡ كمية محدودة</div>` : ''}
          ${Number.isFinite(countdownEnd) && countdownEnd > Date.now() ? `<div class="offer-gallery-countdown">⏳ <span data-offer-countdown-end="${countdownEnd}"></span></div>` : ''}
          ${action && item.ctaText ? `<a class="offer-gallery-cta" href="${escapeHtml(action)}" ${/^https?:/i.test(action) ? 'target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(item.ctaText)}</a>` : ''}
        </div>` : '';
      return `<div class="gallery-item offer-gallery-item has-offer-details" data-idx="${i}"><img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async"/>${details}</div>`;
    }

    return `<div class="gallery-item ${isOffers ? 'offer-gallery-item' : ''}" data-idx="${i}"><img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async"/></div>`;
  }).join('');

  galleryEl.querySelectorAll('img').forEach(img => setupImageLoading(img, fallbackImg));
  if (isOffers) {
    updateOfferCountdowns(galleryEl);
    if (galleryEl.querySelector('[data-offer-countdown-end]')) {
      if (offersCountdownTimer) clearInterval(offersCountdownTimer);
      offersCountdownTimer = setInterval(() => updateOfferCountdowns(galleryEl), 1000);
    }
  }
  galleryEl.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = +item.dataset.idx;
      if (isOffers) {
        const offer = safeImages[index];
        openImageMenu(offer.image || offer.imageUrl || '', offer.titleAr || offer.titleEn || '', safeImages.map(o => o.image || o.imageUrl || ''), index);
      } else {
        openImageMenu(safeImages[index], '', safeImages, index);
      }
    });
  });
  galleryEl.querySelectorAll('.offer-gallery-cta').forEach(btn => {
    btn.addEventListener('click', (e) => e.stopPropagation());
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
   عروضنا — نفس معرض الصور بالضبط
   مع تفاصيل اختيارية لكل عرض.
══════════════════════════════════════ */
function renderOffersShowcase(wrap) {
  const items = (liveState.offers || [])
    .filter(o => o.visible !== false)
    .filter(o => offerIsLive(o))
    .sort((a, b) => {
      const af = a.featured ? 0 : 1;
      const bf = b.featured ? 0 : 1;
      if (af !== bf) return af - bf;
      return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    });

  renderGalleryView(wrap, items, { type: 'offers' });
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
  document.getElementById('galleryBackBtn').style.display = (isGallery || isOffers) ? 'flex' : 'none';

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
    renderGalleryView(wrap, cat.galleryImages || [], { type: 'gallery' });
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
    ? `${item.sizePrices.map(s => `${escapeHtml(s.name || '')} ${escapeHtml(s.price)}`).join(' / ')} <span class="prod-currency">AED</span>`
    : ((item.price !== undefined && item.price !== null) ? `${item.price}<span class="prod-currency">AED</span>` : '—');

  const sizePricesBlock = document.getElementById('pd-sizeprices-block');
  if (hasSizePrices) {
    document.getElementById('pd-sizeprices-list').innerHTML = item.sizePrices.map(s =>
      `<div class="pd-sizeprice-row"><span class="pd-sizeprice-name">${escapeHtml(s.name || '')}</span><span class="pd-sizeprice-value">${escapeHtml(s.price)} <span class="prod-currency">AED</span></span></div>`
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
  if (item.sizes && item.sizes.length) chipsHtml += `<div class="prod-sizes">${item.sizes.map(s => `<span class="prod-size-chip">${escapeHtml(s)}</span>`).join('')}</div>`;
  if (item.flavors && item.flavors.length) chipsHtml += `<div class="prod-flavors">${item.flavors.map(f => `<span class="prod-flavor-chip">${escapeHtml(f)}</span>`).join('')}</div>`;
  if (item.manaeshTypes && item.manaeshTypes.length) chipsHtml += `<div class="manaesh-types">${item.manaeshTypes.map(t => `<span class="manaesh-chip">${escapeHtml(t)}</span>`).join('')}</div>`;
  document.getElementById('pd-chips').innerHTML = chipsHtml;

  const n = item.nutrition;
  const nutritionBlock = document.getElementById('pd-nutrition-block');
  if (n && (n.calories || n.protein || n.fat || n.carb)) {
    const grid = document.getElementById('pd-nutrition-grid');
    grid.innerHTML = [
      n.calories != null ? `<div class="pd-nutri-item"><div class="pd-nutri-value">${escapeHtml(n.calories)}</div><div class="pd-nutri-label">سعرة حرارية</div></div>` : '',
      n.protein != null ? `<div class="pd-nutri-item"><div class="pd-nutri-value">${escapeHtml(n.protein)}g</div><div class="pd-nutri-label">بروتين</div></div>` : '',
      n.fat != null ? `<div class="pd-nutri-item"><div class="pd-nutri-value">${escapeHtml(n.fat)}g</div><div class="pd-nutri-label">دهون</div></div>` : '',
      n.carb != null ? `<div class="pd-nutri-item"><div class="pd-nutri-value">${escapeHtml(n.carb)}g</div><div class="pd-nutri-label">كارب</div></div>` : '',
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
  renderHero();
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
window.addEventListener('hero-settings-updated', renderHero);

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
  // firebase-app.js owns the initial fetch through its single auth-state
  // listener. Doing another fetch here can race with the auth callback and
  // let a public (non-admin) snapshot overwrite the admin snapshot.
  startPolling();
  setTimeout(checkScrollIndicator, 600);
})();
