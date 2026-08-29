/* ============ 工具函数 ============ */
'use strict';

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

let _uidCounter = 0;
function uid(prefix) {
  _uidCounter = (_uidCounter + 1) % 1e7;
  return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7) + _uidCounter.toString(36);
}

/* HTML 转义（所有用户内容渲染前必须过一遍） */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function debounce(fn, ms) {
  let t = null;
  const wrapped = function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
  wrapped.flush = function () { clearTimeout(t); fn(); };
  return wrapped;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

/* 两点球面距离（千米），输入 [lng,lat] WGS84 */
function haversineKm(a, b) {
  const R = 6371.0, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function polyLengthKm(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversineKm(pts[i - 1], pts[i]);
  return d;
}

/* 折线抽稀（运行时给手绘多余点用） */
function simplifyDP(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const dist = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let dmax = -1, idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = dist(pts[k], pts[i], pts[j]);
      if (d > dmax) { dmax = d; idx = k; }
    }
    if (dmax > tol) { keep[idx] = true; stack.push([i, idx], [idx, j]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/* ---------- WGS-84 <-> GCJ-02 火星坐标系转换 ---------- */
const GCJ = (() => {
  const A = 6378245.0, EE = 0.00669342162296594323;
  const inChina = (lng, lat) => lng > 72.004 && lng < 137.8347 && lat > 0.8293 && lat < 55.8271;
  const tLat = (x, y) => {
    let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
    r += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
    r += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
    return r;
  };
  const tLng = (x, y) => {
    let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
    r += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
    r += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
    return r;
  };
  function wgs2gcj(lng, lat) {
    if (!inChina(lng, lat)) return [lng, lat];
    let dLat = tLat(lng - 105, lat - 35), dLng = tLng(lng - 105, lat - 35);
    const radLat = lat / 180 * Math.PI;
    let magic = Math.sin(radLat); magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180) / ((A * (1 - EE)) / (magic * sqrtMagic) * Math.PI);
    dLng = (dLng * 180) / (A / sqrtMagic * Math.cos(radLat) * Math.PI);
    return [lng + dLng, lat + dLat];
  }
  function gcj2wgs(lng, lat) {
    let wlng = lng, wlat = lat;
    for (let i = 0; i < 3; i++) {
      const g = wgs2gcj(wlng, wlat);
      wlng -= g[0] - lng; wlat -= g[1] - lat;
    }
    return [wlng, wlat];
  }
  return { wgs2gcj, gcj2wgs };
})();

/* ---------- Toast 轻提示 ---------- */
function toast(msg, type) {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + (type || '');
  t.textContent = msg;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 2600);
}

/* ---------- 确认对话框（Promise） ---------- */
function confirmDlg(title, text, okLabel) {
  return new Promise(resolve => {
    const m = showModal(`
      <h3>${esc(title)}</h3>
      <div class="modal-body"><p class="confirm-text">${esc(text)}</p></div>
      <div class="modal-foot">
        <button class="btn" data-act="cancel">取消</button>
        <button class="btn btn-danger" data-act="ok">${esc(okLabel || '确定')}</button>
      </div>`, { small: true });
    m.querySelector('[data-act="cancel"]').onclick = () => { closeModal(); resolve(false); };
    m.querySelector('[data-act="ok"]').onclick = () => { closeModal(); resolve(true); };
  });
}

/* ---------- 通用模态框 ---------- */
function showModal(html, opts) {
  opts = opts || {};
  let wrap = $('#modal-overlay');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'modal-overlay';
    document.body.appendChild(wrap);
  }
  wrap.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'modal-card' + (opts.small ? ' small' : '') + (opts.wide ? ' wide' : '');
  card.innerHTML = `<button class="modal-close" title="关闭">✕</button>` + html;
  wrap.appendChild(card);
  wrap.classList.add('show');
  card.querySelector('.modal-close').onclick = () => closeModal();
  wrap.onmousedown = (e) => { if (e.target === wrap && !opts.locked) closeModal(); };
  return card;
}
function closeModal() {
  const wrap = $('#modal-overlay');
  if (wrap) { wrap.classList.remove('show'); wrap.innerHTML = ''; }
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---------- 文件下载 ---------- */
function downloadFile(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
