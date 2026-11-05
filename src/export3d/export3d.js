// 导出 3D 动画（export3d/1）：glTF 2.0 .glb + blender_import.py（转 FBX）+ scene3d.json + timeline.json + 音频。
// 复用 AE 导出时间轴（逐帧 bake、英文图层名）。圆环 = 真实圆环网格（TorusGeometry，开口环按缺口角截断），
// 球 = 球体网格（SphereGeometry），其余 2D 元素（背景/盒子/夹子/连杆/界面/特效/手指）= 带贴图四边形。
// 坐标：Y 轴向上，1 画布像素 = 1 mm；画面平铺在 XZ 平面（屏幕右 = +X，屏幕下 = +Z）；正交相机在 +Y 处朝下看。
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { makeZip } from '../ae/zip.js';
import { theme } from '../themes.js';
import PY_TEXT from './blender_import.py';
import README_TEXT from './README_3D.md';
export const PX = 0.001;
const SAFE = s => String(s).replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
const r5 = x => Math.round(x * 1e5) / 1e5;
function evalProp(P, t, def) {
  if (P === undefined || P === null) return def; if (typeof P !== 'object' || Array.isArray(P)) return P;
  const T = P.t, V = P.v; if (!T || !T.length) return def; if (t <= T[0]) return V[0]; if (t >= T[T.length - 1]) return V[V.length - 1];
  let i = 0; while (i < T.length - 2 && T[i + 1] <= t) i++; if (P.hold) return V[i];
  const u = (t - T[i]) / (T[i + 1] - T[i]), a = V[i], b = V[i + 1]; return Array.isArray(a) ? a.map((x, k) => x + (b[k] - x) * u) : a + (b - a) * u;
}
const animated = P => P && typeof P === 'object' && !Array.isArray(P) && P.t && P.t.length > 1;
function reduceKeys(times, vals, n) { const T = [], V = [], same = (i, j) => { for (let k = 0; k < n; k++) if (Math.abs(vals[i * n + k] - vals[j * n + k]) > 1e-7) return false; return true; };
  for (let i = 0; i < times.length; i++) { if (i > 0 && i < times.length - 1 && same(i, i - 1) && same(i, i + 1)) continue; T.push(times[i]); for (let k = 0; k < n; k++) V.push(vals[i * n + k]); } return { T, V }; }
// 素材键 → 3D 网格参数
export function meshSpec(id) {
  id = String(id).replace(/^[a-z0-9]+:(?=(ring|clip|ball)_)/, '');
  let m = /^ring_(open|closed)_([a-z]+)_([\d.]+)_(-?[\d.]+)_([\d.]+)/.exec(id); if (m) return { kind: 'ring', open: m[1] === 'open', color: m[2], R: +m[3], gapC: +m[4], gapW: +m[5] };
  m = /^clip_([a-z]+)_([\d.]+)_/.exec(id); if (m) return { kind: 'clip', color: m[1], R: +m[2] };
  m = /^ball_([a-z]+)_([\d.]+)$/.exec(id); if (m) return { kind: 'ball', color: m[1], r: +m[2] };
  return null;
}
export async function export3D({ S, aeResult, api }) {
  const fps = +S.export3dFps || 30, tl = aeResult.timeline, files = aeResult.fileList, W = tl.meta.width, H = tl.meta.height, D = tl.meta.duration, NF = Math.round(D * fps);
  const fileMap = new Map(files.map(f => [f.name, f.data])), assetById = new Map(tl.assets.map(a => [a.id, a])), compById = new Map(tl.comps.map(c => [c.id, c]));
  const K = W / 864, X = x => (x - W / 2) * PX, Z = y => (y - H / 2) * PX, T = (S.ringThick || 30) * K;
  const root = new THREE.Scene(); root.name = 'ring_belt_scene';
  const tracks = [], opacityTracks = {}, nodes = [], stats = { quads: 0, rings: 0, balls: 0, hand: 0 };
  const addTrack = (name, prop, times, vals, n, interp) => { const { T, V } = reduceKeys(times, vals, n); if (T.length === 1) { T.push(D); for (let k = 0; k < n; k++) V.push(V[k]); } const Tr = prop === 'quaternion' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack; tracks.push(new Tr(name + '.' + prop, T, V, interp)); };
  const frameTimes = () => { const a = []; for (let f = 0; f <= NF; f++) a.push(r5(f / fps)); return a; };
  function visTrack(name, visAt) { const times = [], vals = []; for (let f = 0; f <= NF; f++) { const v = visAt(f / fps) ? 1 : 0; times.push(r5(f / fps)); vals.push(v, v, v); } addTrack(name, 'scale', times, vals, 3, THREE.InterpolateDiscrete); }
  const texCache = new Map();
  async function texFromPng(file) { if (texCache.has(file)) return texCache.get(file); const bmp = await createImageBitmap(new Blob([fileMap.get(file)], { type: 'image/png' })); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.name = file.replace(/^assets\//, '').replace(/\.png$/, ''); texCache.set(file, t); return t; }
  const geoCache = new Map(), matCache = new Map();
  const quadGeo = (w, h, ax, ay) => { const key = [w, h, ax, ay].join(','); if (!geoCache.has(key)) { const g = new THREE.PlaneGeometry(w * PX, h * PX); g.rotateX(-Math.PI / 2); g.translate((w / 2 - ax) * PX, 0, (h / 2 - ay) * PX); geoCache.set(key, g); } return geoCache.get(key); };
  const PHYS = ['transmission', 'ior', 'thickness', 'attenuationColor', 'attenuationDistance', 'clearcoat', 'clearcoatRoughness', 'sheen'];
  const colMat = (c, kind) => { const key = kind + c; if (!matCache.has(key)) {
    const hexC = api.colorHex(c), P = { ...(theme().mat3d ? theme().mat3d(kind, c, hexC) : {}) }, col = P.color || hexC; delete P.color;
    if (P.attenuationColor) P.attenuationColor = new THREE.Color(P.attenuationColor);
    const Ctor = PHYS.some(k => k in P) ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const m = new Ctor({ color: new THREE.Color(col), roughness: kind === 'ball' ? 0.25 : 0.45, metalness: 0, ...P }); m.color.convertSRGBToLinear();
    const tc = theme().tex3d && theme().tex3d(kind, hexC); if (tc) { const t = new THREE.CanvasTexture(tc); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.name = `tex_${theme().id}_${kind}_${c}`; m.map = t; }
    m.name = `mat_${kind}_${c}`; matCache.set(key, m); } return matCache.get(key); };
  function ringGeo(sp) { // 屏幕角 t（y 向下）↔ XZ 平面 (cos t, sin t)
    const key = 'ring' + JSON.stringify(sp); if (geoCache.has(key)) return geoCache.get(key);
    const arc = sp.open ? Math.PI * 2 - sp.gapW : Math.PI * 2, a0 = sp.open ? sp.gapC + sp.gapW / 2 : 0;
    const tube = (theme().tubeHalf ? theme().tubeHalf(sp.R) : T / 2), prof = theme().ringProfile3d ? theme().ringProfile3d(sp.R, tube) : null; // 管径与 2D 视觉一致
    const g = new THREE.TorusGeometry(sp.R * PX, tube * PX, 24, prof ? 240 : 96, arc);
    if (prof) { const P = g.attributes.position, R0 = sp.R * PX; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), th = Math.atan2(y, x), cx = R0 * Math.cos(th), cy = R0 * Math.sin(th), f = 1 + prof(th); P.setXYZ(i, cx + (x - cx) * f, cy + (y - cy) * f, z * f); } g.computeVertexNormals(); }
    g.rotateX(Math.PI / 2); g.rotateY(-a0); g.translate(0, tube * PX, 0); geoCache.set(key, g); return g; }
  function clipGeo(sp) { // 夹扣：玉石主题 = 圆柱金属箍（轴沿管切向 = 局部 x）；其它主题 = 倒角块
    const key = 'clip' + theme().id + sp.R; if (geoCache.has(key)) return geoCache.get(key); const k = sp.R / 151; let g;
    if (theme().id === 'jade') { g = new THREE.CylinderGeometry(30 * k * PX, 30 * k * PX, 48 * k * PX, 32, 1); g.rotateZ(Math.PI / 2); g.translate(0, 30 * k * PX, 0); }
    else { g = new THREE.BoxGeometry(60 * k * PX, 20 * k * PX, 58 * k * PX); g.translate(0, 10 * k * PX, 0); }
    geoCache.set(key, g); return g; }
  function ballGeo(r) { const key = 'ball' + r; if (!geoCache.has(key)) { const g = new THREE.SphereGeometry(r * PX, 24, 16); g.translate(0, r * PX, 0); geoCache.set(key, g); } return geoCache.get(key); }
  const flat = []; let order = 0;
  (function walk(comp, t0w, t1w) { for (const L of comp.layers) { if (L.src.comp) { const c = compById.get(L.src.comp); if (c) walk(c, Math.max(t0w, L.in ?? 0), Math.min(t1w, L.out ?? D)); continue; } const a = L.src.asset ? assetById.get(L.src.asset) : null; if (!a || !/\.png$/.test(a.file)) continue; flat.push({ L, a, tin: Math.max(t0w, L.in ?? 0), tout: Math.min(t1w, L.out ?? D), y: 0.0004 * order++ }); } })(compById.get(tl.mainComp), 0, D);
  const g2 = new THREE.Group(); g2.name = 'layers'; root.add(g2); let qi = 0;
  for (const it of flat) {
    const { L, a } = it, tr = L.tr || {}, isHand = /^(Hand|手指)$/.test(L.name); if (isHand && S.export3dHand === false) continue;
    qi++; const nm = `q${String(qi).padStart(4, '0')}_${SAFE(L.name)}`, sp = S.export3dMeshes === false ? null : meshSpec(a.id);
    let mesh;
    if (sp && sp.kind === 'ring') { mesh = new THREE.Mesh(ringGeo({ ...sp, R: sp.R * K }), colMat(sp.color, 'ring')); stats.rings++; }
    else if (sp && sp.kind === 'clip') { mesh = new THREE.Mesh(clipGeo({ ...sp, R: sp.R * K }), colMat(sp.color, 'clip')); stats.clips = (stats.clips || 0) + 1; }
    else if (sp && sp.kind === 'ball') { mesh = new THREE.Mesh(ballGeo(sp.r * K), colMat(sp.color, 'ball')); stats.balls++; }
    else { const anc = tr.anchor || [0, 0]; const mat = new THREE.MeshBasicMaterial({ map: await texFromPng(a.file), transparent: true, depthWrite: false }); mat.name = 'mat_' + nm; const op0 = evalProp(tr.opacity, 0, 100); if (!animated(tr.opacity) && op0 < 100) mat.opacity = op0 / 100; mesh = new THREE.Mesh(quadGeo(a.w, a.h, anc[0], anc[1]), mat); stats.quads++; }
    if (isHand) stats.hand++;
    const vis = new THREE.Group(); vis.name = nm + '_vis'; vis.position.y = it.y; mesh.name = nm; vis.add(mesh); g2.add(vis);
    const big = a.w * a.h > W * H * 0.25, TH = big ? 50 : 1, f0 = Math.max(0, Math.round(it.tin * fps)), f1 = Math.min(NF, Math.round(it.tout * fps));
    visTrack(vis.name, t => t >= f0 / fps - 1e-9 && t < f1 / fps - 1e-9 && evalProp(tr.opacity, t, 100) >= TH);
    // 精灵缩放（含超采样 kx）→ 网格用逻辑缩放：AE scale% × 素材像素比
    const sk = sp ? api.spriteK(a.id) / K : 1; // AE 缩放已除以超采样倍率，网格按逻辑尺寸建 → 乘回
    const S3 = (sc) => sp ? [sc[0] / 100 * sk, sc[0] / 100 * sk, sc[1] / 100 * sk] : [sc[0] / 100, 1, sc[1] / 100];
    const apply = (tt) => { const p = evalProp(tr.position, tt, [0, 0]), sc = evalProp(tr.scale, tt, [100, 100]), r = evalProp(tr.rotation, tt, 0); return { p, s: S3(sc), r }; };
    if (animated(tr.position) || animated(tr.scale) || animated(tr.rotation)) {
      const times = frameTimes(), pv = [], qv = [], sv = [], q = new THREE.Quaternion(), ax = new THREE.Vector3(0, 1, 0);
      for (const t of times) { const tt = Math.min(Math.max(t, f0 / fps), Math.max(f0, f1 - 1) / fps), v = apply(tt); pv.push(X(v.p[0]), 0, Z(v.p[1])); sv.push(...v.s); q.setFromAxisAngle(ax, -v.r * Math.PI / 180); qv.push(q.x, q.y, q.z, q.w); }
      addTrack(nm, 'position', times, pv, 3, THREE.InterpolateLinear); addTrack(nm, 'scale', times, sv, 3, THREE.InterpolateLinear); if (animated(tr.rotation)) addTrack(nm, 'quaternion', times, qv, 4, THREE.InterpolateLinear);
    }
    { const v = apply(it.tin); mesh.position.set(X(v.p[0]), 0, Z(v.p[1])); mesh.scale.set(...v.s); mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -v.r * Math.PI / 180); }
    if (animated(tr.opacity)) { const TT = [], V = []; for (let f = f0; f <= f1; f++) { TT.push(r5(f / fps)); V.push(Math.round(evalProp(tr.opacity, f / fps, 100)) / 100); } const rk = reduceKeys(TT, V, 1); opacityTracks[nm] = rk.T.map((t, i) => [t, rk.V[i]]); }
    nodes.push({ name: nm, kind: sp ? sp.kind : isHand ? 'hand' : 'quad', src: a.file, in: r5(f0 / fps), out: r5(f1 / fps) });
  }
  const amb = new THREE.AmbientLight(0xffffff, 1.2); amb.name = 'light_ambient'; root.add(amb);
  const sun = new THREE.DirectionalLight(0xffffff, 2); sun.name = 'light_key'; sun.position.set(-0.3, 2, -0.5); root.add(sun);
  const cam = new THREE.OrthographicCamera(-W / 4 * PX, W / 4 * PX, H / 4 * PX, -H / 4 * PX, 0.01, 50); cam.name = 'camera_ortho_topdown'; cam.position.set(0, 10, 0); cam.rotation.set(-Math.PI / 2, 0, 0); root.add(cam);
  const clip = new THREE.AnimationClip('ring_belt', D, tracks);
  const glb = await new GLTFExporter().parseAsync(root, { binary: true, animations: [clip], onlyVisible: false, trs: true });
  const audio = [], mixA = tl.assets.find(a => a.id === 'mix'), sfxC = compById.get('sfx');
  if (sfxC) for (const L of sfxC.layers) { const a = assetById.get(L.src.asset); if (a) audio.push({ file: a.file, t: L.start || 0, name: L.name }); }
  const scene3d = { tool: 'ring-belt', format: 'export3d/1', fps, frames: NF + 1, frameStart: 0, frameEnd: NF, duration: D, width: W, height: H,
    units: { meter: 1, px: PX, note: '1 画布像素 = 1 mm；Y 轴向上；画面在 XZ 平面，屏幕右 = +X，屏幕下 = +Z' },
    camera: { name: cam.name, type: 'orthographic', xmag: W / 2 * PX, ymag: H / 2 * PX, orthoScale: Math.max(W, H) * PX, position: [0, 10, 0] },
    meshes: { ring: 'TorusGeometry（管径 = 主题视觉管半宽 tubeHalf；玉石主题沿弧位移出竹节凸脊/凹槽；开口环按缺口截断）', ball: 'SphereGeometry', clip: '玉石=圆柱金属箍(CylinderGeometry)，其它主题=BoxGeometry；连杆仍为贴图四边形' }, theme: theme().id,
    visibility: 'STEP 缩放：*_vis 节点 scale=1 显示，scale=0 隐藏', opacity: opacityTracks, nodes, audio, mix: mixA ? { file: mixA.file, t: 0 } : null, stats: { ...stats, tracks: tracks.length } };
  const enc = new TextEncoder(), out = [{ name: 'scene.glb', data: new Uint8Array(glb) }, { name: 'scene3d.json', data: enc.encode(JSON.stringify(scene3d)) }, { name: 'timeline.json', data: fileMap.get('timeline.json') }, { name: 'blender_import.py', data: enc.encode(PY_TEXT) }, { name: 'README_3D.md', data: enc.encode(README_TEXT) }, ...files.filter(f => f.name.startsWith('audio/'))];
  const d = new Date(), p2 = x => String(x).padStart(2, '0'), stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  return { blob: makeZip(out), name: `ring-belt_3d_export_${stamp}.zip`, stats: scene3d.stats, duration: D, fps, glbSize: glb.byteLength, scene3d, glb };
}
