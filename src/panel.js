/* ============ 交互面板：日程编辑 / 备注卡 / 方案管理 / 设置 / 帮助 ============ */
'use strict';

const imgURLCache = {};
async function imgURL(im) {
  if (im.kind === 'url') return im.url;
  if (imgURLCache[im.id]) return imgURLCache[im.id];
  const rec = await ImgDB.get(im.id);
  if (!rec) return '';
  imgURLCache[im.id] = URL.createObjectURL(rec.blob);
  return imgURLCache[im.id];
}

const Panel = {};

/* ---------- 顶栏 ---------- */
Panel.renderTop = function () {
  const p = currentPlan(); if (!p) return;
  $('#plan-name').textContent = p.name;
  const st = planStats(p);
  $('#top-stats').innerHTML = `🗓 ${p.days.length} 天 · 📍 ${st.stops} 站 · 🛣 约 ${st.km} km · ⏱ 约 ${Math.floor(st.min / 60)}h${st.min % 60 ? (st.min % 60) + '′' : ''}`;
};

/* ---------- 侧栏 ---------- */
Panel.render = function () {
  const p = currentPlan(); if (!p) return;
  Panel.renderTop();
  const root = $('#panel-body');
  const active = p.days.find(d => d.id === App.ui.activeDayId) || p.days[0];
  if (active) App.ui.activeDayId = active.id;

  const chips = [`<button class="day-chip ${!App.ui.focusDayId ? 'on' : ''}" data-act="focus-all">全部</button>`].concat(
    p.days.map((d, i) => {
      const on = App.ui.focusDayId === d.id || (!App.ui.focusDayId && active && d.id === active.id);
      return `<button class="day-chip ${on ? 'on' : ''}" data-act="focus-day" data-day="${d.id}" style="--c:${DAY_COLORS[i % DAY_COLORS.length]}">D${i + 1} ${esc(d.date || '')}</button>`;
    })
  ).join('');

  root.innerHTML = `
    <div class="day-chips">${chips}<button class="day-chip add" data-act="add-day">＋天</button></div>
    <div id="day-detail"></div>`;
  const det = $('#day-detail');
  if (!active) {
    det.innerHTML = `<div class="empty-hint">还没有行程日，点上方「＋天」开始编排。</div>`;
  } else {
    det.appendChild(Panel.buildDayCard(active));
  }
};

Panel.buildDayCard = function (day) {
  const p = currentPlan();
  const di = p.days.indexOf(day);
  const color = DAY_COLORS[di % DAY_COLORS.length];
  const card = document.createElement('div');
  card.className = 'day-card';

  const stopsHtml = day.stops.map((s, i) => {
    const t = STOP_TYPES[s.type] || STOP_TYPES.other;
    const globalNum = p.days.slice(0, di).reduce((acc, dd) => acc + dd.stops.length, 0) + i + 1;
    const tags = (s.note.tags || []).map(x => `<span class="mini-tag">${esc(x)}</span>`).join('');
    const snip = s.note.text ? `<div class="card-snip">${esc(s.note.text.slice(0, 60))}${s.note.text.length > 60 ? '…' : ''}</div>` : '';
    const extras = [];
    if ((s.note.links || []).length) extras.push(`🔗${s.note.links.length}`);
    if ((s.note.images || []).length) extras.push(`📷${s.note.images.length}`);
    let legHtml = '';
    if (i > 0 && day.stops[i - 1]) {
      const info = legInfo(s, day.stops[i - 1], App.settings.speed);
      const modeBadge = { draft: '<span class="leg-badge draft">草稿</span>', manual: '<span class="leg-badge manual">手绘</span>', amap: '<span class="leg-badge amap">高德✓</span>' }[info.mode];
      const legNote = s.leg && s.leg.note && (s.leg.note.text || (s.leg.note.tags || []).length)
        ? `<div class="leg-note">${(s.leg.note.tags || []).map(x => `<span class="mini-tag warn">${esc(x)}</span>`).join('')}${s.leg.note.text ? esc(s.leg.note.text.slice(0, 50)) + (s.leg.note.text.length > 50 ? '…' : '') : ''}</div>` : '';
      legHtml = `<div class="leg-strip" data-day="${day.id}" data-stop="${s.id}">
        <span class="leg-line"></span>
        <span class="leg-info">↓ ${info.distKm.toFixed(1)} km · ~${Math.round(info.durMin)}′ ${modeBadge}</span>
        <span class="leg-btns">
          <button class="ibtn" data-act="leg-route" title="高德算路（真实距离/耗时）" data-day="${day.id}" data-stop="${s.id}">⚡</button>
          <button class="ibtn" data-act="leg-draw" title="沿路手绘" data-day="${day.id}" data-stop="${s.id}">🖋️</button>
          <button class="ibtn" data-act="leg-note" title="路线贴士" data-day="${day.id}" data-stop="${s.id}">✏️</button>
        </span>${legNote}</div>`;
    }
    return `${legHtml}<div class="stop-card" draggable="true" data-day="${day.id}" data-stop="${s.id}">
      <span class="stop-num" style="--c:${color}">${globalNum}</span>
      <div class="stop-main">
        <div class="stop-name">${t.emoji} ${esc(s.name)}${s.time ? `<span class="stop-time">⏰ ${esc(s.time)}</span>` : ''}</div>
        ${tags ? `<div class="stop-tags">${tags}${extras.length ? `<span class="stop-extras">${extras.join(' · ')}</span>` : ''}</div>` : (extras.length ? `<div class="stop-tags"><span class="stop-extras">${extras.join(' · ')}</span></div>` : '')}
        ${snip}
      </div>
      <span class="stop-btns">
        <button class="ibtn" data-act="stop-edit" title="编辑/备注" data-day="${day.id}" data-stop="${s.id}">✏️</button>
        <button class="ibtn" data-act="stop-copy" title="复制停留点（可到任意一天，含本天）" data-day="${day.id}" data-stop="${s.id}">⧉</button>
        <button class="ibtn" data-act="stop-del" title="删除" data-day="${day.id}" data-stop="${s.id}">🗑</button>
      </span></div>`;
  }).join('');

  card.innerHTML = `
    <div class="day-head" style="--c:${color}">
      <div class="day-title-row">
        <span class="day-badge">D${di + 1}</span>
        <input class="day-date" value="${esc(day.date)}" placeholder="日期" data-field="date"/>
        <input class="day-title" value="${esc(day.title)}" placeholder="当日主题" data-field="title"/>
        <button class="ibtn" data-act="del-day" title="删除这一天">🗑</button>
      </div>
      <div class="day-sub-row">
        <label>🌙 宿</label><input class="day-lodge" value="${esc(day.lodging)}" placeholder="住宿地" data-field="lodging"/>
      </div>
      <textarea class="day-note" placeholder="当日贴士 / 避堵策略…">${esc(day.note)}</textarea>
    </div>
    <div class="day-stops">${stopsHtml || '<div class="empty-hint small">这一天还没有停留点：点右上「📍 添加地点」或「📚 地点库」。</div>'}</div>`;
  return card;
};

/* ---------- 面板事件（委托） ---------- */
Panel.bind = function () {
  $('#panel').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const p = currentPlan();
    if (act === 'focus-all') { MV.fitAll(); return; }
    if (act === 'focus-day') { App.ui.activeDayId = btn.dataset.day; MV.focusDay(btn.dataset.day); return; }
    if (act === 'add-day') {
      const d = newDay({ date: '', title: '新的一天' });
      p.days.push(d); App.ui.activeDayId = d.id; App.ui.focusDayId = null;
      requestSave(); Panel.render(); MV.renderAll(); return;
    }
    if (act === 'del-day') {
      const day = p.days.find(d => d.id === btn.dataset.day); if (!day) return;
      confirmDlg('删除行程日', `确定删除「D${p.days.indexOf(day) + 1} ${day.title || day.date || ''}」及其全部停留点？`, '删除').then(ok => {
        if (!ok) return;
        p.days = p.days.filter(d => d !== day);
        if (App.ui.activeDayId === day.id) App.ui.activeDayId = p.days.length ? p.days[0].id : null;
        if (App.ui.focusDayId === day.id) App.ui.focusDayId = null;
        requestSave(); Panel.render(); MV.renderAll();
      });
      return;
    }
    if (act === 'stop-edit') return Panel.openStopEditor(btn.dataset.day, btn.dataset.stop);
    if (act === 'stop-copy') return Panel.openCopyStop(btn.dataset.day, btn.dataset.stop);
    if (act === 'leg-note') return Panel.openLegEditor(btn.dataset.day, btn.dataset.stop);
    if (act === 'leg-draw') return MV.enterDraw(btn.dataset.day, btn.dataset.stop);
    if (act === 'leg-route') return Panel.amapRoute(findStop(btn.dataset.day, btn.dataset.stop));
    if (act === 'stop-del') {
      const f = findStop(btn.dataset.day, btn.dataset.stop); if (!f) return;
      confirmDlg('删除停留点', `确定删除「${f.stop.name}」？`, '删除').then(ok => {
        if (!ok) return;
        f.day.stops.splice(f.index, 1);
        const next = f.day.stops[f.index];
        if (next) next.leg = newLeg({ note: next.leg ? next.leg.note : newNote() });
        requestSave(); Panel.render(); MV.renderAll();
      });
      return;
    }
  });

  // 行程日字段输入
  $('#panel').addEventListener('input', (e) => {
    const inp = e.target.closest('[data-field], .day-note');
    if (!inp) return;
    const dayCard = e.target.closest('.day-card');
    if (!dayCard) return;
    const p = currentPlan();
    const dayEl = $('#day-chips');
    // 找到当前激活 day：以 day-card 对应 activeDayId
    const day = p.days.find(d => d.id === App.ui.activeDayId); if (!day) return;
    if (inp.classList.contains('day-note')) day.note = inp.value;
    else if (inp.dataset.field === 'date') day.date = inp.value;
    else if (inp.dataset.field === 'title') day.title = inp.value;
    else if (inp.dataset.field === 'lodging') day.lodging = inp.value;
    requestSave();
  });
  $('#panel').addEventListener('change', (e) => {
    if (e.target.closest('[data-field]')) { Panel.render(); MV.renderAll(); }
  });

  // 停留点拖拽排序：整个行程卡与日期签都是有效放置区，带插入指示线，支持跨天移动与边缘自动滚动
  let dragId = null, dragFromDay = null, dropIdx = -1;
  let lastY = 0, scrollRAF = 0, indEl = null, chipEl = null;
  const panelBody = $('#panel-body');
  const setChip = (chip) => {
    if (chipEl) chipEl.classList.remove('drop-target');
    chipEl = chip || null;
    if (chipEl) chipEl.classList.add('drop-target');
  };
  const setIndicator = (listEl, idx) => {
    if (!indEl) { indEl = document.createElement('div'); indEl.className = 'drop-indicator'; }
    const cards = $$('.stop-card', listEl);
    if (idx >= cards.length) { listEl.appendChild(indEl); return; }
    const ref = cards[idx];
    const strip = ref.previousElementSibling;
    listEl.insertBefore(indEl, strip && strip.classList.contains('leg-strip') ? strip : ref);
  };
  const clearDnD = () => {
    dragId = dragFromDay = null; dropIdx = -1; lastY = 0;
    if (scrollRAF) { cancelAnimationFrame(scrollRAF); scrollRAF = 0; }
    if (indEl) { indEl.remove(); indEl = null; }
    setChip(null);
  };
  const scrollStep = () => {
    if (!dragId) { scrollRAF = 0; return; }
    const r = panelBody.getBoundingClientRect();
    const edge = 56, speed = 12;
    if (lastY >= r.top && lastY < r.top + edge) panelBody.scrollTop -= speed;
    else if (lastY <= r.bottom && lastY > r.bottom - edge) panelBody.scrollTop += speed;
    scrollRAF = requestAnimationFrame(scrollStep);
  };
  const stopListOf = (e) => {
    const inList = e.target.closest('.day-stops');
    if (inList) return inList;
    const cardEl = e.target.closest('.day-card');
    return cardEl ? cardEl.querySelector('.day-stops') : null;
  };
  const dropIndexOf = (listEl, clientY) => {
    let idx = 0;
    $$('.stop-card', listEl).forEach(c => {
      const r = c.getBoundingClientRect();
      if (clientY > r.top + r.height / 2) idx++;
    });
    return idx;
  };

  $('#panel').addEventListener('dragstart', (e) => {
    const card = e.target.closest('.stop-card'); if (!card) return;
    dragId = card.dataset.stop;
    dragFromDay = card.dataset.day;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragId); } catch (x) { }
    if (!scrollRAF) scrollRAF = requestAnimationFrame(scrollStep);
  });
  $('#panel').addEventListener('dragover', (e) => {
    if (!dragId) return;
    lastY = e.clientY;
    const chip = e.target.closest('.day-chip[data-day]');
    if (chip && chip.dataset.day !== dragFromDay) {
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      setChip(chip);
      if (indEl) { indEl.remove(); indEl = null; }
      return;
    }
    const listEl = stopListOf(e);
    if (listEl) {
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      setChip(null);
      dropIdx = dropIndexOf(listEl, e.clientY);
      setIndicator(listEl, dropIdx);
    }
  });
  $('#panel').addEventListener('drop', (e) => {
    if (!dragId) return;
    const chip = e.target.closest('.day-chip[data-day]');
    if (chip && chip.dataset.day !== dragFromDay) {
      e.preventDefault();
      Panel.moveStopToDay(dragId, chip.dataset.day);
      clearDnD();
      return;
    }
    const listEl = stopListOf(e);
    if (listEl && dropIdx >= 0) {
      e.preventDefault();
      Panel.reorderStop(dragFromDay, dragId, dropIdx);
    }
    clearDnD();
  });
  $('#panel').addEventListener('dragend', clearDnD);
};

/* ---------- 添加停留点 ---------- */
Panel.addStopAt = function (latlng) {
  const p = currentPlan();
  let day = p.days.find(d => d.id === App.ui.activeDayId);
  if (!day) { day = newDay({ title: '新的一天' }); p.days.push(day); App.ui.activeDayId = day.id; }
  const w = fromMap(latlng);
  const s = newStop({ lng: w.lng, lat: w.lat });
  if (day.stops.length) s.leg = newLeg();
  day.stops.push(s);
  requestSave(); Panel.render(); MV.renderAll();
  Panel.openStopEditor(day.id, s.id, true);
};

Panel.addStopAfter = function (found) {
  const s = newStop({ lng: (found.prev ? found.stop.lng : found.stop.lng), lat: found.stop.lat });
  s.lng = found.stop.lng; s.lat = found.stop.lat; // 初始位置与锚点重合，稍后拖开或在编辑里改
  if (found.day.stops.length) s.leg = newLeg();
  found.day.stops.splice(found.index + 1, 0, s);
  requestSave(); Panel.render(); MV.renderAll();
  toast('已添加，可拖动标记调整位置');
  Panel.openStopEditor(found.day.id, s.id, true);
};

/* 结构变化（排序/跨天移动/复制）后检查一天内各段：与停留点不再吻合的路线段重置为草稿（保留备注） */
function normalizeDayLegs(day) {
  day.stops.forEach((s, i) => {
    if (i === 0 || !s.leg || s.leg.mode === 'draft' || !s.leg.line) return;
    const prev = day.stops[i - 1];
    const leg = s.leg;
    const start = leg.line[0], end = leg.line[leg.line.length - 1];
    if (Math.abs(start[0] - prev.lng) > 1e-6 || Math.abs(start[1] - prev.lat) > 1e-6 ||
        Math.abs(end[0] - s.lng) > 1e-6 || Math.abs(end[1] - s.lat) > 1e-6) {
      leg.mode = 'draft'; leg.line = null; leg.distKm = null; leg.durMin = null;
    }
  });
}

/* 同一天内排序（toIdx 为插入槽位 0..n） */
Panel.reorderStop = function (dayId, stopId, toIdxRaw) {
  const day = currentPlan().days.find(d => d.id === dayId); if (!day) return;
  const from = day.stops.findIndex(s => s.id === stopId); if (from < 0) return;
  let to = clamp(toIdxRaw, 0, day.stops.length);
  if (to === from || to === from + 1) return; // 落回原位
  const [moved] = day.stops.splice(from, 1);
  if (from < to) to--;
  day.stops.splice(to, 0, moved);
  normalizeDayLegs(day);
  requestSave(); Panel.render(); MV.renderAll();
};

/* 跨天移动（拖到日期签）：从源天取出，追加到目标天末尾 */
Panel.moveStopToDay = function (stopId, toDayId) {
  const p = currentPlan();
  const fromDay = p.days.find(d => d.stops.some(s => s.id === stopId)); if (!fromDay) return;
  const toDay = p.days.find(d => d.id === toDayId);
  if (!toDay || toDay === fromDay) return;
  const [moved] = fromDay.stops.splice(fromDay.stops.findIndex(s => s.id === stopId), 1);
  moved.leg = toDay.stops.length ? newLeg({ note: moved.leg ? moved.leg.note : newNote() }) : null;
  toDay.stops.push(moved);
  normalizeDayLegs(fromDay);
  App.ui.activeDayId = toDay.id;
  requestSave(); Panel.render(); MV.renderAll();
  toast(`已把「${moved.name}」移动到 D${p.days.indexOf(toDay) + 1}`);
};

/* 复制停留点到某天（独立副本：新 id、路线段重置；名称/类型/坐标/点位备注沿用，之后两边互不联动） */
Panel.cloneStopToDay = function (stop, day, pos) {
  const cp = JSON.parse(JSON.stringify(stop));
  cp.id = uid('s');
  const insertStart = pos === 'start';
  cp.leg = (!insertStart && day.stops.length) ? newLeg() : null;
  if (insertStart) {
    day.stops.unshift(cp);
    if (day.stops[1] && !day.stops[1].leg) day.stops[1].leg = newLeg();
  } else {
    day.stops.push(cp);
  }
  return cp;
};

/* 「⧉ 复制停留点」弹窗：选插入位置 + 目标天（任意一天，含当天——环线日出发/返回同一酒店） */
Panel.openCopyStop = function (dayId, stopId) {
  const f = findStop(dayId, stopId); if (!f) return;
  const p = currentPlan();
  let pos = 'end';
  const m = showModal(`
    <h3>⧉ 复制停留点 <span class="hint">「${esc(f.stop.name)}」将作为独立副本加入所选位置，之后互不联动</span></h3>
    <div class="modal-body">
      <div class="form-row"><label>插入位置</label>
        <div class="seg">
          <button class="btn btn-xs btn-primary" data-pos="end">所选天 末尾</button>
          <button class="btn btn-xs" data-pos="start">所选天 开头</button>
        </div>
      </div>
      <div class="copy-days">
        ${p.days.map((d, di) =>
          `<button class="btn copy-day" data-day="${d.id}"><b>D${di + 1}</b> ${esc(d.date || '')} ${esc(d.title || '')}${d === f.day ? '<span class="cur-badge">本天</span>' : ''}<span class="hint">${d.stops.length} 站</span></button>`).join('')}
      </div>
    </div>`, { small: true });
  $$('.seg .btn', m).forEach(b => b.onclick = () => {
    pos = b.dataset.pos;
    $$('.seg .btn', m).forEach(x => x.classList.toggle('btn-primary', x === b));
  });
  $$('.copy-day', m).forEach(b => b.onclick = () => {
    const day = p.days.find(d => d.id === b.dataset.day); if (!day) return;
    Panel.cloneStopToDay(f.stop, day, pos);
    requestSave(); closeModal(); Panel.render(); MV.renderAll();
    toast(`已复制「${f.stop.name}」到 D${p.days.indexOf(day) + 1} ${pos === 'start' ? '开头' : '末尾'}`);
  });
};

Panel.amapRoute = async function (found) {
  if (!found || !found.prev) { toast('该点之前没有出发地'); return; }
  if (!App.settings.amapKey) { Panel.openSettings('填写高德 Key 后可用「⚡ 一键算路」'); return; }
  toast('高德算路中…');
  try {
    const r = await amapRouteLeg(found);
    found.stop.leg = found.stop.leg || newLeg();
    found.stop.leg.mode = 'amap';
    found.stop.leg.line = r.line;
    found.stop.leg.distKm = r.distKm;
    found.stop.leg.durMin = r.durMin;
    requestSave(); MV.renderAll(); Panel.render();
    toast(`✓ ${found.prev.name} → ${found.stop.name}：${r.distKm.toFixed(1)} km / 约 ${r.durMin} 分钟`);
  } catch (e) {
    toast(String(e.message || e), 'err');
  }
};

/* ---------- 停留点编辑器 ---------- */
Panel.openStopEditor = function (dayId, stopId, isNew) {
  const f = findStop(dayId, stopId); if (!f) return;
  const s = f.stop;
  const typeOpts = Object.entries(STOP_TYPES).map(([k, v]) => `<option value="${k}" ${s.type === k ? 'selected' : ''}>${v.emoji} ${v.label}</option>`).join('');
  const m = showModal(`
    <h3>${isNew ? '➕ 新增停留点' : '✏️ 编辑停留点'}</h3>
    <div class="modal-body">
      <div class="form-row"><label>名称</label><input id="ed-name" value="${esc(s.name)}"/></div>
      <div class="form-row2">
        <div class="form-row"><label>类型</label><select id="ed-type">${typeOpts}</select></div>
        <div class="form-row"><label>时间备注</label><input id="ed-time" value="${esc(s.time)}" placeholder="如 14:00 / 上午"/></div>
      </div>
      <div class="form-row"><label>坐标</label><div class="coord-line">${s.lat.toFixed(4)}, ${s.lng.toFixed(4)} <span class="hint">可在地图上拖动标记微调</span></div></div>
      ${Panel.noteEditorHtml(s.note, 'stop')}
    </div>
    <div class="modal-foot">
      <button class="btn btn-danger" data-x="del">🗑 删除地点</button>
      <span style="flex:1"></span>
      <button class="btn" data-x="cancel">取消</button>
      <button class="btn btn-primary" data-x="save">保存</button>
    </div>`, { wide: true });
  Panel.bindNoteEditor(m, s.note);
  m.querySelector('[data-x="cancel"]').onclick = () => { if (isNew) Panel.removeStopQuiet(f); closeModal(); };
  m.querySelector('[data-x="save"]').onclick = () => {
    s.name = m.querySelector('#ed-name').value.trim() || s.name;
    s.type = m.querySelector('#ed-type').value;
    s.time = m.querySelector('#ed-time').value.trim();
    Panel.saveNoteEditor(m, s.note);
    requestSave(); closeModal(); MV.renderAll(); Panel.render();
  };
  m.querySelector('[data-x="del"]').onclick = async () => {
    if (!await confirmDlg('删除停留点', `确定删除「${s.name}」？`, '删除')) return;
    Panel.removeStopQuiet(f);
    requestSave(); closeModal(); MV.renderAll(); Panel.render();
  };
};

Panel.removeStopQuiet = function (f) {
  f.day.stops = f.day.stops.filter(x => x.id !== f.stop.id);
  const next = f.day.stops[f.index];
  if (next) next.leg = newLeg({ note: next.leg ? next.leg.note : newNote() });
};

/* ---------- 路线段编辑器 ---------- */
Panel.openLegEditor = function (dayId, stopId) {
  const f = findStop(dayId, stopId); if (!f || !f.prev) return;
  const leg = f.stop.leg || newLeg();
  const info = legInfo(f.stop, f.prev, App.settings.speed);
  const modeName = { draft: '草稿直线（估）', manual: '手绘路线', amap: '高德实际路线' }[info.mode];
  const m = showModal(`
    <h3>🛣️ 路线贴士</h3>
    <div class="modal-body">
      <div class="leg-route-line">${esc(f.prev.name)} → ${esc(f.stop.name)}</div>
      <div class="pop-meta">${modeName} · 约 ${info.distKm.toFixed(1)} km · 约 ${Math.round(info.durMin)} 分钟${leg.mode === 'draft' ? '（建议 ⚡ 算路或 🖋️ 手绘后更准）' : ''}</div>
      ${Panel.noteEditorHtml(leg.note, 'leg')}
    </div>
    <div class="modal-foot">
      <span style="flex:1"></span>
      <button class="btn" data-x="cancel">取消</button>
      <button class="btn btn-primary" data-x="save">保存</button>
    </div>`, { wide: true });
  Panel.bindNoteEditor(m, leg.note);
  m.querySelector('[data-x="cancel"]').onclick = closeModal;
  m.querySelector('[data-x="save"]').onclick = () => {
    f.stop.leg = leg;
    Panel.saveNoteEditor(m, leg.note);
    requestSave(); closeModal(); MV.renderAll(); Panel.render();
  };
};

/* ---------- 备注编辑器（标签/文本/链接/图片） ---------- */
Panel.noteEditorHtml = function (note, kind) {
  const tagChips = NOTE_TAGS.map(t => `<button type="button" class="tag-chip ${(note.tags || []).includes(t) ? 'on' : ''}" data-tag="${t}">${t}</button>`).join('');
  return `
    <div class="form-row"><label>标签</label><div class="tag-row" data-kind="${kind}">${tagChips}</div></div>
    <div class="form-row"><label>笔记 / 贴士 / log</label><textarea class="ed-text" rows="3" placeholder="记录备注、提醒、攻略摘要…"></textarea></div>
    <div class="form-row"><label>链接</label>
      <div class="links-box"></div>
      <button type="button" class="btn btn-xs" data-x="add-link">＋ 添加链接</button>
    </div>
    <div class="form-row"><label>图片</label>
      <div class="imgs-box"></div>
      <div class="img-actions">
        <label class="btn btn-xs file-label">📁 上传图片<input type="file" accept="image/*" multiple hidden class="ed-imgfile"/></label>
        <input class="ed-imgurl" placeholder="或粘贴图片链接 https://…"/>
        <button type="button" class="btn btn-xs" data-x="add-imgurl">添加</button>
      </div>
    </div>`;
};

Panel.bindNoteEditor = function (m, note) {
  m.querySelector('.ed-text').value = note.text || '';
  m.querySelector('.tag-row').addEventListener('click', (e) => {
    const c = e.target.closest('.tag-chip'); if (!c) return;
    c.classList.toggle('on');
  });
  const linksBox = m.querySelector('.links-box');
  const renderLinks = () => {
    linksBox.innerHTML = (note.links || []).map((l, i) => `
      <div class="link-row" data-i="${i}">
        <input class="lk-title" placeholder="标题" value="${esc(l.title)}"/>
        <input class="lk-url" placeholder="https://…" value="${esc(l.url)}"/>
        <button type="button" class="ibtn" data-del-link="${i}">✕</button>
      </div>`).join('') || '<div class="hint">暂无链接</div>';
  };
  renderLinks();
  linksBox.addEventListener('click', (e) => {
    const d = e.target.closest('[data-del-link]');
    if (d) { note.links.splice(+d.dataset.delLink, 1); renderLinks(); }
  });
  m.querySelector('[data-x="add-link"]').onclick = () => { note.links = note.links || []; note.links.push({ title: '', url: '' }); renderLinks(); };

  const imgsBox = m.querySelector('.imgs-box');
  const renderImgs = async () => {
    imgsBox.innerHTML = (note.images || []).map((im, i) => `<div class="img-thumb" data-i="${i}"><img/><button type="button" class="img-del" data-del-img="${i}">✕</button></div>`).join('');
    for (const [i, im] of (note.images || []).entries()) {
      const url = await imgURL(im);
      const el = imgsBox.querySelector(`.img-thumb[data-i="${i}"] img`);
      if (el && url) el.src = url;
    }
    if (!(note.images || []).length) imgsBox.innerHTML = '<div class="hint">暂无图片（海报不使用照片，仅备注内查看）</div>';
  };
  renderImgs();
  imgsBox.addEventListener('click', (e) => {
    const d = e.target.closest('[data-del-img]');
    if (d) {
      const im = note.images[+d.dataset.delImg];
      if (im && im.kind === 'idb') ImgDB.del(im.id);
      note.images.splice(+d.dataset.delImg, 1);
      renderImgs();
    }
  });
  m.querySelector('.ed-imgfile').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (!('indexedDB' in window)) { toast('当前环境不支持本地图片库，请改用图片链接', 'err'); return; }
    for (const file of files) {
      try { await addImageToNote(note, file); } catch (err) { toast('图片处理失败：' + file.name, 'err'); }
    }
    renderImgs();
    e.target.value = '';
  });
  m.querySelector('[data-x="add-imgurl"]').onclick = () => {
    const url = m.querySelector('.ed-imgurl').value.trim();
    if (!/^https?:\/\//.test(url)) { toast('请输入 http(s) 图片链接', 'err'); return; }
    note.images.push({ kind: 'url', url });
    m.querySelector('.ed-imgurl').value = '';
    renderImgs();
  };
};

Panel.saveNoteEditor = function (m, note) {
  note.text = m.querySelector('.ed-text').value;
  note.tags = $$('.tag-chip.on', m).map(c => c.dataset.tag);
  note.links = $$('.link-row', m).map(row => ({
    title: row.querySelector('.lk-title').value.trim() || '链接',
    url: row.querySelector('.lk-url').value.trim(),
  })).filter(l => l.url);
};

/* ---------- 方案管理 ---------- */
Panel.openPlans = function () {
  const list = Object.values(App.plans).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const m = showModal(`
    <h3>🗂 行程方案</h3>
    <div class="modal-body"><div class="plan-list">
      ${list.map(p => {
        const st = planStats(p);
        return `<div class="plan-row ${p.id === App.currentId ? 'cur' : ''}" data-id="${p.id}">
          <div class="plan-main">
            <b>${esc(p.name)}</b>${p.id === App.currentId ? '<span class="cur-badge">当前</span>' : ''}
            <div class="hint">${p.days.length} 天 · ${st.stops} 站 · 更新于 ${esc((p.updatedAt || '').slice(0, 16).replace('T', ' '))}</div>
          </div>
          <div class="plan-btns">
            <button class="btn btn-xs" data-pact="switch" data-id="${p.id}">打开</button>
            <button class="btn btn-xs" data-pact="rename" data-id="${p.id}">重命名</button>
            <button class="btn btn-xs" data-pact="copy" data-id="${p.id}">复制</button>
            <button class="btn btn-xs" data-pact="export" data-id="${p.id}">导出</button>
            <button class="btn btn-xs btn-danger-ghost" data-pact="del" data-id="${p.id}">删除</button>
          </div></div>`;
      }).join('')}
    </div></div>
    <div class="modal-foot">
      <button class="btn" data-pact="import">📥 导入 JSON</button>
      <span style="flex:1"></span>
      <button class="btn btn-primary" data-pact="new">＋ 新建空白方案</button>
    </div>`);
  m.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pact]'); if (!b) return;
    const id = b.dataset.id;
    const act = b.dataset.pact;
    if (act === 'switch') { App.currentId = id; App.ui.activeDayId = App.plans[id].days[0] ? App.plans[id].days[0].id : null; App.ui.focusDayId = null; saveState(); closeModal(); Panel.render(); MV.renderAll(); MV.fitAll(); }
    if (act === 'new') {
      const p = newPlan('方案' + (Object.keys(App.plans).length + 1));
      p.days.push(newDay({ date: '10/1', title: '' }));
      App.plans[p.id] = p; App.currentId = p.id; App.ui.activeDayId = p.days[0].id; App.ui.focusDayId = null;
      saveState(); closeModal(); Panel.render(); MV.renderAll(); MV.fitAll();
      toast('已新建，可复制方案A再改');
    }
    if (act === 'copy') {
      const src = App.plans[id];
      const cp = JSON.parse(JSON.stringify(src));
      cp.id = uid('p'); cp.name = src.name + ' 副本'; cp.createdAt = cp.updatedAt = new Date().toISOString();
      // 克隆所有 id，避免互相影响
      cp.days.forEach(d => { d.id = uid('d'); d.stops.forEach(s => { s.id = uid('s'); if (s.leg) s.leg = Object.assign({}, s.leg); }); });
      App.plans[cp.id] = cp;
      saveState(); Panel.openPlans();
    }
    if (act === 'rename') {
      const p = App.plans[id];
      const name = prompt('方案名称：', p.name);
      if (name && name.trim()) { p.name = name.trim(); saveState(); Panel.render(); Panel.openPlans(); }
    }
    if (act === 'del') {
      if (Object.keys(App.plans).length <= 1) { toast('至少保留一个方案', 'err'); return; }
      if (await confirmDlg('删除方案', `确定删除「${App.plans[id].name}」？该操作不可恢复。`, '删除')) {
        delete App.plans[id];
        if (App.currentId === id) { App.currentId = Object.keys(App.plans)[0]; App.ui.activeDayId = currentPlan().days[0] ? currentPlan().days[0].id : null; }
        saveState(); closeModal(); Panel.render(); MV.renderAll(); MV.fitAll();
      }
    }
    if (act === 'export') { closeModal(); Panel.openExport(id); }
    if (act === 'import') { closeModal(); Panel.pickImportFile(); }
  });
};

Panel.openExport = function (planId) {
  const m = showModal(`
    <h3>📤 导出方案</h3>
    <div class="modal-body">
      <p class="confirm-text">导出为 JSON 文件，可用于备份或传到其他设备导入。</p>
      <label class="check-row"><input type="checkbox" id="exp-imgs"/> 同时内嵌本地图片（文件会变大）</label>
    </div>
    <div class="modal-foot">
      <span style="flex:1"></span>
      <button class="btn" data-x="cancel">取消</button>
      <button class="btn btn-primary" data-x="go">导出</button>
    </div>`, { small: true });
  m.querySelector('[data-x="cancel"]').onclick = closeModal;
  m.querySelector('[data-x="go"]').onclick = () => {
    const withImgs = m.querySelector('#exp-imgs').checked;
    closeModal(); exportPlan(planId, withImgs);
  };
};

Panel.pickImportFile = function () {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => {
    const file = inp.files && inp.files[0]; if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const plan = await importPlanPayload(payload);
      closeModal(); Panel.render(); MV.renderAll(); MV.fitAll();
      toast(`已导入「${plan.name}」`);
    } catch (e) { toast('导入失败：' + (e.message || e), 'err'); }
  };
  inp.click();
};

/* ---------- 设置 ---------- */
Panel.openSettings = function (hint) {
  const s = App.settings;
  const m = showModal(`
    <h3>⚙️ 设置</h3>
    <div class="modal-body">
      ${hint ? `<div class="settings-hint">${esc(hint)}</div>` : ''}
      <div class="form-row"><label>高德 Key</label><input id="set-key" value="${esc(s.amapKey)}" placeholder="Web端(JS API) 的 Key" autocomplete="off"/></div>
      <div class="form-row"><label>安全密钥 jscode</label><input id="set-jscode" value="${esc(s.amapJsCode)}" placeholder="与 Key 配对的安全密钥" autocomplete="off"/></div>
      <div class="settings-tip">Key 只保存在本机浏览器（localStorage），不写入页面文件——分享工具时对方是空白状态，需自行注册填写。</div>
      <div class="form-row2">
        <div class="form-row"><label>估速 km/h</label><input id="set-speed" type="number" min="20" max="100" value="${s.speed || 45}"/></div>
        <div class="form-row">
          <label>连接测试</label>
          <div class="test-row">
            <button class="btn" id="set-test">🔌 测试连接</button>
            <span id="set-test-result" class="hint"></span>
          </div>
        </div>
      </div>
      <details class="reg-guide"><summary>📖 没有高德 Key？注册步骤（免费，约5分钟）</summary>
        <ol>
          <li>打开 <b>lbs.amap.com</b>（高德开放平台），手机号注册或淘宝/支付宝登录；</li>
          <li>完成<b>个人实名认证</b>（身份证信息，免费，个人认证即可）；</li>
          <li>控制台 →「应用管理」→「创建新应用」（名字随意）→「添加 Key」，服务平台选 <b>「Web端(JS API)」</b>；</li>
          <li>创建后得到 <b>Key</b> 和 <b>安全密钥（jscode）</b> 两个值，分别填到上面两个输入框；</li>
          <li>点「测试连接」验证。免费额度对个人行程规划完全够用。</li>
        </ol>
      </details>
    </div>
    <div class="modal-foot">
      <button class="btn btn-danger-ghost" data-x="reset">恢复出厂</button>
      <span style="flex:1"></span>
      <button class="btn" data-x="cancel">取消</button>
      <button class="btn btn-primary" data-x="save">保存</button>
    </div>`);
  m.querySelector('[data-x="cancel"]').onclick = closeModal;
  m.querySelector('[data-x="save"]').onclick = () => {
    s.amapKey = m.querySelector('#set-key').value.trim();
    s.amapJsCode = m.querySelector('#set-jscode').value.trim();
    s.speed = clamp(parseInt(m.querySelector('#set-speed').value, 10) || 45, 20, 100);
    AMapS.loading = null;
    requestSave(); closeModal(); Panel.render(); MV.renderAll();
    toast('设置已保存（仅存本机）');
  };
  m.querySelector('#set-test').onclick = async () => {
    const r = m.querySelector('#set-test-result');
    r.textContent = '测试中…';
    const key = m.querySelector('#set-key').value.trim();
    const jscode = m.querySelector('#set-jscode').value.trim();
    const backup = { k: App.settings.amapKey, j: App.settings.amapJsCode };
    App.settings.amapKey = key; App.settings.amapJsCode = jscode;
    try {
      await ensureAMap(true);
      const rr = await new Promise((resolve, reject) => {
        try {
          const driving = new AMap.Driving({ policy: AMap.DrivingPolicy.LEAST_TIME });
          const o = GCJ.wgs2gcj(109.411, 18.303), d = GCJ.wgs2gcj(109.638, 18.172);
          driving.search(new AMap.LngLat(o[0], o[1]), new AMap.LngLat(d[0], d[1]), (status, result) => {
            if (status === 'complete' && result.routes && result.routes.length) resolve(result.routes[0]);
            else reject(new Error((result && result.info) || status));
          });
        } catch (e) { reject(e); }
      });
      r.innerHTML = `<span class="ok">✓ 连接成功（机场→亚龙湾 ${(Math.round(rr.distance) / 1000).toFixed(0)}km）</span>`;
    } catch (e) {
      r.innerHTML = `<span class="bad">✕ ${esc(String(e.message || e))}</span>`;
    } finally {
      App.settings.amapKey = backup.k; App.settings.amapJsCode = backup.j;
    }
  };
  m.querySelector('[data-x="reset"]').onclick = async () => {
    if (!await confirmDlg('恢复出厂', '将清空本机所有方案与设置数据并重新初始化，确定？', '清空重置')) return;
    try { localStorage.removeItem(STORE_KEY); } catch (e) { }
    location.reload();
  };
};

/* ---------- 帮助 ---------- */
Panel.openHelp = function () {
  showModal(`
    <h3>🌴 使用指南</h3>
    <div class="modal-body help-body">
      <h4>快速上手</h4>
      <ol class="help-steps">
        <li><b>看行程</b>：左侧按天（D1~D6）编排；点击上方日期徽章，地图会聚焦到当天的路线段。</li>
        <li><b>改行程</b>：拖动停留点卡片可调顺序（有位置指示线，整列任意位置可松手）；拖到顶部日期签可直接移动到那一天；「⧉」把地点复制到任意一天（含本天——环线日出发/返回同一酒店时，复制两个到当天开头/末尾即可）；「📍 添加地点」在地图上点一下即可插入新点——填过 Key 时还会自动列出点击处附近的地点，点选即可带名称/类型加入，或用来修正现有停留点的位置；「📚 地点库」收录了三亚/陵水/万宁/中部山区等约 38 个常用地点，顶部还列出方案里已有地点可一键复用。</li>
        <li><b>搜精准位置</b>：地图左上角搜索框输入酒店 / 景区 / 餐厅名（如"海棠湾 希尔顿"），结果可一键「添加为停留点」，或「修正」你放得不准的现有点位（需在设置里填一次免费高德 Key）。</li>
        <li><b>画路线</b>：两站之间默认是虚线草稿。点 <b>⚡</b> 用高德算出真实驾车距离和耗时（需在设置里填一次免费 Key）；或点 <b>🖋️</b> 沿着公路手工点击打点。</li>
        <li><b>记贴士</b>：地点和路线都能打开「✏️」卡片——分类标签、笔记、链接、图片（上传后压缩存本机）。</li>
        <li><b>分享</b>：「🖼️ 海报」生成竖版（朋友圈）/横版路线图 PNG；「🖨️ 打印」输出完整行程单 PDF；「🗂 方案」里可导出 JSON 备份或传到别的设备导入。</li>
      </ol>
      <h4>数据存在哪？</h4>
      <p>全部保存在<b>本机浏览器</b>里（方案存 localStorage，图片存 IndexedDB），不上传任何服务器。换设备用「导出 JSON → 导入」迁移；重要节点记得导出备份。个别浏览器对本地文件（file://）的存储隔离较严格，移动/重命名 HTML 文件后若读不到数据，用备份恢复即可。</p>
      <h4>常见问题</h4>
      <ul class="help-faq">
        <li><b>地图不显示？</b>底图瓦片需要联网；断网时海岛轮廓、路线、备注仍可正常使用。</li>
        <li><b>手机上打开？</b>发这个 HTML 文件过去即可，显示与电脑一致，可双指缩放。</li>
        <li><b>坐标说明</b>：数据以 WGS-84 保存，显示时按底图自动转换（高德为火星坐标），路线与底图道路是对齐的。</li>
      </ul>
    </div>
    <div class="modal-foot"><span style="flex:1"></span><button class="btn btn-primary" data-x="ok">开始规划 →</button></div>`);
  $('#modal-overlay [data-x="ok"]').onclick = closeModal;
};

/* ---------- 地点库 ---------- */
Panel.openPoiLib = function () {
  const m = showModal(`
    <h3>📚 地点库 <span class="hint">点击加入当前天的行程末尾；坐标为参考位置，之后可在地图拖动微调</span></h3>
    <div class="modal-body">
      <input id="poi-search" placeholder="搜索名称/区域，如：陵水、海湾、温泉…"/>
      <div id="poi-list" class="poi-list"></div>
    </div>`, { wide: true });
  const listEl = m.querySelector('#poi-list');
  const renderList = () => {
    const q = m.querySelector('#poi-search').value.trim().toLowerCase();
    const p = currentPlan();
    // 方案已有地点：一键复用（插入当前天末尾）
    const reused = [];
    p.days.forEach((d, di) => d.stops.forEach((s, si) => {
      if (q && !s.name.toLowerCase().includes(q)) return;
      const gnum = p.days.slice(0, di).reduce((acc, dd) => acc + dd.stops.length, 0) + si + 1;
      reused.push(`<button class="poi-item" data-planstop-day="${d.id}" data-planstop-id="${s.id}"><span>${(STOP_TYPES[s.type] || STOP_TYPES.other).emoji} ${circledNum(gnum)} ${esc(s.name)} <span class="hint">（D${di + 1}）</span></span><span class="poi-add">＋</span></button>`);
    }));
    const items = POI_LIB.filter(x => !q || x.name.toLowerCase().includes(q) || x.region.toLowerCase().includes(q));
    const groups = {};
    items.forEach(x => { (groups[x.region] = groups[x.region] || []).push(x); });
    listEl.innerHTML =
      `<div class="poi-region">⭐ 本方案已有地点 · 点击插入当前天末尾</div>${reused.join('') || '<div class="hint">（无匹配）</div>'}
      ` + (Object.entries(groups).map(([rg, arr]) => `
      <div class="poi-region">${esc(rg)}</div>
        ${arr.map(x => `<button class="poi-item" data-poi="${esc(x.name)}"><span>${(STOP_TYPES[x.type] || STOP_TYPES.other).emoji} ${esc(x.name)}</span><span class="poi-add">＋</span></button>`).join('')}
      `).join('') || '<div class="hint">无匹配</div>');
  };
  renderList();
  m.querySelector('#poi-search').addEventListener('input', renderList);
  listEl.addEventListener('click', (e) => {
    const ps = e.target.closest('[data-planstop-id]');
    if (ps) {
      const srcDay = currentPlan().days.find(d => d.id === ps.dataset.planstopDay);
      const src = srcDay && srcDay.stops.find(x => x.id === ps.dataset.planstopId);
      if (!src) return;
      const p = currentPlan();
      let day = p.days.find(d => d.id === App.ui.activeDayId);
      if (!day) { day = newDay({ title: '新的一天' }); p.days.push(day); App.ui.activeDayId = day.id; }
      Panel.cloneStopToDay(src, day, 'end');
      requestSave(); Panel.render(); MV.renderAll();
      toast(`已把「${src.name}」插入 D${p.days.indexOf(day) + 1} 末尾`);
      return;
    }
    const b = e.target.closest('[data-poi]'); if (!b) return;
    const poi = POI_LIB.find(x => x.name === b.dataset.poi); if (!poi) return;
    const p = currentPlan();
    let day = p.days.find(d => d.id === App.ui.activeDayId);
    if (!day) { day = newDay({ title: '新的一天' }); p.days.push(day); App.ui.activeDayId = day.id; }
    const s = newStop({ name: poi.name, type: poi.type, lng: poi.lng, lat: poi.lat });
    if (day.stops.length) s.leg = newLeg();
    day.stops.push(s);
    requestSave(); Panel.render(); MV.renderAll();
    toast(`已添加「${poi.name}」到 D${p.days.indexOf(day) + 1}`);
  });
};
