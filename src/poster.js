/* ============ 分享海报（Canvas 纯矢量渲染）+ 打印导出 ============ */
'use strict';

const Poster = {
  orientation: 'portrait',   // portrait | landscape
  lastCanvas: null,
};

const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif';

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function halo(ctx, text, x, y, fill, strokeW) {
  ctx.save();
  ctx.lineWidth = strokeW || 4; ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
  ctx.restore();
}
function waves(ctx, W, H, cx, cy, baseR, n, gap) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.arc(cx, cy, baseR + i * gap, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  ctx.restore();
}

function collectRoutes(plan) {
  // 返回 {days:[{color, label, lodging, segments:[[ [lng,lat],... ]], stops:[{name,lng,lat,num,type}]}], totalNum}
  const days = [];
  let n = 0;
  plan.days.forEach((d, di) => {
    const day = {
      color: DAY_COLORS[di % DAY_COLORS.length],
      label: `D${di + 1}`, date: d.date, title: d.title, lodging: d.lodging,
      segments: [], stops: [],
    };
    d.stops.forEach((s, i) => {
      n++;
      day.stops.push({ name: s.name, lng: s.lng, lat: s.lat, num: n, type: s.type });
      if (i > 0) {
        const leg = s.leg;
        let line;
        if (leg && leg.mode !== 'draft' && leg.line && leg.line.length > 1) line = leg.line;
        else line = legDraftLine(d.stops[i - 1], s);
        day.segments.push(line);
      }
    });
    days.push(day);
  });
  return { days, totalNum: n };
}

function islandBBox() {
  let minX = 999, minY = 999, maxX = -999, maxY = -999;
  const walk = (c) => { if (typeof c[0] === 'number') { minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); } else c.forEach(walk); };
  const feats = (window.HAINAN_GEO && HAINAN_GEO.features || []).filter(f => !(((f.properties || {}).name) || '').includes('三沙'));
  walk(feats.map(f => f.geometry.coordinates));
  return { minX, minY, maxX, maxY };
}

/* 在矩形内绘制地图面板，返回投影函数 */
function drawMapPanel(ctx, plan, rect) {
  const { x, y, w, h } = rect;
  const pad = Math.round(w * 0.055);
  // 投影（等经纬 + 纬度余弦修正）——先于任何绘制，避免 TDZ 引用错误
  const bb = islandBBox();
  const midLat = (bb.minY + bb.maxY) / 2;
  const dLng = (bb.maxX - bb.minX) * Math.cos(midLat * Math.PI / 180);
  const dLat = (bb.maxY - bb.minY);
  const k = Math.min((w - pad * 2) / dLng, (h - pad * 2) / dLat);
  const ox = x + (w - dLng * k) / 2, oy = y + (h - dLat * k) / 2;
  function proj(lng, lat) {
    if (lng == null) lng = bb.minX;
    if (lat == null) lat = bb.minY;
    return { X: ox + (lng - bb.minX) * Math.cos(midLat * Math.PI / 180) * k, Y: oy + (bb.maxY - lat) * k };
  }
  const P = (lng, lat) => { const p = proj(lng, lat); return [p.X, p.Y]; };

  ctx.save();
  // 面板纸面 + 阴影
  ctx.save();
  ctx.shadowColor = 'rgba(4,36,48,0.45)';
  ctx.shadowBlur = 34; ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#F3EDDE';
  rr(ctx, x, y, w, h, 26); ctx.fill();
  ctx.restore();
  rr(ctx, x, y, w, h, 26); ctx.clip();

  // 经纬淡网格
  ctx.strokeStyle = 'rgba(140,120,80,0.10)'; ctx.lineWidth = 1;
  for (let g = 108.5; g <= 111.1; g += 0.5) {
    const px = proj(g, null).X;
    ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + h); ctx.stroke();
  }
  for (let g = 18.0; g <= 20.2; g += 0.5) {
    const py = proj(null, g).Y;
    ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + w, py); ctx.stroke();
  }

  // 岛屿：白色填充
  ctx.fillStyle = '#FFFFFF';
  HAINAN_GEO.features.forEach(f => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
    polys.forEach(poly => {
      ctx.beginPath();
      poly.forEach((ring, ri) => {
        ring.forEach((c, i) => { const [px, py] = P(c[0], c[1]); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
        ctx.closePath();
      });
      ctx.fill('evenodd');
    });
  });
  // 市县虚界（白色托底 + 沙色虚线）
  const strokeCounties = (dash, color, lw) => {
    ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = lw;
    HAINAN_GEO.features.forEach(f => {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
      polys.forEach(poly => poly.forEach(ring => {
        ctx.beginPath();
        ring.forEach((c, i) => { const [px, py] = P(c[0], c[1]); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
        ctx.stroke();
      }));
    });
    ctx.setLineDash([]);
  };
  if (window.HAINAN_ROADS) {
    const drawRoads = (arr, color, lw) => {
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      (arr || []).forEach(line => {
        ctx.beginPath();
        line.forEach((c, i) => { const [px, py] = P(c[0], c[1]); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
        ctx.stroke();
      });
    };
    drawRoads(HAINAN_ROADS.e, '#C4B79A', 2.6);
    drawRoads(HAINAN_ROADS.p, '#D3CBB4', 1.4);
  }
  strokeCounties([5, 4], 'rgba(150,130,90,0.30)', 1.3);

  // 路线（白托底 + 日色主线）
  const data = collectRoutes(plan);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  data.days.forEach(day => {
    day.segments.forEach(line => {
      const pts = line.map(c => P(c[0], c[1]));
      if (pts.length < 2) return;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 9;
      ctx.beginPath(); pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])); ctx.stroke();
      ctx.strokeStyle = day.color; ctx.lineWidth = 4.6;
      ctx.beginPath(); pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])); ctx.stroke();
    });
  });
  // 站点徽章 + 名称
  data.days.forEach(day => {
    day.stops.forEach((s, si) => {
      const [px, py] = P(s.lng, s.lat);
      ctx.beginPath(); ctx.arc(px, py, 13.5, 0, Math.PI * 2);
      ctx.fillStyle = day.color; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 15px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(s.num), px, py + 0.5);
      const right = px < x + w * 0.72;
      ctx.font = `600 17px ${FONT}`;
      ctx.textAlign = right ? 'left' : 'right'; ctx.textBaseline = 'middle';
      const tx = right ? px + 21 : px - 21;
      const ty = py + (s.num % 2 === 0 ? -18 : 18);
      halo(ctx, s.name, tx, ty, '#4A5A60', 4);
      ctx.textAlign = 'center';
    });
  });
  // 指北针 + 图例
  const cx = x + w - 52, cy = y + 56;
  ctx.strokeStyle = '#8B7B5E'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy + 12); ctx.lineTo(cx - 7, cy + 6); ctx.lineTo(cx, cy - 14); ctx.lineTo(cx + 7, cy + 6); ctx.closePath();
  ctx.fillStyle = '#8B7B5E'; ctx.fill();
  ctx.font = `700 12px ${FONT}`; ctx.fillStyle = '#8B7B5E';
  ctx.fillText('N', cx, cy - 28);
  ctx.restore();
  return proj;
}

function headerMetrics(ctx, plan, boxW, topY, size) {
  let ts = size || 60;
  ctx.font = `900 ${ts}px ${FONT}`;
  const title = plan.name || '海南自驾行程';
  while (ctx.measureText(title).width > boxW - 120 && ts > 30) { ts -= 2; ctx.font = `900 ${ts}px ${FONT}`; }
  const th = Math.round((size || 60) * 0.72);
  return { ts, th, subY: topY + th + ts + 14 + Math.round(ts * 0.75) };
}

function posterHeader(ctx, plan, centerX, boxW, topY, size) {
  const hm = headerMetrics(ctx, plan, boxW, topY, size);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  // 顶部小徽标
  const tag = '海南自驾 · 行程路书';
  ctx.font = `500 ${Math.round(hm.ts * 0.36)}px ${FONT}`;
  const tw = ctx.measureText(tag).width + 44;
  const th = hm.th;
  const tx = centerX - tw / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  rr(ctx, tx, topY, tw, th, th / 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.textBaseline = 'middle';
  ctx.fillText(tag, centerX, topY + th / 2 + 1);
  // 主标题
  ctx.font = `900 ${hm.ts}px ${FONT}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,40,60,0.4)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
  ctx.fillText(plan.name || '海南自驾行程', centerX, topY + th + hm.ts + 14);
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  // 副标题
  const st = planStats(plan);
  const sub = [plan.startDate && plan.endDate ? `${plan.startDate} – ${plan.endDate}` : '', `${plan.days.length} 天${st.stops ? ` ${st.stops} 站` : ''}`, plan.travelers, plan.vehicle].filter(Boolean).join(' · ');
  ctx.font = `400 ${Math.round(hm.ts * 0.46)}px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillText(sub, centerX, hm.subY);
  return hm.subY;
}

function circledNum(n) { return n <= 20 ? String.fromCodePoint(0x2460 + n - 1) : '(' + n + ')'; }

const NO_BREAK_BEFORE = '）】」』！？。，、；：…';
function wrapText(ctx, text, maxW) {
  const lines = []; let line = '';
  for (const ch of Array.from(text)) {
    // 标点悬挂：不允许"）"这类标点单独落到行首
    if (line && ctx.measureText(line + ch).width > maxW && !NO_BREAK_BEFORE.includes(ch)) { lines.push(line); line = ch; }
    else line += ch;
  }
  if (line) lines.push(line);
  return lines;
}

/* 逐日行程行（日期标题 + 实际路线序列 + 住宿）；draw=false 时仅测量高度 */
function dayList(ctx, plan, x, y, maxW, draw) {
  const data = collectRoutes(plan);
  const lhTitle = 36, lhRoute = 30, dayGap = 20;
  let cy = y;
  data.days.forEach((day, di) => {
    const titleText = `D${di + 1}  ${day.date || ''}  ${day.title || ''}`.trim();
    if (draw) {
      ctx.beginPath(); ctx.arc(x + 9, cy + lhTitle / 2 - 5, 8, 0, Math.PI * 2);
      ctx.fillStyle = day.color; ctx.fill();
      ctx.font = `700 26px ${FONT}`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(titleText, x + 26, cy + lhTitle / 2 - 5);
      if (day.lodging) {
        ctx.font = `500 21px ${FONT}`;
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText('🌙 宿 ' + day.lodging, x + maxW, cy + lhTitle / 2 - 5);
        ctx.textAlign = 'left';
      }
    }
    cy += lhTitle - 8;
    const routeText = day.stops.length
      ? day.stops.map(s => `${circledNum(s.num)}${s.name}`).join('  →  ')
      : '—（暂无停留点）';
    ctx.font = `400 21px ${FONT}`;
    const lines = wrapText(ctx, routeText, maxW - 26);
    lines.forEach(ln => {
      if (draw) {
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.textBaseline = 'middle';
        ctx.fillText(ln, x + 26, cy + lhRoute / 2 - 4);
      }
      cy += lhRoute;
    });
    cy += dayGap;
  });
  return data.days.length ? cy - y - dayGap : 0;
}

function scratchCtx() {
  return document.createElement('canvas').getContext('2d');
}

function renderPoster(plan, orientation, scale) {
  const portrait = orientation !== 'landscape';
  const W = portrait ? 1080 : 1920;
  const mc = scratchCtx();

  // ---- 先排版度量，得出自适应高度（宽度固定，高度随内容伸展） ----
  let hm, listH, H;
  if (portrait) {
    hm = headerMetrics(mc, plan, W, 54, 62);
    listH = dayList(mc, plan, 0, 0, W - 128, false);
    H = Math.max(1800, Math.ceil(hm.subY + 34 + 1000 + 34 + listH + 30 + 58 + 92));
  } else {
    hm = headerMetrics(mc, plan, 614, 46, 54);
    listH = dayList(mc, plan, 0, 0, 614, false);
    H = Math.max(1080, Math.ceil(hm.subY + 26 + listH + 30 + 170 + 70));
  }
  const canvas = document.createElement('canvas');
  canvas.width = W * scale; canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // 海洋渐变背景
  const g = ctx.createLinearGradient(0, 0, portrait ? 0 : W, portrait ? H : 0);
  g.addColorStop(0, '#094A5E'); g.addColorStop(0.55, '#0E6E86'); g.addColorStop(1, '#159BB4');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  waves(ctx, W, H, W - 40, H - 60, 60, 5, 26);
  waves(ctx, W, H, 60, 120, 46, 4, 22);

  const st = planStats(plan);
  if (portrait) {
    posterHeader(ctx, plan, W / 2, W, 54, 62);
    const mapRect = { x: 56, y: hm.subY + 34, w: W - 112, h: 1000 };
    drawMapPanel(ctx, plan, mapRect);
    const listY = mapRect.y + mapRect.h + 34;
    dayList(ctx, plan, 64, listY, W - 128, true);
    const stats = `🛣️ 全程约 ${st.km} km　·　📍 ${st.stops} 个停留点　·　🏛️ 途经 ${st.counties} 市县`;
    ctx.font = `600 28px ${FONT}`;
    const sw = ctx.measureText(stats).width + 90;
    const sy = listY + listH + 30;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    rr(ctx, W / 2 - sw / 2, sy, sw, 58, 29); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(stats, W / 2, sy + 30);
    ctx.font = `400 21px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.fillText('海南自驾行程规划 · 本地生成', W / 2, H - 52);
  } else {
    const rx = 1250, rw = W - rx - 56;
    const mapRect = { x: 56, y: 56, w: 1130, h: H - 112 };
    drawMapPanel(ctx, plan, mapRect);
    posterHeader(ctx, plan, rx + rw / 2, rw, 46, 54);
    const listY = hm.subY + 26;
    dayList(ctx, plan, rx, listY, rw, true);
    let sy = listY + listH + 30;
    const statsLines = [
      `🛣️ 全程约 ${st.km} km`,
      `📍 ${st.stops} 个停留点 · 🏛️ 途经 ${st.counties} 市县`,
    ];
    statsLines.forEach(t => {
      ctx.font = `600 27px ${FONT}`;
      const sw2 = ctx.measureText(t).width + 70;
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      rr(ctx, rx, sy, sw2, 54, 27); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(t, rx + 35, sy + 28);
      sy += 66;
    });
    ctx.font = `400 21px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.fillText('海南自驾行程规划 · 本地生成', rx, H - 60);
    ctx.textAlign = 'left';
  }
  return canvas;
}

/* ---------- 海报弹窗 ---------- */
Poster.openModal = function () {
  const plan = currentPlan(); if (!plan) return;
  const m = showModal(`
    <h3>🖼️ 分享海报 <span class="hint">纯矢量绘制，自动按当前方案生成；导出 PNG 高清图</span></h3>
    <div class="modal-body poster-body">
      <div class="poster-toolbar">
        <div class="seg">
          <button class="btn btn-xs ${Poster.orientation === 'portrait' ? 'btn-primary' : ''}" data-o="portrait">竖版 · 朋友圈</button>
          <button class="btn btn-xs ${Poster.orientation === 'landscape' ? 'btn-primary' : ''}" data-o="landscape">横版 · 打印/电脑</button>
        </div>
        <button class="btn btn-primary" data-x="download">⬇️ 下载高清 PNG</button>
      </div>
      <div class="poster-preview-wrap"><canvas id="poster-canvas"></canvas></div>
    </div>`, { wide: true });
  const canvas = m.querySelector('#poster-canvas');
  const render = () => {
    const scale = Poster.orientation === 'portrait' ? 1.2 : 1.5;
    const c = renderPoster(plan, Poster.orientation, scale);
    canvas.width = c.width; canvas.height = c.height;
    canvas.getContext('2d').drawImage(c, 0, 0);
    canvas.style.aspectRatio = `${c.width}/${c.height}`;
  };
  render();
  m.querySelector('.poster-toolbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-o]'); if (!b) return;
    Poster.orientation = b.dataset.o;
    $$('[data-o]', m).forEach(x => x.classList.toggle('btn-primary', x.dataset.o === Poster.orientation));
    render();
  });
  m.querySelector('[data-x="download"]').onclick = () => {
    toast('生成高清图…');
    setTimeout(() => {
      const c = renderPoster(plan, Poster.orientation, 2);
      c.toBlob(blob => {
        const safeName = (plan.name || '行程').replace(/[\\/:*?"<>|]/g, '_');
        downloadFile(`海南自驾-${safeName}-${Poster.orientation === 'portrait' ? '竖版' : '横版'}.png`, blob);
        toast('已保存海报 PNG');
      }, 'image/png');
    }, 30);
  };
};

/* ---------- 打印 / PDF ---------- */
Poster.print = function () {
  const plan = currentPlan(); if (!plan) return;
  const root = $('#print-root');
  const c = renderPoster(plan, 'landscape', 1.2);
  const st = planStats(plan);
  let html = `<div class="pr-head"><h1>${esc(plan.name)}</h1><div class="pr-sub">${esc([plan.startDate && plan.endDate ? `${plan.startDate} – ${plan.endDate}` : '', plan.travelers, plan.vehicle].filter(Boolean).join(' · '))} · 全程约 ${st.km} km</div></div>`;
  html += `<img class="pr-poster" src="${c.toDataURL('image/png')}"/>`;
  html += `<div class="pr-days">`;
  plan.days.forEach((d, di) => {
    const color = DAY_COLORS[di % DAY_COLORS.length];
    html += `<section class="pr-day"><h2 style="border-color:${color}">D${di + 1} ${esc(d.date || '')} ${esc(d.title || '')}${d.lodging ? ` <span class="pr-lodge">🌙 宿 ${esc(d.lodging)}</span>` : ''}</h2>`;
    if (d.note) html += `<p class="pr-daynote">💡 ${esc(d.note)}</p>`;
    if (!d.stops.length) html += `<p class="hint">（无停留点）</p>`;
    d.stops.forEach((s, i) => {
      if (i > 0 && d.stops[i - 1]) {
        const info = legInfo(s, d.stops[i - 1], App.settings.speed);
        const legNote = s.leg && s.leg.note;
        html += `<div class="pr-leg">🛣️ ${esc(d.stops[i - 1].name)} → ${esc(s.name)} · ${info.distKm.toFixed(1)} km · ~${Math.round(info.durMin)} 分钟${legNote && legNote.text ? ` —— ${esc(legNote.text)}` : ''}${legNote && legNote.tags && legNote.tags.length ? `（${esc(legNote.tags.join('、'))}）` : ''}</div>`;
      }
      const t = STOP_TYPES[s.type] || STOP_TYPES.other;
      html += `<div class="pr-stop"><span class="pr-stopname">${t.emoji} ${esc(s.name)}${s.time ? ` <span class="pr-time">${esc(s.time)}</span>` : ''}</span>`;
      if (s.note.tags && s.note.tags.length) html += `<span class="pr-tags">${s.note.tags.map(x => esc(x)).join(' / ')}</span>`;
      if (s.note.text) html += `<div class="pr-notetext">${esc(s.note.text)}</div>`;
      if (s.note.links && s.note.links.length) html += `<div class="pr-links">${s.note.links.map(l => `🔗 <span>${esc(l.title)}</span>：${esc(l.url)}`).join('<br>')}</div>`;
      html += `</div>`;
    });
    html += `</section>`;
  });
  html += `</div><div class="pr-foot">海南自驾行程规划 · 打印于 ${new Date().toLocaleString('zh-CN')}</div>`;
  root.innerHTML = html;
  setTimeout(() => window.print(), 60);
};
