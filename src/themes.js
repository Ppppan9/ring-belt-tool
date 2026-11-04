// 主题系统（数据驱动）。每个主题 = { id, name, desc, ...可选绘制钩子 }。
// 钩子缺省时回落到“原版”绘制（render.js / items.js 原逻辑），因此原版主题行为与 phase6 完全一致。
// 钩子只改“外观”，不改任何几何/碰撞：环中心线半径、夹子位置、盒子孔位、传送带孔距全部沿用游戏数据。
// 可用钩子：background(W,H) / ring(g,game,r,T) / ball(col,r,name)->canvas / clip(g,game,r) / link(g,p,r,ux,uy,len,col)
//          brick(g,game,box,isTray,S) / pit(g) / topUI(g,game,S) / mat3d(kind,colorName)->{roughness,metalness}
import { GEO, TAU } from './game.js';
import { RR, boardPath } from './render.js';
import linenUrl from '../assets/themes/realistic/linen.jpg';

const img = u => { if (typeof Image === 'undefined') return null; const im = new Image(); im.src = u; return im; };
const TEX = { linen: img(linenUrl) };
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
/**
 * 渲染一个实体精灵到新画布。w,h,ax,ay 为设计单位；k = 像素/设计单位。
 * sdf(x,y) 设计单位，<0 为内部。bevel = 倒角宽度（设计单位，圆管时 = 管半宽）。
 * o: { color, mat, shadow:{dx,dy,blur,a}, concave, light, tint(x,y,[r,g,b])->[r,g,b], grain, alpha }
 */
export function solid(w, h, ax, ay, k, sdf, bevel, o = {}) {
  if (o.ss > 1) { // 超采样：高分辨率渲染后逐级减半下采样（干净抗锯齿边缘，无毛刺/光晕）
    let src = solid(w, h, ax, ay, k * o.ss, sdf, bevel, { ...o, ss: 1 }); const W = Math.ceil(w * k), H = Math.ceil(h * k);
    while (src.width / 2 >= W * 1.01) { const t = mk(Math.ceil(src.width / 2), Math.ceil(src.height / 2)), tg = t.getContext('2d'); tg.imageSmoothingQuality = 'high'; tg.drawImage(src, 0, 0, t.width, t.height); src = t; }
    const c = mk(W, H), cg = c.getContext('2d'); cg.imageSmoothingQuality = 'high'; cg.drawImage(src, 0, 0, W, H); return c;
  }
  const W = Math.ceil(w * k), H = Math.ceil(h * k), c = mk(W, H), g = c.getContext('2d'), id = g.createImageData(W, H), d = id.data;
  const M = MAT[o.mat || 'plastic'], base = hex(o.color || '#888'), L = o.light || LIGHT, Hv = [L[0], L[1], L[2] + 1], hn = Math.hypot(...Hv), HH = Hv.map(x => x / hn);
  const sh = o.shadow, e = 0.5 / k, prof = s => { const t = cl(-s / bevel); return Math.sqrt(1 - (1 - t) * (1 - t)) * bevel; };
  let seed = 1234567; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const x = (px + 0.5) / k - ax, y = (py + 0.5) / k - ay, s = sdf(x, y), i = (py * W + px) * 4;
    let sa = 0; if (sh) { const ss = sdf(x - sh.dx, y - sh.dy); sa = ss < 0 ? sh.a : ss < sh.blur ? sh.a * Math.pow(1 - ss / sh.blur, 2) : 0; }
    const cov = cl(0.5 - s * k);
    if (cov <= 0) { if (sa > 0) { d[i] = 38; d[i + 1] = 26; d[i + 2] = 12; d[i + 3] = sa * 255; } continue; }
    const zx = (prof(sdf(x + e, y)) - prof(sdf(x - e, y))) / (2 * e), zy = (prof(sdf(x, y + e)) - prof(sdf(x, y - e))) / (2 * e);
    let nx = -zx, ny = -zy, nz = 1; if (o.concave) { nx = -nx; ny = -ny; } const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const ndl = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]), ndh = Math.max(0, nx * HH[0] + ny * HH[1] + nz * HH[2]);
    let col = o.tint ? o.tint(x, y, base) : base;
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
  }
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
const realistic = {
  id: 'realistic', name: '超写实', desc: '亚麻布面 + 缎面拉丝/阳极氧化金属环与夹扣 + 玻璃珠 + 金属皮革传送带（分层软投影）',
  background(W, H) {
    const c = mk(W, H), g = c.getContext('2d');
    const pat = (im, sc) => { if (!im || !im.complete || !im.naturalWidth) return null; const p = g.createPattern(im, 'repeat'); if (p && p.setTransform) p.setTransform(new DOMMatrix().scale(sc)); return p; };
    g.fillStyle = pat(TEX.linen, 1.5) || '#cdbfa6'; g.fillRect(0, 0, W, H);
    // 暖色左上主光衰减 + 暗角
    let gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, 'rgba(255,240,215,0.30)'); gr.addColorStop(0.55, 'rgba(255,238,205,0)'); gr.addColorStop(1, 'rgba(45,28,10,0.36)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    gr = g.createRadialGradient(W * 0.42, H * 0.36, H * 0.2, W * 0.5, H * 0.5, H * 0.75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(40,25,8,0.38)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // 游戏区：轻微下压的布面（内阴影 + 亮边缝线）
    g.save(); g.beginPath(); boardPath(g); g.clip();
    g.fillStyle = 'rgba(70,50,25,0.04)'; g.fillRect(0, 0, W, H);
    g.shadowColor = 'rgba(45,28,10,0.55)'; g.shadowBlur = 26; g.shadowOffsetX = 5; g.shadowOffsetY = 9; g.fillStyle = '#000'; g.beginPath(); g.rect(-300, -300, W + 600, H + 600); boardPath(g); g.fill('evenodd'); g.restore();
    g.save(); g.beginPath(); boardPath(g); g.lineWidth = 2; g.strokeStyle = 'rgba(255,246,228,0.55)'; g.stroke(); g.restore();
    // 传送带：拉丝钢外框 + 深棕皮革带 + 镀铬导轨
    const B = GEO.belt, bw = B.x1 - B.x0, bh = B.y1 - B.y0, cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2, P2 = 40;
    const frame = solid(bw + P2 * 2, bh + P2 * 2, bw / 2 + P2, bh / 2 + P2, 1, (x, y) => sdBox(x, y, bw / 2, bh / 2, bh / 2), 11, { color: GRAYC, clean: { broad: 0.35, tight: 0.5 }, shadow: { dx: 7, dy: 12, blur: 26, a: 0.42 }});
    g.drawImage(frame, cx - bw / 2 - P2, cy - bh / 2 - P2);
    const belt = solid(bw - 16, bh - 16, bw / 2 - 8, bh / 2 - 8, 1, (x, y) => sdBox(x, y, bw / 2 - 10, bh / 2 - 10, bh / 2 - 10), 6, { color: '#4a3526', mat: 'rubber', grain: 0.04, concave: true });
    g.drawImage(belt, cx - bw / 2 + 8, cy - bh / 2 + 8);
    const rail = solid(650, 40, 325, 20, 1, (x, y) => sdBox(x, y, 313, 8.5, 8.5), 8.5, { color: '#d9dce0', clean: { broad: 0.4, tight: 0.8 }, shadow: { dx: 2, dy: 4, blur: 7, a: 0.45 } });
    g.drawImage(rail, 432 - 325, 1253.5 - 20);
    return c;
  },
  ring(g, game, r) {
    const R = r.R, hw = tubeW(R), pad = 6, S = Math.ceil(R + hw + pad), col = metalCol(game, r.color), gray = col === GRAYC;
    const c = solid(S * 2, S * 2, S, S, 2, ringSDF(r, hw), hw, { color: col, light: UP, ss: 2, clean: { dir: 0.07, broad: gray ? 0.18 : 0.2, tight: gray ? 0.36 : 0.3, tintSpec: gray ? 0 : 0.45 }});
    g.save(); g.translate(r.c[0], r.c[1]); put(g, c, -S, -S, S * 2, S * 2); g.restore();
  },
  // 环投影（剪影，世界坐标偏移由 items.js 叠两层：贴地接触影 + 大范围柔影）
  tubeHalf: R => tubeW(R),
  ringShadow(g, game, r, blur) {
    const R = r.R, hw = tubeW(R); g.filter = `blur(${blur}px)`; g.lineWidth = hw * 2; g.lineCap = 'round'; g.strokeStyle = 'rgb(38,26,12)'; g.beginPath();
    if (r.closed) g.arc(0, 0, R, 0, TAU); else g.arc(0, 0, R, r.gapC + r.gapW / 2, r.gapC - r.gapW / 2 + TAU);
    g.stroke(); g.filter = 'none';
  },
  ball(col, r) { return marble(col, r, 3); },
  clip(g, game, r) { // 夹块：带倒角的小金属块（父环色），局部 -y 指向父环
    const k = r.R / 151 * (r.clampScale || 1), col = metalCol(game, r.p.color), hw = 32 * k, hh = 28 * k, rad = 14 * k, S = Math.ceil(Math.max(hw, hh) + 16);
    const c = solid(S * 2, S * 2, S, S, 3, (x, y) => sdBox(x, y, hw, hh, rad), 22 * k, { color: col, light: UP, clean: { broad: 0.32, tight: 0.55, tintSpec: col === GRAYC ? 0 : 0.3 }, shadow: { dx: 0, dy: 0, blur: 10, a: 0.4 }});
    put(g, c, -S, -S, S * 2, S * 2);
    const sl = solid(S * 2, S * 2, S, S, 3, (x, y) => sdBox(x, y, hw * 0.98, 2.2 * k, 2 * k), 2 * k, { color: col, light: UP, clean: { broad: 0.1, tight: 0.1 }, concave: true, alpha: 0.85 }); // 中缝
    put(g, sl, -S, -S, S * 2, S * 2); return true;
  },
  link(g, p, r, ux, uy, len, col0) { // 颈部：父环色的圆柱短杆
    const col = /^(grey|gray)$/.test(p.color) ? GRAYC : col0, nw = 19 * (r.R / 151) * (r.clampScale || 1), x0 = p.R, x1 = len - 14 * (r.R / 151) * (r.clampScale || 1), L2 = (x1 - x0) / 2, m = (x0 + x1) / 2, ang = Math.atan2(uy, ux);
    const c = solid(L2 * 2 + nw * 2 + 24, nw * 2 + 24, L2 + nw + 12, nw + 12, 3, (x, y) => sdBox(x, y, L2 + nw * 0.3, nw, nw * 0.5), nw * 0.9, { color: col, light: UP, clean: { broad: 0.3, tight: 0.5, tintSpec: 0.2 }, shadow: { dx: 0, dy: 0, blur: 7, a: 0.35 } });
    g.save(); g.rotate(ang); g.translate(m, 0); put(g, c, -(L2 + nw + 12), -(nw + 12), L2 * 2 + nw * 2 + 24, nw * 2 + 24); g.restore();
  },
  brick(g, game, box, isTray, S, ballFn) {
    const col = game.color(box.color), w = 162, h = 76;
    const body = solid(w + 40, h + 46, w / 2 + 20, 16, KS, (x, y) => sdBox(x, y - (h + 4) / 2, w / 2, (h + 4) / 2, 14), 18, { color: col, clean: { broad: 0.28, tight: 0.45, tintSpec: 0.3 }, shadow: { dx: 5, dy: 9, blur: 14, a: 0.4 }, tint: (x, y, b) => y > h - 12 ? b.map(v => v * 0.78) : b});
    g.drawImage(body, -w / 2 - 20, -16, w + 40, h + 46);
    if (!isTray) return;
    const well = solid(w - 20, h - 26, (w - 20) / 2, 4, KS, (x, y) => sdBox(x, y - (h - 34) / 2, (w - 28) / 2, (h - 34) / 2, 6), 5, { color: '#4a3526', mat: 'rubber', grain: 0.04, concave: true });
    g.drawImage(well, -(w - 20) / 2, 10, w - 20, h - 26);
    const hole = solid(36, 36, 18, 18, KS, (x, y) => Math.hypot(x, y) - 15, 6, { color: '#1c140e', mat: 'rubber', concave: true });
    const cap = S.boxCapacity; for (let i = 0; i < cap; i++) { const hx = (i - (cap - 1) / 2) * 44; g.drawImage(hole, hx - 18, 32 - 18, 36, 36); if (i < box.n) ballFn(hx, 32); }
  },
  pit(g) { const c = solid(40, 40, 20, 20, KS, (x, y) => Math.hypot(x / 17, y / 15.5) * 15.5 - 15.5, 7, { color: '#1c140e', mat: 'rubber', concave: true }); g.drawImage(c, -20, -20, 40, 40); },
  topUI(g, game) {
    const pill = solid(240, 120, 120, 56, KS, (x, y) => sdBox(x, y, 101, 40, 40), 14, { color: GRAYC, clean: { broad: 0.35, tight: 0.55 }, shadow: { dx: 4, dy: 8, blur: 14, a: 0.4 }});
    g.drawImage(pill, 432 - 120, 156 - 56, 240, 120);
    g.font = '700 40px RB, Roboto, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillText('Level ' + (game.levelIdx + 1), 432, 158); g.fillStyle = '#3b3f46'; g.fillText('Level ' + (game.levelIdx + 1), 432, 156);
    const btn = solid(130, 134, 62, 62, KS, (x, y) => sdBox(x, y, 46, 47, 22), 14, { color: '#e98a24', clean: { broad: 0.3, tight: 0.5, tintSpec: 0.3 }, shadow: { dx: 4, dy: 8, blur: 14, a: 0.4 } });
    g.drawImage(btn, 776 - 62, 162 - 62, 130, 134);
    const bar = solid(24, 56, 12, 28, KS, (x, y) => sdBox(x, y, 7.5, 23, 7.5), 6, { color: '#fff1dc', clean: { broad: 0.2, tight: 0.3 } }); for (const x of [759, 793]) g.drawImage(bar, x - 12, 160 - 28, 24, 56);
  },
  mat3d(kind, colorName) { if (kind === 'ball') return { roughness: 0.05, metalness: 0 }; return { roughness: 0.32, metalness: 0.85 }; },
};

// ---------- 原创UI 主题（phase9：法律安全的原创美术；环/夹扣/铰链沿用原版精灵不变） ----------
// 风格：薄荷→雾紫的柔和平涂渐变 + 细六边形几何底纹；磨砂白圆角面板；分节履带式传送带；切面宝石珠；胶囊盒+点阵容量灯；圆形图标按钮。
const OU = { ink: '#2f3a6b', inkSoft: '#56619a', mint: '#bff0e3', lilac: '#d9d2fb', sky: '#c9e4ff', white: '#ffffff', track: '#3a4373', tread: '#5b66a3', accent: '#ff7aa8' };
const mixc = (a, b, t) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round((v + (B[i] - v) * t) * 255)).join(',') + ')'; };
function hexPath(g, x, y, r, rot = 0) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = rot + i * Math.PI / 3; g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); } g.closePath(); }
const originalUI = {
  id: 'original-ui', name: '原创UI', desc: '原创美术：薄荷-雾紫平涂渐变 + 六边形几何底纹 + 磨砂面板 + 履带式传送带 + 切面宝石珠 + 胶囊盒（环/夹扣沿用原版）',
  background(W, H) {
    const c = mk(W, H), g = c.getContext('2d');
    let gr = g.createLinearGradient(0, 0, W * 0.35, H); gr.addColorStop(0, OU.mint); gr.addColorStop(0.5, OU.sky); gr.addColorStop(1, OU.lilac); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // 几何底纹：细线六边形网格 + 少量大圆形光斑
    g.save(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5; const r = 34, dx = r * 1.5, dy = r * Math.sqrt(3);
    for (let i = -1; i * dx < W + r; i++) for (let j = -1; j * dy < H + r; j++) { hexPath(g, i * dx, j * dy + (i % 2 ? dy / 2 : 0), r * 0.9); g.stroke(); }
    g.restore();
    for (const [x, y, rr, a] of [[120, 260, 260, 0.35], [760, 900, 340, 0.28], [200, 1600, 300, 0.3]]) { const rg = g.createRadialGradient(x, y, 0, x, y, rr); rg.addColorStop(0, `rgba(255,255,255,${a})`); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
    // 游戏区：磨砂白面板 + 柔和外投影 + 白描边
    g.save(); g.shadowColor = 'rgba(47,58,107,0.22)'; g.shadowBlur = 30; g.shadowOffsetY = 10; g.beginPath(); boardPath(g); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fill(); g.restore();
    g.save(); g.beginPath(); boardPath(g); g.clip(); gr = g.createLinearGradient(0, 200, 0, H); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(201,228,255,0.25)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(86,97,154,0.06)'; for (let y = 230; y < H; y += 28) for (let x = 20 + ((y / 28) % 2) * 14; x < W; x += 28) { g.beginPath(); g.arc(x, y, 2, 0, TAU); g.fill(); } g.restore();
    g.save(); g.beginPath(); boardPath(g); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.stroke(); g.restore();
    // 传送带：深靛色轨道 + 分节履带 + 两端薄荷色轮毂
    const B = GEO.belt, bw = B.x1 - B.x0, bh = B.y1 - B.y0;
    g.save(); g.shadowColor = 'rgba(47,58,107,0.35)'; g.shadowBlur = 18; g.shadowOffsetY = 8; RR(g, B.x0, B.y0, bw, bh, 26); g.fillStyle = OU.track; g.fill(); g.restore();
    g.save(); RR(g, B.x0 + 8, B.y0 + 8, bw - 16, bh - 16, 20); g.clip(); g.fillStyle = '#2a3260'; g.fillRect(B.x0, B.y0, bw, bh);
    for (let x = B.x0 + 14; x < B.x1 - 10; x += 22) { RR(g, x, B.y0 + 12, 16, bh - 24, 5); g.fillStyle = 'rgba(91,102,163,0.55)'; g.fill(); }
    g.restore();
    for (const x of [B.x0 + bh / 2, B.x1 - bh / 2]) { g.beginPath(); g.arc(x, (B.y0 + B.y1) / 2, bh / 2 - 14, 0, TAU); g.fillStyle = 'rgba(191,240,227,0.25)'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(191,240,227,0.7)'; g.stroke(); }
    RR(g, 118, 1246, 626, 15, 7.5); g.fillStyle = OU.mint; g.fill();
    return c;
  },
  pit(g) { hexPath(g, 0, 0, 17, Math.PI / 6); g.fillStyle = '#1e2550'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(191,240,227,0.55)'; g.stroke(); },
  ball(col, r) { // 切面宝石：八边形轮廓 + 平涂分面 + 白色内描边
    const k = 3, pad = 4, s = r * 2 + pad * 2, c = mk(s * k, s * k), g = c.getContext('2d'); g.scale(k, k); g.translate(s / 2, s / 2);
    const N = 8, pts = [...Array(N)].map((_, i) => [r * Math.cos(i * TAU / N + Math.PI / 8), r * Math.sin(i * TAU / N + Math.PI / 8)]);
    g.beginPath(); pts.forEach(p => g.lineTo(p[0], p[1] + 1.5)); g.closePath(); g.fillStyle = 'rgba(47,58,107,0.25)'; g.fill();
    for (let i = 0; i < N; i++) { const a = pts[i], b = pts[(i + 1) % N], m = (i + 0.5) * TAU / N + Math.PI / 8, lt = 0.5 + 0.5 * Math.cos(m - (-2.3)); g.beginPath(); g.moveTo(0, 0); g.lineTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.closePath(); g.fillStyle = lt > 0.5 ? mixc(col, '#ffffff', (lt - 0.5) * 0.7) : mixc(col, '#1d2350', (0.5 - lt) * 0.55); g.fill(); }
    g.beginPath(); for (let i = 0; i < N; i++) g.lineTo(pts[i][0] * 0.55, pts[i][1] * 0.55); g.closePath(); g.fillStyle = mixc(col, '#ffffff', 0.25); g.fill();
    g.beginPath(); pts.forEach(p => g.lineTo(p[0], p[1])); g.closePath(); g.lineWidth = Math.max(1, r * 0.09); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.stroke();
    g.beginPath(); g.ellipse(-r * 0.3, -r * 0.38, r * 0.2, r * 0.1, -0.6, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fill();
    c.dw = s; return c;
  },
  brick(g, game, box, isTray, S, ballFn) { // 胶囊盒：大圆角 + 柔和渐变 + 白色描边；托盘为点阵容量灯槽
    const col = game.color(box.color), w = 162, h = 76;
    g.save(); g.shadowColor = 'rgba(47,58,107,0.28)'; g.shadowBlur = 12; g.shadowOffsetY = 6; RR(g, -w / 2, 0, w, h, h / 2); g.fillStyle = col; g.fill(); g.restore();
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, mixc(col, '#ffffff', 0.35)); gr.addColorStop(1, mixc(col, '#2f3a6b', 0.15)); RR(g, -w / 2, 0, w, h, h / 2); g.fillStyle = gr; g.fill();
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.9)'; RR(g, -w / 2 + 1.5, 1.5, w - 3, h - 3, h / 2 - 1.5); g.stroke();
    if (!isTray) { g.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(i * 16, h / 2, 4, 0, TAU); g.fill(); } return; }
    const cap = S.boxCapacity; for (let i = 0; i < cap; i++) { const hx = (i - (cap - 1) / 2) * 44;
      g.beginPath(); g.arc(hx, 32, 16, 0, TAU); g.fillStyle = 'rgba(30,37,80,0.35)'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.7)'; g.stroke();
      if (i < box.n) ballFn(hx, 32); }
    // 容量灯
    for (let i = 0; i < cap; i++) { const lx = (i - (cap - 1) / 2) * 14; g.beginPath(); g.arc(lx, h - 9, 3.5, 0, TAU); g.fillStyle = i < box.n ? '#ffffff' : 'rgba(255,255,255,0.3)'; g.fill(); }
  },
  topUI(g, game) { // 关卡徽章（六边形图标 + 文字）+ 圆形暂停按钮
    g.save(); g.shadowColor = 'rgba(47,58,107,0.25)'; g.shadowBlur = 14; g.shadowOffsetY = 6; RR(g, 322, 118, 220, 76, 22); g.fillStyle = '#ffffff'; g.fill(); g.restore();
    hexPath(g, 360, 156, 22, Math.PI / 6); g.fillStyle = OU.ink; g.fill(); hexPath(g, 360, 156, 12, Math.PI / 6); g.fillStyle = OU.mint; g.fill();
    g.font = '700 36px RB, Roboto, Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = OU.ink; g.fillText('LV ' + (game.levelIdx + 1), 392, 158);
    g.save(); g.shadowColor = 'rgba(47,58,107,0.3)'; g.shadowBlur = 14; g.shadowOffsetY = 6; g.beginPath(); g.arc(776, 160, 44, 0, TAU); g.fillStyle = OU.ink; g.fill(); g.restore();
    g.beginPath(); g.arc(776, 160, 38, 0, TAU); g.lineWidth = 3; g.strokeStyle = 'rgba(191,240,227,0.8)'; g.stroke();
    for (const x of [764, 788]) { RR(g, x - 5, 142, 10, 36, 5); g.fillStyle = OU.mint; g.fill(); }
  },
  capLight(g, st) { RR(g, -9, -5, 18, 10, 5); g.fillStyle = { on: OU.mint, full: OU.accent, off: 'rgba(255,255,255,0.18)' }[st]; g.fill(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.8)'; g.stroke(); },
  sparkle(g) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 6 : 20; g.lineTo(rr * Math.cos(a), rr * Math.sin(a)); } g.closePath(); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 2; g.strokeStyle = OU.accent; g.stroke(); },
  mat3d(kind) { if (kind === 'ball') return { roughness: 0.15, metalness: 0.1 }; return { roughness: 0.5, metalness: 0.1 }; },
};

export const THEMES = {
  default: { id: 'default', name: '原版', desc: '参考视频美术（assets/named/*.png）' },
  realistic,
  'original-ui': originalUI,
};
export const THEME_OPTIONS = Object.values(THEMES).map(t => [t.id, t.name]);
let cur = THEMES.default;
export const theme = () => cur;
export function setTheme(id) { cur = THEMES[id] || THEMES.default; return cur; }
export const spritePrefix = () => cur.id === 'default' ? '' : cur.id + ':';
