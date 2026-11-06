import { asset, RING_ART } from './assets.js';
import { theme } from './themes.js';
import { GEO, mix, TAU, ease, clamp, rng } from './game.js';
export const RR = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
export function boardPath(g) {
  const G = GEO, B = G.board, x0 = B.x0, x1 = B.x1, y0 = B.y0, r = B.r, fy = G.funnelY;
  g.moveTo(x0, y0 + r); g.quadraticCurveTo(x0, y0, x0 + r, y0); g.lineTo(x1 - r, y0); g.quadraticCurveTo(x1, y0, x1, y0 + r);
  g.lineTo(x1, fy); g.bezierCurveTo(x1, fy + 50, x1 - 60, fy + 62, x1 - 140, fy + 80); g.lineTo(G.tipR + 18, G.tipY - 24);
  g.arc(G.tipR + 4, G.tipY, 22, -Math.PI * 0.62, Math.PI * 0.55, true); g.lineTo(x1 - 60, G.lowY); g.quadraticCurveTo(x1, G.lowY, x1, G.lowY + 60); g.lineTo(x1, 2000); g.lineTo(x0, 2000); g.lineTo(x0, G.lowY + 60); g.quadraticCurveTo(x0, G.lowY, x0 + 60, G.lowY);
  g.lineTo(G.tipL - 4, G.tipY + 22); g.arc(G.tipL - 4, G.tipY, 22, Math.PI * 0.45, Math.PI * 1.62, true); g.lineTo(x0 + 140, fy + 80); g.bezierCurveTo(x0 + 60, fy + 62, x0, fy + 50, x0, fy); g.closePath();
}
export function makeBackground(W, H) {
  if (theme().background) return theme().background(W, H);
  const A = asset('background'); if (A) { const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(A, 0, 0, W, H); return c; }
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const R = rng(42);
  // 外层浅色木
  g.fillStyle = '#b98047'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '120,70,30' : '220,160,100'},${0.02 + R() * 0.03})`; g.fillRect(R() * W, R() * H, 1 + R() * 3, 40 + R() * 300); }
  // 凹槽外缘(略深)
  g.save(); g.beginPath(); boardPath(g); g.lineWidth = 26; g.strokeStyle = 'rgba(120,70,30,0.35)'; g.stroke(); g.lineWidth = 12; g.strokeStyle = 'rgba(150,95,45,0.6)'; g.stroke(); g.restore();
  // 深色木板
  g.save(); g.beginPath(); boardPath(g); g.clip();
  g.fillStyle = '#8a4f2a'; g.fillRect(0, 0, W, H);
  const planks = [[20, 197, [[258, 680], [680, 1200], [1174, 1560], [1560, 2000]]], [197, 355, [[258, 1000], [1000, 1400], [1400, 2000]]], [355, 512, [[258, 866], [866, 1300], [1300, 1720], [1720, 2000]]], [512, 668, [[258, 680], [680, 1180], [1180, 1600], [1600, 2000]]], [668, 844, [[258, 1000], [1000, 1460], [1460, 2000]]]];
  planks.forEach(([a, b, segs]) => segs.forEach(([y0, y1]) => { const v = (R() - 0.5) * 14; g.fillStyle = `rgb(${138 + v},${79 + v * 0.7},${41 + v * 0.5})`; g.fillRect(a, y0, b - a, y1 - y0);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '90,45,15' : '170,110,60'},${0.04 + R() * 0.06})`; g.fillRect(a + R() * (b - a), y0, 1 + R() * 2.5, y1 - y0); }
    g.fillStyle = 'rgba(70,35,12,0.55)'; g.fillRect(a - 1.5, y0, 3, y1 - y0); g.fillRect(a, y0 - 1.5, b - a, 3); g.fillStyle = 'rgba(190,120,70,0.18)'; g.fillRect(a + 1.5, y0 + 1.5, b - a - 3, 2); }));
  // 内阴影
  g.shadowColor = 'rgba(40,15,0,0.85)'; g.shadowBlur = 34; g.shadowOffsetY = 14; g.lineWidth = 40; g.strokeStyle = 'rgba(0,0,0,1)'; g.beginPath(); g.rect(-200, -200, W + 400, H + 400); boardPath(g); g.fill('evenodd');
  g.restore();
  // 浅色木唇边高光
  g.save(); g.beginPath(); boardPath(g); g.lineWidth = 3; g.strokeStyle = 'rgba(225,165,105,0.55)'; g.stroke(); g.restore();
  // 传送带外壳
  const B = GEO.belt, bh = B.y1 - B.y0;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 16; g.shadowOffsetY = 8; RR(g, B.x0, B.y0, B.x1 - B.x0, bh, bh / 2); g.fillStyle = '#ab9bcf'; g.fill(); g.restore();
  RR(g, B.x0 + 8, B.y0 + 8, B.x1 - B.x0 - 16, bh - 16, bh / 2 - 8); g.fillStyle = '#5a4e96'; g.fill();
  const gr = g.createLinearGradient(0, B.y0, 0, B.y1); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.18)'); g.fillStyle = gr; g.fill();
  RR(g, 116, 1244, 630, 19, 9.5); g.fillStyle = '#a99ad2'; g.fill(); RR(g, 121, 1248, 620, 11, 5.5); g.fillStyle = '#7c5a52'; g.fill();
  return c;
}
// ---------- 精灵 ----------
export function ballSprite(cache, col, r, name) {
  const key = theme().id + '|' + col + '|' + r.toFixed(1); if (cache[key]) return cache[key];
  if (theme().ball) return cache[key] = theme().ball(col, r, name);
  const s = Math.ceil(r * 2 + 6), c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d'), m = s / 2;
  const A = name && asset('ball_' + name); if (A) { g.drawImage(A, 3, 3, r * 2, r * 2); return cache[key] = c; }
  g.beginPath(); g.arc(m, m + 1.2, r, 0, TAU); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill();
  const gr = g.createRadialGradient(m - r * 0.35, m - r * 0.4, r * 0.1, m, m, r); gr.addColorStop(0, mix(col, '#ffffff', 0.5)); gr.addColorStop(0.5, col); gr.addColorStop(0.85, mix(col, '#000000', 0.08)); gr.addColorStop(1, mix(col, '#000000', 0.25));
  g.beginPath(); g.arc(m, m, r, 0, TAU); g.fillStyle = gr; g.fill(); g.lineWidth = Math.max(1, r * 0.06); g.strokeStyle = mix(col, '#000000', 0.5); g.stroke();
  g.beginPath(); g.ellipse(m - r * 0.28, m - r * 0.45, r * 0.3, r * 0.17, -0.5, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill();
  return cache[key] = c;
}
export function drawRing(g, game, r, T) {
  if (theme().ring) return theme().ring(g, game, r, T);
  if (drawRingArt(g, game, r, T)) return;
  const col = mix(game.color(r.color), '#ffffff', r.hl * 0.55), dark = mix(col, '#000000', 0.42), light = mix(col, '#ffffff', 0.55);
  const a0 = r.closed ? 0 : r.rot + r.gapC + r.gapW / 2, a1 = r.closed ? TAU : r.rot + r.gapC - r.gapW / 2 + TAU;
  const arc = (rad, w, s, dx = 0, dy = 0) => { g.beginPath(); g.arc(r.c[0] + dx, r.c[1] + dy, rad, a0, a1); g.lineWidth = w; g.strokeStyle = s; g.lineCap = 'round'; g.stroke(); };
  arc(r.R, T + 2, 'rgba(0,0,0,0.28)', 0, 5);
  arc(r.R, T, dark); arc(r.R, T - 4, col);
  arc(r.R - T * 0.12, T * 0.42, mix(col, '#ffffff', 0.18));
  arc(r.R - T * 0.2, T * 0.16, light, -1, -1);
  g.save(); g.globalAlpha = 0.55; arc(r.R + T * 0.22, T * 0.12, light); g.restore();
}
export function drawClamp(g, game, r, T) {
  const cw0 = game.clampWorld(r), a = Math.atan2(cw0[1] - r.c[1], cw0[0] - r.c[0]), p = r.p, off = r.clipOff || 0, du = Math.hypot(cw0[0] - p.c[0], cw0[1] - p.c[1]) || 1, cw = [cw0[0] + (cw0[0] - p.c[0]) / du * off, cw0[1] + (cw0[1] - p.c[1]) / du * off], col = game.color(p.color), dark = mix(col, '#000000', 0.35);
  // 连杆
  const pa = Math.atan2(cw[1] - p.c[1], cw[0] - p.c[0]), px = p.c[0] + p.R * Math.cos(pa), py = p.c[1] + p.R * Math.sin(pa);
  g.beginPath(); g.moveTo(px, py); g.lineTo(cw[0], cw[1]); g.lineCap = 'butt'; g.lineWidth = 12; g.strokeStyle = dark; g.stroke(); g.lineWidth = 8; g.strokeStyle = col; g.stroke();
  g.save(); g.translate(cw[0], cw[1]); g.rotate(a + Math.PI / 2); const w = T + 14, h = T + 12; if (drawClampArt(g, game, r)) { g.restore(); return; }
  RR(g, -w / 2, -h / 2 + 2, w, h, 5); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill();
  RR(g, -w / 2, -h / 2, w, h, 5); const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0); gr.addColorStop(0, mix(col, '#ffffff', 0.35)); gr.addColorStop(0.5, col); gr.addColorStop(1, dark); g.fillStyle = gr; g.fill(); g.lineWidth = 2; g.strokeStyle = dark; g.stroke();
  g.restore();
}
function brickColors(col) { return { top: col, dark: mix(col, '#000000', 0.25), line: mix(col, '#000000', 0.65), light: mix(col, '#ffffff', 0.25) }; }
export function drawBrick(g, game, x, y, box, isTray, S, scale = 1, alpha = 1) {
  const c = brickColors(game.color(box.color)), w = 162, h = 76;
  g.save(); g.globalAlpha = alpha; g.translate(x, y + h / 2); g.scale(scale, scale); g.translate(0, -h / 2);
  if (theme().brick) { theme().brick(g, game, box, isTray, S, (hx, hy) => { const sp = ballSprite(game.spriteCache, game.color(box.color), 15, box.color), d = sp.dw || sp.width; g.drawImage(sp, hx - d / 2, hy - d / 2, d, d); }); g.restore(); return; }
  const BA = asset((isTray ? 'tray_' : 'brick_') + box.color); if (BA) { g.drawImage(BA, -w / 2, 0, w, h + 10); if (isTray) for (let i = 0; i < box.n; i++) { const hx = (i - (S.boxCapacity - 1) / 2) * 44, sp = ballSprite(game.spriteCache, game.color(box.color), 15, box.color); g.drawImage(sp, hx - sp.width / 2, 32 - sp.height / 2); } g.restore(); return; }
  RR(g, -w / 2, 8, w, h, 14); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fill();
  RR(g, -w / 2, 0, w, h + 4, 14); g.fillStyle = c.line; g.fill();
  RR(g, -w / 2 + 2, 2, w - 4, h, 12); g.fillStyle = c.dark; g.fill();
  RR(g, -w / 2 + 2, 2, w - 4, h - 12, 12); g.fillStyle = c.top; g.fill();
  if (isTray) {
    RR(g, -w / 2 + 14, 14, w - 28, h - 36, 4); g.fillStyle = c.light; g.fill(); g.lineWidth = 2.5; g.strokeStyle = c.line; g.stroke();
    RR(g, -w / 2 + 19, 18, w - 38, h - 44, 3); g.fillStyle = c.top; g.fill();
    const cap = S.boxCapacity; for (let i = 0; i < cap; i++) { const hx = (i - (cap - 1) / 2) * 44; g.beginPath(); g.arc(hx, 32, 15, 0, TAU); g.fillStyle = c.dark; g.fill(); g.lineWidth = 1.5; g.strokeStyle = mix(c.top, '#000', 0.4); g.stroke();
      if (i < box.n) { const sp = ballSprite(game.spriteCache, game.color(box.color), 15, box.color); g.drawImage(sp, hx - sp.width / 2, 32 - sp.height / 2); } }
  } else { g.beginPath(); g.ellipse(-w / 2 + 30, 14, 14, 5, 0, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.0)'; g.fill(); }
  g.restore();
}
export function star(g, x, y, r, rot) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); } g.closePath(); }
export function render(g, game, S, bg) {
  const W = 864, H = 1920; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, g.canvas.width, g.canvas.height); g.save(); const L = designLayout(g.canvas.width, g.canvas.height); g.fillStyle = '#b98047'; g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.translate(L.ox, L.oy); g.scale(L.s, L.s);
  g.drawImage(bg, 0, 0, W, H);
  // 传送带凹坑
  const n = game.belt.slots.length; for (let i = 0; i < n; i++) { const p = game.beltPos(game.slotS(i)); g.beginPath(); g.ellipse(p.x, p.y, 17, 15.5, 0, 0, TAU); g.fillStyle = '#2a2149'; g.fill(); g.beginPath(); g.ellipse(p.x, p.y + 2.5, 15, 12, 0, 0, TAU); g.fillStyle = '#1d1636'; g.fill(); }
  // 盒子
  const T = S.ringThick;
  for (const c of game.cols) { const sh = c.shift > 0 ? ease(c.shift) * GEO.brickStride : 0; for (let k = c.stack.length - 1; k >= 0; k--) { const y = GEO.brickTop + (k === 0 ? 0 : 80 + (k - 1) * GEO.brickStride) + sh; drawBrick(g, game, c.x, y, c.stack[k], k === 0, S); } }
  for (const f of game.flyBricks) { const t = f.t / 0.6; drawBrick(g, game, f.x, f.y - 140 * ease(Math.min(1, t * 1.4)), f.box, true, S, 1 + 0.15 * Math.sin(Math.min(1, t) * Math.PI), 1 - Math.max(0, (t - 0.55) / 0.45)); }
  // 传送带上的球
  for (let i = 0; i < n; i++) { const b = game.belt.slots[i]; if (!b) continue; const p = game.beltPos(game.slotS(i)); const k = ease(Math.min(1, b.snap)), x = b.sx + (p.x - b.sx) * k, y = b.sy + (p.y - b.sy) * k; const sp = ballSprite(game.spriteCache, game.color(b.color), Math.round(b.r * 2) / 2, b.color); g.drawImage(sp, x - sp.width / 2, y - sp.height / 2); }
  for (const d of game.drops) { const t = Math.min(1, d.t), hx = d.col.x + (d.hole - (S.boxCapacity - 1) / 2) * 44, hy = GEO.brickTop + 32, x = d.x0 + (hx - d.x0) * ease(t), y = d.y0 + (hy - d.y0) * t * t, r = game.beltR + (15 - game.beltR) * t; const sp = ballSprite(game.spriteCache, game.color(d.b.color), Math.round(r * 2) / 2, d.b.color); g.drawImage(sp, x - sp.width / 2, y - sp.height / 2); }
  // 自由球
  for (const b of game.balls) if (b.state === 'free') { const sp = ballSprite(game.spriteCache, game.color(b.color), b.r, b.color); g.drawImage(sp, b.x - sp.width / 2, b.y - sp.height / 2); }
  // 环 + 夹子
  const alive = game.rings.filter(r => r.alive).sort((a, b) => (a.z || 0) - (b.z || 0));
  for (const r of alive) drawRing(g, game, r, T);
  for (const r of game.rings) if (r.p && r.p.alive) drawClamp(g, game, r, T);
  // 碎片
  for (const s of game.shards) { g.save(); g.globalAlpha = clamp(1 - (s.t / s.life - 0.6) / 0.4, 0, 1); g.translate(s.x, s.y); g.rotate(s.a); g.beginPath(); const z = s.s / 2; if (s.k === 0) { g.moveTo(-z, -z * 0.6); g.lineTo(z * 0.8, -z); g.lineTo(z, z * 0.5); g.lineTo(-z * 0.5, z); } else if (s.k === 1) { g.moveTo(0, -z); g.lineTo(z, z * 0.7); g.lineTo(-z, z * 0.5); } else { g.moveTo(-z, 0); g.lineTo(0, -z); g.lineTo(z, 0); g.lineTo(0, z); } g.closePath(); g.fillStyle = s.col; g.fill(); g.lineWidth = 2; g.strokeStyle = mix(s.col, '#000000', 0.35); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(-z * 0.3, -z * 0.3, z * 0.25, 0, TAU); g.fill(); g.restore(); }
  // 星星
  for (const s of game.stars) { const a = 1 - s.t / s.life; g.save(); g.globalAlpha = a; if (s.flash && s.t < 0.2) { const gr = g.createRadialGradient(s.x, s.y + 0, 0, s.x, s.y, 40); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(s.x, s.y, 40, 0, TAU); g.fill(); } star(g, s.x, s.y, s.s, s.t * 4); g.fillStyle = '#ffe23a'; g.fill(); g.restore(); }
  // UI
  drawTopUI(g, game, S);
  if (game.hintOn && game.levelIdx === 0) { g.font = '700 58px RB, Roboto, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = '#111'; g.strokeText(S.hintText, 432, 388); g.fillStyle = '#fff'; g.fillText(S.hintText, 432, 388); }
  /* 结算页已移除 */
  g.restore();
}
export function drawTopUI(g, game, S) {
  if (theme().topUI) return theme().topUI(g, game, S);
  const LP = asset('level_pill'), PB = asset('pause_btn'); if (LP) g.drawImage(LP, 330, 114, 204, 85); if (PB) g.drawImage(PB, 727, 112, 99, 103); if (LP && PB) { g.font = '700 40px RB, Roboto, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('Level ' + (game.levelIdx + 1), 432, 156); return; }
  // Level 胶囊
  RR(g, 330, 117, 204, 82, 18); g.fillStyle = '#b07450'; g.fill(); RR(g, 333, 114, 198, 80, 16); g.fillStyle = '#2d0a0b'; g.fill(); RR(g, 337, 118, 190, 70, 13); const gr = g.createLinearGradient(0, 118, 0, 188); gr.addColorStop(0, '#4a1416'); gr.addColorStop(1, '#3a0d0f'); g.fillStyle = gr; g.fill();
  g.font = '700 40px RB, Roboto, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('Level ' + (game.levelIdx + 1), 432, 156);
  // 暂停
  RR(g, 727, 116, 99, 99, 24); g.fillStyle = '#9b4a07'; g.fill(); RR(g, 731, 112, 91, 94, 21); const pg = g.createLinearGradient(0, 112, 0, 206); pg.addColorStop(0, '#ffc53a'); pg.addColorStop(1, '#ea7d0e'); g.fillStyle = pg; g.fill(); RR(g, 741, 120, 71, 40, 14); g.fillStyle = 'rgba(255,240,160,0.35)'; g.fill();
  for (const x of [759, 789]) { RR(g, x - 8, 136, 16, 48, 8); g.fillStyle = '#c45d06'; g.fill(); RR(g, x - 7, 133, 14, 46, 7); g.fillStyle = '#ffef2a'; g.fill(); }
}
export function bubbleText(g, txt, x, y, size) {
  g.font = `${size}px LI, "Lilita One", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.fillStyle = '#b8231a'; g.fillText(txt, x, y + size * 0.13); g.lineWidth = size * 0.1; g.strokeStyle = '#b8231a'; g.strokeText(txt, x, y + size * 0.13);
  const gr = g.createLinearGradient(0, y - size / 2, 0, y + size / 2); gr.addColorStop(0, '#fff27a'); gr.addColorStop(0.45, '#ffd21e'); gr.addColorStop(1, '#ff9a00'); g.lineWidth = size * 0.06; g.strokeStyle = '#e07000'; g.strokeText(txt, x, y); g.fillStyle = gr; g.fillText(txt, x, y);
}
export function designLayout(cw, ch) { const s = Math.min(cw / 864, ch / 1920); return { s, ox: (cw - 864 * s) / 2, oy: (ch - 1920 * s) / 2 }; }

function ringImg(kind, color) { const k = `ring_${kind}_${color}`; const A = asset(k); if (A) return { A, gray: false }; if (color === 'gray') { const B = asset(`ring_${kind}_cyan`); if (B) return { A: B, gray: true }; } return null; }
function drawRingArt(g, game, r, T) {
  const kind = r.closed ? 'closed' : 'open', art = RING_ART[kind]; const got = r.sprite ? { A: asset(r.sprite), gray: false } : ringImg(kind, r.color); if (!got || !got.A) return false;
  const A = got.A, k = r.R / art.centerR * (r.spriteScale || 1), dw = A.naturalWidth * k, dh = A.naturalHeight * k, pv = r.pivot || art.pivot;
  g.save(); g.translate(r.c[0], r.c[1]); g.rotate(r.rot + (r.closed ? 0 : r.gapC - (art.gapDir * Math.PI / 180)) + (r.spriteRot || 0) * Math.PI / 180);
  g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 8; g.shadowOffsetY = 5;
  if (got.gray) g.filter = 'grayscale(1) brightness(1.25)';
  g.drawImage(A, -pv[0] * dw, -pv[1] * dh, dw, dh); g.shadowColor = 'transparent'; g.filter = 'none';
  if (r.hl > 0.01) { g.globalAlpha = r.hl * 0.5; g.globalCompositeOperation = 'lighter'; g.drawImage(A, -pv[0] * dw, -pv[1] * dh, dw, dh); }
  g.restore(); return true;
}
export function drawClampArt(g, game, r) { // 已在夹子位置、局部 -y 指向父环
  if (theme().clip) return theme().clip(g, game, r);
  const pc = r.p.color, A = asset(r.clampSprite || (pc === 'gray' ? 'arc_or_hinge_gray' : 'clip_' + pc)); if (!A) return false;
  const k = (r.R / RING_ART.open.centerR) * (r.clampScale || 1), w = A.naturalWidth * k, h = A.naturalHeight * k, cp = r.clampPivot || (r.clampSprite ? [0.5, 0.5] : RING_ART.clip.pivot);
  g.rotate((r.clampRot ?? (pc === 'gray' ? 90 : 180)) * Math.PI / 180); const CF = theme().clipFilter; if (CF) { g.save(); g.filter = CF; } g.drawImage(A, -cp[0] * w, -cp[1] * h, w, h); if (CF) g.restore(); return true;
}
