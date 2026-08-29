/* ============ 启动与全局事件 ============ */
'use strict';

(function boot() {
  loadState();
  MV.init();
  Panel.bind();
  Panel.render();
  MV.renderAll();
  MV.map.fitBounds(MV.islandBounds, { padding: [30, 30] });

  // 顶栏按钮
  $('#btn-plans').addEventListener('click', () => Panel.openPlans());
  $('#btn-poster').addEventListener('click', () => Poster.openModal());
  $('#btn-print').addEventListener('click', () => Poster.print());
  $('#btn-settings').addEventListener('click', () => Panel.openSettings());
  $('#btn-help').addEventListener('click', () => Panel.openHelp());

  // 地图工具
  $('#btn-add-stop').addEventListener('click', () => MV.toggleAddMode());
  $('#btn-add-poi').addEventListener('click', () => Panel.openPoiLib());
  $('#basemap-switcher').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-bm]');
    if (b) MV.setBasemap(b.dataset.bm);
  });
  // 手绘工具条
  $('#draw-undo').addEventListener('click', () => {
    if (!MV.draw) return;
    MV.draw.pts.pop();
    MV.renderDrawPreview();
  });
  $('#draw-done').addEventListener('click', () => MV.finishDraw());
  $('#draw-cancel').addEventListener('click', () => { MV.exitDraw(); MV.renderAll(); });

  window.addEventListener('beforeprint', () => { if (!$('#print-root').innerHTML) Poster.print && null; });

  // 首次使用引导
  let seen = false;
  try { seen = !!localStorage.getItem('hainanTrip.introSeen'); } catch (e) { }
  if (!seen) {
    Panel.openHelp();
    try { localStorage.setItem('hainanTrip.introSeen', '1'); } catch (e) { }
  }
})();
