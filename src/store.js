/* ============ 数据层：方案模型 / 本地存储 / 图片库 / 内置数据 ============ */
'use strict';

const STORE_KEY = 'hainanTrip.v1';
const DAY_COLORS = ['#F97316', '#0EA5E9', '#10B981', '#8B5CF6', '#F43F5E', '#EAB308', '#06B6D4', '#84CC16', '#EC4899', '#14B8A6'];
const STOP_TYPES = {
  airport: { label: '机场', emoji: '✈️' },
  hotel:   { label: '住宿', emoji: '🏨' },
  scenic:  { label: '景点', emoji: '🏞️' },
  beach:   { label: '海湾', emoji: '🏖️' },
  food:    { label: '美食', emoji: '🍜' },
  town:    { label: '城镇', emoji: '🏘️' },
  gas:     { label: '加油', emoji: '⛽' },
  culture: { label: '人文', emoji: '🏛️' },
  other:   { label: '地点', emoji: '📍' },
};
const NOTE_TAGS = ['住宿', '美食', '加油', '避堵提醒', '门票', '亲子', '拍照', '购物', '贴士'];

/* ---------- 内置 POI 库（坐标为参考位置，可拖动微调；WGS-84） ---------- */
const POI_LIB = [
  { name: '三亚凤凰国际机场', type: 'airport', lng: 109.411, lat: 18.303, region: '三亚' },
  { name: '三亚湾（湾西段）', type: 'beach', lng: 109.478, lat: 18.252, region: '三亚' },
  { name: '三亚市区·解放路', type: 'town', lng: 109.509, lat: 18.253, region: '三亚' },
  { name: '大东海', type: 'beach', lng: 109.511, lat: 18.215, region: '三亚' },
  { name: '鹿回头公园', type: 'scenic', lng: 109.492, lat: 18.213, region: '三亚' },
  { name: '亚龙湾', type: 'beach', lng: 109.638, lat: 18.172, region: '三亚' },
  { name: '海棠湾', type: 'beach', lng: 109.730, lat: 18.310, region: '三亚' },
  { name: '蜈支洲岛码头·后海村', type: 'scenic', lng: 109.760, lat: 18.313, region: '三亚' },
  { name: '天涯海角', type: 'scenic', lng: 109.345, lat: 18.298, region: '三亚' },
  { name: '南山文化旅游区', type: 'scenic', lng: 109.199, lat: 18.291, region: '三亚' },
  { name: '大小洞天', type: 'scenic', lng: 109.135, lat: 18.283, region: '三亚' },
  { name: '崖州古城', type: 'culture', lng: 109.171, lat: 18.313, region: '三亚' },
  { name: '陵水·南湾猴岛/新村渔港', type: 'scenic', lng: 110.025, lat: 18.412, region: '陵水' },
  { name: '清水湾', type: 'beach', lng: 109.962, lat: 18.411, region: '陵水' },
  { name: '分界洲岛码头', type: 'scenic', lng: 110.010, lat: 18.585, region: '陵水' },
  { name: '香水湾', type: 'beach', lng: 110.045, lat: 18.553, region: '陵水' },
  { name: '陵水县城·椰林镇', type: 'town', lng: 110.037, lat: 18.505, region: '陵水' },
  { name: '日月湾（冲浪）', type: 'beach', lng: 110.222, lat: 18.655, region: '万宁' },
  { name: '石梅湾', type: 'beach', lng: 110.282, lat: 18.690, region: '万宁' },
  { name: '神州半岛', type: 'beach', lng: 110.333, lat: 18.702, region: '万宁' },
  { name: '兴隆华侨旅游经济区', type: 'town', lng: 110.193, lat: 18.726, region: '万宁' },
  { name: '万宁市区·万城镇', type: 'town', lng: 110.389, lat: 18.796, region: '万宁' },
  { name: '和乐镇', type: 'town', lng: 110.479, lat: 18.983, region: '万宁' },
  { name: '新群湾', type: 'beach', lng: 110.487, lat: 18.997, region: '万宁' },
  { name: '大花角', type: 'scenic', lng: 110.497, lat: 19.020, region: '万宁' },
  { name: '山钦湾', type: 'beach', lng: 110.455, lat: 18.852, region: '万宁' },
  { name: '龙滚镇', type: 'town', lng: 110.457, lat: 18.843, region: '万宁' },
  { name: '博鳌镇（琼海）', type: 'town', lng: 110.656, lat: 19.153, region: '琼海' },
  { name: '琼海市区·嘉积镇', type: 'town', lng: 110.474, lat: 19.242, region: '琼海' },
  { name: '五指山市区', type: 'town', lng: 109.517, lat: 18.776, region: '五指山' },
  { name: '五指山热带雨林·水满乡', type: 'scenic', lng: 109.662, lat: 18.888, region: '五指山' },
  { name: '阿陀岭盘山段（224国道）', type: 'scenic', lng: 109.545, lat: 18.732, region: '五指山' },
  { name: '保亭县城·保城镇', type: 'town', lng: 109.703, lat: 18.637, region: '保亭' },
  { name: '七仙岭温泉', type: 'scenic', lng: 109.687, lat: 18.668, region: '保亭' },
  { name: '呀诺达雨林', type: 'scenic', lng: 109.645, lat: 18.462, region: '保亭' },
  { name: '槟榔谷黎苗文化旅游区', type: 'culture', lng: 109.633, lat: 18.405, region: '保亭' },
  { name: '琼中县城·营根镇', type: 'town', lng: 109.842, lat: 19.033, region: '琼中' },
  { name: '白沙县城·牙叉镇', type: 'town', lng: 109.443, lat: 19.225, region: '白沙' },
];

/* ---------- 工厂函数 ---------- */
function newNote() { return { text: '', tags: [], links: [], images: [] }; }
function noteIsEmpty(n) { return !n || (!n.text && !(n.tags || []).length && !(n.links || []).length && !(n.images || []).length); }

function newStop(fields) {
  return Object.assign({
    id: uid('s'), name: '新地点', type: 'other', lng: 0, lat: 0, time: '',
    leg: null, note: newNote(),
  }, fields);
}
/* leg：从上一个停留点到本停留点的路线段 */
function newLeg(fields) {
  return Object.assign({ mode: 'draft', line: null, distKm: null, durMin: null, note: newNote() }, fields);
}

function newDay(fields) {
  return Object.assign({ id: uid('d'), date: '', title: '', lodging: '', note: '', stops: [] }, fields);
}

function newPlan(name) {
  return {
    id: uid('p'), name: name || '新方案', version: 1,
    startDate: '', endDate: '', travelers: '2 人', vehicle: '租车自驾',
    days: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

/* ---------- 默认方案 A（来自用户的 1.png 行程表） ---------- */
function seedPlanA() {
  const p = newPlan('方案A · 避堵版');
  p.startDate = '10/1'; p.endDate = '10/6';
  const P = (name) => POI_LIB.find(x => x.name === name);
  const mkStop = (poiName, extra) => {
    const poi = P(poiName);
    return newStop(Object.assign({ name: poi.name, type: poi.type, lng: poi.lng, lat: poi.lat }, extra || {}));
  };
  const mkLeg = (fields) => newLeg(fields);

  const d1 = newDay({ date: '10/1 周四', title: '抵达三亚', lodging: '三亚湾', note: '晚上抵达，只安排机场→酒店，不开长途。' });
  const sAirport = mkStop('三亚凤凰国际机场', { time: '航班到达', note: Object.assign(newNote(), { text: '取租车（机场柜台/停车场），检查车况并拍照留证。', tags: ['贴士'] }) });
  const sHotel1 = mkStop('三亚湾（湾西段）', { name: '三亚湾酒店', type: 'hotel', note: Object.assign(newNote(), { text: '入住+夜宵，海边散步。', tags: ['住宿'] }) });
  sHotel1.leg = mkLeg({});
  d1.stops = [sAirport, sHotel1];

  const d2 = newDay({ date: '10/2 周五', title: '东线·海岸线①', lodging: '万城', note: '早一点离开三亚，避开下午 G98 压力；沿岭-海湾慢线走，渔港+小海湾。' });
  const d2s1 = mkStop('崖州古城', { note: Object.assign(newNote(), { text: '崖州古城+文明门，顺路早市。', tags: ['人文', '拍照'] }) });
  d2s1.leg = mkLeg({ note: Object.assign(newNote(), { text: '出三亚走 G98 西段→转东线，尽量 9 点前过市区。', tags: ['避堵提醒'] }) });
  const d2s2 = mkStop('陵水·南湾猴岛/新村渔港', { note: Object.assign(newNote(), { text: '新村渔港 seafood + 疍家海上村庄。', tags: ['美食'] }) });
  d2s2.leg = mkLeg({});
  const d2s3 = mkStop('香水湾', { note: Object.assign(newNote(), { text: '小海湾停留拍照。', tags: ['拍照'] }) });
  d2s3.leg = mkLeg({});
  const d2s4 = mkStop('万宁市区·万城镇', { name: '万城镇·酒店', type: 'hotel', note: Object.assign(newNote(), { text: '连住两晚，行李不挪窝。', tags: ['住宿'] }) });
  d2s4.leg = mkLeg({});
  d2.stops = [d2s1, d2s2, d2s3, d2s4];

  const d3 = newDay({ date: '10/3 周六', title: '万宁小环线·海岸线②', lodging: '万城', note: '不走长途，避免日月湾互通；万宁北部小众海岸慢慢玩。' });
  const d3s1 = mkStop('龙滚镇', { note: Object.assign(newNote(), { text: '镇上午餐，本地小吃。', tags: ['美食'] }) });
  d3s1.leg = mkLeg({});
  const d3s2 = mkStop('山钦湾', { note: Object.assign(newNote(), { text: '礁石海岸，注意潮汐。', tags: ['拍照'] }) });
  d3s2.leg = mkLeg({});
  const d3s3 = mkStop('新群湾', { note: Object.assign(newNote(), { text: '渔村海湾，人少清静。', tags: ['拍照'] }) });
  d3s3.leg = mkLeg({});
  const d3s4 = mkStop('万宁市区·万城镇', { name: '万城镇·酒店（返回）', type: 'hotel', note: Object.assign(newNote(), { text: '原酒店返回入住。', tags: ['住宿'] }) });
  d3s4.leg = mkLeg({});
  d3.stops = [d3s1, d3s2, d3s3, d3s4];

  const d4 = newDay({ date: '10/4 周日', title: '进山·华侨文化', lodging: '五指山', note: '彻底离开 G98 东线，经兴隆走中线进山，午后多雨备雨具。' });
  const d4s1 = mkStop('兴隆华侨旅游经济区', { note: Object.assign(newNote(), { text: '兴隆咖啡+南洋风味，植物园逛一逛。', tags: ['美食', '贴士'] }) });
  d4s1.leg = mkLeg({ note: Object.assign(newNote(), { text: '万城→兴隆 走县道小线，避开 G98 主线。', tags: ['避堵提醒'] }) });
  const d4s2 = mkStop('五指山市区', { note: Object.assign(newNote(), { text: '山城市集，黎家菜晚餐。', tags: ['住宿', '美食'] }) });
  d4s2.leg = mkLeg({ note: Object.assign(newNote(), { text: '中线盘山（阿陀岭），弯多限速，天黑前翻山。', tags: ['避堵提醒', '贴士'] }) });
  d4.stops = [d4s1, d4s2];

  const d5 = newDay({ date: '10/5 周一', title: '雨林公路·黎苗文化', lodging: '三亚', note: '走中线回三亚，不碰万宁—陵水—三亚东线。' });
  const d5s1 = mkStop('保亭县城·保城镇', { note: Object.assign(newNote(), { text: '七仙岭温泉泡汤或槟榔谷黎苗文化，二选一。', tags: ['贴士', '门票'] }) });
  d5s1.leg = mkLeg({});
  const d5s2 = mkStop('三亚市区·解放路', { name: '三亚市区·酒店', type: 'hotel', note: Object.assign(newNote(), { text: '连住到最后，第一市场海鲜加工。', tags: ['住宿', '美食'] }) });
  d5s2.leg = mkLeg({ note: Object.assign(newNote(), { text: '假期尾段返程车流，午后出发避开傍晚高峰。', tags: ['避堵提醒'] }) });
  d5.stops = [d5s1, d5s2];

  const d6 = newDay({ date: '10/6 周二', title: '市内慢游·返程', lodging: '', note: '不安排跨城行程；预留还车+登机时间。' });
  const d6s1 = mkStop('大东海', { time: '上午', note: Object.assign(newNote(), { text: '海边最后闲逛+补手信。', tags: ['购物'] }) });
  const d6s2 = mkStop('三亚凤凰国际机场', { time: '航班前 3 小时', note: Object.assign(newNote(), { text: '还车（加满油/拍照留证）→值机。', tags: ['贴士'] }) });
  d6s2.leg = mkLeg({});
  d6.stops = [d6s1, d6s2];

  p.days = [d1, d2, d3, d4, d5, d6];
  return p;
}

/* ---------- 全局状态 ---------- */
const App = {
  plans: {},        // id -> Plan
  currentId: null,
  settings: { amapKey: '', amapJsCode: '', basemap: 'amap', speed: 45 },
  ui: { activeDayId: null, focusDayId: null },
  dirty: false,
};

function currentPlan() { return App.plans[App.currentId] || null; }
function dayColor(day) { return DAY_COLORS[currentPlan().days.indexOf(day) % DAY_COLORS.length]; }

function saveState() {
  App.plans[App.currentId] && (App.plans[App.currentId].updatedAt = new Date().toISOString());
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ plans: App.plans, currentId: App.currentId, settings: App.settings, ui: { activeDayId: App.ui.activeDayId } }));
    saveState.indicate();
  } catch (e) {
    console.error(e);
    toast('本地保存失败：存储空间可能已满', 'err');
  }
}
saveState.indicate = debounce(() => {
  const el = $('#save-indicator');
  if (el) { el.textContent = '● 已保存 ' + new Date().toTimeString().slice(0, 8); el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 1200); }
}, 150);
const requestSave = debounce(saveState, 600);

function loadState() {
  let raw = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch (e) { /* ignore */ }
  if (raw) {
    try {
      const data = JSON.parse(raw);
      Object.assign(App.plans, data.plans || {});
      App.currentId = data.currentId;
      Object.assign(App.settings, data.settings || {});
      Object.assign(App.ui, data.ui || {});
    } catch (e) { console.error('解析本地数据失败', e); }
  }
  if (!Object.keys(App.plans).length) {
    const p = seedPlanA();
    App.plans[p.id] = p;
    App.currentId = p.id;
    saveState();
  }
  if (!App.plans[App.currentId]) App.currentId = Object.keys(App.plans)[0];
  if (!App.ui.activeDayId) {
    const p = currentPlan();
    App.ui.activeDayId = p && p.days.length ? p.days[0].id : null;
  }
}

/* ---------- 统计 ---------- */
function legDraftLine(fromStop, toStop) { return [[fromStop.lng, fromStop.lat], [toStop.lng, toStop.lat]]; }

function legInfo(stop, prevStop, speed) {
  // 返回 {distKm, durMin, mode}
  const leg = stop.leg;
  if (!leg || !prevStop) return { distKm: 0, durMin: 0, mode: 'draft' };
  if (leg.mode === 'amap' && leg.distKm != null) {
    return { distKm: leg.distKm, durMin: leg.durMin != null ? leg.durMin : leg.distKm / (speed || 45) * 60, mode: 'amap' };
  }
  if (leg.mode === 'manual' && leg.line && leg.line.length > 1) {
    const km = polyLengthKm(leg.line) * 1.05;
    return { distKm: km, durMin: leg.durMin != null ? leg.durMin : km / (speed || 45) * 60, mode: 'manual' };
  }
  const km = haversineKm(legDraftLine(prevStop, stop)[0], legDraftLine(prevStop, stop)[1]) * 1.25;
  return { distKm: km, durMin: km / (speed || 45) * 60, mode: 'draft' };
}

function planStats(plan) {
  const speed = App.settings.speed || 45;
  let km = 0, min = 0, stops = 0;
  const counties = new Set();
  plan.days.forEach(d => d.stops.forEach((s, i) => {
    stops++;
    const c = countyOf(s.lng, s.lat); if (c) counties.add(c);
    if (i > 0) { const info = legInfo(s, d.stops[i - 1], speed); km += info.distKm; min += info.durMin; }
  }));
  return { km: Math.round(km), min: Math.round(min), stops, counties: counties.size };
}

/* ---------- 市县归属（点在多边形内，射线法） ---------- */
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function countyOf(lng, lat) {
  const feats = (window.HAINAN_GEO && HAINAN_GEO.features) || [];
  for (const f of feats) {
    const g = f.geometry; if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) if (pointInRing(lng, lat, poly[0])) return (f.properties && f.properties.name) || '';
  }
  return '';
}

/* ---------- IndexedDB 图片库 ---------- */
const ImgDB = (() => {
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('no idb'));
      const req = indexedDB.open('hainanTrip', 1);
      req.onupgradeneeded = () => { req.result.createObjectStore('images'); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      setTimeout(() => reject(new Error('idb timeout')), 5000);
    });
    return dbp;
  }
  async function tx(mode) { const db = await open(); return db.transaction('images', mode).objectStore('images'); }
  return {
    async put(id, record) { const st = await tx('readwrite'); return new Promise((res, rej) => { const r = st.put(record, id); r.onsuccess = res; r.onerror = () => rej(r.error); }); },
    async get(id) { try { const st = await tx('readonly'); return new Promise((res) => { const r = st.get(id); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); } catch (e) { return null; } },
    async del(id) { try { const st = await tx('readwrite'); st.delete(id); } catch (e) { } },
  };
})();

/* 本地文件 -> 压缩 blob（长边1600, jpeg 0.82） */
function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const max = 1600;
        let { width: w, height: h } = img;
        if (Math.max(w, h) > max) { const k = max / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        c.toBlob(blob => {
          URL.revokeObjectURL(url);
          blob ? resolve({ blob, w, h }) : reject(new Error('压缩失败'));
        }, 'image/jpeg', 0.82);
      } catch (e) { reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片读取失败')); };
    img.src = url;
  });
}

async function addImageToNote(note, file) {
  const { blob, w, h } = await compressImageFile(file);
  const id = uid('img');
  await ImgDB.put(id, { blob, w, h, name: file.name, addedAt: Date.now() });
  note.images.push({ kind: 'idb', id });
}

/* 收集方案里所有本地图 id */
function planImageIds(plan) {
  const ids = [];
  const scan = (note) => { if (!note) return; (note.images || []).forEach(im => { if (im.kind === 'idb') ids.push(im.id); }); };
  plan.days.forEach(d => { d.stops.forEach(s => { scan(s.note); if (s.leg) scan(s.leg.note); }); });
  return ids;
}

/* blob -> dataURL */
function blobToDataURL(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
}

/* ---------- 导出 / 导入 ---------- */
async function exportPlan(planId, withImages) {
  const plan = App.plans[planId];
  if (!plan) return;
  const payload = { app: 'hainan-trip', version: 1, exportedAt: new Date().toISOString(), plan: JSON.parse(JSON.stringify(plan)) };
  if (withImages) {
    const ids = planImageIds(plan);
    const images = {};
    for (const id of ids) {
      const rec = await ImgDB.get(id);
      if (rec) images[id] = { w: rec.w, h: rec.h, name: rec.name, data: await blobToDataURL(rec.blob) };
    }
    payload.images = images;
  }
  const json = JSON.stringify(payload, null, withImages ? 0 : 2);
  const safeName = (plan.name || '行程').replace(/[\\/:*?"<>|]/g, '_');
  downloadFile(`海南自驾-${safeName}.json`, new Blob([json], { type: 'application/json' }));
  toast('已导出 JSON' + (withImages && Object.keys(payload.images || {}).length ? `（含 ${Object.keys(payload.images).length} 张图片）` : ''));
}

async function importPlanPayload(payload) {
  if (!payload || payload.app !== 'hainan-trip' || !payload.plan) throw new Error('不是本工具导出的行程文件');
  const plan = payload.plan;
  if (!plan.id || !Array.isArray(plan.days)) throw new Error('文件内容不完整');
  const exists = !!App.plans[plan.id];
  for (const id of Object.keys(payload.images || {})) {
    const im = payload.images[id];
    try {
      const blob = await (await fetch(im.data)).blob();
      await ImgDB.put(id, { blob, w: im.w, h: im.h, name: im.name, addedAt: Date.now() });
    } catch (e) { console.warn('图片恢复失败', id, e); }
  }
  App.plans[plan.id] = plan;
  if (exists && !(await confirmDlg('覆盖方案', `本地已有同名方案「${plan.name}」，导入将覆盖它。继续？`, '覆盖'))) {
    plan.id = uid('p');
    App.plans[plan.id] = plan;
  }
  App.currentId = plan.id;
  App.ui.activeDayId = plan.days.length ? plan.days[0].id : null;
  App.ui.focusDayId = null;
  saveState();
  return plan;
}
