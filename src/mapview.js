/* ============ 地图层：Leaflet / 底图 / 图层渲染 / 手绘 / 高德算路 ============ */
'use strict';

/* DataV 边界数据的坐标系（true=WGS84，需要时转 GCJ 显示）。浏览器实测后可翻转。 */
const DATAV_WGS84 = true;

const BASEMAPS = {
  amap: { name: '高德', gcj: true, make: () => L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', { subdomains: '1234', maxZoom: 18, attribution: '© 高德地图' }) },
  sat: {
    name: '卫星', gcj: true, make: () => L.layerGroup([
      L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', { subdomains: '1234', maxZoom: 18, attribution: '© 高德地图 影像' }),
      L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}', { subdomains: '1234', maxZoom: 18, opacity: 0.85 }),
    ]),
  },
};

const MV = {
  map: null,
  tiles: null,
  counties: null,
  dayGroups: {},     // dayId -> L.layerGroup
  islandBounds: null,
  addMode: false,
  draw: null,        // {dayId, stopId, pts: [wgs...]}
};

function gcjTiles() { const b = BASEMAPS[App.settings.basemap] || BASEMAPS.amap; return b.gcj; }
/* 存储坐标(WGS84) -> 地图显示坐标 */
function mapLL(lng, lat) {
  if (gcjTiles()) { const g = GCJ.wgs2gcj(lng, lat); return L.latLng(g[1], g[0]); }
  return L.latLng(lat, lng);
}
/* 地图点击坐标 -> 存储 WGS84 */
function fromMap(latLng) {
  if (gcjTiles()) { const w = GCJ.gcj2wgs(latLng.lng, latLatFix(latLng)); return { lng: w[0], lat: w[1] }; }
  return { lng: latLng.lng, lat: latLng.lat };
}
function latLatFix(o) { return o.lat; }

/* ---------- 初始化 ---------- */
MV.init = function () {
  MV.map = L.map('map', {
    zoomControl: false, minZoom: 8, maxZoom: 18,
    maxBounds: L.latLngBounds([14.5, 104.0], [23.5, 114.0]),
    maxBoundsViscosity: 0.7, attributionControl: true,
  });
  MV.map.attributionControl.setPrefix(false);
  L.control.zoom({ position: 'bottomright' }).addTo(MV.map);
  L.control.scale({ position: 'bottomleft', imperial: false }).addTo(MV.map);
  MV.map.createPane('counties'); MV.map.getPane('counties').style.zIndex = 300;
  MV.map.createPane('routes'); MV.map.getPane('routes').style.zIndex = 380;

  // 海岛范围（排除三沙市——其辖区覆盖整个南海，会撑爆取景框）
  let minX = 999, minY = 999, maxX = -999, maxY = -999;
  const walk = (c) => { if (typeof c[0] === 'number') { minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); } else c.forEach(walk); };
  walk(mainlandFeatures().map(f => f.geometry.coordinates));
  MV.islandBounds = [[minY, minX], [maxY, maxX]];

  MV.setBasemap(App.settings.basemap || 'amap');

  MV.map.on('click', (e) => {
    if (MV.addMode) { MV.addMode = false; $('#map').classList.remove('crosshair'); updateToolStates(); Panel.addStopAt(e.latlng); return; }
    if (MV.draw) { MV.draw.pts.push([fromMap(e.latlng).lng, fromMap(e.latlng).lat]); MV.renderDrawPreview(); }
  });
  MV.map.on('dblclick', () => { if (MV.draw) { MV.finishDraw(); } });
  Search.bind();
  MV.map.on('popupopen', (e) => {
    const el = e.popup.getElement();
    $$('[data-act]', el).forEach(btn => {
      btn.onclick = () => {
        const { act, day, stop } = btn.dataset;
        const found = findStop(day, stop);
        if (!found) return;
        if (act === 'edit-stop') Panel.openStopEditor(day, stop);
        else if (act === 'add-after') Panel.addStopAfter(found);
        else if (act === 'edit-leg') Panel.openLegEditor(day, stop);
        else if (act === 'draw-leg') MV.enterDraw(day, stop);
        else if (act === 'route-leg') Panel.amapRoute(found);
        else if (act === 'clear-leg') { found.stop.leg = newLeg({ note: found.stop.leg ? found.stop.leg.note : newNote() }); requestSave(); MV.renderAll(); Panel.render(); toast('已恢复为草稿直线'); }
      };
    });
  });
};

/* 主岛市县要素（排除三沙市） */
function mainlandFeatures() {
  return ((window.HAINAN_GEO && HAINAN_GEO.features) || []).filter(f => {
    const n = (f.properties && f.properties.name) || '';
    return !n.includes('三沙');
  });
}

function findStop(dayId, stopId) {
  const p = currentPlan(); if (!p) return null;
  const day = p.days.find(d => d.id === dayId); if (!day) return null;
  const idx = day.stops.findIndex(s => s.id === stopId); if (idx < 0) return null;
  return { day, stop: day.stops[idx], index: idx, prev: idx > 0 ? day.stops[idx - 1] : null, plan: p };
}

/* ---------- 底图 ---------- */
MV.setBasemap = function (key) {
  if (!BASEMAPS[key]) key = 'amap';
  App.settings.basemap = key;
  if (MV.tiles) MV.map.removeLayer(MV.tiles);
  MV.tiles = BASEMAPS[key].make().addTo(MV.map);
  $$('#basemap-switcher button').forEach(b => b.classList.toggle('on', b.dataset.bm === key));
  if (MV.counties) MV.renderCounties();
  MV.renderAll();
  requestSave();
};

/* ---------- 市县图层 ---------- */
function txGeoCoords(c) {
  if (Array.isArray(c[0])) return c.map(txGeoCoords);
  return gcjTiles() ? (DATAV_WGS84 ? GCJ.wgs2gcj(c[0], c[1]) : [c[0], c[1]]) : (DATAV_WGS84 ? [c[0], c[1]] : GCJ.gcj2wgs(c[0], c[1]));
}
MV.renderCounties = function () {
  if (MV.counties) { MV.map.removeLayer(MV.counties); MV.counties = null; }
  const geo = { type: 'FeatureCollection', features: HAINAN_GEO.features.map(f => ({ type: 'Feature', properties: f.properties, geometry: { type: f.geometry.type, coordinates: txGeoCoords(f.geometry.coordinates) } })) };
  const styleFor = f => {
    const name = f.properties.name || '';
    const touched = countyStopCount(name) > 0;
    return { color: '#0B7A8F', weight: 1.8, opacity: 0.8, dashArray: '5 4', fillColor: touched ? '#14B8A6' : '#38BDF8', fillOpacity: touched ? 0.22 : 0.12 };
  };
  MV.counties = L.geoJSON(geo, {
    pane: 'counties', style: styleFor,
    onEachFeature: (f, layer) => {
      layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.32, weight: 2 }));
      layer.on('mouseout', () => MV.counties.resetStyle(layer));
      layer.on('click', () => layer.bindPopup(countyPopupHtml(f.properties.name)).openPopup());
    },
  }).addTo(MV.map);
};
function countyStopCount(name) {
  const p = currentPlan(); if (!p) return 0;
  let n = 0;
  p.days.forEach(d => d.stops.forEach(s => { if (countyOf(s.lng, s.lat) === name) n++; }));
  return n;
}
function countyPopupHtml(name) {
  const p = currentPlan(); if (!p) return '';
  const rows = [];
  p.days.forEach((d, di) => d.stops.forEach(s => {
    if (countyOf(s.lng, s.lat) === name) rows.push(`<span class="cp-item"><i style="background:${dayColor(d)}"></i>D${di + 1} ${esc(s.name)}</span>`);
  }));
  return `<div class="county-pop"><b>🏛️ ${esc(name)}</b><div class="cp-tip">${rows.length ? '本方案经过：' : '当前方案未涉及'}</div><div class="cp-list">${rows.join('')}</div></div>`;
}

/* ---------- 路线 & 停留点 ---------- */
MV.renderAll = function () {
  if (!MV.map || !currentPlan()) return;
  Object.values(MV.dayGroups).forEach(g => MV.map.removeLayer(g));
  MV.dayGroups = {};
  const p = currentPlan();
  let n = 0;
  p.days.forEach((d, di) => {
    const group = L.layerGroup().addTo(MV.map);
    MV.dayGroups[d.id] = group;
    const dim = App.ui.focusDayId && App.ui.focusDayId !== d.id;
    const color = DAY_COLORS[di % DAY_COLORS.length];
    d.stops.forEach((s, i) => {
      n++;
      const myNum = n;
      if (i > 0 && d.stops[i - 1]) {
        const leg = s.leg || newLeg();
        let line, draft = false;
        if (leg.mode !== 'draft' && leg.line && leg.line.length > 1) line = leg.line;
        else { line = legDraftLine(d.stops[i - 1], s); draft = true; }
        const pts = line.map(c => mapLL(c[0], c[1]));
        const base = { pane: 'routes', color: '#FFFFFF', weight: draft ? 5 : 7, opacity: dim ? 0.25 : 0.9 };
        L.polyline(pts, base).addTo(group);
        const main = L.polyline(pts, draft
          ? { pane: 'routes', color: '#8A9BA8', weight: 3, dashArray: '7 8', opacity: dim ? 0.25 : 1, className: dim ? '' : 'route-draft' }
          : { pane: 'routes', color, weight: 4, opacity: dim ? 0.25 : 1, className: dim ? '' : 'route-flow' });
        main.on('click', () => MV.openLegPopup(d, s, draft));
        main.addTo(group);
      }
      const ll = mapLL(s.lng, s.lat);
      const icon = L.divIcon({
        className: '',
        html: `<div class="stop-marker ${dim ? 'dim' : ''} ${n === 1 ? 'origin' : ''}" style="--c:${color}"><span>${n}</span><em>${(STOP_TYPES[s.type] || STOP_TYPES.other).emoji}</em></div>`,
        iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -16],
      });
      const mk = L.marker(ll, { icon, draggable: !dim && !MV.draw, autoPan: true });
      mk.on('dragstart', () => { MV._dragOrigin = mk.getLatLng(); });
      mk.on('dragend', () => {
        const origin = MV._dragOrigin; MV._dragOrigin = null;
        const cur = mk.getLatLng();
        // 像素位移阈值：滤掉无障碍合成事件等造成的"零距离拖动"，避免静默改写坐标
        const z = MV.map.getZoom();
        const p1 = MV.map.project(origin, z), p2 = MV.map.project(cur, z);
        if (!origin || Math.hypot(p1.x - p2.x, p1.y - p2.y) < 10) { mk.setLatLng(origin || cur); return; }
        const w = fromMap(cur);
        s.lng = w.lng; s.lat = w.lat;
        requestSave(); MV.renderAll(); Panel.render();
      });
      mk.on('click', () => mk.bindPopup(MV.stopPopupHtml(d, di, s, myNum), { maxWidth: 320 }).openPopup());
      mk.addTo(group);
    });
  });
};

MV.stopPopupHtml = function (day, di, s, num) {
  const t = STOP_TYPES[s.type] || STOP_TYPES.other;
  const tags = (s.note.tags || []).map(x => `<span class="mini-tag">${esc(x)}</span>`).join('');
  const snip = s.note.text ? `<div class="pop-note">${esc(s.note.text.slice(0, 90))}${s.note.text.length > 90 ? '…' : ''}</div>` : '';
  const links = (s.note.links || []).length ? `<div class="pop-meta">🔗 ${s.note.links.length} 个链接</div>` : '';
  const imgs = (s.note.images || []).length ? `<div class="pop-meta">📷 ${s.note.images.length} 张图片</div>` : '';
  return `<div class="stop-pop">
    <div class="pop-head"><b>#${num} ${t.emoji} ${esc(s.name)}</b><span class="pop-day" style="background:${dayColor(day)}">D${di + 1}</span></div>
    <div class="pop-meta">${t.label}${s.time ? ' · ⏰ ' + esc(s.time) : ''}</div>
    ${tags ? `<div class="pop-tags">${tags}</div>` : ''}
    ${snip}${links}${imgs}
    <div class="pop-btns">
      <button class="btn btn-xs" data-act="edit-stop" data-day="${day.id}" data-stop="${s.id}">✏️ 编辑</button>
      <button class="btn btn-xs" data-act="add-after" data-day="${day.id}" data-stop="${s.id}">➕ 此后加点</button>
    </div></div>`;
};

MV.openLegPopup = function (day, stop, draft) {
  const found = findStop(day.id, stop.id); if (!found || !found.prev) return;
  const info = legInfo(stop, found.prev, App.settings.speed);
  const modeName = { draft: '✏️ 草稿直线', manual: '🖋️ 手绘', amap: '⚡ 高德算路' }[info.mode];
  const note = stop.leg && stop.leg.note;
  const tags = note && note.tags ? note.tags.map(x => `<span class="mini-tag">${esc(x)}</span>`).join('') : '';
  const snip = note && note.text ? `<div class="pop-note">${esc(note.text.slice(0, 80))}${note.text.length > 80 ? '…' : ''}</div>` : '';
  const keyHint = !App.settings.amapKey ? '（未配置 Key）' : '';
  MV.map.openPopup(`<div class="stop-pop">
    <div class="pop-head"><b>🛣️ ${esc(found.prev.name)} → ${esc(stop.name)}</b></div>
    <div class="pop-meta">${modeName} · 约 ${info.distKm.toFixed(1)} km · ~${Math.round(info.durMin)} 分钟</div>
    ${tags ? `<div class="pop-tags">${tags}</div>` : ''}${snip}
    <div class="pop-btns">
      <button class="btn btn-xs" data-act="route-leg" data-day="${day.id}" data-stop="${stop.id}">⚡ 高德算路${keyHint}</button>
      <button class="btn btn-xs" data-act="draw-leg" data-day="${day.id}" data-stop="${stop.id}">🖋️ 手绘</button>
      <button class="btn btn-xs" data-act="edit-leg" data-day="${day.id}" data-stop="${stop.id}">✏️ 贴士</button>
      ${!draft ? `<button class="btn btn-xs" data-act="clear-leg" data-day="${day.id}" data-stop="${stop.id}">↺ 恢复草稿</button>` : ''}
    </div></div>`, mapLL((found.prev.lng + stop.lng) / 2, (found.prev.lat + stop.lat) / 2), { maxWidth: 340 });
};

/* ---------- 添加地点模式 ---------- */
MV.toggleAddMode = function () {
  MV.addMode = !MV.addMode;
  if (MV.addMode && MV.draw) MV.exitDraw();
  $('#map').classList.toggle('crosshair', MV.addMode);
  updateToolStates();
  if (MV.addMode) toast('点击地图放置新停留点（再次点击按钮取消）');
};
function updateToolStates() {
  const b = $('#btn-add-stop'); if (b) b.classList.toggle('on', MV.addMode);
  const d = $('#btn-add-poi'); if (d) d.classList.remove('on');
}

/* ---------- 手绘路线 ---------- */
MV.enterDraw = function (dayId, stopId) {
  const found = findStop(dayId, stopId); if (!found || !found.prev) { toast('该点之前没有出发地'); return; }
  closeModal();
  MV.draw = { dayId, stopId, pts: [] };
  MV.addMode = false; $('#map').classList.remove('crosshair');
  $('#drawbar').hidden = false;
  MV.renderDrawPreview();
  const c = [(found.prev.lng + found.stop.lng) / 2, (found.prev.lat + found.stop.lat) / 2];
  MV.map.fitBounds(L.latLngBounds(mapLL(found.prev.lng, found.prev.lat), mapLL(found.stop.lng, found.stop.lat)).pad(0.4), { maxZoom: 14 });
  MV.map.panTo(mapLL(c[0], c[1]));
  toast('沿路点击打点，双击或点“完成”结束');
};
MV.renderDrawPreview = function () {
  const found = findStop(MV.draw.dayId, MV.draw.stopId); if (!found) return;
  const all = [found.prev, ...MV.draw.pts.map(p => ({ lng: p[0], lat: p[1] })), found.stop];
  const pts = all.map(s => mapLL(s.lng, s.lat));
  if (MV._drawLayer) MV.map.removeLayer(MV._drawLayer);
  MV._drawLayer = L.layerGroup([
    L.polyline(pts, { pane: 'routes', color: '#fff', weight: 7, opacity: 0.9 }),
    L.polyline(pts, { pane: 'routes', color: '#F43F5E', weight: 4, dashArray: '2 7', className: 'route-flow' }),
    ...MV.draw.pts.map(p => L.circleMarker(mapLL(p[0], p[1]), { radius: 4, color: '#fff', weight: 2, fillColor: '#F43F5E', fillOpacity: 1 })),
  ]).addTo(MV.map);
  $('#draw-count').textContent = `${MV.draw.pts.length} 个途经点`;
};
MV.finishDraw = function () {
  const found = findStop(MV.draw.dayId, MV.draw.stopId); if (!found) { MV.exitDraw(); return; }
  let line = [[found.prev.lng, found.prev.lat], ...MV.draw.pts, [found.stop.lng, found.stop.lat]];
  line = simplifyDP(line, 0.0004);
  found.stop.leg = found.stop.leg || newLeg();
  found.stop.leg.mode = 'manual';
  found.stop.leg.line = line;
  found.stop.leg.distKm = null; found.stop.leg.durMin = null;
  requestSave(); MV.exitDraw(); MV.renderAll(); Panel.render();
  toast('手绘路线已保存，可在“贴士”里补充备注');
};
MV.exitDraw = function () {
  MV.draw = null;
  $('#drawbar').hidden = true;
  if (MV._drawLayer) { MV.map.removeLayer(MV._drawLayer); MV._drawLayer = null; }
};

/* ---------- 地图搜索（高德 POI） ---------- */
const Search = { items: [], preview: null };

function guessStopType(t) {
  t = t || '';
  if (t.includes('酒店') || t.includes('宾馆') || t.includes('民宿') || t.includes('住宿')) return 'hotel';
  if (t.includes('餐饮') || t.includes('美食') || t.includes('餐厅') || t.includes('小吃')) return 'food';
  if (t.includes('加油') || t.includes('充电')) return 'gas';
  if (t.includes('景点') || t.includes('风景') || t.includes('公园') || t.includes('旅游') || t.includes('景区')) return 'scenic';
  if (t.includes('海滩') || t.includes('海湾') || t.includes('浴场')) return 'beach';
  return 'other';
}

Search.bind = function () {
  $('#search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Search.run();
    if (e.key === 'Escape') { $('#search-results').hidden = true; e.target.blur(); }
  });
  $('#search-results').addEventListener('click', (e) => {
    const item = e.target.closest('.search-item');
    if (item) Search.pick(+item.dataset.i);
  });
  document.addEventListener('click', (e) => {
    const box = $('#search-box');
    if (box && !box.contains(e.target)) { const r = $('#search-results'); if (r) r.hidden = true; }
  });
};

Search.run = function () {
  const kw = $('#search-input').value.trim();
  if (!kw) return;
  if (!App.settings.amapKey) {
    Panel.openSettings('搜索功能需要高德 Key（免费，约 5 分钟）：填写后即可搜索全国地名 / 酒店 / 景区并精准定位');
    return;
  }
  const box = $('#search-results');
  box.hidden = false;
  box.innerHTML = '<div class="search-empty">搜索中…</div>';
  ensureAMap().then(() => {
    AMap.plugin('AMap.PlaceSearch', () => {
      const ps = new AMap.PlaceSearch({ city: '海南省', citylimit: true, pageSize: 8, extensions: 'base' });
      ps.search(kw, (status, result) => {
        if (status === 'complete' && result.poiList && result.poiList.pois && result.poiList.pois.length) {
          Search.items = result.poiList.pois;
          box.innerHTML = Search.items.map((p, i) => `
            <div class="search-item" data-i="${i}">
              <div class="si-name">${esc(p.name)}</div>
              <div class="si-addr">${esc([p.district, p.address].filter(Boolean).join(' '))}</div>
            </div>`).join('');
        } else if (status === 'complete') {
          box.innerHTML = '<div class="search-empty">未找到相关地点，换个关键词试试</div>';
        } else {
          const info = (result && result.info) || status || '未知错误';
          box.innerHTML = `<div class="search-empty">搜索失败：${esc(String(info))}${String(info).includes('INVALID_USER_KEY') ? '<br>（Key 或安全密钥不正确，请到设置里检查）' : ''}</div>`;
        }
      });
    });
  }).catch(e => { box.hidden = true; toast(String(e.message || e), 'err'); });
};

Search.pick = function (i) {
  const p = Search.items[i]; if (!p || !p.location) return;
  const w = GCJ.gcj2wgs(p.location.lng, p.location.lat);
  $('#search-results').hidden = true;
  Search.showPreview({ name: p.name, address: [p.district, p.address].filter(Boolean).join(' '), lng: w[0], lat: w[1], type: guessStopType(p.type) });
};

Search.showPreview = function (poi) {
  Search.clearPreview();
  const ll = mapLL(poi.lng, poi.lat);
  Search.preview = L.marker(ll, {
    icon: L.divIcon({ className: '', html: '<div class="poi-preview">📍</div>', iconSize: [34, 34], iconAnchor: [17, 32] }),
  }).addTo(MV.map);
  MV.map.flyTo(ll, Math.max(MV.map.getZoom(), 13), { duration: 0.8 });
  const opts = currentPlan().days.map((d, di) =>
    `<optgroup label="D${di + 1} ${esc(d.title || d.date || '')}">` +
    d.stops.map(s => `<option value="${d.id}|${s.id}">${esc(s.name)}</option>`).join('') +
    `</optgroup>`).join('');
  Search.preview.bindPopup(`
    <div class="stop-pop">
      <div class="pop-head"><b>📍 ${esc(poi.name)}</b></div>
      <div class="pop-meta">${esc(poi.address || '（无地址信息）')}</div>
      <div class="pop-btns">
        <button class="btn btn-xs btn-primary" id="sp-add">➕ 添加为停留点</button>
      </div>
      <div class="pop-fixrow">
        <select id="sp-target" title="选择要修正位置的现有停留点">${opts || '<option value="">暂无停留点</option>'}</select>
        <button class="btn btn-xs" id="sp-fix">📍 修正该点</button>
      </div>
      <div class="hint" style="margin-top:5px">「修正」会把所选停留点移动到当前精准坐标，其前后路线段恢复为草稿</div>
    </div>`, { offset: [0, -34], maxWidth: 320 }).openPopup();
  MV.map.once('popupclose', () => Search.clearPreview());
  const el = Search.preview.getPopup().getElement();
  el.querySelector('#sp-add').onclick = () => Search.applyAdd(poi);
  el.querySelector('#sp-fix').onclick = () => {
    const v = el.querySelector('#sp-target').value;
    if (v) Search.applyFix(v, poi);
  };
};

Search.applyAdd = function (poi) {
  const p = currentPlan();
  let day = p.days.find(d => d.id === App.ui.activeDayId);
  if (!day) { day = newDay({ title: '新的一天' }); p.days.push(day); App.ui.activeDayId = day.id; }
  const s = newStop({ name: poi.name, type: poi.type, lng: poi.lng, lat: poi.lat });
  if (day.stops.length) s.leg = newLeg();
  day.stops.push(s);
  Search.clearPreview();
  requestSave(); Panel.render(); MV.renderAll();
  toast(`已添加「${poi.name}」到 D${p.days.indexOf(day) + 1}`);
};

Search.applyFix = function (v, poi) {
  const [dayId, stopId] = v.split('|');
  const f = findStop(dayId, stopId); if (!f) return;
  f.stop.lng = poi.lng; f.stop.lat = poi.lat;
  f.stop.leg = newLeg({ note: f.stop.leg ? f.stop.leg.note : newNote() });
  const next = f.day.stops[f.index + 1];
  if (next) next.leg = newLeg({ note: next.leg ? next.leg.note : newNote() });
  Search.clearPreview();
  requestSave(); MV.renderAll(); Panel.render();
  toast(`已将「${f.stop.name}」修正到「${poi.name}」的精准位置`);
};

Search.clearPreview = function () {
  if (Search.preview) { MV.map.removeLayer(Search.preview); Search.preview = null; }
};

/* ---------- 视角 ---------- */
MV.fitAll = function () {
  App.ui.focusDayId = null; MV.renderAll(); Panel.render();
  MV.map.fitBounds(MV.islandBounds, { padding: [30, 30] });
};
MV.focusDay = function (dayId) {
  const p = currentPlan();
  if (App.ui.focusDayId === dayId) { MV.fitAll(); return; }
  const day = p.days.find(d => d.id === dayId); if (!day || !day.stops.length) { App.ui.focusDayId = dayId; MV.renderAll(); Panel.render(); return; }
  App.ui.focusDayId = dayId; MV.renderAll(); Panel.render();
  const pts = day.stops.map(s => mapLL(s.lng, s.lat));
  MV.map.fitBounds(L.latLngBounds(pts).pad(0.35), { maxZoom: 13 });
};

/* ---------- 高德 JS API（懒加载 + 算路） ---------- */
const AMapS = { loading: null };
function ensureAMap(force) {
  if (window.AMap && !force) return Promise.resolve();
  const key = (App.settings.amapKey || '').trim();
  if (!key) return Promise.reject(new Error('未配置高德 Key：请先在“设置”里填写'));
  if (AMapS.loading && !force) return AMapS.loading;
  $$('#amap-bootstrap').forEach(s => s.remove());
  window.AMap = null;
  window._AMapSecurityConfig = (App.settings.amapJsCode || '').trim() ? { securityJsCode: App.settings.amapJsCode.trim() } : undefined;
  AMapS.loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.id = 'amap-bootstrap';
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.Driving,AMap.PlaceSearch`;
    s.onload = () => { window.AMap ? resolve() : reject(new Error('脚本加载异常')); };
    s.onerror = () => reject(new Error('脚本加载失败，请检查网络'));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('加载超时（15s）')), 15000);
  }).catch(e => { AMapS.loading = null; throw e; });
  return AMapS.loading;
}

async function amapRouteLeg(found) {
  await ensureAMap();
  return new Promise((resolve, reject) => {
    try {
      const driving = new AMap.Driving({ policy: AMap.DrivingPolicy.LEAST_TIME });
      const o = GCJ.wgs2gcj(found.prev.lng, found.prev.lat);
      const d = GCJ.wgs2gcj(found.stop.lng, found.stop.lat);
      driving.search(new AMap.LngLat(o[0], o[1]), new AMap.LngLat(d[0], d[1]), (status, result) => {
        if (status === 'complete' && result.routes && result.routes.length) {
          const r = result.routes[0];
          const line = [];
          (r.steps || []).forEach(st => (st.path || []).forEach(pt => {
            const w = GCJ.gcj2wgs(pt.lng, pt.lat);
            const last = line[line.length - 1];
            if (!last || last[0] !== w[0] || last[1] !== w[1]) line.push(w);
          }));
          if (line.length < 2) return reject(new Error('返回路线为空'));
          resolve({ line, distKm: Math.round(r.distance) / 1000, durMin: Math.max(1, Math.round(r.time / 60)) });
        } else {
          const info = (result && result.info) || status || '未知错误';
          reject(new Error('算路失败：' + info + (String(info).includes('INVALID_USER_KEY') ? '（Key 或安全密钥不正确）' : '')));
        }
      });
    } catch (e) { reject(e); }
  });
}
