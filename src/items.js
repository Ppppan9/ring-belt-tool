// 逐帧元素表（frameItems）+ 精灵缓存：屏幕渲染、AE 导出、3D 导出共用同一份数据，保证三者一致。
// item = { id(稳定), asset(精灵键), x, y, sc, rot(弧度), op, z, add? }，坐标为设计坐标 864×1920。
import { GEO, TAU, ease, clamp, mix } from './game.js';
import { theme, spritePrefix, runJob } from './themes.js';
import { CLIP_NECK_LEN } from './game.js';
import { clipBlockHalf } from './levels.js';
import { RR, ballSprite, drawRing, drawBrick, star, drawTopUI, drawClampArt, designLayout } from './render.js';
export const VIEW = { x0: 0, y0: 0, w: 864, h: 1920 };
const KS = 2; // 小精灵超采样
// phase16：精灵仓库按“设置签名”(颜色/环粗/盒容量…)分库、键内含主题前缀 → 切换主题不清空，回切即用缓存。
let stores = {}, storeSig = '', cache = (stores[''] = {}), archive = {};
export function useSpriteStore(sig) { if (sig === storeSig) return; storeSig = sig; cache = stores[sig] || (stores[sig] = {}); const ks = Object.keys(stores); if (ks.length > 4) for (const k of ks.slice(0, ks.length - 4)) if (k !== sig) delete stores[k]; }
export function clearSprites() { Object.assign(archive, cache); cache = stores[storeSig] = {}; jobs.clear(); }
export function resetSpriteArchive() { archive = {}; }
export function allSprites() { return Object.assign({}, archive, cache); }
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
// 预算模式（仅交互主循环开启）：缺失精灵按时间片分帧生成；先出 1× 预览（lq:），全部预览就绪后再在空闲片补全高质量版本。
// 非预算模式（DET/测试步进/AE/3D/H5 导出）保持同步、全质量，结果与 phase15 完全一致。
export const BUDGET = { on: false, deadline: 0, slow: false, pending: 0, lqPending: 0, made: 0, lqAllDone: true, fbPrefix: null };
const jobs = new Map();
export function cancelSpriteJobs() { jobs.clear(); }
export function beginBudget(ms) { BUDGET.on = ms > 0; BUDGET.deadline = performance.now() + ms; BUDGET.lqAllDone = BUDGET.lqPending === 0; BUDGET.pending = 0; BUDGET.lqPending = 0; }
export function endBudget() { BUDGET.on = false; }
function build(key, w, h, ax, ay, fn, ks, ss) {
  let m = jobs.get(key); if (!m) jobs.set(key, m = new Map());
  const c = mk(w * ks, h * ks), g = c.getContext('2d'); g.scale(ks, ks); g.translate(ax, ay);
  const t0 = performance.now(); m.t = (m.t || 0); m.n = (m.n || 0) + 1; let r; try { r = runJob(m, BUDGET.deadline, () => fn(g), ss); } finally { m.t += performance.now() - t0; } if (!r) return null;
  jobs.delete(key); BUDGET.made++; (BUDGET.log || (BUDGET.log = [])).push([key, Math.round(m.t), m.n]); if (BUDGET.log.length > 200) BUDGET.log.shift(); return { s: { c, w, h, ax, ay }, usedSS: r.usedSS };
}
function need(key, w, h, ax, ay, fn, ks = KS) {
  const P = spritePrefix(); key = P + key; if (cache[key]) return key;
  if (!BUDGET.on) { const c = mk(w * ks, h * ks), g = c.getContext('2d'); g.scale(ks, ks); g.translate(ax, ay); fn(g); cache[key] = { c, w, h, ax, ay }; return key; }
  const hqK = P + 'mq:' + key.slice(P.length), lqK = P + 'lq:' + key.slice(P.length);
  if (cache[hqK]) return hqK;
  const t = performance.now() < BUDGET.deadline;
  if (cache[lqK]) { // 预览已有：所有预览就绪后才补全高质量
    if (!BUDGET.lqAllDone) return lqK; BUDGET.pending++; if (!t) return lqK;
    const r = build(hqK, w, h, ax, ay, fn, ks, 2); if (!r) return lqK; cache[hqK] = r.s; BUDGET.pending--; return hqK;
  }
  BUDGET.pending++; BUDGET.lqPending++; if (!t) return lqK;
  const r = build(lqK, w, h, ax, ay, fn, ks, 3); if (!r) return lqK; BUDGET.lqPending--;
  if (!r.usedSS) { cache[hqK] = r.s; BUDGET.pending--; return hqK; } // 无超采样的精灵：预览即最终
  cache[lqK] = r.s; return lqK;
}
const oid = new WeakMap(); let oidN = 0; const idOf = o => { let v = oid.get(o); if (v == null) { v = ++oidN; oid.set(o, v); } return v; };
const pop = k => { const x = clamp(k, 0, 1); return x < 0.6 ? ease(x / 0.6) * 1.12 : 1.12 - 0.12 * ease((x - 0.6) / 0.4); };

export function frameItems(game, S, ctx = {}) {
  const out = [], L = game.levelIdx, P = (id, asset, x, y, z, o = {}) => out.push({ id, asset, x, y, sc: o.sc ?? 1, rot: o.rot || 0, op: o.op ?? 1, z, add: !!o.add });
  // 背景（木板 + 传送带外壳，静态）
  if (ctx.bg) { const bk = spritePrefix() + 'background'; if (!cache[bk] || cache[bk].c !== ctx.bg) cache[bk] = { c: ctx.bg, w: 864, h: 1920, ax: 0, ay: 0 }; P('background', bk, 0, 0, 0); }
  // 传送带凹坑
  const n = game.belt.slots.length, pit = need('pit', 40, 40, 20, 20, g => { if (theme().pit) return theme().pit(g); g.beginPath(); g.ellipse(0, 0, 17, 15.5, 0, 0, TAU); g.fillStyle = '#2a2149'; g.fill(); g.beginPath(); g.ellipse(0, 2.5, 15, 12, 0, 0, TAU); g.fillStyle = '#1d1636'; g.fill(); });
  for (let i = 0; i < n; i++) { const p = game.beltPos(game.slotS(i)); P('pit_' + i, pit, p.x, p.y, 1); }
  // 容量灯（关卡限制传送带容量时，例如 L20 = 6）：中轴上一排小灯，已占用=黄，满=红
  if (game.belt.cap) { const used = game.belt.slots.filter(Boolean).length, full = used >= game.belt.cap;
    for (let i = 0; i < game.belt.cap; i++) { const st = i < used ? (full ? 'full' : 'on') : 'off', col = { on: '#ffd23a', full: '#ff3b3b', off: '#3a2f6a' }[st];
      const k = need('caplight_' + st, 22, 22, 11, 11, g => { if (theme().capLight) return theme().capLight(g, st); g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fillStyle = col; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.45)'; g.stroke(); if (st !== 'off') { g.beginPath(); g.arc(-2.5, -2.5, 2.5, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill(); } });
      P('caplight_' + i, k, 432 + (i - (game.belt.cap - 1) / 2) * 30, 1253.5, 1.5); } }
  // 盒子（托盘 = 栈顶，砖 = 下方排队）
  const boxKey = (box, tray) => { const k = tray ? `tray_${box.color}_${box.n}` : `brick_${box.color}`; return need(k, 180, 110, 90, 48, g => drawBrick(g, game, 0, -38, box, tray, S)); };
  game.cols.forEach(c => { const sh = c.shift > 0 ? ease(c.shift) * GEO.brickStride : 0; for (let k = c.stack.length - 1; k >= 0; k--) { const y = GEO.brickTop + (k === 0 ? 0 : 80 + (k - 1) * GEO.brickStride) + sh, b = c.stack[k]; P('box_' + idOf(b), boxKey(b, k === 0), c.x, y + 38, 2 + (c.stack.length - k) * 0.001); } });
  for (const f of game.flyBricks) { const t = f.t / 0.6; P('box_' + idOf(f.box), boxKey(f.box, true), f.x, f.y - 140 * ease(Math.min(1, t * 1.4)) + 38, 2.5, { sc: 1 + 0.15 * Math.sin(Math.min(1, t) * Math.PI), op: clamp(1 - Math.max(0, (t - 0.55) / 0.45), 0, 1) }); }
  // 球（统一以关卡球半径为基准精灵，缩放表示大小变化）
  const R0 = game.ballR, ballKey = color => { const col = game.color(color), s = Math.ceil(R0 * 2 + 6); return need(`ball_${color}_${R0}`, s, s, s / 2, s / 2, g => { const sp = ballSprite(game.spriteCache, col, R0, color); g.drawImage(sp, -(sp.dw || sp.width) / 2, -(sp.dw || sp.height) / 2, sp.dw || sp.width, sp.dw || sp.height); }); };
  for (let i = 0; i < n; i++) { const b = game.belt.slots[i]; if (!b) continue; const p = game.beltPos(game.slotS(i)), k = ease(Math.min(1, b.snap)); P('ball_' + b.id, ballKey(b.color), b.sx + (p.x - b.sx) * k, b.sy + (p.y - b.sy) * k, 3, { sc: b.r / R0 }); }
  for (const d of game.drops) { const t = Math.min(1, d.t), hx = d.col.x + (d.hole - (S.boxCapacity - 1) / 2) * 44, hy = GEO.brickTop + 32; P('ball_' + d.b.id, ballKey(d.b.color), d.x0 + (hx - d.x0) * ease(t), d.y0 + (hy - d.y0) * t * t, 3, { sc: (game.beltR + (15 - game.beltR) * t) / R0 }); }
  for (const b of game.balls) if (b.state === 'free') P('ball_' + b.id, ballKey(b.color), b.x, b.y, 3.5, { sc: b.r / R0 });
  // 环 + 连杆 + 夹子
  const T = S.ringThick, alive = game.rings.filter(r => r.alive).sort((a, b) => (a.z || 0) - (b.z || 0));
  const ZR = {}; { // 层级：父环(夹子同色环)永远压在其子环之上 → 夹块可同时「在父环之下、子环之上」
    const dep = r => { let d = 0, q = r; while (q.p && q.p.alive && d < 50) { q = q.p; d++; } return d; };
    alive.map((r, i) => [r, i, dep(r)]).sort((a, b) => b[2] - a[2] || a[1] - b[1]).forEach(([r], k) => { ZR[r.id] = 4 + k * 0.001; }); }
  alive.forEach((r, i) => {
    const half = Math.ceil((r.R + T) * 2 * (r.spriteScale || 1) + 30); let key = `ring_${r.closed ? 'closed' : 'open'}_${r.color}_${r.R}_${r.gapC.toFixed(3)}_${r.gapW.toFixed(3)}_${r.sprite || ''}`;
    key = need(key, half * 2, half * 2, half, half, g => drawRing(g, game, { ...r, c: [0, 0], rot: 0, hl: 0 }, T));
    const z = ZR[r.id]; P(`ring_L${L + 1}_${r.id}`, key, r.c[0], r.c[1], z, { rot: r.rot + (r.shakeT > 0 ? Math.sin(r.shakeT * 70) * 0.05 * r.shakeT / 0.3 : 0) });
    if (theme().ringShadow) { // 分层软投影：世界坐标右下偏移（不随环旋转），贴地接触影 + 大范围柔影
      const shK = BUDGET.on && BUDGET.slow ? Math.max(0.5, KS / 2) : KS; // 慢设备：柔影半分辨率（blur 滤镜不可分片，代价 ∝ 像素数）；filter 模糊按像素计 → 半径同比缩放
      const sk = b => need(`rshadow${b}_${key}`, half * 2, half * 2, half, half, g => theme().ringShadow(g, game, r, b * shK / KS), shK);
      P(`ringsh2_L${L + 1}_${r.id}`, sk(16), r.c[0] + 13, r.c[1] + 21, 3.40 + z * 0.001, { rot: r.rot, op: 0.62 });
      P(`ringsh1_L${L + 1}_${r.id}`, sk(4), r.c[0] + 4, r.c[1] + 6, 3.41 + z * 0.001, { rot: r.rot, op: 0.72 });
    }
    if (r.hl > 0.01) P(`ringhl_L${L + 1}_${r.id}`, key, r.c[0], r.c[1], z + 0.0005, { rot: r.rot, op: r.hl * 0.5, add: true });
  });
  for (const r of game.rings) if (r.p && r.p.alive && r.clampLocal) {
    const p = r.p, cl = r.clampLocal, len0 = Math.hypot(cl[0], cl[1]), ux = cl[0] / len0, uy = cl[1] / len0, col = game.color(p.color), dark = mix(col, '#000000', 0.35);
    const cg = clipGeom(r), off = cg.off, len = len0 + off, half = Math.ceil(len + 20); r.clipOff = off; // 颈部：父环外沿 → 夹块内沿，至少 CLIP_NECK_LEN 可见
    const lk = need(`link_L${L + 1}_${r.id}_${p.color}_n${off.toFixed(1)}`, half * 2, half * 2, half, half, g => { if (theme().link) return theme().link(g, p, r, ux, uy, len, col); g.beginPath(); g.moveTo(p.R * ux, p.R * uy); g.lineTo(ux * (len - cg.blockHalf * 0.5), uy * (len - cg.blockHalf * 0.5)); g.lineCap = 'butt'; const nw = 48 * (r.R / 151) * (r.clampScale || 1); g.lineWidth = nw + 4; g.strokeStyle = dark; g.stroke(); g.lineWidth = nw; g.strokeStyle = col; g.stroke(); }); // 颈部：与父环同色，宽度=夹子颈宽，从父环中心线接到夹块
    P(`link_L${L + 1}_${r.id}`, lk, p.c[0], p.c[1], (ZR[p.id] ?? 5) - 0.0004, { rot: r._frz ? r._frz.prot : p.rot }); // 颈部压在父环下面
    const cw0 = game.clampWorld(r), du = Math.hypot(cw0[0] - p.c[0], cw0[1] - p.c[1]) || 1, cw = [cw0[0] + (cw0[0] - p.c[0]) / du * off, cw0[1] + (cw0[1] - p.c[1]) / du * off], a = Math.atan2(cw0[1] - r.c[1], cw0[0] - r.c[0]), w = T + 14, h = T + 12, cs = Math.ceil(Math.max(w, h, 160 * (r.R / 151) * (r.clampScale || 1)) + 20);
    const ck = need(`clip_${p.color}_${r.R}_${r.clampSprite || ''}_${r.clampRot ?? ''}`, cs, cs, cs / 2, cs / 2, g => { if (drawClampArt(g, game, r)) return; RR(g, -w / 2, -h / 2 + 2, w, h, 5); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill(); RR(g, -w / 2, -h / 2, w, h, 5); const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0); gr.addColorStop(0, mix(col, '#ffffff', 0.35)); gr.addColorStop(0.5, col); gr.addColorStop(1, dark); g.fillStyle = gr; g.fill(); g.lineWidth = 2; g.strokeStyle = dark; g.stroke(); });
    const zp = ZR[p.id] ?? 5, zc = ZR[r.id] ?? 4, zClip = Math.max(zc + 0.0006, zp - 0.0002); // 夹块：在父环(同色)之下、被夹子环之上
    r._clipC = cw; P(`clip_L${L + 1}_${r.id}`, ck, cw[0], cw[1], zClip, { rot: a + Math.PI / 2 });
  }
  // 碎片 / 星星
  for (const s of game.shards) { const k = need(`shard_${s.k}_${s.col}`, 40, 40, 20, 20, g => { const z = 15; g.beginPath(); if (s.k === 0) { g.moveTo(-z, -z * 0.6); g.lineTo(z * 0.8, -z); g.lineTo(z, z * 0.5); g.lineTo(-z * 0.5, z); } else if (s.k === 1) { g.moveTo(0, -z); g.lineTo(z, z * 0.7); g.lineTo(-z, z * 0.5); } else { g.moveTo(-z, 0); g.lineTo(0, -z); g.lineTo(z, 0); g.lineTo(0, z); } g.closePath(); g.fillStyle = s.col; g.fill(); g.lineWidth = 2; g.strokeStyle = mix(s.col, '#000000', 0.35); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(-z * 0.3, -z * 0.3, z * 0.25, 0, TAU); g.fill(); });
    P('shard_' + idOf(s), k, s.x, s.y, 6, { sc: s.s / 30, rot: s.a, op: clamp(1 - (s.t / s.life - 0.6) / 0.4, 0, 1) }); }
  const stK = need('star', 44, 44, 22, 22, g => { if (theme().sparkle) return theme().sparkle(g); star(g, 0, 0, 20, 0); g.fillStyle = '#ffe23a'; g.fill(); }), flK = need('flash', 84, 84, 42, 42, g => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 40); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.fill(); });
  for (const s of game.stars) { const a = clamp(1 - s.t / s.life, 0, 1), id = idOf(s); if (s.flash && s.t < 0.2) P('flash_' + id, flK, s.x, s.y, 6.5, { op: a }); P('star_' + id, stK, s.x, s.y, 6.6, { sc: s.s / 20, rot: s.t * 4, op: a }); }
  // 顶部 UI
  const hudOp = 1; // 视频：过关页出现时顶部 Level/暂停 立即隐藏
  P('hud', need(`hud_${L + 1}`, 520, 125, -320, -102, g => drawTopUI(g, game, S)), 0, 0, 7, { op: hudOp });
  if (game.hintOn && L === 0 && S.hintText) P('hint', need('hint_' + S.hintText, 864, 120, 432, 60, g => { g.font = '700 58px RB, Roboto, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = '#111'; g.strokeText(S.hintText, 0, 0); g.fillStyle = '#fff'; g.fillText(S.hintText, 0, 0); }, 1), 432, 388, 7.1);
  /* 结算页已移除 */
  // 手指
  if (ctx.hand && ctx.handImg) { const f = ctx.hand, im = ctx.handImg, iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height; if (iw) {
    const w = 864 * S.handSize, h = w * ih / iw, ax = (S.handFlip ? 1 - S.handAnchorX : S.handAnchorX) * w, ay = S.handAnchorY * h;
    const hk = need('hand', w, h, ax, ay, g => { g.translate(-ax, -ay); if (S.handFlip) { g.translate(w, 0); g.scale(-1, 1); } g.drawImage(im, 0, 0, w, h); }, Math.max(1, Math.min(2, iw / w)));
    if (S.tapRipple && f.press > 0.5) P('ripple', need('ripple', 72, 72, 36, 36, g => { g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 4; g.stroke(); }), f.x, f.y, 39);
    P('hand', hk, f.x, f.y, 40, { sc: 1 - (S.pressEnabled ? f.press * S.pressDepth : 0), rot: (S.handRotation || 0) * Math.PI / 180 }); } }
  return out;
}
// 把元素表画到画布（屏幕显示、截图、录制都走这里）
// 生成中的兜底：用上一主题同名精灵（同一仓库），保证画面不空、游戏照常进行
function fallback(sprites, k) { const fp = BUDGET.fbPrefix; if (fp == null) return null; const P = spritePrefix(); if (!k.startsWith(P)) return null; let r = k.slice(P.length).replace(/^(lq|mq):/, ''); return sprites[fp + r] || sprites[fp + 'mq:' + r] || sprites[fp + 'lq:' + r] || null; }
export function drawItems(g, items, sprites = cache) {
  const L = designLayout(g.canvas.width, g.canvas.height);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.fillStyle = '#b98047'; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  const list = items.map((it, i) => [it, i]).sort((a, b) => a[0].z - b[0].z || a[1] - b[1]);
  for (const [it] of list) { const s = sprites[it.asset] || archive[it.asset] || fallback(sprites, it.asset); if (!s || it.op <= 0.001) continue;
    g.setTransform(L.s, 0, 0, L.s, L.ox, L.oy); g.translate(it.x, it.y); if (it.rot) g.rotate(it.rot); if (it.sc !== 1) g.scale(it.sc, it.sc);
    g.globalAlpha = clamp(it.op, 0, 1); g.globalCompositeOperation = it.add ? 'lighter' : 'source-over'; g.drawImage(s.c, -s.ax, -s.ay, s.w, s.h); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

// 夹扣颈部几何：夹块中心 = 夹点(子环中心线)，不再外推；颈部 = 父环外沿 → 夹块内沿
export function clipGeom(r) {
  const p = r.p, len = Math.hypot(r.clampLocal[0], r.clampLocal[1]), th = theme().tubeHalf ? theme().tubeHalf(p.R) : p.R * 25 / 151;
  const blockHalf = clipBlockHalf(r), gap = len - p.R - th;
  return { gap, blockHalf, off: 0, neck: gap - blockHalf };
}
