/* ══════════════════════════════════════

   kiosk-app.js — منطق عرض المنيو (للعرض فقط)

   تجربة Kiosk premium: تصفح سريع، بحث، مفضلات، آخر مشاهدة، وتكبير الصور.

   الأدمن بقى في صفحة منفصلة: admin.html

══════════════════════════════════════ */

import {

  liveState, setCallbacks, fetchMenuData, startPolling,

} from "./firebase-app.js";



const fallbackImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23F5EDE3'/%3E%3Ccircle cx='200' cy='120' r='45' fill='%23EAD9C5'/%3E%3Ctext x='200' y='195' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%23B07040'%3Eالصورة غير متاحة%3C/text%3E%3C/svg%3E";

const CAT_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='260' viewBox='0 0 400 260'%3E%3Crect width='400' height='260' fill='%23EAD9C5'/%3E%3Ccircle cx='200' cy='110' r='40' fill='%23D4A830' opacity='0.3'/%3E%3Ctext x='200' y='165' text-anchor='middle' font-family='sans-serif' font-size='13' fill='%23B07040'%3Eلا توجد صورة%3C/text%3E%3C/svg%3E";



const $ = (id) => document.getElementById(id);

const htmlEscape = (value) => String(value == null ? '' : value)

  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const imageFor = (item, fallback = fallbackImg) => item?.imageUrl || fallback;



function setupImageLoading(img, fallback) {

  const done = () => img.classList.add('img-loaded');

  const fail = () => {
