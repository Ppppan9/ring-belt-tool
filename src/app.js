import { SCHEMA, DEFAULTS, TOOL_ID, TOOL_ZH, SETTINGS_VERSION, loadSettings, saveSettings, exportSettingsJSON, importSettingsJSON } from './settings.js';
import { Game, TAU, wrap, clamp, ease } from './game.js';
import { makeBackground, designLayout } from './render.js';
import { Sfx } from './sfx.js';
import { DEFAULT_HAND } from './default_hand.js';
import { assetsReady } from './assets.js';
import { setTheme, themeAssetsReady } from './themes.js';
import { ADV_GROUP } from './settings.js';
import { enhanceSections, makeSwitch, themePicker, panelEntrance, bindPress } from './panelfx.js';
import { frameItems, drawItems, clearSprites, allSprites, resetSpriteArchive, VIEW } from './items.js';
import { createAERecorder } from './ae/recorder.js';
import { export3D } from './export3d/export3d.js';
import { applyPlayableMode, isPlayableNoHand, exportH5PlayableFromPage, bindEditorDevicePreview, markH5DeviceCustomIfSizeEdited, applyH5DevicePresetToSettings } from './h5/index.js';
export const APP_VERSION = '2.0.0';
const $ = id => document.getElementById(id);
let S = loadSettings();
const Q = new URLSearchParams(location.search), DET = Q.has('det');
const cv = $('stage'), g = cv.getContext('2d');
const sfx = new Sfx(() => S);
const game = new Game(S, sfx);
sfx.clock = () => game.time; // 音效节流按游戏时间（确定性）
let bg = null, handImg = null;
function applyCanvas() { cv.width = S.canvasW; cv.height = S.canvasH; setTheme(S.theme); game.spriteCache = {}; bg = makeBackground(864, 1920); clearSprites(); }
function applyTheme() { setTheme(S.theme); game.spriteCache = {}; clearSprites(); bg = makeBackground(864, 1920); }
function loadHand() { const v = S.handImage; if (!v || isPlayableNoHand()) { handImg = null; return; } const im = new Image(); im.src = v === '__default__' ? DEFAULT_HAND : v; handImg = im; clearSprites(); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function toast(m, ms = 2600) { const t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms); }
function status(m) { const s = $('status'); if (s) s.textContent = m; }

// ---------------- 手指 ----------------
const finger = { x: 600, y: 1500, visible: false, press: 0, down: false };
const handVisible = () => !isPlayableNoHand() && finger.visible && !!handImg && !!(handImg.naturalWidth || handImg.width);
let auto = null;
function autoStart() { if (game.state !== 'play' && game.state !== 'lc') restart(); auto = { q: [], t: 0, step: 0, cur: null, wait: S.autoStartDelay / 1000 }; finger.visible = true; ui.autoBtn.textContent = '■ 停止'; if (S.autoRec && !rec) startRec(); }
function autoStop() { auto = null; game.pointerUp(); finger.down = false; finger.press = 0; if (!S.manualHand) finger.visible = false; ui.autoBtn.textContent = '▶ 自动通关'; updateCursor(); }
function planNext() {
  const lv = game.lv, sp = S.autoSpeed; const mv = () => rnd(S.moveMin, S.moveMax) / 1000 / sp, dl = () => (rnd(S.delayMin, S.delayMax) + (Math.random() < S.thinkChance ? Math.random() * S.thinkMax : 0)) / 1000 / sp;
  if (game.state === 'lc') { if (game.isEnded() && !S.loopLevels) return null; return [{ k: 'wait', c: () => game.lcT > 1.25, max: 5 }, { k: 'tap' }]; } /* 无结算页：自动通关停留片刻后自行续关 */
  if (game.state !== 'play') return [{ k: 'pause', d: 0.1 }];
  if (auto.lvKey !== lv) { auto.lvKey = lv; auto.step = 0; auto.tries = 0; } const plan = lv.plan || []; while (auto.step < plan.length) { const [id, mode] = plan[auto.step]; const r = game.rings.find(r => r.id === id); if (r && r.alive) break; auto.step++; }
  if (auto.step >= plan.length) return [{ k: 'pause', d: 0.2 }];
  const [id, mode, spd = 1, pre = 0, settle = false] = plan[auto.step]; if (mode === 'spill' || (auto.tries = (auto.tries || 0) + 1) > 3) { auto.step++; auto.tries = 0; } const r = game.rings.find(r => r.id === id);
  const gp = () => game.grabPoint(r); const j = S.jitter;
  const loose = () => game.balls.some(b => b.state === 'free' && !game.rings.some(q => q.alive && Math.hypot(b.x - q.c[0], b.y - q.c[1]) < q.R));
  return [...(settle && auto.tries <= 1 ? [{ k: 'wait', c: () => !loose(), max: 10 }] : []), ...(pre && auto.tries <= 1 ? [{ k: 'pause', d: pre / sp }] : []), { k: 'moveTo', f: gp, j, d: mv() }, { k: 'down', r }, { k: 'drag', r, mode, spd }, { k: 'wait', c: () => !r.alive || (mode === 'spill' && game.ringBalls(r) === 0), max: mode === 'spill' ? 6 / Math.min(1, spd) : 1.5 }, { k: 'up' }, { k: 'pause', d: dl() }];
}
function autoUpdate(dt) {
  if (!auto) return; if (auto.wait > 0) { auto.wait -= dt; return; }
  if (game.isEnded() && game.lcT > 0.3 && !S.loopLevels) { finishAuto(); return; }
  if (!auto.cur) { if (!auto.q.length) { const n = planNext(); if (!n) { finishAuto(); return; } auto.q = n; } auto.cur = auto.q.shift(); auto.t = 0; const c = auto.cur; if (c.k === 'move' || c.k === 'moveTo') { const p = c.k === 'moveTo' ? c.f() : c; c.x0 = finger.x; c.y0 = finger.y; c.x1 = p.x + (c.j ? rnd(-c.j, c.j) * 0.3 : 0); c.y1 = p.y + (c.j ? rnd(-c.j, c.j) * 0.3 : 0); } if (c.k === 'drag') { c.total = c.r.alive ? wrap(game.planTarget(c.r, c.mode)) : 0; if (c.mode === 'detach') c.total += Math.sign(c.total || 1) * 0.12; /* 拖到缺口正对卡扣（真正解锁角）再略过一点 */ if (c.mode === 'spill' && c.r.alive && c.r.p) { const d = wrap(game.planTarget(c.r, 'detach')); if (Math.sign(d) === Math.sign(c.total) && Math.abs(d) < Math.abs(c.total) + 0.6) c.total -= Math.sign(c.total) * Math.PI * 2; } /* 倒球时绕开解锁角，避免途中误脱 */ c.done = 0; c.lastA = Math.atan2(finger.y - c.r.c[1], finger.x - c.r.c[0]); } }
  const c = auto.cur; auto.t += dt;
  if (c.k === 'pause') { if (auto.t >= c.d) auto.cur = null; }
  else if (c.k === 'move' || c.k === 'moveTo') { const u = Math.min(1, auto.t / c.d), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; finger.x = c.x0 + (c.x1 - c.x0) * e; finger.y = c.y0 + (c.y1 - c.y0) * e - Math.sin(u * Math.PI) * 20; if (u >= 1) auto.cur = null; }
  else if (c.k === 'down') { finger.down = true; game.pointerDown(finger.x, finger.y, c.r); auto.cur = null; }
  else if (c.k === 'up') { finger.down = false; game.pointerUp(); auto.cur = null; }
  else if (c.k === 'tap') { if (auto.t < 0.09) finger.down = true; else { finger.down = false; game.continueNext(); auto.cur = null; } }
  else if (c.k === 'drag') { const r = c.r; if (!r.alive || !game.drag) { auto.cur = null; return; } const w = S.dragSpeed * Math.PI / 180 * S.autoSpeed * (c.spd || 1) * dt; const rem = c.total - c.done; const st = Math.sign(rem) * Math.min(Math.abs(rem), w); c.done += st; const a = c.lastA + st; c.lastA = a; const rr = Math.hypot(finger.x - r.c[0], finger.y - r.c[1]); finger.x = r.c[0] + rr * Math.cos(a); finger.y = r.c[1] + rr * Math.sin(a); game.pointerMove(finger.x, finger.y); if (Math.abs(rem) < 1e-3) auto.cur = null; }
  else if (c.k === 'wait') { if (c.c() || auto.t > c.max) auto.cur = null; }
}
function finishAuto() { const wasRec = !!rec; autoStop(); if (wasRec && S.autoStop) setTimeout(() => stopRec(), S.tailSec * 1000); }

// ---------------- 手动操作 ----------------
function toDesign(e) { const b = cv.getBoundingClientRect(); const px = (e.clientX - b.left) * cv.width / b.width, py = (e.clientY - b.top) * cv.height / b.height; const L = designLayout(cv.width, cv.height); return [(px - L.ox) / L.s, (py - L.oy) / L.s]; }
function updateCursor() { cv.style.cursor = handVisible() && S.hideCursor ? 'none' : 'pointer'; }
cv.addEventListener('pointerdown', e => { sfx.resume(); if (auto) return; const [x, y] = toDesign(e); try { cv.setPointerCapture(e.pointerId); } catch (_) { } finger.x = x; finger.y = y; finger.down = true; if (S.manualHand) finger.visible = true; grabs++; if (game.state === 'lc') { if (window.__PLAYABLE__) game.continueNext(); /* 编辑器内只认面板“⏭ 下一关”；试玩包无面板，点盘面续关 */ updateCursor(); return; } game.pointerDown(x, y); updateCursor(); });
cv.addEventListener('pointermove', e => { const [x, y] = toDesign(e); if (!auto) { finger.x = x; finger.y = y; if (S.manualHand) finger.visible = true; game.pointerMove(x, y); } updateCursor(); });
cv.addEventListener('pointerup', () => { if (auto) return; finger.down = false; game.pointerUp(); updateCursor(); });
cv.addEventListener('pointerleave', () => { if (!auto && !finger.down) { finger.visible = false; updateCursor(); } });
let grabs = 0;

// ---------------- 录制 + AE 记录 ----------------
let rec = null;
const ae = createAERecorder({ env: () => ({ S, items: curItems, view: VIEW, sprites: allSprites }), now: () => game.time * 1000, sfx, sprites: allSprites, version: APP_VERSION });
let curItems = [], aeLast = null;
function aeStart() { resetSpriteArchive(); ae.start(); setAeBtn(); status('AE 记录中…'); }
function aeStop() { const r = ae.stop(); if (r) aeLast = r; sfx.hook = null; setAeBtn(); status(r ? `AE 记录完成：${r.frames} 帧，${r.tracks.size} 个元素` : ''); return r; }
async function aeExport(r = aeLast, So) { if (ae.rec) aeStop(), r = aeLast; if (!r) { toast('没有 AE 记录：请先点“● 开始记录”或开启录制同步'); return null; } status('正在打包 AE 工程…'); const out = await ae.exportZip(r, So); download(out.blob, out.name); status(`AE 工程已导出：${out.name}（${out.stats.layers} 图层 / ${out.stats.keys} 关键帧）`); window.__lastAE = out; return out; }
async function do3D() {
  if (ae.rec) aeStop(); if (!aeLast) { toast('没有记录：请先自动通关（或录制/AE 记录）'); return null; }
  status('正在生成 3D 动画…'); const aeR = await ae.exportZip(aeLast, { aeSampling: 'bake', aeNames: 'en', aeSize: 'canvas' }); const AS = allSprites();
  const r = await export3D({ S, aeResult: aeR, api: { colorHex: c => game.color(c), spriteK: id => AS[id] ? AS[id].c.width / AS[id].w : 1 } });
  download(r.blob, r.name); status(`3D 已导出：${r.name}（圆环 ${r.stats.rings} / 球 ${r.stats.balls} / 平面 ${r.stats.quads}）`); window.__last3D = r; return r;
}
function setAeBtn() { const b = ui.aeToggle; if (b) b.textContent = ae.rec ? '■ 停止记录' : '● 开始记录'; }
function pickMime() { const c = S.recFormat === 'webm' ? ['video/webm;codecs=vp9,opus', 'video/webm'] : S.recFormat === 'mp4' ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'] : ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']; return c.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || ''; }
function startRec() { sfx.resume(); const st = cv.captureStream(+S.recFps); sfx.ensure(); if (sfx.dest) sfx.dest.stream.getAudioTracks().forEach(t => st.addTrack(t)); const mime = pickMime(); const mr = new MediaRecorder(st, { mimeType: mime || undefined, videoBitsPerSecond: S.recBitrate * 1e6 }); const chunks = []; mr.ondataavailable = e => e.data.size && chunks.push(e.data); mr.onstop = () => { const type = mr.mimeType || 'video/webm'; const blob = new Blob(chunks, { type }); window.__lastRec = { size: blob.size, type }; download(blob, `${TOOL_ID}_${stamp()}.${type.includes('mp4') ? 'mp4' : 'webm'}`); }; mr.start(200); rec = mr; ui.recBtn.textContent = '■ 停止录制'; $('recInfo').textContent = '● 录制中'; if (S.aeWithRec && !ae.rec) aeStart(); }
function stopRec() { if (!rec) return; rec.stop(); rec = null; ui.recBtn.textContent = '⏺ 开始录制'; $('recInfo').textContent = ''; if (S.aeWithRec && ae.rec) { aeStop(); aeExport().catch(e => toast('AE 导出失败：' + e.message)); } }
function stamp() { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }
function download(blob, name) { window.__downloads = (window.__downloads || []).concat(name); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }

// ---------------- 游戏控制 ----------------
function restart() { game.coins = S.coinStart; game.loadLevel((Q.has('level') ? +Q.get('level') : S.startLevel) - 1); } /* ?level=20 直达第 20 关 */
function newRound() { game.seed = (Math.random() * 1e9) | 0; game.loadLevel(game.levelIdx, { shuffle: true }); }

// ---------------- UI ----------------
const ui = {};
function buildUI() {
  $('ver').textContent = 'v' + APP_VERSION;
  ui.autoBtn = $('btnAuto'); ui.autoBtn.onclick = () => auto ? autoStop() : autoStart();
  ui.recBtn = $('btnRec'); ui.recBtn.onclick = () => rec ? stopRec() : startRec();
  $('btnRestart').onclick = () => { autoStop(); restart(); };
  $('btnNew').onclick = () => { autoStop(); newRound(); };
  $('btnNext').onclick = () => { autoStop(); game.loadLevel((game.levelIdx + 1) % game.levels().length); };
  $('btnShot').onclick = () => cv.toBlob(b => download(b, `${TOOL_ID}_${stamp()}.png`));
  $('btnExport').onclick = () => download(new Blob([exportSettingsJSON(S)], { type: 'application/json' }), `${TOOL_ID}_settings_${stamp()}.json`);
  const imp = $('importFile'); $('btnImport').onclick = () => imp.click();
  imp.onchange = () => { const f = imp.files[0]; if (!f) return; f.text().then(t => { try { S = importSettingsJSON(t); onSettings(true); toast('设置已导入'); } catch (e) { toast('导入失败：' + e.message); } imp.value = ''; }); };
  $('btnReset').onclick = () => { if (DET || confirm('恢复全部默认设置？')) { S = { ...DEFAULTS }; onSettings(true); toast('已恢复默认'); } };
  buildPanel(); bindPress(document.getElementById('panelHead')); if (!buildPanel.entered) { buildPanel.entered = 1; panelEntrance(); }
}
const ACTIONS = { _aeToggle: () => ae.rec ? aeStop() : aeStart(), _aeExport: () => aeExport().catch(e => toast('AE 导出失败：' + e.message)), _export3d: () => do3D().catch(e => toast('3D 导出失败：' + e.message)), _exportH5: () => exportH5().catch(e => toast('H5 导出失败：' + e.message)) };
function buildPanel() {
  const P = $('panelBody'); P.innerHTML = '';
  const advD = document.createElement('details'); advD.className = 'adv'; advD.id = 'advSettings'; advD.open = !!buildPanel.advOpen; advD.ontoggle = () => { buildPanel.advOpen = advD.open; };
  { const s = document.createElement('summary'); s.textContent = ADV_GROUP + '（不常用）'; advD.appendChild(s); }
  for (const [gname, items] of SCHEMA) {
    const d = document.createElement('details'); d.open = gname === '关卡与玩法' || gname === '主题'; const s = document.createElement('summary'); s.textContent = gname; d.appendChild(s);
    let advHead = null;
    for (const [k, label, t, def, ex = {}] of items) {
      const host = ex.adv ? (advHead || (advHead = (() => { const h = document.createElement('div'); h.className = 'advSub'; h.textContent = gname; advD.appendChild(h); return advD; })())) : d;
      const row = document.createElement('label'); row.className = 'row'; const sp = document.createElement('span'); sp.textContent = label; row.appendChild(sp); let inp;
      if (t === 'button') { inp = document.createElement('button'); inp.textContent = label; inp.id = 'btn' + k; sp.textContent = ''; inp.onclick = e => { e.preventDefault(); ACTIONS[k] && ACTIONS[k](); }; if (k === '_aeToggle') ui.aeToggle = inp; }
      else if (t === 'bool') { inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = !!S[k]; inp.onchange = () => set(k, inp.checked); row.classList.add('t-switch'); }
      else if (t === 'select') { inp = document.createElement('select'); ex.options.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; inp.appendChild(o); }); inp.value = S[k]; inp.onchange = () => set(k, typeof def === 'number' ? +inp.value : inp.value); }
      else if (t === 'num') { inp = document.createElement('input'); inp.type = 'number'; Object.assign(inp, { min: ex.min, max: ex.max, step: ex.step }); inp.value = S[k]; inp.onchange = () => set(k, +inp.value); }
      else if (t === 'color') { inp = document.createElement('input'); inp.type = 'color'; inp.value = S[k]; inp.oninput = () => set(k, inp.value); }
      else if (t === 'area') { inp = document.createElement('textarea'); inp.value = S[k]; inp.onchange = () => set(k, inp.value); }
      else if (t === 'file') { inp = document.createElement('span'); const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.onchange = () => { const r = new FileReader(); r.onload = () => set(k, r.result); r.readAsDataURL(f.files[0]); }; const c = document.createElement('button'); c.textContent = '内置'; c.onclick = e => { e.preventDefault(); set(k, k === 'handImage' ? DEFAULT_HAND : ''); }; const x = document.createElement('button'); x.textContent = '清除'; x.onclick = e => { e.preventDefault(); set(k, ''); }; inp.append(f, c, x); }
      else { inp = document.createElement('input'); inp.type = 'text'; inp.value = S[k]; inp.onchange = () => set(k, inp.value); }
      if (t !== 'button') inp.dataset.key = k; if (ex.adv) row.dataset.adv = '1';
      if (t === 'bool') { row.appendChild(makeSwitch(inp)); host.appendChild(row); continue; }
      if (k === 'theme') { const tp = themePicker(inp, ex.options); tp.prepend(sp); sp.className = 'tp-l'; host.appendChild(tp); continue; }
      row.classList.add('t-' + t); row.appendChild(inp); host.appendChild(row);
    }
    P.appendChild(d);
  }
  P.appendChild(advD);
  enhanceSections(P);
  setAeBtn();
}
const RELOAD_KEYS = new Set(['levelsJson', 'beltSlots', 'ballRadius', 'ringThick', 'colorMap', 'useArtGap', 'startLevel', 'boxCapacity']);
function set(k, v) { S[k] = v; if (k === 'h5Device') applyH5DevicePresetToSettings(S); if (k === 'h5DeviceW' || k === 'h5DeviceH') markH5DeviceCustomIfSizeEdited(S); onSettings(k.startsWith('h5Device'), k); }
function onSettings(rebuild, k) { game.S = S; saveSettings(S); if (rebuild) buildPanel(); if (rebuild || k === 'canvasW' || k === 'canvasH') applyCanvas(); else if (k === 'theme') applyTheme(); if (rebuild || (k && (k.startsWith('col') || k === 'ringThick' || k === 'boxCapacity'))) { game.spriteCache = {}; clearSprites(); } if ((rebuild && k !== 'h5Device' && !(k || '').startsWith('h5Device')) || RELOAD_KEYS.has(k)) game.loadLevel(rebuild ? S.startLevel - 1 : game.levelIdx); if (rebuild || k === 'handImage' || (k || '').startsWith('hand')) loadHand(); if (!S.manualHand && !auto) finger.visible = false; if (window.__h5EditorDeviceFit) window.__h5EditorDeviceFit(); updateCursor(); }
async function exportH5() { return exportH5PlayableFromPage({ toolId: TOOL_ID, S: { ...S, app: TOOL_ID }, status, toast, stripDataUrls: [DEFAULT_HAND] }); }

// ---------------- 主循环 ----------------
let lastHud = -1;
function frame(dt) {
  if (sfx.master) sfx.master.gain.value = S.sfxMute ? 0 : S.sfxVolume;
  autoUpdate(dt); finger.press += ((finger.down ? 1 : 0) - finger.press) * Math.min(1, dt * 20); game.update(dt);
  if (game.levelIdx !== lastHud) { lastHud = game.levelIdx; }
  curItems = frameItems(game, S, { bg, hand: handVisible() ? finger : null, handImg });
  drawItems(g, curItems); if (ae.rec) ae.sample(game.time * 1000); updateCursor();
}
let last = 0;
function loop(t) { const dt = Math.min(1 / 30, (t - (last || t)) / 1000); last = t; frame(dt); requestAnimationFrame(loop); }
// 测试钩子
window.__game = game; window.__S = () => S; window.__finger = finger; window.__ae = ae; window.__items = () => curItems;
window.__toClient = (x, y) => { const b = cv.getBoundingClientRect(); const L = designLayout(cv.width, cv.height); return [b.left + (x * L.s + L.ox) * b.width / cv.width, b.top + (y * L.s + L.oy) * b.height / cv.height]; };
window.__step = (n = 1, dt = 1 / 50) => { for (let i = 0; i < n; i++) frame(dt); };
window.__auto = on => on ? autoStart() : autoStop();
window.__setSettings = o => { Object.assign(S, o); onSettings(true); };
window.__spriteKeys = () => Object.keys(allSprites());
window.__aeStart = aeStart; window.__aeStop = aeStop; window.__aeExport = aeExport; window.__export3d = do3D; window.__exportH5 = exportH5; window.__startRec = startRec; window.__stopRec = stopRec;
window.__app = { TOOL_ID, SETTINGS_VERSION, APP_VERSION };

document.title = `${TOOL_ZH}核玩工具`;
const PLAY = applyPlayableMode({
  state: () => `${game.levelIdx}|${game.state}|${grabs}|${game.rings.filter(r => r.alive).length}|${game.balls.filter(b => b.state === 'free').length}|${game.rings.map(r => r.rot.toFixed(2)).join(',')}`,
  isEnded: () => game.isEnded(),
  autoPlay: () => autoStart(),
  applySettings: o => { S = { ...S, ...o }; game.S = S; },
  onResize: () => { },
});
if (!PLAY) { buildUI(); bindEditorDevicePreview(() => S); } else { ui.autoBtn = { textContent: '' }; ui.recBtn = { textContent: '' }; }
applyCanvas(); loadHand(); updateCursor();
Promise.all([assetsReady(), themeAssetsReady()]).then(() => { applyTheme(); if (Q.has('seed')) Math.random = (() => { let s = +Q.get('seed') || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); restart(); window.__ready = true; if (!DET) requestAnimationFrame(loop); else frame(0); });
