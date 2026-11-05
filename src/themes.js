// 主题系统（数据驱动）。每个主题 = { id, name, desc, ...可选绘制钩子 }。
// 钩子缺省时回落到“原版”绘制（render.js / items.js 原逻辑），因此原版主题行为与 phase6 完全一致。
// 钩子只改“外观”，不改任何几何/碰撞：环中心线半径、夹子位置、盒子孔位、传送带孔距全部沿用游戏数据。
// 可用钩子：background(W,H) / ring(g,game,r,T) / ball(col,r,name)->canvas / clip(g,game,r) / link(g,p,r,ux,uy,len,col)
//          brick(g,game,box,isTray,S) / pit(g) / topUI(g,game,S) / mat3d(kind,colorName)->{roughness,metalness}
import { GEO, TAU } from './game.js';
import { RR, boardPath } from './render.js';
import jadeTexUrl from '../assets/themes/jade/jade_l.jpg';
import leavesUrl from '../assets/themes/jade/leaves.webp';
import sceneUrl from '../assets/themes/jade/scene.webp';
import woodSceneUrl from '../assets/themes/wood/scene.webp'; // phase20：木质参考图去棋子场景
import candySceneUrl from '../assets/themes/candy/scene.webp'; // phase21：彩块参考图去棋子场景 // phase19：参考图风格整幅场景（竹/荷/湖 + 雕玉大盘框 + 下方玉面板），无棋子

const img = u => { if (typeof Image === 'undefined') return null; const im = new Image(); im.src = u; return im; };
const TEX = { jade: img(jadeTexUrl), leaves: img(leavesUrl), scene: img(sceneUrl), woodScene: img(woodSceneUrl), candyScene: img(candySceneUrl) };
export const themeAssetsReady = () => Promise.all(Object.values(TEX).filter(Boolean).map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));

// ---------- 通用：基于 SDF 的逐像素“实体”渲染（倒角高度场 → 法线 → 光照） ----------
const hex = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) / 255); };
const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
const LIGHT = (() => { const v = [-0.32, -0.48, 0.82], n = Math.hypot(...v); return v.map(x => x / n); })();
// 材质：plastic（高光漆面塑料）/ metal（拉丝金属）/ rubber（哑光橡胶）/ glass（烟熏玻璃）
const MAT = {
  plastic: { amb: 0.30, dif: 0.74, ks: 0.7, sh: 70, ks2: 0.22, sh2: 8, sss: 0.18, rim: 0.35 },
  metal: { amb: 0.30, dif: 0.55, ks: 1.1, sh: 40, ks2: 0.45, sh2: 4, sss: 0, rim: 0.2, aniso: 0.05 },
  rubber: { amb: 0.5, dif: 0.55, ks: 0.12, sh: 12, ks2: 0.04, sh2: 3, sss: 0, rim: 0.25 },
  glass: { amb: 0.5, dif: 0.35, ks: 1.0, sh: 120, ks2: 0.3, sh2: 6, sss: 0, rim: 0.6 },
};
// ---------- phase16：协作式分片生成（可恢复） ----------
// JOB.on 时 solid()/jadeWalls() 每行检查截止时间；超时 → 保存进度到 JOB.memo 并抛出 YIELD；下一帧重跑同一绘制函数时，
// 已完成的子画布直接复用，未完成的从断点行继续。memo 键 = 调用签名 + 该签名第 n 次出现（与调用顺序/CACHE 短路无关）。
// JOB.ss：0 = 原超采样；1 = 降一级（慢设备）；2 = 强制 1×（首帧快速预览）。
export const YIELD = { yield: true };
export const JOB = { on: false, deadline: 0, memo: null, occ: null, ss: 0, usedSS: false };
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
function slot(sig) { if (!JOB.on) return null; const n = JOB.occ.get(sig) || 0; JOB.occ.set(sig, n + 1); const k = sig + '#' + n; let st = JOB.memo.get(k); if (!st) { JOB.memo.set(k, st = {}); } return st; }
const over = () => JOB.on && now() > JOB.deadline;
/** 在时间片内运行 fn；返回 { v } 或 null（让出，进度保存在 memo）。 */
export function runJob(memo, deadline, fn, ss = 0) {
  const prev = { ...JOB }; Object.assign(JOB, { on: true, deadline, memo, occ: new Map(), ss, usedSS: false });
  try { const v = fn(); return { v, usedSS: JOB.usedSS }; } catch (e) { if (e === YIELD) return null; throw e; } finally { const u = JOB.usedSS; Object.assign(JOB, prev); JOB.lastUsedSS = u; }
}
export function cpuBench() { const t = now(); let s = 0; for (let i = 1; i < 2e5; i++) s += Math.sqrt(i) * Math.sin(i); return (now() - t) + (s > 0 ? 0 : 1e-9); }

/**
 * 渲染一个实体精灵到新画布。w,h,ax,ay 为设计单位；k = 像素/设计单位。
 * sdf(x,y) 设计单位，<0 为内部。bevel = 倒角宽度（设计单位，圆管时 = 管半宽）。
 * o: { color, mat, shadow:{dx,dy,blur,a}, concave, light, tint(x,y,[r,g,b])->[r,g,b], grain, alpha }
 */
export function solid(w, h, ax, ay, k, sdf, bevel, o = {}) {
  if (o.ss > 1) { JOB.usedSS = true; if (JOB.on && JOB.ss) o = { ...o, ss: JOB.ss >= 2 ? 1 : Math.max(1, o.ss - 1) }; }
  const pv = JOB.on && JOB.ss >= 3 && k >= 1.5; if (pv) JOB.usedSS = true; // 预览：半分辨率着色后放大（仅首帧快速预览）
  const st = slot(`s${w},${h},${ax},${ay},${k},${bevel},${o.ss | 0},${pv ? 'p' : ''}`); if (st && st.done) return st.done;
  let c0 = solidRun(w, h, ax, ay, pv ? k / 2 : k, sdf, bevel, o, st);
  if (pv) { const W = Math.ceil(w * k), H = Math.ceil(h * k), u = mk(W, H), ug = u.getContext('2d'); ug.imageSmoothingQuality = 'high'; ug.drawImage(c0, 0, 0, W, H); c0 = u; }
  if (st) { st.done = c0; delete st.id; } return c0;
}
function solidRun(w, h, ax, ay, k, sdf, bevel, o, st) {
  if (o.ss > 1) { // 超采样：高分辨率渲染后逐级减半下采样（干净抗锯齿边缘，无毛刺/光晕）
    let src = solid(w, h, ax, ay, k * o.ss, sdf, bevel, { ...o, ss: 1 }); const W = Math.ceil(w * k), H = Math.ceil(h * k);
    while (src.width / 2 >= W * 1.01) { const t = mk(Math.ceil(src.width / 2), Math.ceil(src.height / 2)), tg = t.getContext('2d'); tg.imageSmoothingQuality = 'high'; tg.drawImage(src, 0, 0, t.width, t.height); src = t; }
    const c = mk(W, H), cg = c.getContext('2d'); cg.imageSmoothingQuality = 'high'; cg.drawImage(src, 0, 0, W, H); return c;
  }
  const W = Math.ceil(w * k), H = Math.ceil(h * k);
  if (st && !st.id) { st.c = mk(W, H); st.id = st.c.getContext('2d').createImageData(W, H); st.py = 0; st.seed = 1234567; }
  const c = st ? st.c : mk(W, H), g = c.getContext('2d'), id = st ? st.id : g.createImageData(W, H), d = id.data, py0 = st ? st.py : 0;
  const M = MAT[o.mat || 'plastic'], base = hex(o.color || '#888'), L = o.light || LIGHT, Hv = [L[0], L[1], L[2] + 1], hn = Math.hypot(...Hv), HH = Hv.map(x => x / hn);
  const sh = o.shadow, e = 0.5 / k, prof = s => { const t = cl(-s / bevel); return Math.sqrt(1 - (1 - t) * (1 - t)) * bevel; };
  let seed = st ? st.seed : 1234567; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let py = py0; py < H; py++) { if (st && py > py0 && over()) { st.py = py; st.seed = seed; throw YIELD; } for (let px = 0; px < W; px++) {
    const x = (px + 0.5) / k - ax, y = (py + 0.5) / k - ay, s = sdf(x, y), i = (py * W + px) * 4;
    let sa = 0; if (sh) { const ss = sdf(x - sh.dx, y - sh.dy); sa = ss < 0 ? sh.a : ss < sh.blur ? sh.a * Math.pow(1 - ss / sh.blur, 2) : 0; }
    const cov = cl(0.5 - s * k);
    if (cov <= 0) { if (sa > 0) { d[i] = 38; d[i + 1] = 26; d[i + 2] = 12; d[i + 3] = sa * 255; } continue; }
    const zx = (prof(sdf(x + e, y)) - prof(sdf(x - e, y))) / (2 * e), zy = (prof(sdf(x, y + e)) - prof(sdf(x, y - e))) / (2 * e);
    let nx = -zx, ny = -zy, nz = 1; if (o.concave) { nx = -nx; ny = -ny; } const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const ndl = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]), ndh = Math.max(0, nx * HH[0] + ny * HH[1] + nz * HH[2]);
    let col = o.tint ? o.tint(x, y, base) : base;
    if (o.custom) { const q = o.custom(x, y, nx, ny, nz), a = cov * (o.alpha ?? 1) * (q[3] ?? 1), A = a + sa * (1 - a); d[i] = q[0] * 255 * a / A; d[i + 1] = q[1] * 255 * a / A; d[i + 2] = q[2] * 255 * a / A; d[i + 3] = A * 255; continue; }
    if (o.clean) { // 干净缎面金属（phase9）：管截面连续渐变 + 宽柔高光带 + 细锐高光 + 下沿柔和反弹光 + 影棚环境渐变；无噪声/拉丝
      const C = o.clean, sm = (a, b, v) => { v = cl((v - a) / (b - a)); return v * v * (3 - 2 * v); };
      const dir = C.dir ? C.dir * (-0.55 * nx - 0.85 * ny) : 0; // 左上→右下柔和环境渐变（低幅，平滑）
      const body = 0.20 + 0.70 * Math.pow(nz, 1.25) + dir * (1 - 0.5 * nz);
      const bounce = (C.bounce ?? 0.22) * Math.pow(1 - nz, 2.2) * sm(0.0, 0.6, 1 - nz);
      const broad = (C.broad ?? 0.22) * Math.pow(ndh, 7), tight = (C.tight ?? 0.55) * Math.pow(sm(0.80, 1.0, ndh), 2.2);
      const ts = C.tintSpec ?? 0.25, warm = [1.0, 0.93, 0.82];
      const out = [0, 1, 2].map(j => { const m = col[j]; return cl(m * body + bounce * warm[j] * (0.35 + 0.65 * m) + (broad + tight) * (1 - ts + ts * m)); });
      const a = cov * (o.alpha ?? 1), A = a + sa * (1 - a);
      d[i] = out[0] * 255 * a / A; d[i + 1] = out[1] * 255 * a / A; d[i + 2] = out[2] * 255 * a / A; d[i + 3] = A * 255; continue;
    }
    if (o.satin) { // 缎面/阳极氧化金属：环境反射(上亮下暗的影棚 + 亚麻暖色反弹) + 宽高光带 + 细高光 + 拉丝 + 边缘暖色轮廓光
      const sm = (a, b, v) => { v = cl((v - a) / (b - a)); return v * v * (3 - 2 * v); };
      const ld = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      const env = 0.34 + 0.30 * sm(0.1, 0.95, nz) + 0.16 * ld - 0.07 * Math.exp(-Math.pow((nz - 0.5) / 0.14, 2));
      const fres = Math.pow(1 - nz, 2), bounce = [0.86, 0.76, 0.6];
      const br = o.brush ? o.brush(x, y, rnd) : 1;
      const spec = 0.6 * (o.satin.broad ?? 0.30) * Math.pow(ndh, 6) + 0.45 * (o.satin.tight ?? 0.55) * Math.pow(ndh, 40);
      const tw = o.satin.tintSpec ?? 0.35;
      const out = [0, 1, 2].map(j => { const m = col[j]; return cl((m * env * br + fres * 0.3 * bounce[j] * (0.5 + 0.5 * m)) + spec * (1 - tw + tw * m) * br); });
      const a = cov * (o.alpha ?? 1), A = a + sa * (1 - a);
      d[i] = out[0] * 255 * a / A; d[i + 1] = out[1] * 255 * a / A; d[i + 2] = out[2] * 255 * a / A; d[i + 3] = A * 255; continue;
    }
    const fres = Math.pow(1 - nz, 2), occl = o.concave ? 0.35 + 0.65 * (1 - cl(-s / bevel)) * 0 + 0.4 * nz : 1;
    const spec = M.ks * Math.pow(ndh, M.sh) + M.ks2 * Math.pow(ndh, M.sh2) * 0.5 + M.rim * fres * 0.25;
    const lum = (M.amb + M.dif * ndl) * (1 - 0.35 * fres) * occl;
    const g0 = o.grain ? 1 + (rnd() - 0.5) * o.grain : 1, an = M.aniso ? 1 + M.aniso * Math.sin((o.anisoU ? o.anisoU(x, y) : x) * 1.7 + rnd() * 0.6) : 1;
    let r = col[0] * lum * g0 * an, gg = col[1] * lum * g0 * an, b = col[2] * lum * g0 * an;
    if (M.sss) { const t = nz * nz * M.sss; r += col[0] * t; gg += col[1] * t; b += col[2] * t; }
    r += spec; gg += spec; b += spec;
    const a = cov * (o.alpha ?? 1), A = a + sa * (1 - a);
    d[i] = cl(r) * 255 * a / A; d[i + 1] = cl(gg) * 255 * a / A; d[i + 2] = cl(b) * 255 * a / A; d[i + 3] = A * 255;
  } }
  g.putImageData(id, 0, 0); return c;
}
const KS = 2;
const put = (g, c, x, y, w, h) => g.drawImage(c, x, y, w, h);
const sdBox = (x, y, hw, hh, r) => { const qx = Math.abs(x) - hw + r, qy = Math.abs(y) - hh + r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };
const wrapA = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const isGray = (game, r) => /^(grey|gray)$/.test(r.color) || (game.S && /gr[ae]y/.test(JSON.stringify(game.S.colorMap || '')) && r.color === 'grey');

// ---------- 超写实主题（phase8：亚麻布面 + 缎面/阳极氧化金属 + 玻璃珠） ----------
// 光照约定：环/夹扣/颈部会随环旋转，因此用“正上方主光 + 影棚环境反射”（旋转不变，转动时高光不会跟着跑）；
// 方向感由世界坐标下的分层投影（右下偏移、两层模糊）提供。静态物体（背景、传送带、盒子、UI、球）用左上暖光。
const GRAYC = '#868b93';
const UP = [0, 0, 1];
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const metalCol = (game, name) => { if (/^(grey|gray)$/.test(name)) return GRAYC; const c = hex(game.color(name)), m = (c[0] + c[1] + c[2]) / 3; return '#' + c.map(v => Math.round(cl((v * 0.95 + m * 0.05) * 0.86) * 255).toString(16).padStart(2, '0')).join(''); }; // 阳极氧化：略降饱和/明度
const tubeW = R => R * 0.205; // 视觉管半宽（碰撞仍用 ringThick）
function ringSDF(r, hw) {
  const R = r.R, a0 = r.gapC, half = r.closed ? -1 : r.gapW / 2, e1 = [R * Math.cos(a0 + half), R * Math.sin(a0 + half)], e2 = [R * Math.cos(a0 - half), R * Math.sin(a0 - half)];
  return (x, y) => { if (r.closed || Math.abs(wrapA(Math.atan2(y, x) - a0)) > half) return Math.abs(Math.hypot(x, y) - R) - hw; return Math.min(Math.hypot(x - e1[0], y - e1[1]), Math.hypot(x - e2[0], y - e2[1])) - hw; };
}
function marble(col, r, k) { // 玻璃珠：左上主光高光 + 右下透射焦散 + 菲涅尔暗边 + 细亮轮廓 + 烘焙右下投影
  const pad = r * 0.9, s = Math.ceil(r * 2 + pad * 2), W = Math.ceil(s * k), c = mk(W, W), g = c.getContext('2d'), id = g.createImageData(W, W), d = id.data, b = hex(col);
  const L = LIGHT, HH = (() => { const v = [L[0], L[1], L[2] + 1], n = Math.hypot(...v); return v.map(x => x / n); })();
  for (let py = 0; py < W; py++) for (let px = 0; px < W; px++) {
    const x = (px + 0.5) / k - s / 2, y = (py + 0.5) / k - s / 2, i = (py * W + px) * 4, rr = Math.hypot(x, y), cov = cl(0.5 - (rr - r) * k);
    const sd = Math.hypot(x - r * 0.22, y - r * 0.34) - r * 0.82, sa = sd < 0 ? 0.5 * cl(-sd / (r * 0.9) + 0.35) : 0.5 * 0.35 * Math.pow(cl(1 - sd / (r * 0.55)), 2);
    if (cov <= 0) { if (sa > 0) { d[i] = 38; d[i + 1] = 26; d[i + 2] = 12; d[i + 3] = sa * 255; } continue; }
    const nx = x / r, ny = y / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), ndl = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]), ndh = Math.max(0, nx * HH[0] + ny * HH[1] + nz * HH[2]);
    const fres = Math.pow(1 - nz, 2.5), caus = Math.pow(cl(0.5 + 0.55 * (nx * 0.55 + ny * 0.75)), 3) * (1 - fres) * 0.75;
    const spec = 1.6 * Math.pow(ndh, 220) + 0.35 * Math.pow(ndh, 24), win = Math.exp(-(Math.pow((nx + 0.05) / 0.1, 2) + Math.pow((ny + 0.62) / 0.06, 2))) * 0.25;
    const rim = Math.pow(cl((rr / r - 0.86) / 0.14), 3) * cl((nx * 0.6 + ny * 0.8) * -1 + 0.4) * 0.35;
    const o = [0, 1, 2].map(j => cl(b[j] * (0.22 + 0.5 * ndl + caus * 1.2) * (1 - 0.45 * fres) + spec + win + rim * 0.9 + b[j] * rim * 0.3));
    const a = cov, A = a + sa * (1 - a);
    d[i] = o[0] * 255 * a / A; d[i + 1] = o[1] * 255 * a / A; d[i + 2] = o[2] * 255 * a / A; d[i + 3] = A * 255;
  }
  g.putImageData(id, 0, 0); c.dw = s; return c;
}

// ---------- 玉石主题（phase11：翡翠竹节手镯 + 玉珠 + 薄荷玉盘 + 金/银夹扣） ----------
// 环/夹扣会随环旋转：光照只依赖管截面（顶光，旋转不变）；玉质纹理（色根/絮/点）在环本地坐标里，随环转动是“材质”而非光影。
const vh = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return (vh(i, j) * (1 - u) + vh(i + 1, j) * u) * (1 - v) + (vh(i, j + 1) * (1 - u) + vh(i + 1, j + 1) * u) * v; };
const fbm = (x, y, o = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f); f *= 2.03; a *= 0.5; } return s / (1 - Math.pow(0.5, o)); };
const sm = (a, b, v) => { v = cl((v - a) / (b - a)); return v * v * (3 - 2 * v); };
const strSeed = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 9973; return h; };
// 色相 → 玉种（深色 deep、白底 base、名称）
const JADE = {
  red: { deep: [0.74, 0.20, 0.14], base: [0.97, 0.92, 0.88], name: '红翡' },
  orange: { deep: [0.85, 0.50, 0.12], base: [0.98, 0.94, 0.86], name: '黄翡' },
  yellow: { deep: [0.86, 0.68, 0.14], base: [0.98, 0.96, 0.86], name: '金丝黄翡' },
  green: { deep: [0.02, 0.42, 0.22], base: [0.90, 0.97, 0.93], name: '翠绿' },
  cyan: { deep: [0.10, 0.60, 0.62], base: [0.90, 0.98, 0.98], name: '冰种青' },
  blue: { deep: [0.14, 0.36, 0.70], base: [0.90, 0.94, 0.99], name: '蓝水' },
  purple: { deep: [0.50, 0.30, 0.76], base: [0.96, 0.93, 0.99], name: '紫罗兰' },
  white: { deep: [0.80, 0.82, 0.74], base: [0.99, 0.98, 0.94], name: '羊脂白玉' },
};
const GOLD = '#d6a22e', SILVER = '#cfd5dc';
const MINT = { deep: [0.36, 0.66, 0.58], base: [0.88, 0.97, 0.93] }; // 玉盒：与薄荷玉盘同色
function jadeOf(colHex) {
  const [r, g, b] = hex(colHex), mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0; if (s < 0.18) return null; // 灰 → 金竹节
  let h = mx === mn ? 0 : mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn); h = (h * 60 + 360) % 360;
  return h < 14 || h >= 335 ? JADE.red : h < 42 ? JADE.orange : h < 68 ? JADE.yellow : h < 165 ? JADE.green : h < 205 ? JADE.cyan : h < 255 ? JADE.blue : JADE.purple;
}
const jadeHex = (J, t) => '#' + J.deep.map((v, i) => Math.round(cl(J.base[i] + (v - J.base[i]) * t) * 255).toString(16).padStart(2, '0')).join('');
// 玉纹贴图（AI 生成的无缝翡翠灰度图：暗=色根/絮，亮=冰底），一次取像素，双线性采样（环绕）
let JT = null;
function jadeTex() {
  if (JT) return JT; const im = TEX.jade; if (!im || !im.complete || !im.naturalWidth) return null;
  const c = mk(im.naturalWidth, im.naturalHeight), g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = d[i * 4] / 255; return (JT = { w: c.width, h: c.height, a });
}
function texAt(u, v) { // u,v 以贴图像素计；返回“色根量” 0..1
  const T = jadeTex(); if (!T) return fbm(u / 90, v / 90, 4);
  const { w, h, a } = T; u = ((u % w) + w) % w; v = ((v % h) + h) % h; const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0, x1 = (x0 + 1) % w, y1 = (y0 + 1) % h;
  const L = (a[y0 * w + x0] * (1 - fx) + a[y0 * w + x1] * fx) * (1 - fy) + (a[y1 * w + x0] * (1 - fx) + a[y1 * w + x1] * fx) * fy; return 1 - L;
}
// 竹节：本地角度 θ 的节距
const bambooN = () => 6; // 参考：整圈 6 节，每节约 60°（C 环按弧长约 4–5 节）
const nodeD = (th, R, n) => { const u = (th / TAU * n) % 1, f = u < 0 ? u + 1 : u; return Math.min(f, 1 - f) * TAU * R / n; };
const nodeProf = (d, hw) => -0.085 * Math.exp(-Math.pow(d / (hw * 0.16), 2)) + 0.03 * Math.exp(-Math.pow((d - hw * 0.26) / (hw * 0.09), 2)) + 0.06 * sm(0.25, 1.7, d / hw); // 节处收腰 + 节缘小唇 + 节间鼓起（长节） // 节脊凸起 + 两侧凹槽 + 节间微鼓
function bambooSDF(r, hw) { const base = ringSDF(r, hw), n = bambooN(r.R, hw); return (x, y) => base(x, y) - hw * nodeProf(nodeD(Math.atan2(y, x), r.R, n), hw); }
// 管截面分解（旋转不变）：nr=径向分量（向外为正），nt=切向分量
const xsec = (x, y, nx, ny) => { const q = Math.hypot(x, y) || 1, ux = x / q, uy = y / q; return [nx * ux + ny * uy, -nx * uy + ny * ux]; };
// 截面光：顶光略偏外侧（只依赖 nr/nz → 环转动光影不变）
const LR = [-0.38, 0.925], HR = (() => { const v = [LR[0], LR[1] + 1], l = Math.hypot(...v); return v.map(x => x / l); })();
// 玉：吸收（中心厚 → 色根浓），边缘薄而通透发亮，下侧透射辉光，湿润高光两条
function jadeShade(J, seed, R, hw, n, ballMode, gap) {
  const sc = ballMode ? 1.6 : 1.0;
  return (x, y, nx, ny, nz) => {
    let u, v, nr, nt, t;
    if (ballMode) { u = x * sc * 1.6 + seed * 53; v = y * sc * 1.6 + seed * 31; nr = (nx * 0.6 + ny * 0.8); nt = 0; t = 0; }
    else { const th = Math.atan2(y, x), rho = Math.hypot(x, y); t = (rho - R) / hw; u = th * R * sc + seed * 97; v = t * hw * sc * 1.2 + seed * 41; [nr, nt] = xsec(x, y, nx, ny); }
    const m0 = texAt(u, v), big = fbm(u / 260 + seed, v / 260, 3);
    const thick = ballMode ? Math.pow(nz, 0.6) : Math.pow(nz, 0.8); // 光程
    // 色带：沿弧大尺度分区（一段浓翠、一段冰底，像参考里的“半翠半冰”），纹理只调制分区内的浓淡与絮
    // 色带（锚定在 C 口之间的弧上，关于弧中点对称）：弧中段浓、两端 C 口处渐变成冰底；闭环则整体中浓
    let zone;
    if (ballMode) zone = 0.75;
    else if (gap && !gap.closed) { const g0 = gap.gapW / 2, d = Math.abs(wrapA(Math.atan2(y, x) - gap.gapC)), q = (d - g0) / Math.max(0.01, Math.PI - g0); zone = cl(sm(0.1, 0.78, q + (big - 0.5) * 0.12)); }
    else zone = cl(0.5 + 0.35 * (big - 0.5) * 2);
    let amt = cl(zone * (0.62 + 0.55 * m0) + (1 - zone) * sm(0.45, 0.9, m0) * 0.55); amt = cl(amt * (0.55 + 0.6 * thick)); if (ballMode) amt = cl(0.42 + amt * 0.75);
    const veil = 0.5 + 0.5 * texAt(u * 0.5 + 211, v * 0.5 + 73); // 絮
    let a = [0, 1, 2].map(j => { const b0 = J.base[j] + (J.deep[j] - J.base[j]) * 0.08; return b0 + (J.deep[j] * 0.82 - b0) * Math.pow(amt, 0.8); });
    const fleck = ballMode ? 0 : sm(0.72, 0.9, texAt(u * 2.3 + 17, v * 2.3 + 5)) * zone; a = a.map((c, j) => c * (0.9 + 0.1 * veil) * (1 - 0.35 * fleck));
    // 天然杂质（仅环体；用环局部坐标的二维噪声 → 沿弧无缝、随环旋转、按 seed 确定）
    if (!ballMode) {
      const th = Math.atan2(y, x), rho = Math.hypot(x, y), cx = Math.cos(th), sy = Math.sin(th), o1 = seed * 13.7;
      const P = (f, k, oc) => fbm(cx * R / f + o1 + k, sy * R / f + rho / (f * 0.35) + k * 0.7, oc); // 沿弧拉长（径向压缩）
      const cloud = fbm(x / 34 + o1, y / 34 - o1, 4), cotton = 1 - Math.abs(2 * fbm(x / 22 + 31 + o1, y / 22 + 7, 4) - 1), streak = P(26, 5, 3);
      const fl = sm(0.76, 0.84, fbm(x / 3.2 + o1, y / 3.2 + 9, 2)), crack = sm(0.965, 0.995, 1 - Math.abs(2 * fbm(x / 16 + 77 + o1, y / 16 - 13, 3) - 1));
      const dz = zone * amt, pz = 1 - zone;
      // 浓段：深色云团 + 棉絮白丝 + 黑绿点/线 + 蓝绿↔黄绿色偏
      const hueS = (fbm(x / 60 + 3 + o1, y / 60, 2) - 0.5) * 0.5 * dz;
      a = a.map((c, j) => c * (1 - 0.2 * dz * sm(0.45, 0.75, cloud)) * (1 - 0.28 * dz * sm(0.58, 0.72, streak)));
      a = [a[0] * (1 + hueS * 0.8), a[1], a[2] * (1 - hueS)];
      const ct = sm(0.86, 0.97, cotton) * dz * 0.1; a = a.map(c => c + (0.92 - c) * ct);
      a = a.map((c, j) => c * (1 - 0.6 * fl * (0.3 + 0.7 * zone)) + (j === 1 ? 0.03 : 0) * fl * zone);
      // 冰段：乳白云絮 + 淡绿纱 + 灰绿细点 + 冰裂纹（细亮线+暗边）
      const milk = sm(0.4, 0.75, cloud) * pz * 0.35, veilG = sm(0.5, 0.75, P(40, 19, 3)) * pz * 0.22, spk = sm(0.86, 0.9, fbm(x / 2.6 + 3, y / 2.6 + o1, 2)) * pz;
      a = a.map((c, j) => c + (0.97 - c) * milk); a = a.map((c, j) => c + (J.deep[j] * 0.9 + 0.1 - c) * veilG);
      a = a.map((c, j) => c * (1 - 0.28 * spk) + [0.02, 0.04, 0.03][j] * spk);
      a = a.map(c => cl(c + 0.09 * crack * (0.4 + 0.6 * pz) * thick));
    }
    const deepCore = Math.pow(thick, 2) * amt; a = a.map((c, j) => c * (1 - 0.45 * deepCore) + J.deep[j] * 0.15 * deepCore); // 浓核
    const ndl = Math.max(0, (ballMode ? -0.35 * nx - 0.45 * ny : LR[0] * nr) + LR[1] * nz);
    const wrap = 0.5 + 0.5 * ndl; // 透光体：包裹漫反射
    const edge = Math.pow(1 - nz, 1.6);
    const sss = (ballMode ? sm(-0.2, 0.8, nx * 0.55 + ny * 0.85) : sm(-0.1, 0.9, nr * 0.9)) * edge; // 背光侧透射亮边
    let o = a.map((c, j) => c * ((ballMode ? 0.68 : 0.55) + 0.5 * wrap) + 0.10 * Math.pow(nz, 2) + sss * (0.45 * J.base[j] + 0.25 * (1 - amt) + 0.2 * J.deep[j]) + edge * 0.3 * (1 - amt) + 0.16 * amt * Math.pow(thick, 3) * J.deep[j] / Math.max(...J.deep));
    // 竹节刻痕：切向坡度暗化 + 节脊顶亮线
    if (!ballMode) { const slope = Math.abs(nt); const node = Math.exp(-Math.pow(nodeD(Math.atan2(y, x), R, n) / (hw * 0.07), 2)); o = o.map((c, j) => c * (1 - 0.3 * sm(0.08, 0.6, slope)) + 0.07 * node * Math.pow(nz, 2) - 0.05 * node); }
    // 湿润高光：主光窄高光 + 天窗柔反射 + 菲涅尔
    const sp1 = ballMode ? Math.pow(Math.max(0, 1 - Math.hypot(nx + 0.34, ny + 0.42) / 0.22), 2.2) : Math.pow(Math.max(0, nr * HR[0] + nz * HR[1]), 140);
    const sp2 = ballMode ? 0.35 * Math.pow(Math.max(0, 1 - Math.hypot(nx - 0.3, ny - 0.38) / 0.35), 2) : 0.22 * Math.pow(Math.max(0, nr * 0.62 + nz * 0.78), 30);
    const fres = 0.12 * Math.pow(1 - nz, 3);
    const flick = ballMode ? 1 : 0.55 + 0.45 * sm(0.25, 0.75, 1 - m0); const rimSp = ballMode ? 0 : 0.55 * Math.exp(-Math.pow((nr + 0.62) / 0.1, 2)) * sm(0.2, 0.6, nz) * flick; o = o.map(c => cl(c + (ballMode ? 0.95 : 0.22) * sp1 * flick + sp2 * (ballMode ? 0.8 : 0.45) + fres + rimSp));
    let pzA = 0;
    if (!ballMode) {
      // 深色区光照（截面模型）：深翠体 + 透光内辉 + 暗核/暗边 + 左上宽柔高光 + 细锐高光 + 下缘反弹光
      const kz = Math.pow(cl(zone), 1.1), sdl = Math.max(0, -0.5 * nx - 0.62 * ny + 0.6 * nz);
      const am = (a[0] + a[1] + a[2]) / 3, body = a.map((c, j) => (am + (c - am) * 1.35) * 0.92 + J.deep[j] * 0.1).map(c => c * (0.72 + 0.34 * sdl) * (1 - 0.38 * edge) * (1 - 0.34 * sm(0.48, 0.68, fbm(x / 11 + seed * 3.1, y / 11 - seed, 3)) * (0.5 + 0.5 * amt)));
      const glowC = Math.exp(-Math.pow((nx * 0.4 + ny * 0.7 - 0.25) / 0.45, 2)) * Math.pow(nz, 1.2); // 光穿过管体在背光侧下方聚出的内辉
      const broad = 0.24 * Math.pow(sdl, 5), crisp = 0.9 * Math.pow(Math.max(0, -0.45 * nx - 0.6 * ny + 0.66 * nz), 45);
      const bounce = 0.2 * sm(0.15, 0.9, 0.45 * nx + 0.8 * ny) * Math.pow(1 - nz, 1.3) * sm(0, 0.3, nz + 0.2);
      const thin = 0.85 * Math.pow(Math.max(0, -0.45 * nx - 0.6 * ny + 0.66 * nz), 400); const dk = body.map((c, j) => cl(c + thin + glowC * (0.3 * J.base[j] + 0.3 * J.deep[j]) * (0.6 + 0.4 * amt) + broad + crisp + bounce * (0.55 * J.base[j] + 0.3)));
      o = o.map((c, j) => c + (dk[j] - c) * kz);
      // 浅色区：降亮、带灰绿、半透（透出背景）
      pzA = Math.pow(1 - cl(zone), 1.3);
      const ice = [0.70, 0.80, 0.77].map((v, j) => v * 0.7 + J.base[j] * 0.3);
      o = o.map((c, j) => c + (Math.min(c, c * 0.78 + ice[j] * 0.12) - c) * pzA + (crisp * 0) );
    }
    const alpha = cl(0.74 + 0.3 * Math.max(thick, amt) + 0.25 * edge - pzA * 0.3 * (1 - edge) * (1 - Math.pow(Math.max(0, nr * HR[0] + nz * HR[1]), 40)));
    return [o[0], o[1], o[2], alpha];
  };
}
// 金属（抛光/缎面）：截面环境反射条纹 + 沿弧拉丝 + 竹节刻面
function metalShade(colHex, R, hw, n, mode) {
  const C = hex(colHex), gold = C[0] > C[2] + 0.2;
  const env = q => 0.48 + 0.8 * Math.exp(-Math.pow((q + 0.42) / 0.2, 2)) + 0.35 * Math.exp(-Math.pow((q - 0.55) / 0.22, 2)) + 0.18 * sm(-0.1, 0.25, q) - 0.12 * Math.exp(-Math.pow((q - 0.1) / 0.12, 2));
  return (x, y, nx, ny, nz) => {
    let q, nt = 0, along;
    if (mode === 'ring') { const r2 = xsec(x, y, nx, ny); q = r2[0]; nt = r2[1]; along = Math.atan2(y, x) * R; }
    else if (mode === 'collar') { q = ny; along = x * 3; nt = nx; } // 圆柱箍：轴沿 x
    else { q = ny; along = x; }
    const brush = 0.94 + 0.06 * vn(along * 0.08, (q + 1) * 40);
    let e = env(q) * brush; if (mode === 'collar') e = 0.62 + 0.55 * (e - 0.62); e *= (1 - 0.45 * sm(0.08, 0.55, Math.abs(nt))) + 0.25 * sm(0.55, 0.9, -nt);
    const sp = mode === 'collar' ? 0.45 * Math.pow(Math.max(0, q * HR[0] + nz * HR[1]), 18) : Math.pow(Math.max(0, q * HR[0] + nz * HR[1]), 70);
    const o = C.map((c, j) => cl(c * e * (gold ? 1 : 0.95) + (gold ? 0.55 * c + 0.2 : 0.8) * sp + 0.06 * Math.pow(1 - nz, 2)));
    return [o[0], o[1], o[2], 1];
  };
}

// 阻隔板（盘框/漏斗分隔板/带两侧挡板）：沿原版 boardPath 外侧生成一圈实心薄荷玉板 —— 位置与原版木框完全一致（碰撞不变），
// 逐像素：模糊遮罩当高度场 → 法线 → 倒角明暗；薄荷玉 fbm 絮 + 内缘高光 + 银竹节刻线
function jadeWalls(W, H) {
  const st = slot('walls' + W + 'x' + H); if (st && st.done) return st.done;
  const band = 34;
  if (st && !st.O && !st.m) { const m = mk(W, H), mg = m.getContext('2d');
  mg.save(); mg.beginPath(); mg.rect(-10, -10, W + 20, H + 20); boardPath(mg); mg.clip('evenodd'); mg.beginPath(); boardPath(mg); mg.lineWidth = band * 2; mg.lineJoin = 'round'; mg.strokeStyle = '#fff'; mg.stroke(); mg.restore();
  const hb = mk(W, H), hg = hb.getContext('2d'); hg.filter = 'blur(9px)'; hg.drawImage(m, 0, 0); st.m = m; st.hb = hb; if (over()) throw YIELD; }
  if (!st || !st.O) { const m = st && st.m || mk(W, H), mg = m.getContext('2d'); if (!(st && st.m)) {
  mg.save(); mg.beginPath(); mg.rect(-10, -10, W + 20, H + 20); boardPath(mg); mg.clip('evenodd'); mg.beginPath(); boardPath(mg); mg.lineWidth = band * 2; mg.lineJoin = 'round'; mg.strokeStyle = '#fff'; mg.stroke(); mg.restore();
  }
  const hb = st && st.hb || mk(W, H), hg = hb.getContext('2d'); if (!(st && st.hb)) { hg.filter = 'blur(9px)'; hg.drawImage(m, 0, 0); }
  const A = mg.getImageData(0, 0, W, H).data, Hd = hg.getImageData(0, 0, W, H).data, out = mk(W, H), O = out.getContext('2d').createImageData(W, H);
  if (st) Object.assign(st, { A, Hd, out, O, y: 1 }); else return wallsFinish(W, H, band, { A, Hd, out, O, y: 1 }); }
  const c = wallsFinish(W, H, band, st); st.done = c; delete st.m; delete st.hb; delete st.A; delete st.Hd; delete st.O; return c;
}
function wallsFinish(W, H, band, st) {
  const { A, Hd, out, O } = st, og = out.getContext('2d'), d = O.data, y0 = st.y;
  const L = [-0.35, -0.55, 0.76];
  for (let y = y0; y < H - 1; y++) { if (y > y0 && over() && JOB.memo) { st.y = y; throw YIELD; } for (let x = 1; x < W - 1; x++) {
    const i = (y * W + x) * 4, a = A[i + 3] / 255; if (a < 0.01) continue;
    const hx = (Hd[i + 7] - Hd[i - 1]) / 255, hy = (Hd[i + W * 4 + 3] - Hd[i - W * 4 + 3]) / 255;
    let nx = -hx * 5, ny = -hy * 5, nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const ndl = cl(L[0] * nx + L[1] * ny + L[2] * nz), f = fbm(x / 70 + 11, y / 70, 3), v = Math.exp(-Math.pow((fbm(x / 160, y / 160 + 5, 3) - 0.5) / 0.06, 2));
    const sp = Math.pow(cl(nz * 0.3 + ndl * 0.7), 24) * 0.55, edge = 1 - Hd[i + 3] / 255;
    const base = MINT.base.map((c, j) => c + (MINT.deep[j] - c) * (0.35 + 0.35 * f + 0.25 * v));
    for (let j = 0; j < 3; j++) d[i + j] = cl(base[j] * (0.62 + 0.45 * ndl) + sp + edge * 0.04) * 255;
    d[i + 3] = a * 255;
  } }
  const lazy = !!(JOB.on && JOB.memo);
  if (!st.put) { og.putImageData(O, 0, 0); st.put = 1; if (lazy && over()) { st.y = H; throw YIELD; } }
  if (!st.dash) {
  // 银竹节：沿板中线的短横刻（虚线描边，刻在板面上）
  og.save(); og.beginPath(); og.rect(-10, -10, W + 20, H + 20); boardPath(og); og.clip('evenodd'); og.beginPath(); boardPath(og);
  og.lineWidth = band * 1.5; og.setLineDash([2.2, 86]); og.strokeStyle = 'rgba(60,110,96,0.45)'; og.stroke(); og.lineDashOffset = -2.2; og.strokeStyle = 'rgba(255,255,255,0.55)'; og.stroke();
  og.setLineDash([]); og.lineWidth = 3; og.strokeStyle = SILVER; og.globalAlpha = 0.85; og.stroke(); og.restore(); st.dash = 1; if (lazy && over()) { st.y = H; throw YIELD; } }
  // 板投影到盘面
  const c = mk(W, H), cg = c.getContext('2d'); const S4 = lowShadow(W, H, 16, 'rgb(20,70,58)', sg => sg.drawImage(out, 0, 0)); cg.globalAlpha = 0.45; cg.drawImage(S4, 0, 6, W, H); cg.globalAlpha = 1; cg.drawImage(out, 0, 0); return c;
}
// 斜织纹平铺块：x−y ≡ −H (mod 7) 的白线 + x+y ≡ H (mod 7) 的暗线（原为 ~550×2 条整屏描边）
function hatchTile(H) {
  const k = 'hatch' + H; if (CACHE[k]) return CACHE[k];
  const t = mk(7, 7), tg = t.getContext('2d'), o1 = ((-H % 7) + 7) % 7, o2 = H % 7; tg.lineWidth = 1;
  tg.strokeStyle = 'rgba(255,255,255,0.07)'; tg.beginPath(); for (let d = -14; d <= 14; d += 7) { tg.moveTo(o1 + d, 0); tg.lineTo(o1 + d + 7, 7); } tg.stroke();
  tg.strokeStyle = 'rgba(30,90,75,0.05)'; tg.beginPath(); for (let d = -14; d <= 14; d += 7) { tg.moveTo(o2 + d, 7); tg.lineTo(o2 + d + 7, 0); } tg.stroke();
  return (CACHE[k] = t);
}
// 低分辨率柔阴影：在 1/4 画布上以 filter blur(σ/4) 生成剪影阴影（canvas shadowBlur b ≈ 高斯 σ = b/2），调用方放大绘制
function lowShadow(W, H, blur, color, draw) {
  const q = 4, w = Math.ceil(W / q), h = Math.ceil(H / q), m = mk(w, h), mg = m.getContext('2d');
  mg.scale(1 / q, 1 / q); draw(mg); mg.setTransform(1, 0, 0, 1, 0, 0); mg.globalCompositeOperation = 'source-in'; mg.fillStyle = color; mg.fillRect(0, 0, w, h);
  const o = mk(w, h), og = o.getContext('2d'); og.filter = `blur(${blur / 2 / q}px)`; og.drawImage(m, 0, 0); return o;
}
// 背景分段检查点：分片生成时每段完成后快照整张画布；恢复重跑时直接贴快照跳过已完成段（避免每帧重放全屏滤镜/渐变）
function bgCheckpoints(c, g, W, H) {
  // 只保留“最近完成段”的一张快照：恢复时跳过其之前所有段、只贴一次图（避免每帧多次整屏 drawImage）
  const L = slot('bgck' + W + 'x' + H); let n = -1, cur = false;
  return {
    run() { n++; if (L && L.snap && n <= L.n) { if (n === L.n) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'copy'; g.drawImage(L.snap, 0, 0); g.restore(); } return false; } cur = !!L; return true; },
    end() { if (cur) { const s = L.snap && L.snap.width === W ? L.snap : mk(W, H), sg = s.getContext('2d'); sg.globalCompositeOperation = 'copy'; sg.drawImage(c, 0, 0); L.snap = s; L.n = n; cur = false; if (over()) throw YIELD; } },
  };
}
const CACHE = {};
const jadeTheme = {
  id: 'jade', name: '玉石', desc: '翡翠竹节手镯（红翡/黄翡/翠绿/冰种青/蓝水/紫罗兰）+ 金竹节锚环 + 金/银夹扣 + 玉珠 + 薄荷玉盘与竹叶',
  beltJ: { deep: [0.20, 0.44, 0.36], base: [0.55, 0.735, 0.645] }, holeCol: '#1d4436', pitCol: '#1d4436', railBeads: GOLD, railBeadN: 2, railBeadR: 9, // phase24：参考图带面为薄荷翡翠 + 中轴5颗金珠
  background(W, H) {
    const c = mk(W, H), g = c.getContext('2d');
    const ck = bgCheckpoints(c, g, W, H);
    const SI = TEX[this.sceneKey || 'scene'], SC = SI && SI.complete && SI.naturalWidth ? SI : null;
    if (SC && ck.run('scene')) { g.drawImage(SC, 0, 0, W, H); ck.end(); }
    if (!SC && ck.run('sky')) {
    let gr = g.createLinearGradient(0, 0, W * 0.4, H); gr.addColorStop(0, '#9fd6c7'); gr.addColorStop(0.5, '#86c7b6'); gr.addColorStop(1, '#5fa898'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // 竹叶（四角，柔焦）
    const leaf = (x, y, len, wd, ang, col, blur) => { g.save(); g.filter = `blur(${blur}px)`; g.translate(x, y); g.rotate(ang); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.45, -wd, len, 0); g.quadraticCurveTo(len * 0.45, wd, 0, 0); g.fillStyle = col; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 2; g.beginPath(); g.moveTo(4, 0); g.lineTo(len * 0.95, 0); g.stroke(); g.restore(); };
    ck.end(); }
    if (!SC && ck.run('plate')) {
    // 大玉盘：圆盘 + 斜面厚边（逐像素：凸边倒角 + 盘心微凹）+ 投影
    const PR = 540, pcx = W / 2, pcy = 640;
    const plate = CACHE.plate || (CACHE.plate = solid(PR * 2 + 80, PR * 2 + 80, PR + 40, PR + 40, 0.5, (x, y) => Math.hypot(x, y) - PR, 46, { light: UP, shadow: { dx: 0, dy: 18, blur: 50, a: 0.35 }, custom: (x, y, nx, ny, nz) => {
      const d = Math.hypot(x, y), rim = sm(PR - 60, PR - 30, d), lip = Math.exp(-Math.pow((d - (PR - 58)) / 5, 2));
      const ndl = cl(-0.3 * nx - 0.5 * ny + 0.8 * nz), w = fbm(x / 140, y / 140, 3);
      const base = [0.70, 0.87, 0.82].map((c, j) => c * (0.9 + 0.1 * w) * (0.8 + 0.25 * ndl) + (1 - rim) * 0.02);
      return base.map(c => cl(c - 0.12 * lip + 0.1 * rim * Math.pow(nz, 8))).concat(1); } }));
    g.drawImage(plate, pcx - PR - 40, pcy - PR - 40, PR * 2 + 80, PR * 2 + 80);
    if (TEX.leaves && TEX.leaves.naturalWidth) { const L = TEX.leaves, sz = 420; const put4 = (x, y, sx, sy, rot, a) => { g.save(); g.globalAlpha = a; g.translate(x, y); g.rotate(rot); g.scale(sx, sy); g.drawImage(L, -40, -30, sz, sz); g.restore(); };
      put4(0, 0, 1, 1, -0.1, 0.95); put4(W, 0, -1, 1, 0.1, 0.95); put4(0, H - 120, 1, -1, 0.15, 0.85); put4(W, H - 60, -1, -1, -0.1, 0.85); }
    ck.end(); }
    if (!SC && ck.run('board')) {
    // 玉盘：浅薄荷盘面 + 细织纹 + 厚玉边 + 柔投影
    g.save(); g.shadowColor = 'rgba(20,70,58,0.45)'; g.shadowBlur = 34; g.shadowOffsetY = 14; g.beginPath(); boardPath(g); g.fillStyle = 'rgba(191,231,220,0.35)'; g.fill(); g.restore();
    ck.end(); }
    if (!SC && ck.run('board2')) {
    g.save(); g.beginPath(); boardPath(g); g.clip();
    gr = g.createRadialGradient(W * 0.45, 520, 60, W * 0.5, 640, 760); gr.addColorStop(0, 'rgba(225,248,241,0.35)'); gr.addColorStop(1, 'rgba(166,217,203,0.25)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = g.createPattern(hatchTile(H), 'repeat'); g.fillRect(0, 0, W, H); // phase16：7px 斜织纹改为平铺图案（与逐线描边同几何，快数十倍）
    { const S4 = lowShadow(W, H, 22, 'rgb(25,80,66)', sg => { sg.beginPath(); sg.rect(-300, -300, W + 600, H + 600); boardPath(sg); sg.fill('evenodd'); }); g.globalAlpha = 0.35; g.drawImage(S4, 0, 6, W, H); g.globalAlpha = 1; } g.restore(); // phase16：内阴影 1/4 分辨率模糊后放大（与 shadowBlur 22 等效，快 ~10×）
    g.save(); g.beginPath(); boardPath(g); g.lineWidth = 14; gr = g.createLinearGradient(0, 200, 0, 1200); gr.addColorStop(0, 'rgba(232,250,244,0.95)'); gr.addColorStop(1, 'rgba(170,215,203,0.9)'); g.strokeStyle = gr; g.stroke(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.stroke(); g.restore();
    ck.end(); }
    if (!SC && ck.run('walls')) { // phase19b：场景图自带雕玉框，不再叠画旧漏斗墙/描边（碰撞墙仍在 game.js）
    g.drawImage(CACHE.walls || (CACHE.walls = jadeWalls(W, H)), 0, 0);
    ck.end(); }
    // 传送带：金框 + 墨翠带面 + 金导轨
    const B = GEO.belt, bw = B.x1 - B.x0, bh = B.y1 - B.y0, cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2, P2 = 40;
    const frame = solid(bw + P2 * 2, bh + P2 * 2, bw / 2 + P2, bh / 2 + P2, 1, (x, y) => sdBox(x, y, bw / 2, bh / 2, bh / 2), 12, this.beltFrame ? { custom: this.beltFrame, light: UP, shadow: { dx: 0, dy: 12, blur: 26, a: 0.4 } } : { color: GOLD, light: UP, clean: { broad: 0.4, tight: 0.6, tintSpec: 0.5 }, shadow: { dx: 0, dy: 12, blur: 26, a: 0.4 } });
    g.drawImage(frame, cx - bw / 2 - P2, cy - bh / 2 - P2);
    if (this.beltKnobs) { const kb = solid(40, 60, 20, 30, 1, (x, y) => sdBox(x, y, 7, 18, 6), 7, { color: this.beltKnobs, light: UP, clean: { broad: 0.4, tight: 0.7, tintSpec: 0.5 }, shadow: { dx: 0, dy: 3, blur: 5, a: 0.4 } }); for (const sx of [-1, 1]) g.drawImage(kb, cx + sx * (bw / 2 + 2) - 20, cy - 30); } // 参考图：传送带两端金色端头
    const J = this.beltJ || { deep: [0.20, 0.09, 0.33], base: [0.52, 0.40, 0.70] }; // phase19：材质参考图 → 紫罗兰玉带面
    const bk = 'belt' + this.id, belt = CACHE[bk] || (CACHE[bk] = solid(bw - 16, bh - 16, bw / 2 - 8, bh / 2 - 8, 1, (x, y) => sdBox(x, y, bw / 2 - 11, bh / 2 - 11, bh / 2 - 11), 8, { custom: (x, y, nx, ny, nz) => { const f = fbm(x / 60 + 3, y / 60, 4), v = Math.exp(-Math.pow((fbm(x / 90, y / 90 + 9, 4) - 0.5) / 0.04, 2)); const m = sm(0.35, 0.75, f); return [0, 1, 2].map(j => cl((J.base[j] + (J.deep[j] - J.base[j]) * m) * (0.75 + 0.25 * nz) + 0.12 * v + 0.1 * Math.pow(nz, 8))).concat(1); }, concave: true }));
    // 上传图：cover 铺满带面圆角区域 + 带面明暗（内阴影/顶部反光）保持立体感
    let face = belt;
    if (BELT.img && beltIm && beltIm.complete && beltIm.naturalWidth) {
      face = mk(belt.width, belt.height); const fg = face.getContext('2d'), fw = bw - 22, fh = bh - 22; fg.save(); RR(fg, 3, 3, fw, fh, fh / 2); fg.clip();
      const sc = Math.max(fw / beltIm.naturalWidth, fh / beltIm.naturalHeight), dw = beltIm.naturalWidth * sc, dh = beltIm.naturalHeight * sc; fg.drawImage(beltIm, 3 + (fw - dw) / 2, 3 + (fh - dh) / 2, dw, dh);
      let sg = fg.createLinearGradient(0, 3, 0, fh + 3); sg.addColorStop(0, 'rgba(0,0,0,0.35)'); sg.addColorStop(0.18, 'rgba(0,0,0,0)'); sg.addColorStop(0.8, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(255,255,255,0.18)'); fg.fillStyle = sg; fg.fillRect(0, 0, face.width, face.height); fg.restore();
    } else { face = mk(belt.width, belt.height); face.getContext('2d').drawImage(belt, 0, 0); }
    adjustPixels(face);
    g.drawImage(face, cx - bw / 2 + 8, cy - bh / 2 + 8); BELT_RECT = { x: cx - bw / 2 + 8, y: cy - bh / 2 + 8, w: bw - 16, h: bh - 16 };
    const rail = solid(650, 40, 325, 20, 1, (x, y) => sdBox(x, y, 313, 7.5, 7.5), 7.5, { color: this.railCol || GOLD, light: UP, clean: { broad: 0.4, tight: 0.7, tintSpec: 0.5 }, shadow: { dx: 0, dy: 4, blur: 7, a: 0.4 } });
    g.drawImage(rail, 432 - 325, 1253.5 - 20);
    if (this.railBeads) { const bR = this.railBeadR || 8.5, bd = solid(30, 30, 15, 15, 1, (x, y) => Math.hypot(x, y) - bR, bR, { color: this.railBeads, light: UP, clean: { broad: 0.4, tight: 0.7, tintSpec: 0.5 }, shadow: { dx: 0, dy: 2, blur: 3, a: 0.4 } }); const bn = this.railBeadN ?? 3; for (let i = -bn; i <= bn; i++) g.drawImage(bd, 432 + i * (bR * 2.2) - 15, 1253.5 - 15); } // 参考图：传送带中轴的一串珠子
    return c;
  },
  tubeHalf(R) { return this.tw ? Math.min(this.tw(R), tubeW(R)) : tubeW(R); }, // 视觉管宽不得超过布局预留 TUBE_HALF_MAX(=0.205R)，否则吃掉夹扣颈部
  ring(g, game, r) {
    const R = r.R, hw = this.tubeHalf(R) * 0.93, pad = 6, S = Math.ceil(R + hw * 1.15 + pad), J = jadeOf(game.color(r.color)), n = bambooN(R, hw);
    const sdf = this.ringShade ? ringSDF(r, hw) : bambooSDF(r, hw); // 木质/彩块：光滑粗管（无竹节）
    const c = solid(S * 2, S * 2, S, S, 2, sdf, hw, { ss: 3, light: UP, custom: this.ringShade ? this.ringShade(game.color(r.color), R, hw) : J ? jadeShade(J, strSeed(r.id + r.color) % 37, R, hw, n, false, r) : metalShade(GOLD, R, hw, n, 'ring') });
    g.save(); g.translate(r.c[0], r.c[1]); put(g, c, -S, -S, S * 2, S * 2);
    if (this.endCap && !r.closed) { // 木质参考：开口两端金色端帽（短圆柱箍，轴 = 管切向）
      const cw = hw * 0.42, ch = hw * 1.12, cs = Math.ceil(ch + 10), ms = metalShade(GOLD, 0, ch, 0, 'collar');
      const cap = solid(cs * 2, cs * 2, cs, cs, 3, (x, y) => sdBox(x, y, cw, ch, Math.min(cw * 0.7, 4)), 3, { ss: 2, light: UP, shadow: { dx: 0, dy: 0, blur: 5, a: 0.35 }, custom: (x, y, nx, ny, nz) => { const yy = cl(y / ch, -0.999, 0.999); return ms(x, y, nx * 0.5, yy, Math.sqrt(1 - yy * yy)); } });
      for (const sg of [-1]) { const a = r.gapC + sg * r.gapW / 2, a2 = a + sg * (cw * 0.9) / R; g.save(); g.translate(R * Math.cos(a2), R * Math.sin(a2)); g.rotate(a2 + Math.PI / 2); put(g, cap, -cs, -cs, cs * 2, cs * 2); g.restore(); }
    }
    g.restore();
  },
  ringShadow(g, game, r, blur) {
    const R = r.R, hw = this.tubeHalf(R); g.filter = `blur(${blur}px)`; g.lineWidth = hw * 2; g.lineCap = 'round'; g.strokeStyle = this.shadowCol || 'rgba(22,74,60,0.55)'; g.beginPath();
    if (r.closed) g.arc(0, 0, R, 0, TAU); else g.arc(0, 0, R, r.gapC + r.gapW / 2, r.gapC - r.gapW / 2 + TAU);
    g.stroke(); g.filter = 'none';
  },
  ball(col, r) { r *= this.ballK || 1; // 玉珠：透光体 + 色根/絮 + 左上高光 + 右下透射亮边 + 烘焙投影
    const J = jadeOf(col) || JADE.white, k = 3, pad = r * 0.8, s = Math.ceil(r * 2 + pad * 2), W = Math.ceil(s * k), c = mk(W, W), g = c.getContext('2d'), id = g.createImageData(W, W), d = id.data;
    const sh = this.ballShade ? this.ballShade(col) : jadeShade(J, (strSeed(col) % 23) + r, 0, r, 1, true);
    for (let py = 0; py < W; py++) for (let px = 0; px < W; px++) {
      const x = (px + 0.5) / k - s / 2, y = (py + 0.5) / k - s / 2, i = (py * W + px) * 4, rr = Math.hypot(x, y), cov = cl(0.5 - (rr - r) * k);
      const sd = Math.hypot(x - r * 0.12, y - r * 0.3) - r * 0.85, sa = sd < 0 ? 0.32 : 0.32 * Math.pow(cl(1 - sd / (r * 0.5)), 2);
      if (cov <= 0) { if (sa > 0) { d[i] = 20; d[i + 1] = 70; d[i + 2] = 56; d[i + 3] = sa * 255; } continue; }
      const nx = x / r, ny = y / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), [o0, o1, o2, al] = sh(x, y, nx, ny, nz);
      const spec = 0;
      const a = cov * (0.92 + 0.08 * al), A = a + sa * (1 - a), o = [o0, o1, o2].map(v => cl(v + spec));
      d[i] = o[0] * 255 * a / A; d[i + 1] = o[1] * 255 * a / A; d[i + 2] = o[2] * 255 * a / A; d[i + 3] = A * 255;
    }
    g.putImageData(id, 0, 0); c.dw = s; return c;
  },
  clip(g, game, r) { // 圆柱金属箍：包住子环管（轴 = 管切向 = 本地 x），两端唇边 + 合缝 + 小螺钉；锚环为金竹节 → 金箍，其余银箍
    const k = r.R / 151 * (r.clampScale || 1), col = this.clipCol ? this.clipCol(game.color(r.p.color)) : jadeOf(game.color(r.p.color)) ? SILVER : GOLD, th = this.tubeHalf(r.R) * 0.93, ck = this.clipK || 1, cw = Math.max(16 * k, th * 0.62) * ck, ch = Math.max(28 * k, th * 1.3) * (this.clipKh || ck), lip = 3.2 * k, S = Math.ceil(Math.max(cw, ch) + 18);
    const sdf = (x, y) => { const inLip = Math.abs(x) > cw - lip * 1.6; return sdBox(x, y, cw, ch + (inLip ? 1.6 * k : 0), Math.min(cw * 0.6, 9 * k)); };
    const ms = this.clipMetal === false ? paintShade(col, { gloss: 0.55, soft: true }) : metalShade(col, 0, ch, 0, 'collar');
    const c = solid(S * 2, S * 2, S, S, 3, sdf, 3 * k, { ss: 2, light: UP, shadow: { dx: 0, dy: 0, blur: 8, a: 0.4 }, custom: (x, y, nx, ny, nz) => {
      const yy = cl(y / (ch + 1.6 * k), -0.999, 0.999), cz = Math.sqrt(1 - yy * yy); let o = ms(x, y, nx * 0.5, yy, cz);
      const groove = Math.exp(-Math.pow((Math.abs(x) - (cw - lip * 1.6)) / (0.7 * k), 2)); // 唇边分界刻线
      const seam = Math.exp(-Math.pow((y - ch * 0.62) / (0.6 * k), 2)) * (Math.abs(x) < cw - lip * 1.6 ? 1 : 0); // 合缝
      const sd = Math.hypot(x - cw * 0.35, y - ch * 0.62) - 2.4 * k, screw = sd < 0 ? 1 : 0; // 螺钉
      const split = this.clipSplit ? Math.exp(-Math.pow(y / (1.1 * k), 2)) : 0; // 参考图：两节并排金套筒
      const f = 1 - 0.55 * groove - 0.5 * seam - 0.75 * split; o = o.map(v => v * f);
      if (screw) { const sh = 0.55 + 0.6 * cl(-(x - cw * 0.35) / (2.4 * k) - (y - ch * 0.62) / (2.4 * k)) * 0.5; o = o.map((v, j) => cl(v * sh + (Math.abs(x - cw * 0.35) < 0.5 * k ? -0.25 : 0))); }
      return o; } });
    put(g, c, -S, -S, S * 2, S * 2);
    return true;
  },
  link(g, p, r, ux, uy, len, col0) { // 颈部：短圆柱金属颈
    const col = this.clipCol ? this.clipCol(col0) : jadeOf(col0) ? SILVER : GOLD, kk = (r.R / 151) * (r.clampScale || 1), nw = 8.5 * kk, x0 = p.R, x1 = len - 20 * kk, L2 = Math.max(1, (x1 - x0) / 2), m = (x0 + x1) / 2, ang = Math.atan2(uy, ux);
    const ms = this.clipMetal === false ? paintShade(col, { gloss: 0.55, soft: true }) : metalShade(col, 0, nw, 0, 'neck');
    const c = solid(L2 * 2 + 24, nw * 2 + 24, L2 + 12, nw + 12, 3, (x, y) => sdBox(x, y, L2 + 2, nw, 2), nw, { ss: 2, light: UP, shadow: { dx: 0, dy: 0, blur: 6, a: 0.3 }, custom: (x, y, nx, ny, nz) => { const yy = cl(y / nw, -0.999, 0.999); return ms(x, y, 0, yy, Math.sqrt(1 - yy * yy)); } });
    g.save(); g.rotate(ang); g.translate(m, 0); put(g, c, -(L2 + 12), -(nw + 12), L2 * 2 + 24, nw * 2 + 24); g.restore();
  },
  brick(g, game, box, isTray, S, ballFn) { // 经典玉器匣：深色漆木匣体 + 金口沿 + 墨绿丝绒内衬；盒色 = 正面彩玉嵌片 + 孔位彩玉圈
    const hx0 = game.color(box.color), J = this.colJ ? this.colJ(hx0) : jadeOf(hx0) || JADE.white, w = 166, h = 78;
    // phase19：彩玉匣（参考图）：盒色半透玉体 + 斜面倒角 + 金口沿；托盘（首行）= 同色玉托 + 3 个金圈深孔；排队盒 = 圆角彩玉板
    const body = solid(w + 44, h + 50, w / 2 + 22, 16, KS, (x, y) => sdBox(x, y - (h + 4) / 2, w / 2, (h + 4) / 2, 20), 16, { custom: this.boxShade ? this.boxShade(hx0) : jadeShade(J, 9 + (isTray ? 0 : 4), 0, 90, 1, true), shadow: { dx: 0, dy: 10, blur: 16, a: 0.45 } });
    g.drawImage(body, -w / 2 - 22, -16, w + 44, h + 50);
    g.save(); RR(g, -w / 2 + 3, 3, w - 6, h - 2, 17); let gg = g.createLinearGradient(0, 0, 0, h); gg.addColorStop(0, '#fff3c4'); gg.addColorStop(0.35, GOLD); gg.addColorStop(1, '#7a520c'); g.lineWidth = isTray ? 4.5 : 3; g.strokeStyle = this.boxRim ? this.boxRim(J) : gg; g.stroke();
    RR(g, -w / 2 + 12, 10, w - 24, h - 16, 12); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.35)'; g.stroke(); g.restore();
    if (!isTray) return;
    const hole = solid(40, 40, 20, 20, KS, (x, y) => Math.hypot(x, y) - 15, 6, { color: this.trayHoleTint ? jadeHex(J, 0.7) : (this.holeCol || '#0b2f24'), mat: 'rubber', concave: true }); // 彩块参考图：托盘孔为同色内凹
    const cap = S.boxCapacity; for (let i = 0; i < cap; i++) { const hx = (i - (cap - 1) / 2) * 44; g.drawImage(hole, hx - 20, 32 - 20, 40, 40); g.save(); g.beginPath(); g.arc(hx, 32, 16.5, 0, TAU); g.lineWidth = 3; g.strokeStyle = jadeHex(J, 0.95); g.stroke(); g.beginPath(); g.arc(hx, 32, 18.8, 0, TAU); g.lineWidth = 1.2; g.strokeStyle = 'rgba(255,220,130,0.9)'; g.stroke(); g.restore(); if (i < box.n) ballFn(hx, 32); }
  },

  pit(g) { const c = solid(40, 40, 20, 20, KS, (x, y) => Math.hypot(x / 17, y / 15.5) * 15.5 - 15.5, 7, { color: this.pitCol || '#241338', mat: 'rubber', concave: true }); g.drawImage(c, -20, -20, 40, 40); },
  topUI(g, game) { // 玉牌关卡胶囊（金边）+ 圆形玉扣暂停钮
    const J = JADE.green, uk = this.uiK || 1; g.save(); g.translate(432, 156); g.scale(uk, uk); g.translate(-432, -156);
    const pill = solid(250, 124, 125, 58, KS, (x, y) => sdBox(x, y, 104, 40, 18), 16, { custom: this.plaqueShade || jadeShade(J, 5, 0, 60, 1, true), shadow: { dx: 0, dy: 8, blur: 14, a: 0.38 } });
    g.drawImage(pill, 432 - 125, 156 - 58, 250, 124);
    g.save(); RR(g, 432 - 103, 156 - 39, 206, 78, 17); let gg = g.createLinearGradient(0, 117, 0, 195); gg.addColorStop(0, '#fff2c0'); gg.addColorStop(0.5, GOLD); gg.addColorStop(1, '#8e6210'); g.lineWidth = 4; g.strokeStyle = gg; g.stroke(); g.restore();
    g.font = '700 40px RB, Roboto, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(10,50,36,0.55)'; g.fillText('Level ' + (game.levelIdx + 1), 432, 159); g.fillStyle = '#fff8e2'; g.fillText('Level ' + (game.levelIdx + 1), 432, 156); g.restore(); g.save(); g.translate(776, 160); g.scale(uk, uk); g.translate(-776, -160);
    const btn = solid(130, 134, 65, 63, KS, (x, y) => sdBox(x, y, 44, 44, 16), 16, { custom: this.btnShade || this.plaqueShade || jadeShade(J, 11, 0, 46, 1, true), shadow: { dx: 0, dy: 8, blur: 14, a: 0.38 } });
    g.drawImage(btn, 776 - 65, 160 - 63, 130, 134);
    g.save(); RR(g, 776 - 43, 160 - 43, 86, 86, 15); gg = g.createLinearGradient(0, 115, 0, 205); gg.addColorStop(0, '#fff2c0'); gg.addColorStop(0.5, GOLD); gg.addColorStop(1, '#8e6210'); g.lineWidth = 4; g.strokeStyle = gg; g.stroke(); g.restore();
    const bar = solid(24, 56, 12, 28, KS, (x, y) => sdBox(x, y, 6.5, 20, 6.5), 6, { color: GOLD, light: UP, clean: { broad: 0.35, tight: 0.6, tintSpec: 0.5 } }); for (const x of [763, 789]) g.drawImage(bar, x - 12, 160 - 28, 24, 56); g.restore();
  },
  capLight(g, st) { const gr = g.createRadialGradient(-2, -2, 1, 0, 0, 7); const c = { on: ['#c9f5dd', '#1c9a5c'], full: ['#fff3c4', GOLD], off: ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.12)'] }[st]; gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]); g.beginPath(); g.arc(0, 0, 6.5, 0, TAU); g.fillStyle = gr; g.fill(); },
  sparkle(g) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 4.5 : 20; g.lineTo(rr * Math.cos(a), rr * Math.sin(a)); } g.closePath(); const gr = g.createRadialGradient(0, 0, 1, 0, 0, 20); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, '#ffe9a6'); gr.addColorStop(1, GOLD); g.fillStyle = gr; g.fill(); },
  // 3D：玉 = 透射 + 体积衰减 + 清漆（KHR_materials_transmission/volume/ior/clearcoat）；金/银 = 金属
  mat3d(kind, colorName, colHex) {
    if (kind === 'clip') return { color: colHex && jadeOf(colHex) ? SILVER : GOLD, metalness: 1, roughness: 0.2 };
    const J = colHex ? jadeOf(colHex) : null; if (!J) return { color: GOLD, metalness: 1, roughness: 0.3 };
    const deep = '#' + J.deep.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
    return { color: '#ffffff', metalness: 0, roughness: kind === 'ball' ? 0.12 : 0.16, transmission: 0.45, ior: 1.66, thickness: kind === 'ball' ? 0.012 : 0.03, attenuationColor: deep, attenuationDistance: 0.06, clearcoat: 1, clearcoatRoughness: 0.06 };
  },
  // 3D 底色贴图（torus UV：u 沿环弧，v 绕管）：玉纹贴图 → 白底→玉色
  tex3d(kind, colHex) {
    const J = colHex && jadeOf(colHex); if (!J) return null; const W = kind === 'ball' ? 256 : 512, H = kind === 'ball' ? 128 : 128, c = mk(W, H), g = c.getContext('2d'), id = g.createImageData(W, H), d = id.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const m = texAt(x * 1.5, y * 1.5), big = fbm(x / 120, y / 120, 3), amt = cl((m * 1.35 - 0.05) * (0.55 + 1.1 * big)), i = (y * W + x) * 4; for (let j = 0; j < 3; j++) { const b0 = J.base[j] + (J.deep[j] - J.base[j]) * 0.18; d[i + j] = 255 * (b0 + (J.deep[j] - b0) * amt); } d[i + 3] = 255; }
    g.putImageData(id, 0, 0); return c;
  },
  // 3D 竹节：返回 θ → 管半径相对增量
  ringProfile3d(R, hw) { const n = bambooN(R, hw * 0.93); return th => nodeProf(nodeD(th, R, n), hw * 0.93); },
};

// ===== phase20/21：彩绘材质主题（木质 / 彩块）—— 复用玉石主题的全部几何/缓存/分段异步生成管线，只替换材质着色函数 =====
const vivid = (c, k) => c.map(v => cl(0.5 + (v - 0.5) * 1.0) * k);
function paintShade(colHex, o) { // o: { grain, gloss, soft, along(x,y) }
  const base = hex(colHex);
  return (x, y, nx, ny, nz) => {
    const ndl = cl(-0.35 * nx - 0.55 * ny + 0.76 * nz), hv = [-0.35, -0.55, 1.76], hl = Math.hypot(...hv), ndh = Math.max(0, (nx * hv[0] + ny * hv[1] + nz * hv[2]) / hl);
    let gr = 1; if (o.grain) { const a = o.along ? o.along(x, y) : x; const w = fbm(a / 90, y / (o.fine ? 3.5 : 7) + x / 300, 3); gr = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(a * 0.05 + w * 9)) - 0.08 * Math.pow(fbm(x / 13, y / 13, 2), 3); }
    if (o.grain) gr = 0.86 + (gr - 0.82) * (o.fine ? 0.9 : 1.3); // phase24：参考图为细纹亮漆，降对比
    const sp = o.gloss * (Math.pow(ndh, o.soft ? 18 : 60) + (o.soft ? 0.25 * Math.pow(ndh, 4) : 0)), rim = Math.pow(1 - nz, 3) * (o.soft ? 0.15 : 0.45);
    return base.map(c => cl(c * gr * ((o.soft ? 0.62 : 0.5) + (o.soft ? 0.5 : 0.62) * ndl) - rim * c + sp)).concat(1);
  };
}
const paintJ = colHex => { const b = hex(colHex); return { base: b.map(v => cl(v * 1.1 + 0.05)), deep: b.map(v => v * 0.55) }; };
function makePaintTheme(o) {
  const ringCol = c => jadeOf(c) ? c : o.anchor;
  return { ...jadeTheme, ...o,
    ringShade(c, R) { return paintShade(ringCol(c), { grain: o.grain, gloss: o.gloss, soft: o.soft, along: (x, y) => Math.atan2(y, x) * R }); },
    ballShade(c) { return paintShade(c, { grain: false, gloss: o.gloss * 1.2, soft: o.soft }); },
    boxShade(c) { return paintShade(c, { grain: o.grain, fine: true, gloss: o.gloss * 0.6, soft: o.soft }); },
    colJ: paintJ,
    plaqueShade: paintShade(o.plaque, { grain: o.grain, gloss: 0.35, soft: o.soft }),
    btnShade: paintShade(o.btn || o.plaque, { grain: o.grain, gloss: 0.5, soft: o.soft }),
    beltFrame: paintShade(o.beltFrameCol, { grain: o.grain, gloss: 0.3, soft: o.soft }),
    mat3d(kind, colorName, colHex) {
      if (kind === 'clip') return { color: o.clipCol(colHex || '#888'), metalness: o.clipMetal ? 1 : 0, roughness: o.clipMetal ? 0.25 : 0.35 };
      const c = colHex ? ringCol(colHex) : o.anchor; return { color: o.grain ? '#ffffff' : c, metalness: 0, roughness: o.soft ? 0.32 : 0.5, clearcoat: o.soft ? 0.8 : 0.4, clearcoatRoughness: 0.2 };
    },
    tex3d(kind, colHex) { // 木纹：在底色上叠加年轮条纹；彩块：纯色（返回 null 使用 mat3d.color）
      if (!o.grain || !colHex) return null; const W = 512, H = 128, c = mk(W, H), g = c.getContext('2d'), id = g.createImageData(W, H), d = id.data, b = hex(ringCol(colHex));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const w = fbm(x / 90, y / 7, 3), gr = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(x * 0.05 + w * 9)), i = (y * W + x) * 4; for (let j = 0; j < 3; j++) d[i + j] = 255 * cl(b[j] * gr); d[i + 3] = 255; }
      g.putImageData(id, 0, 0); return c;
    },
    ringProfile3d: undefined,
  };
}
const woodTheme = makePaintTheme({
  id: 'wood', name: '木质', desc: '木纹彩绘粗环 + 金箍 + 彩漆木珠 + 深色拼板雕框木盘 + 木框紫带 + 彩漆木牌（参考：木质材质图）',
  sceneKey: 'woodScene', tw: R => R * 0.215, endCap: true, railBeads: GOLD, railBeadN: 3, railBeadR: 8.5, beltKnobs: GOLD, clipSplit: true, shadowCol: 'rgba(28,14,4,0.6)', ballK: 1.2, clipK: 1.8, clipKh: 1.25, uiK: 1.15, grain: true, gloss: 0.35, soft: false, anchor: '#dcb98c', plaque: '#8a5a32', btn: '#9a6638', beltFrameCol: '#7a4a26',
  beltJ: { deep: [0.30, 0.20, 0.42], base: [0.56, 0.46, 0.68] }, railCol: GOLD, holeCol: '#2c1c2e', pitCol: '#2c1c2e',
  clipCol: () => GOLD, clipMetal: true, boxRim: () => 'rgba(60,32,14,0.55)',
});
const candyTheme = makePaintTheme({
  id: 'candy', name: '彩块', desc: '卡通糖果塑料纯色圆管环（柔高光）+ 浅木拼板底 + 米色圆角框 + 绿叶 + 木牌关卡 + 橙色暂停 + 紫色圆角传送带 + 亮色彩块',
  sceneKey: 'candyScene', tw: R => R * 0.225, railBeads: '#3a3470', railBeadR: 11, railBeadN: 3, trayHoleTint: true, shadowCol: 'rgba(40,20,60,0.45)', ballK: 1.15, clipK: 1.7, clipKh: 1.3, uiK: 1.3, grain: false, gloss: 0.55, soft: true, anchor: '#c9c9cf', plaque: '#7a4628', btn: '#ffb21c', beltFrameCol: '#5b4fc4',
  beltJ: { deep: [0.40, 0.35, 0.80], base: [0.45, 0.40, 0.87] }, railCol: '#c9c9d6', holeCol: '#3a2f96', pitCol: '#3a2f96',
  clipCol: c => jadeOf(c) ? c : '#c4c5cc', clipMetal: false, boxRim: J => '#' + J.deep.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join(''),
});

export const THEMES = {
  default: { id: 'default', name: '原版', desc: '参考视频美术（assets/named/*.png）' },
  jade: jadeTheme,
  wood: woodTheme,
  candy: candyTheme,
};
export const THEME_OPTIONS = Object.values(THEMES).map(t => [t.id, t.name]);
let cur = THEMES.default;
export const theme = () => cur;
// 传送带带面外观（玉石主题）：明度/饱和度/色相/对比度 + 可上传图片替换。逐像素调色（不依赖 ctx.filter，H5 旧 Safari 一致）
let BELT_RECT = null; export const beltRect = () => BELT_RECT;
let BELT = { b: 1, s: 1, h: 0, c: 1, img: '' }, beltIm = null, beltImSrc = '';
export function setBeltLook(S) {
  const n = { b: +S.beltFaceBright || 1, s: S.beltFaceSat == null ? 1 : +S.beltFaceSat, h: +S.beltFaceHue || 0, c: +S.beltFaceContrast || 1, img: S.beltFaceImage || '' };
  if (n.img !== beltImSrc) { beltImSrc = n.img; beltIm = null; if (n.img && typeof Image !== 'undefined') { const im = new Image(); im.src = n.img; beltIm = im; } }
  const ch = JSON.stringify(n) !== JSON.stringify(BELT); BELT = n; return ch;
}
export const beltImageReady = () => !beltIm || beltIm.complete ? Promise.resolve() : new Promise(r => { beltIm.onload = beltIm.onerror = r; });
export const beltLook = () => ({ ...BELT, imgLoaded: !!(beltIm && beltIm.complete && beltIm.naturalWidth) });
function adjustPixels(c) {
  const { b, s: sat, h, c: con } = BELT; if (b === 1 && sat === 1 && h === 0 && con === 1) return c;
  const g = c.getContext('2d'), id = g.getImageData(0, 0, c.width, c.height), d = id.data, A = h * Math.PI / 180, cs = Math.cos(A), sn = Math.sin(A);
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] / 255, gg = d[i + 1] / 255, bb = d[i + 2] / 255;
    let Y = 0.299 * r + 0.587 * gg + 0.114 * bb, I = 0.596 * r - 0.274 * gg - 0.322 * bb, Q = 0.211 * r - 0.523 * gg + 0.312 * bb; // YIQ：色相旋转 + 饱和度缩放
    const I2 = (I * cs - Q * sn) * sat, Q2 = (I * sn + Q * cs) * sat; Y = (Y * b - 0.5) * con + 0.5;
    r = Y + 0.956 * I2 + 0.621 * Q2; gg = Y - 0.272 * I2 - 0.647 * Q2; bb = Y - 1.106 * I2 + 1.703 * Q2;
    d[i] = cl(r) * 255; d[i + 1] = cl(gg) * 255; d[i + 2] = cl(bb) * 255;
  }
  g.putImageData(id, 0, 0); return c;
}
export function setTheme(id) { cur = THEMES[id] || THEMES.default; return cur; }
export const spritePrefix = () => cur.id === 'default' ? '' : cur.id + ':';
