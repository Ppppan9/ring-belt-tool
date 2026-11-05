import { LEVELS, SPECIAL_LEVELS, CLIP_NECK_LEN } from './levels.js';
export { CLIP_NECK_LEN };
const TAU = Math.PI * 2, D2R = Math.PI / 180;
export const W0 = 864, H0 = 1920;
const wrap = a => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hex2rgb(h) { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); }
function rgb2hex(c) { return '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v + (B[i] - v) * t)); }
const FIXED_COLORS = { grey: '#a6b2c6', gray: '#a9adb5', sky: '#8ccaf2', lilac: '#b79cf0' };

// ---------- 场景几何 ----------
export const GEO = {
  board: { x0: 20, x1: 844, y0: 258, r: 118 },
  funnelY: 990, tipL: 392, tipR: 472, tipY: 1150, tipR_: 22, lowY: 1174,
  belt: { x0: 64, x1: 800, y0: 1187, y1: 1325, lx0: 145, lx1: 720, cy: 1256, R: 38 },
  brickTop: 1340, brickStride: 86,
  colX4: [170, 345, 520, 695], colX2: [345, 520],
};
export class Game {
  constructor(S, sfx) { this.S = S; this.sfx = sfx || { play() { } }; this.levelIdx = 0; this.seed = 1; this.bgCache = null; this.spriteCache = {}; this.time = 0; this.events = []; }
  color(name) { const S = this.S; const m = { red: S.colRed, blue: S.colBlue, green: S.colGreen, yellow: S.colYellow, purple: S.colPurple, orange: S.colOrange, cyan: S.colCyan }; return m[name] || FIXED_COLORS[name] || name; }
  levels() { try { if (this.S.levelsJson && this.S.levelsJson.trim()) { const L = JSON.parse(this.S.levelsJson); if (Array.isArray(L) && L.length) return L; } } catch (e) { } return LEVELS; }
  emit(name, data) { this.events.push({ name, t: this.time, level: this.levelIdx + 1, ...data }); }
  loadLevel(idx, opt = {}) {
    const L = this.levels(); const sp = SPECIAL_LEVELS[idx + 1]; this.levelIdx = sp ? idx : ((idx % L.length) + L.length) % L.length; const lv = JSON.parse(JSON.stringify(sp || L[this.levelIdx])); /* 特殊关（如第 20 关）不进 1–5 关循环 */
    const R = rng(this.seed * 7919 + this.levelIdx * 131 + 17); this.rand = R;
    if (opt.shuffle) { // 换一局：颜色置换 + 环初始角度微调
      const used = [...new Set(lv.rings.filter(r => r.balls).map(r => r.color))]; const perm = used.slice().sort(() => R() - 0.5); const map = {}; used.forEach((c, i) => map[c] = perm[i]);
      lv.rings.forEach(r => { if (map[r.color]) r.color = map[r.color]; if (r.gap && !r.anchor) r.gap[0] += (R() - 0.5) * 50; }); lv.boxes = lv.boxes.map(col => col.map(c => map[c] || c)); lv.boxes.sort(() => R() - 0.5);
    }
    let cmap = {}; try { cmap = JSON.parse(this.S.colorMap || '{}'); } catch (e) { } const mc = c => cmap[c] || c; lv.rings.forEach(r => r.color = mc(r.color)); lv.boxes = lv.boxes.map(col => col.map(mc));
    if (this.S.useArtGap) lv.rings.forEach(r => { if (r.gap) r.gap[1] = this.S.useArtGap; });
    this.lv = lv; this.ballR = lv.ballR || this.S.ballRadius; this.beltR = this.S.beltBallR || 16.5;
    this.rings = lv.rings.map(r => ({ ...r, c: [r.x, r.y], rot: 0, gapC: r.gap ? r.gap[0] * D2R : 0, gapW: r.gap ? r.gap[1] * D2R : 0, alive: true, children: [], hl: 0, omega: 0 }));
    const byId = {}; this.rings.forEach(r => byId[r.id] = r);
    this.rings.forEach(r => { if (r.parent) { const p = byId[r.parent]; r.p = p; p.children.push(r); const a = Math.atan2(p.c[1] - r.c[1], p.c[0] - r.c[0]); r.clampW = [r.c[0] + r.R * Math.cos(a), r.c[1] + r.R * Math.sin(a)]; r.clampLocal = [r.clampW[0] - p.c[0], r.clampW[1] - p.c[1]]; } });
    // 球
    this.balls = []; let id = 0;
    this.rings.forEach(r => { const n = r.balls || 0; const pts = packBalls(n, this.ballR, r.R - this.S.ringThick / 2 - this.ballR - 1); pts.forEach(([x, y]) => this.balls.push({ id: id++, color: r.color, x: r.c[0] + x, y: r.c[1] + y, px: r.c[0] + x, py: r.c[1] + y, r: this.ballR, state: 'free' })); });
    // 盒子
    const cols = lv.boxes.length; const xs = cols <= 2 ? GEO.colX2 : cols === 3 ? [258, 432, 606] : GEO.colX4;
    this.cols = lv.boxes.map((col, i) => ({ x: xs[i] ?? (100 + i * 175), stack: col.map(c => ({ color: c, n: 0, pend: 0 })), shift: 0 }));
    this.flyBricks = []; this.shards = []; this.stars = []; this.drops = [];
    this.belt = { off: 0, slots: new Array(this.S.beltSlots).fill(null), cap: lv.beltSlots ?? (this.S.beltCap ?? 6) }; /* 关卡 beltSlots=传送带容量(同时可载球数)；孔距/外观保持标准格数不变 */
    this.state = 'play'; this.doneT = 0; this.lcT = 0; this.hintOn = this.levelIdx === 0 && this.S.showHint; this.drag = null; this.levelTime = 0;
    // 预先沉降
    for (let i = 0; i < 180; i++) this.physics(1 / 120);
    this.balls.forEach(b => { b.px = b.x; b.py = b.y; });
    this.emit('levelStart');
  }
  // ---------- 传送带路径 ----------
  beltLen() { const B = GEO.belt; return 2 * (B.lx1 - B.lx0) + TAU * B.R; }
  beltPos(s) { // s=0 在上边右端，沿上边向左移动
    const B = GEO.belt, Lstr = B.lx1 - B.lx0, L = this.beltLen(); s = ((s % L) + L) % L;
    if (s < Lstr) return { x: B.lx1 - s, y: B.cy - B.R, seg: 'top' };
    s -= Lstr; if (s < Math.PI * B.R) { const a = -Math.PI / 2 - s / B.R; return { x: B.lx0 + B.R * Math.cos(a), y: B.cy + B.R * Math.sin(a), seg: 'left' }; }
    s -= Math.PI * B.R; if (s < Lstr) return { x: B.lx0 + s, y: B.cy + B.R, seg: 'bottom' };
    s -= Lstr; const a = Math.PI / 2 - s / B.R; return { x: B.lx1 + B.R * Math.cos(a), y: B.cy + B.R * Math.sin(a), seg: 'right' };
  }
  slotS(i) { return this.belt.off + i * this.beltLen() / this.belt.slots.length; }
  // ---------- 环 ----------
  ringAt(x, y) {
    let best = null, bd = 1e9; const T = this.S.ringThick;
    for (const r of this.rings) { if (!r.alive || r.anchor) continue; const d = Math.hypot(x - r.c[0], y - r.c[1]); if (d < r.R + T / 2 + 26) { const sc = Math.abs(d - r.R); const k = d < r.R ? sc * 0.5 : sc; if (k < bd) { bd = k; best = r; } } }
    return best;
  }
  rotateRing(r, d) {
    if (!d) return; r.rot += d;
    const rot = (q, cx, cy) => { const c = Math.cos(d), s = Math.sin(d), x = q.c[0] - cx, y = q.c[1] - cy; q.c[0] = cx + x * c - y * s; q.c[1] = cy + x * s + y * c; };
    const rec = q => { q.children.forEach(ch => { if (!ch.alive) return; rot(ch, r.c[0], r.c[1]); ch.rot += d; rec(ch); }); };
    rec(r);
  }
  clampWorld(r) { if (!r.alive && r._frz) return r._frz.cw; const p = r.p, c = Math.cos(p.rot), s = Math.sin(p.rot), [x, y] = r.clampLocal; return [p.c[0] + x * c - y * s, p.c[1] + x * s + y * c]; }
  ringBalls(r) { const lim = r.R - this.S.ringThick / 2; return this.balls.filter(b => b.state === 'free' && Math.hypot(b.x - r.c[0], b.y - r.c[1]) < lim).length; }
  shatter(r) {
    if (!r.alive) return; this.freezeClip(r); r.alive = false; this.sfx.play('shatter'); this.emit('shatter', { ring: r.id });
    const T = this.S.ringThick, col = this.color(r.color), a0 = r.rot + r.gapC + (r.closed ? 0 : r.gapW / 2), span = r.closed ? TAU : TAU - r.gapW;
    const n = Math.max(8, Math.round(span * r.R / 26));
    for (let i = 0; i < n; i++) { const a = a0 + span * (i + 0.5) / n, x = r.c[0] + r.R * Math.cos(a), y = r.c[1] + r.R * Math.sin(a), sp = 80 + this.rand() * 260, da = a + (this.rand() - 0.5) * 1.5;
      this.shards.push({ x, y, vx: Math.cos(da) * sp, vy: Math.sin(da) * sp - 200 * this.rand(), a: this.rand() * TAU, va: (this.rand() - 0.5) * 14, s: T * (0.55 + this.rand() * 0.6), col, t: 0, life: 0.55 + this.rand() * 0.35, k: Math.floor(this.rand() * 3) }); }
    r.children.forEach(ch => this.shatter(ch));
    if (r.p && r.p.anchor && !r.p.children.some(c => c.alive) && this.S.shatter) setTimeout(() => { }, 0), this.shatter(r.p);
  }
  // ---------- 物理 ----------
  physics(dt) {
    const S = this.S, T = S.ringThick, e = S.bounce, g = S.gravity, balls = this.balls.filter(b => b.state === 'free');
    for (const b of balls) { const vx = (b.x - b.px), vy = (b.y - b.py); b.px = b.x; b.py = b.y; const damp = 0.999; b.x += vx * damp; b.y += vy * damp + g * dt * dt; const sp = Math.hypot(b.x - b.px, b.y - b.py), mx = 2400 * dt; if (sp > mx) { b.x = b.px + (b.x - b.px) * mx / sp; b.y = b.py + (b.y - b.py) * mx / sp; } }
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) { const a = balls[i], b = balls[j], dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy; if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), o = (rr - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o; } }
      for (const b of balls) { for (const r of this.rings) if (r.alive) this.collideRing(b, r, T); this.collideWalls(b); }
    }
    for (const b of balls) if (b.y > GEO.belt.y0 - b.r - 8 && b.x > GEO.tipL - 30 && b.x < GEO.tipR + 30) this.tryCapture(b);
  }
  collideRing(b, r, T) {
    const dx = b.x - r.c[0], dy = b.y - r.c[1], d = Math.hypot(dx, dy), h = T / 2 + b.r;
    if (Math.abs(d - r.R) > h + 2) return;
    const ang = Math.atan2(dy, dx), loc = wrap(ang - r.rot - r.gapC);
    if (r.closed || Math.abs(loc) > r.gapW / 2) { // 环身
      const nx = dx / d, ny = dy / d, inside = d < r.R; const target = inside ? r.R - h : r.R + h; if (inside ? d > target : d < target) { const pen = d - target; b.x -= nx * pen; b.y -= ny * pen; this.reflect(b, inside ? -nx : nx, inside ? -ny : ny); }
    } else { // 缺口两端圆头
      for (const s of [-1, 1]) { const a = r.rot + r.gapC + s * r.gapW / 2, cx = r.c[0] + r.R * Math.cos(a), cy = r.c[1] + r.R * Math.sin(a), ex = b.x - cx, ey = b.y - cy, ed = Math.hypot(ex, ey); if (ed < h && ed > 1e-6) { const nx = ex / ed, ny = ey / ed; b.x += nx * (h - ed); b.y += ny * (h - ed); this.reflect(b, nx, ny); } }
    }
  }
  reflect(b, nx, ny) { const vx = b.x - b.px, vy = b.y - b.py, vn = vx * nx + vy * ny; if (vn < 0) { const e = this.S.bounce, tx = vx - vn * nx, ty = vy - vn * ny; const nvx = tx * 0.96 - vn * e * nx, nvy = ty * 0.96 - vn * e * ny; b.px = b.x - nvx; b.py = b.y - nvy; } }
  collideWalls(b) {
    const G = GEO, r = b.r, x0 = G.board.x0 + 18, x1 = G.board.x1 - 18;
    if (b.y < G.board.y0 + r) { b.y = G.board.y0 + r; this.reflect(b, 0, 1); }
    const segs = [[x0, 200, x0, G.funnelY], [x1, 200, x1, G.funnelY], [x0, G.funnelY, G.tipL - 6, G.tipY - 22], [x1, G.funnelY, G.tipR + 6, G.tipY - 22], [G.tipL - 4, G.tipY - 22, G.tipL - 4, G.belt.y0], [G.tipR + 4, G.tipY - 22, G.tipR + 4, G.belt.y0], [G.tipL - 40, G.belt.y0 + 4, G.tipR + 40, G.belt.y0 + 4]];
    for (const [ax, ay, bx, by] of segs) { const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy; let t = ((b.x - ax) * vx + (b.y - ay) * vy) / L2; t = clamp(t, 0, 1); const cx = ax + vx * t, cy = ay + vy * t, dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy); if (d < r && d > 1e-6) { const nx = dx / d, ny = dy / d; b.x += nx * (r - d); b.y += ny * (r - d); this.reflect(b, nx, ny); } }
  }
  tryCapture(b) {
    if (this.belt.cap && this.belt.slots.filter(Boolean).length >= this.belt.cap) return;
    const n = this.belt.slots.length, sp = this.beltLen() / n; let best = -1, bd = 1e9;
    for (let i = 0; i < n; i++) { if (this.belt.slots[i]) continue; const p = this.beltPos(this.slotS(i)); if (p.seg !== 'top') continue; const d = Math.abs(p.x - b.x); if (d < bd) { bd = d; best = i; } }
    if (best >= 0 && bd < sp * 0.5) { b.state = 'belt'; b.slot = best; b.snap = 0; b.sx = b.x; b.sy = b.y; this.belt.slots[best] = b; this.sfx.play('land', { minGap: 0.05 }); this.emit('land'); }
  }
  // ---------- 主更新 ----------
  update(dt) {
    this.time += dt; this.levelTime += dt; const S = this.S;
    if (this.state === 'lc' || this.state === 'lcOut') { this.lcT += dt; if (this.state === 'lcOut' && this.lcT > 0.35) { this.state = 'play'; } }
    // 拖动
    if (this.drag && this.drag.ring.alive && this.isLocked(this.drag.ring)) { const r = this.drag.ring; this.dragStep = 0; r.omega = 0; if (Math.abs(wrap(this.drag.target - r.rot)) > 0.05 && !(r.shakeT > 0)) { r.shakeT = 0.3; this.sfx.play('tick'); this.emit('locked', { ring: r.id }); } this.drag.rot0 = r.rot; this.drag.acc = 0; this.drag.target = r.rot; }
    else if (this.drag && this.drag.ring.alive) { const r = this.drag.ring; const want = wrap(this.drag.target - r.rot); const maxd = 12 * dt; const d = clamp(want, -maxd, maxd); r.omega = d / dt; this.pendingRot = (this.pendingRot || 0); this.dragStep = d; }
    const sub = 4, h = dt / sub;
    for (let k = 0; k < sub; k++) { if (this.drag && this.drag.ring.alive && this.dragStep) this.rotateRing(this.drag.ring, this.dragStep / sub); this.physics(h); this.checkDetach(); }
    this.dragStep = 0;
    this.rings.forEach(r => r.hl += ((this.drag && this.drag.ring === r ? 1 : 0) - r.hl) * Math.min(1, dt * 18));
    // 传送带
    const L = this.beltLen(), n = this.belt.slots.length, spc = L / n; this.belt.off = (this.belt.off + S.beltSpeed * dt) % L;
    for (let i = 0; i < n; i++) { const b = this.belt.slots[i]; if (!b) continue; b.snap = Math.min(1, b.snap + dt / 0.08); const p = this.beltPos(this.slotS(i)); b.r += (this.beltR - b.r) * Math.min(1, dt * 12);
      if (b.snap >= 1 && p.seg === 'bottom') { const col = this.cols.find(c => { const top = c.stack[0]; return top && top.color === b.color && top.n + top.pend < S.boxCapacity && Math.abs(c.x - p.x) < spc * 0.5 && c.shift <= 0.35; }); if (col) { const top = col.stack[0]; const hole = top.n + top.pend; top.pend++; this.belt.slots[i] = null; b.state = 'drop'; this.drops.push({ b, col, box: top, hole, t: 0, x0: p.x, y0: p.y }); } } }
    // 落入盒子
    for (const d of this.drops) { d.t += dt / (S.dropTime / 1000); if (d.t >= 1 && !d.done) { d.done = true; d.box.pend--; d.box.n++; d.b.state = 'boxed'; this.sfx.play('pop', { pitch: d.hole }); this.emit('box', { color: d.box.color }); const hx = d.col.x + (d.hole - (S.boxCapacity - 1) / 2) * 44; for (let i = 0; i < 4; i++) this.stars.push({ x: hx, y: GEO.brickTop + 36, vx: (this.rand() - 0.5) * 260, vy: -160 - this.rand() * 220, t: 0, life: 0.6 + this.rand() * 0.3, s: 8 + this.rand() * 6, flash: i === 0 }); if (d.box.n >= S.boxCapacity) { setTimeout(() => { }, 0); d.col.completeT = 0.12; } } }
    this.drops = this.drops.filter(d => !d.done);
    for (const c of this.cols) { if (c.completeT != null) { c.completeT -= dt; if (c.completeT <= 0) { c.completeT = null; const box = c.stack.shift(); this.flyBricks.push({ x: c.x, y: GEO.brickTop, box, t: 0 }); c.shift = 1; this.sfx.play('boxDone'); this.emit('boxDone', { color: box.color }); } } if (c.shift > 0) c.shift = Math.max(0, c.shift - dt / 0.14); }
    this.flyBricks.forEach(f => f.t += dt); this.flyBricks = this.flyBricks.filter(f => f.t < 0.6);
    this.shards.forEach(s => { s.t += dt; s.vy += S.gravity * 0.6 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.a += s.va * dt; }); this.shards = this.shards.filter(s => s.t < s.life);
    this.stars.forEach(s => { s.t += dt; s.vy += 500 * dt; s.x += s.vx * dt; s.y += s.vy * dt; }); this.stars = this.stars.filter(s => s.t < s.life);
    // 锚环无子环 → 碎裂
    this.rings.forEach(r => { if (r.shakeT > 0) r.shakeT -= dt; });
    this.rings.forEach(r => { if (r.alive && r.anchor && r.children.length && !r.children.some(c => c.alive) && S.shatter) this.shatter(r); });
    // 环空 & 无剩余
    if (this.state === 'play') { const left = this.balls.some(b => b.state !== 'boxed'); if (!left) { this.doneT += dt; if (this.doneT * 1000 >= S.lcDelay) this.levelComplete(); } }
  }
  checkDetach() {
    for (const r of this.rings) { if (!r.alive || !r.p || r.closed) continue; if (r.hinge && this.S.hingeRelease === false) continue; /* 铰接环：缺口真正越过夹扣即脱开（环内剩余球随之洒出） */ const cw = this.clampWorld(r); const a = Math.atan2(cw[1] - r.c[1], cw[0] - r.c[0]); const loc = wrap(a - r.rot - r.gapC); const win = this.unlockWin(r); const prev = r._loc; r._loc = loc;
      // 真正解锁：卡扣（对方管身 T/2）+ 本环端头圆角（T/2）都完全落入缺口，再留 unlockMargin° 余量；跨帧扫过中心也算
      const crossed = prev != null && Math.sign(prev) !== Math.sign(loc) && Math.abs(prev) < r.gapW / 2 && Math.abs(loc) < r.gapW / 2;
      if (Math.abs(loc) <= win || crossed) { this.detach(r); } }
  }
  freezeClip(r) { /* 夹扣固定在场景：环脱落后夹扣(及颈部)冻结在脱落瞬间的屏幕位置/朝向，父环再转也不跟着转 */ if (r.p && r.clampLocal && !r._frz) r._frz = { cw: this.clampWorld(r), prot: r.p.rot }; }
  clipClear(r) { // 缺口端头圆角半径 + 夹子方块半宽（按美术：管粗 50、夹块宽 68，环图中心线半径 151）
    const k = r.R / 151, T = this.S.ringThick; return Math.max(T, (25 + 34 * (r.clampScale || 1)) * k); }
  // 被两个及以上夹扣同时约束（作为被夹环 + 夹着别的环，都算）的环不能转动
  ringEmpty(r) { return !this.balls.some(b => b.state === 'free' && Math.hypot(b.x - r.c[0], b.y - r.c[1]) < r.R); }
  joints(r) { return (r.p && r.p.alive && r.alive ? 1 : 0) + r.children.filter(c => c.alive).length; }
  isLocked(r) { return this.S.lockMultiJoint !== false && this.joints(r) > 1; }
  unlockWin(r) { const m = (this.S.unlockMargin ?? 3) * D2R; return Math.max(0.5 * D2R, r.gapW / 2 - Math.asin(Math.min(1, this.clipClear(r) / r.R)) - m);
  }
  detach(r) { if (this.drag && this.drag.ring === r) this.drag = null; if (this.S.shatter) this.shatter(r); else { this.freezeClip(r); r.alive = false; } this.emit('detach', { ring: r.id }); }
  levelComplete() { /* 不再有结算/奖励页：过关后停在完成盘面（环全碎、球入盒），手动点面板“⏭ 下一关”才换关；自动通关/录制时自动续关 */ this.state = 'lc'; this.lcT = 0; this.confetti = []; this.puffs = []; this.lcCount = (this.lcCount || 0) + 1; this.lastLC = { level: this.levelIdx + 1, levelTime: this.levelTime }; this.sfx.play('complete'); this.emit('levelComplete'); }
  continueNext() { if (this.state !== 'lc') return false; const L = this.levels(); let n = this.levelIdx + 1; if (n >= L.length) { if (!this.S.loopLevels) return false; n = 0; } this.prevSnapshot = true; this.loadLevel(n); this.state = 'lcOut'; this.lcT = 0; return true; }
  continueRect() { return { x: 432 - 104, y: 1170 - 44, w: 208, h: 88 }; }
  isEnded() { return this.state === 'lc' && this.levelIdx >= this.levels().length - 1; }
  // ---------- 拖动 ----------
  pointerDown(x, y, force) { if (this.state !== 'play') return null; const r = force && force.alive ? force : this.ringAt(x, y); if (!r) return null; this.drag = { ring: r, a0: Math.atan2(y - r.c[1], x - r.c[0]), rot0: r.rot, target: r.rot, acc: 0, lastA: Math.atan2(y - r.c[1], x - r.c[0]) }; this.hintOn = false; this.sfx.play('tick'); this.emit('grab', { ring: r.id }); return r; }
  pointerMove(x, y) { const d = this.drag; if (!d) return; const r = d.ring; const a = Math.atan2(y - r.c[1], x - r.c[0]); d.acc += wrap(a - d.lastA); d.lastA = a; d.target = d.rot0 + d.acc; }
  pointerUp() { if (this.drag) this.emit('release', { ring: this.drag.ring.id }); this.drag = null; }
  // 自动通关：返回环上可抓点
  grabPoint(r) { const a = r.rot + r.gapC + Math.PI; let ang = a; if (r.p) { const cw = this.clampWorld(r); const ac = Math.atan2(cw[1] - r.c[1], cw[0] - r.c[0]); if (Math.abs(wrap(ang - ac)) < 0.9) ang = ac + Math.PI * 0.6; } return { x: r.c[0] + r.R * Math.cos(ang), y: r.c[1] + r.R * Math.sin(ang), ang }; }
  planTarget(r, mode) { if (mode === 'spill') return wrap(Math.PI / 2 - (r.rot + r.gapC)); const cw = this.clampWorld(r); const ac = Math.atan2(cw[1] - r.c[1], cw[0] - r.c[0]); return wrap(ac - (r.rot + r.gapC)); }
}
function packBalls(n, r, maxD) { // 在圆内底部堆放
  const pts = [], dx = r * 2.02, dy = r * 1.75; let row = 0;
  while (pts.length < n && row < 30) { const y = maxD - r * 0.2 - row * dy; const half = Math.sqrt(Math.max(0, maxD * maxD - y * y)); const cnt = Math.floor((2 * half) / dx) + 1; const off = row % 2 ? dx / 2 : 0; for (let i = 0; i < cnt && pts.length < n; i++) { const x = -((cnt - 1) * dx) / 2 + i * dx + (cnt * dx > 2 * half ? 0 : off * 0); if (Math.hypot(x, y) <= maxD) pts.push([x, y]); } row++; }
  return pts;
}
export { mix, hex2rgb, rgb2hex, wrap, ease, clamp, TAU, D2R };
