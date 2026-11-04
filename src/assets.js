// 美术资源清单（用户提供，assets/named/*.png，build 时内联为 dataURL）。缺失的资源走程序化占位绘制。
// 详见 /ASSET_MAP.md。
import files from './assets_gen.js';
export const ASSETS = {};
for (const [k, url] of Object.entries(files)) { const im = new Image(); im.src = url; ASSETS[k] = im; }
export const asset = k => { const im = ASSETS[k]; return im && im.complete && im.naturalWidth ? im : null; };
export const assetsReady = () => Promise.all(Object.values(ASSETS).map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
// 环图几何（像素，量自用户美术）：中心线半径 151、管粗 50、开口环缺口朝上（-90°）、开口两端圆头中心夹角≈58°
export const RING_ART = {
  open: { centerR: 151, tube: 50, pivot: [175.5 / 352, 157 / 333], gapDir: -90, gapDeg: 58 },
  closed: { centerR: 151, tube: 50, pivot: [0.5, 0.5] },
  clip: { w: 68, h: 78, stemDown: true, pivot: [0.5, 28 / 78], stemW: 42 }, // pivot=夹块中心（落在被夹环的中心线上），颈部朝父环
};
// 美术颜色（采样自资源，用于程序化的球/盒子/碎片）
export const ART_HEX = { red: '#dc3247', orange: '#ec8a23', green: '#24b24a', blue: '#3a6fde', cyan: '#33a9e0', purple: '#8c45dc', gray: '#a9adb5' };
