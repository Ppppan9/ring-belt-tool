// 逐帧元素表（frameItems）+ 精灵缓存：屏幕渲染、AE 导出、3D 导出共用同一份数据，保证三者一致。
// item = { id(稳定), asset(精灵键), x, y, sc, rot(弧度), op, z, add? }，坐标为设计坐标 864×1920。
import { GEO, TAU, ease, clamp, mix } from './game.js';
import { theme, spritePrefix } from './themes.js';
import { RR, ballSprite, drawRing, drawBrick, star, drawTopUI, drawCoin, coinStack, bubbleText, drawClampArt, designLayout } from './render.js';
export const VIEW = { x0: 0, y0: 0, w: 864, h: 1920 };
const KS = 2; // 小精灵超采样
let cache = {}, archive = {};
export function clearSprites() { Object.assign(archive, cache); cache = {}; }
export function resetSpriteArchive() { archive = {}; }
export function allSprites() { return Object.assign({}, archive, cache); }
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
function need(key, w, h, ax, ay, fn, ks = KS) { key = spritePrefix() + key; let s = cache[key]; if (s) return key; const c = mk(w * ks, h * ks), g = c.getContext('2d'); g.scale(ks, ks); g.translate(ax, ay); fn(g); cache[key] = { c, w, h, ax, ay }; return key; }
const oid = new WeakMap(); let oidN = 0; const idOf = o => { let v = oid.get(o); if (v == null) { v = ++oidN; oid.set(o, v); } return v; };
const pop = k => { const x = clamp(k, 0, 1); return x < 0.6 ? ease(x / 0.6) * 1.12 : 1.12 - 0.12 * ease((x - 0.6) / 0.4); };

export function frameItems(game, S, ctx = {}) {
  const out = [], L = game.levelIdx, P = (id, asset, x, y, z, o = {}) => out.push({ id, asset, x, y, sc: o.sc ?? 1, rot: o.rot || 0, op: o.op ?? 1, z, add: !!o.add });
  // 背景（木板 + 传送带外壳，静态）
  if (ctx.bg) { const bk = spritePrefix() + 'background'; cache[bk] || (cache[bk] = { c: ctx.bg, w: 864, h: 1920, ax: 0, ay: 0 }); P('background', bk, 0, 0, 0); }
  // 传送带凹坑
  const n = game.belt.slots.length, pit = need('pit', 40, 40, 20, 20, g => { if (theme().pit) return theme().pit(g); g.beginPath(); g.ellipse(0, 0, 17, 15.5, 0, 0, TAU); g.fillStyle = '#2a2149'; g.fill(); g.beginPath(); g.ellipse(0, 2.5, 15, 12, 0, 0, TAU); g.fillStyle = '#1d1636'; g.fill(); });
  for (let i = 0; i < n; i++) { const p = game.beltPos(game.slotS(i)); P('pit_' + i, pit, p.x, p.y, 1); }
  // 容量灯（关卡限制传送带容量时，例如 L20 = 6）：中轴上一排小灯，已占用=黄，满=红
  if (game.belt.cap) { const used = game.belt.slots.filter(Boolean).length, full = used >= game.belt.cap;
    for (let i = 0; i < game.belt.cap; i++) { const st = i < used ? (full ? 'full' : 'on') : 'off', col = { on: '#ffd23a', full: '#ff3b3b', off: '#3a2f6a' }[st];
      const k = need('caplight_' + st, 22, 22, 11, 11, g => { g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fillStyle = col; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.45)'; g.stroke(); if (st !== 'off') { g.beginPath(); g.arc(-2.5, -2.5, 2.5, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill(); } });
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
      const sk = b => need(`rshadow${b}_${key}`, half * 2, half * 2, half, half, g => theme().ringShadow(g, game, r, b));
      P(`ringsh2_L${L + 1}_${r.id}`, sk(16), r.c[0] + 13, r.c[1] + 21, 3.40 + z * 0.001, { rot: r.rot, op: 0.62 });
      P(`ringsh1_L${L + 1}_${r.id}`, sk(4), r.c[0] + 4, r.c[1] + 6, 3.41 + z * 0.001, { rot: r.rot, op: 0.72 });
    }
    if (r.hl > 0.01) P(`ringhl_L${L + 1}_${r.id}`, key, r.c[0], r.c[1], z + 0.0005, { rot: r.rot, op: r.hl * 0.5, add: true });
  });
  for (const r of game.rings) if (r.p && r.p.alive && r.clampLocal) {
    const p = r.p, cl = r.clampLocal, len = Math.hypot(cl[0], cl[1]), ux = cl[0] / len, uy = cl[1] / len, col = game.color(p.color), dark = mix(col, '#000000', 0.35), half = Math.ceil(len + 20);
    const lk = need(`link_L${L + 1}_${r.id}_${p.color}`, half * 2, half * 2, half, half, g => { if (theme().link) return theme().link(g, p, r, ux, uy, len, col); g.beginPath(); g.moveTo(p.R * ux, p.R * uy); g.lineTo(cl[0] - ux * 20 * (r.R / 151), cl[1] - uy * 20 * (r.R / 151)); g.lineCap = 'butt'; const nw = 48 * (r.R / 151) * (r.clampScale || 1); g.lineWidth = nw + 4; g.strokeStyle = dark; g.stroke(); g.lineWidth = nw; g.strokeStyle = col; g.stroke(); }); // 颈部：与父环同色，宽度=夹子颈宽，从父环中心线接到夹块
    P(`link_L${L + 1}_${r.id}`, lk, p.c[0], p.c[1], (ZR[p.id] ?? 5) - 0.0004, { rot: p.rot }); // 颈部压在父环下面
    const cw = game.clampWorld(r), a = Math.atan2(cw[1] - r.c[1], cw[0] - r.c[0]), w = T + 14, h = T + 12, cs = Math.ceil(Math.max(w, h, 160 * (r.R / 151) * (r.clampScale || 1)) + 20);
    const ck = need(`clip_${p.color}_${r.R}_${r.clampSprite || ''}_${r.clampRot ?? ''}`, cs, cs, cs / 2, cs / 2, g => { if (drawClampArt(g, game, r)) return; RR(g, -w / 2, -h / 2 + 2, w, h, 5); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill(); RR(g, -w / 2, -h / 2, w, h, 5); const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0); gr.addColorStop(0, mix(col, '#ffffff', 0.35)); gr.addColorStop(0.5, col); gr.addColorStop(1, dark); g.fillStyle = gr; g.fill(); g.lineWidth = 2; g.strokeStyle = dark; g.stroke(); });
    const zp = ZR[p.id] ?? 5, zc = ZR[r.id] ?? 4, zClip = Math.max(zc + 0.0006, zp - 0.0002); // 夹块：在父环(同色)之下、被夹子环之上
    P(`clip_L${L + 1}_${r.id}`, ck, cw[0], cw[1], zClip, { rot: a + Math.PI / 2 });
  }
  // 碎片 / 星星
  for (const s of game.shards) { const k = need(`shard_${s.k}_${s.col}`, 40, 40, 20, 20, g => { const z = 15; g.beginPath(); if (s.k === 0) { g.moveTo(-z, -z * 0.6); g.lineTo(z * 0.8, -z); g.lineTo(z, z * 0.5); g.lineTo(-z * 0.5, z); } else if (s.k === 1) { g.moveTo(0, -z); g.lineTo(z, z * 0.7); g.lineTo(-z, z * 0.5); } else { g.moveTo(-z, 0); g.lineTo(0, -z); g.lineTo(z, 0); g.lineTo(0, z); } g.closePath(); g.fillStyle = s.col; g.fill(); g.lineWidth = 2; g.strokeStyle = mix(s.col, '#000000', 0.35); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(-z * 0.3, -z * 0.3, z * 0.25, 0, TAU); g.fill(); });
    P('shard_' + idOf(s), k, s.x, s.y, 6, { sc: s.s / 30, rot: s.a, op: clamp(1 - (s.t / s.life - 0.6) / 0.4, 0, 1) }); }
  const stK = need('star', 44, 44, 22, 22, g => { star(g, 0, 0, 20, 0); g.fillStyle = '#ffe23a'; g.fill(); }), flK = need('flash', 84, 84, 42, 42, g => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 40); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.fill(); });
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
function lcItems(game, S, P) {
  const t = game.lcT, out = game.state === 'lcOut', fa = out ? clamp(1 - t / 0.35, 0, 1) : clamp(t / 0.12, 0, 1), ct = out ? 3 : t;
  P('lc_dim', need('lc_dim', 864, 1920, 0, 0, g => { g.fillStyle = 'rgba(20,8,0,0.66)'; g.fillRect(0, 0, 864, 1920); }, 0.25), 0, 0, 20, { op: fa });
  P('lc_rays', need('lc_rays', 680, 680, 340, 340, g => { const glow = g.createRadialGradient(0, 0, 10, 0, 0, 330); glow.addColorStop(0, 'rgba(255,240,170,0.95)'); glow.addColorStop(0.35, 'rgba(255,215,90,0.55)'); glow.addColorStop(1, 'rgba(255,200,60,0)'); g.fillStyle = glow; g.beginPath(); g.arc(0, 0, 330, 0, TAU); g.fill(); for (let i = 0; i < 18; i++) { g.rotate(TAU / 18); g.beginPath(); g.moveTo(0, 0); g.lineTo(330, -22); g.lineTo(330, 22); g.closePath(); const rg = g.createLinearGradient(0, 0, 330, 0); rg.addColorStop(0, 'rgba(255,250,200,0.55)'); rg.addColorStop(1, 'rgba(255,230,120,0)'); g.fillStyle = rg; g.fill(); } }, 1), 432, 800, 20.1, { rot: ct * 0.25, op: fa });
  P('lc_coins', need('lc_coins', 560, 500, 280, 260, g => coinStack(g, 0, 0, 1)), 432, 815, 20.2, { sc: 1.0 * pop(ct / 0.4), op: fa });
  P('lc_level', need('lc_level', 900, 220, 450, 110, g => bubbleText(g, 'LEVEL', 0, 0, 104)), 432, 315, 20.3, { sc: pop((ct - 0.05) / 0.35), op: fa });
  P('lc_complete', need('lc_complete', 1000, 220, 500, 110, g => bubbleText(g, 'COMPLETE', 0, 0, 104)), 432, 443, 20.4, { sc: pop((ct - 0.12) / 0.35), op: fa });
  P('lc_amount', need('lc_amount_' + S.coinPerLevel, 300, 90, 150, 45, g => { g.font = '700 62px RB, Roboto, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(String(S.coinPerLevel), 0, 0); }), 432, 990, 20.5, { op: fa * clamp((ct - 0.2) / 0.2, 0, 1) });
  if (game.confetti) game.confetti.forEach((c, i) => { const tt = Math.min(ct, 3), x = c.x + c.vx * (1 - Math.exp(-tt * 2.2)) / 2.2 + Math.sin(tt * 3 + c.curl) * 20, y = c.y + c.vy * (1 - Math.exp(-tt * 2.2)) / 2.2 + 140 * tt * tt * 0.5 + 60 * tt, w = Math.round(c.w), h = Math.round(c.h);
    P('confetti_' + i, need(`confetti_${c.c}_${w}_${h}`, w + 2, h + 2, (w + 2) / 2, (h + 2) / 2, g => { g.fillStyle = c.c; g.fillRect(-w / 2, -h / 2, w, h); }), x, y, 21, { rot: c.a + c.va * tt, sc: 0.35 + 0.65 * Math.abs(Math.cos(tt * 6 + c.curl)), op: fa * clamp(2.6 - tt, 0, 1) }); });
  const pk = need('puff', 200, 160, 100, 80, g => { g.fillStyle = '#fff'; const r = 50; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(Math.cos(k * 1.6) * r * 0.8, Math.sin(k * 1.6) * r * 0.6, r * 0.75, 0, TAU); g.fill(); } });
  if (game.puffs) game.puffs.forEach((p, i) => { const tt = ct - p.d; if (tt < 0 || tt > 1.6) return; P('puff_' + i, pk, p.x + p.vx * tt, p.y + p.vy * tt, 21.5, { sc: p.r * (0.6 + tt * 0.8) / 50, op: fa * clamp(1 - tt / 1.6, 0, 1) * 0.95 }); });
  const ft = ct - 0.45; /* 视频：0.4s 金币条出现，随后金币飞入 */ game.coinShown = game.coinFrom + (game.coins - game.coinFrom) * clamp((ft - 0.15) / 0.5, 0, 1); const v = Math.round(game.coinShown);
  P('lc_coinpill', need('coinpill_' + v, 260, 90, -20, -120, g => { const R = (x, y, w, h, r) => RR(g, x, y, w, h, r); R(50, 132, 230, 58, 29); g.fillStyle = 'rgba(30,15,10,0.55)'; g.fill(); drawCoin(g, 60, 161, 34, 0); g.font = '700 32px RB, Roboto, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(String(v), 160, 162); R(222, 137, 48, 48, 10); g.fillStyle = '#2fae2f'; g.fill(); R(225, 139, 42, 40, 9); g.fillStyle = '#5ee34a'; g.fill(); g.fillStyle = '#fff'; g.fillRect(242, 149, 8, 24); g.fillRect(234, 157, 24, 8); }), 0, 0, 22, { op: fa * clamp(ft / 0.08, 0, 1) });
  const ck = need('coin', 70, 70, 35, 35, g => drawCoin(g, 0, 0, 30, 0.1));
  if (!out) for (let i = 0; i < 6; i++) { const k = clamp((ft - i * 0.1) / 0.45, 0, 1); if (k <= 0 || k >= 1) continue; P('flycoin_' + i, ck, 432 + (60 - 432) * ease(k) + Math.sin(k * Math.PI) * (i % 2 ? 80 : -60), 815 + (161 - 815) * ease(k), 22.5); }
  const bt = ct - 0.18; /* 视频：过关 0.2s 后 CONTINUE 弹出 */ if (bt > 0 || out) { const sc = (out ? 1 : pop(bt / 0.3)) * (1 + 0.04 * Math.sin(Math.max(0, bt - 0.3) * 6));
    P('lc_continue', need('lc_continue', 230, 110, 115, 52, g => { RR(g, -104, -40, 208, 88, 20); g.fillStyle = '#0a4b8a'; g.fill(); RR(g, -104, -44, 208, 84, 20); g.fillStyle = '#ffffff'; g.fill(); RR(g, -98, -38, 196, 72, 15); const bg = g.createLinearGradient(0, -38, 0, 34); bg.addColorStop(0, '#5ff0ff'); bg.addColorStop(1, '#13b4f0'); g.fillStyle = bg; g.fill(); RR(g, -90, -34, 180, 26, 12); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fill(); g.font = '30px LI, "Lilita One", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 5; g.strokeStyle = '#0b5aa0'; g.strokeText('CONTINUE', 0, 0); g.fillStyle = '#fff'; g.fillText('CONTINUE', 0, 0); }), 432, 1170, 23, { sc, op: fa }); }
}
// 把元素表画到画布（屏幕显示、截图、录制都走这里）
export function drawItems(g, items, sprites = cache) {
  const L = designLayout(g.canvas.width, g.canvas.height);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.fillStyle = '#b98047'; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  const list = items.map((it, i) => [it, i]).sort((a, b) => a[0].z - b[0].z || a[1] - b[1]);
  for (const [it] of list) { const s = sprites[it.asset] || archive[it.asset]; if (!s || it.op <= 0.001) continue;
    g.setTransform(L.s, 0, 0, L.s, L.ox, L.oy); g.translate(it.x, it.y); if (it.rot) g.rotate(it.rot); if (it.sc !== 1) g.scale(it.sc, it.sc);
    g.globalAlpha = clamp(it.op, 0, 1); g.globalCompositeOperation = it.add ? 'lighter' : 'source-over'; g.drawImage(s.c, -s.ax, -s.ay, s.w, s.h); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
