// 导出 After Effects 工程：逐帧采样 frameItems()（素材 + 中心位置/缩放/旋转/不透明度/层级），
// 每个元素（id + 素材）的每段连续出现 = 一个独立图层。改编自共享 pin-rescue 记录器（解环传送带：画布 864×1920）。
import { makeZip } from './zip.js';
import JSX_TEXT from './build_ae_project.jsx';
import README_TEXT from './README_AE.md';
import { renderSfxOffline, encodeWav, SFX_NAMES, SFX_DUR } from '../audio.js';
const r3 = v => Math.round(v * 1000) / 1000, r4 = x => Math.round(x * 10000) / 10000;
const LABEL = { background: 15, pit: 15, box: 9, ball: 2, ring: 1, ringhl: 11, link: 8, clip: 8, shard: 11, star: 11, flash: 11, hint: 15, hud: 15, lc: 5, confetti: 6, puff: 11, flycoin: 3, ripple: 12, hand: 12, audio: 16 };
const CN = { red: '红', orange: '橙', green: '绿', blue: '蓝', cyan: '青', purple: '紫', gray: '灰', yellow: '黄', pink: '粉' };
const T = { background: ['背景', 'Background'], pit: ['传送带凹槽', 'BeltPit'], box: ['盒子', 'Box'], ball: ['球', 'Ball'], ring: ['圆环', 'Ring'], ringhl: ['圆环高亮', 'RingHighlight'], link: ['连杆', 'Link'], clip: ['夹子', 'Clip'], shard: ['碎片', 'Shard'], star: ['星星', 'Star'], flash: ['闪光', 'Flash'], hint: ['提示文字', 'Hint'], hud: ['顶部界面', 'HUD'], lc: ['过关', 'LevelComplete'], confetti: ['彩带', 'Confetti'], puff: ['烟雾', 'Puff'], flycoin: ['飞金币', 'FlyCoin'], ripple: ['点击波纹', 'Ripple'], hand: ['手指', 'Hand'] };
const colOf = a => (String(a || '').split('_').find(t => t in CN) || null);
export function layerName(id, asset, zh) {
  const k = id.split('_')[0], rest = id.slice(k.length + 1), base = (T[k] || [k, k])[zh ? 0 : 1], c = colOf(asset);
  if (k === 'box') return `${base}_${c ? (zh ? CN[c] || c : c) : ''}_${asset.startsWith('tray') ? (zh ? '托盘' : 'tray') : (zh ? '砖' : 'brick')}_${rest}`;
  if (c && (k === 'ball' || k === 'ring' || k === 'clip')) return `${base}_${zh ? CN[c] || c : c}_${rest}`;
  return rest ? `${base}_${rest}` : base;
}
const folderOf = a => /^(background|pit)/.test(a) ? 'scene' : /^(ring|link|clip)/.test(a) ? 'rings' : /^(ball|tray|brick)/.test(a) ? 'balls' : /^(shard|star|flash|confetti|puff)/.test(a) ? 'fx' : 'ui';
export function createAERecorder(api) {
  let R = null;
  function start() { const E = api.env(); R = { t0: api.now(), lastT: 0, frames: 0, tracks: new Map(), blur: [], sfx: [], S: { ...E.S } }; api.sfx.hook = (name, o) => { if (R) R.sfx.push({ t: Math.max(0, (api.now() - R.t0) / 1000), name, dur: o && o.dur, v: o && o.v }); }; }
  function stop() { const r = R; R = null; return r; }
  function sample(now) {
    if (!R) return; const E = api.env(), f = R.frames, t = Math.max(R.lastT + 1e-4 * (f > 0), (now - R.t0) / 1000);
    for (const it of E.items) {
      if (it.id === 'blur') { R.blur.push([t, r3(it.blur)]); continue; }
      const key = it.id + '|' + it.asset; let tr = R.tracks.get(key);
      if (!tr) { tr = { id: it.id, asset: it.asset, z: it.z, add: !!it.add, s: [], order: R.tracks.size }; R.tracks.set(key, tr); }
      tr.s.push([t, r3(it.x), r3(it.y), r3(it.sc ?? 1), r3(it.rot || 0), r3(it.op ?? 1), f]);
    }
    R.lastT = t; R.frames++;
  }
  async function exportZip(rec = R, So = null) {
    if (!rec || rec.frames < 2) throw new Error('没有可导出的记录：请先自动通关或手动游玩');
    const E = api.env(), S = So ? { ...rec.S, ...So } : rec.S, AS = (api.sprites || E.sprites)();
    const fps = +S.aeFps || 30, bake = S.aeSampling === 'bake', zh = S.aeNames !== 'en', V = E.view;
    const [CW, CH] = (S.aeSize && S.aeSize !== 'canvas' ? S.aeSize.split('x').map(Number) : [Math.round(V.w), Math.round(V.h)]), K = Math.min(CW / V.w, CH / V.h), OX = (CW - V.w * K) / 2, OY = (CH - V.h * K) / 2;
    const D = Math.max(1 / fps, Math.ceil((rec.lastT + 1 / fps) * fps - 1e-6) / fps);
    const assets = [], assetFiles = [], pending = [], used = new Map();
    const folders = [{ id: 'root', name: '解环传送带_AE工程' }, { id: 'img', name: '素材', parent: 'root' }, { id: 'scene', name: '场景', parent: 'img' }, { id: 'rings', name: '圆环与夹子', parent: 'img' }, { id: 'balls', name: '球与盒子', parent: 'img' }, { id: 'fx', name: '特效', parent: 'img' }, { id: 'ui', name: '界面', parent: 'img' }, { id: 'aud', name: '音频', parent: 'root' }, { id: 'pre', name: '预合成', parent: 'root' }];
    const toPng = c => new Promise(res => c.toBlob(b => b.arrayBuffer().then(a => res(new Uint8Array(a))), 'image/png'));
    function assetFor(key) {
      if (used.has(key)) return used.get(key); const a = AS[key]; if (!a) return null;
      const file = 'assets/' + key + '.png', o = { id: key, file, folder: folderOf(key), w: a.c.width, h: a.c.height, name: key + '.png', kx: a.c.width / a.w, ky: a.c.height / a.h, ax: a.ax, ay: a.ay };
      assets.push(o); pending.push(toPng(a.c).then(data => assetFiles.push({ name: file, data }))); used.set(key, o); return o;
    }
    const rnd = v => Array.isArray(v) ? v.map(x => Math.round(x * 100) / 100) : Math.round(v * 100) / 100;
    function resample(s) { const f0 = Math.round(s[0][0] * fps), f1 = Math.max(f0, Math.round(s[s.length - 1][0] * fps)), out = []; let j = 0;
      for (let f = f0; f <= f1; f++) { const tau = f / fps; while (j < s.length - 2 && s[j + 1][0] <= tau + 1e-9) j++; const a = s[j], b = s[j + 1] || a, u = b[0] > a[0] ? Math.min(1, Math.max(0, (tau - a[0]) / (b[0] - a[0]))) : 0; out.push({ t: tau, v: a.map((x, i) => i === 0 ? tau : x + (b[i] - x) * u) }); }
      return { f0, f1, list: out }; }
    function prop(fr, get, tol) {
      const t = fr.list.map(o => o.t), vv = fr.list.map(o => get(o.v)), same = (a, b, e) => Array.isArray(a) ? a.every((x, i) => Math.abs(x - b[i]) <= e) : Math.abs(a - b) <= e;
      if (vv.every(x => same(x, vv[0], 1e-6))) return rnd(vv[0]);
      let keep; if (bake) keep = vv.map((_, i) => i);
      else { keep = [0]; let a = 0; for (let b = 2; b < vv.length; b++) { let ok = true; for (let m = a + 1; m < b && ok; m++) { const u = (t[m] - t[a]) / (t[b] - t[a]); const lin = Array.isArray(vv[a]) ? vv[a].map((x, i) => x + (vv[b][i] - x) * u) : vv[a] + (vv[b] - vv[a]) * u; ok = same(lin, vv[m], tol); } if (!ok) { keep.push(b - 1); a = b - 1; } } if (vv.length > 1) keep.push(vv.length - 1); }
      return { t: keep.map(i => r4(t[i])), v: keep.map(i => rnd(vv[i])) };
    }
    const segs = [], layers = [], comps = [], markers = [];
    for (const tr of rec.tracks.values()) { let a = 0; for (let i = 1; i <= tr.s.length; i++) if (i === tr.s.length || tr.s[i][6] !== tr.s[i - 1][6] + 1) { segs.push({ tr, s: tr.s.slice(a, i) }); a = i; } }
    segs.sort((p, q) => p.tr.z - q.tr.z || p.tr.order - q.tr.order || p.s[0][0] - q.s[0][0]);
    const nSeg = new Map(), segK = new Map(); segs.forEach(g => { const k = g.tr.id + '|' + g.tr.asset; nSeg.set(k, (nSeg.get(k) || 0) + 1); });
    let blurDone = false;
    const pushBlur = () => { if (blurDone || !rec.blur.length) return; blurDone = true; const s = rec.blur, fr = resample(s.map(e => [e[0], e[1]])); layers.push({ name: zh ? '失败模糊（调整图层）' : 'FailBlur (adjustment)', src: { solid: [1, 1, 1], adjust: true, w: CW, h: CH }, in: r4(fr.f0 / fps), out: D, label: 15, tr: { anchor: [CW / 2, CH / 2], position: [CW / 2, CH / 2] }, fx: { blur: prop(fr, e => e[1], 0.2) } }); };
    for (const g of segs) {
      if (g.tr.z >= 5) pushBlur();
      const a = assetFor(g.tr.asset); if (!a) continue;
      const tm = g.tr.id.startsWith('ball_') ? 2 : 1; // 球：静止时的物理微抖不记关键帧
      const fr = resample(g.s), tin = fr.f0 / fps, last = g.s[g.s.length - 1], nextT = rec.frames - 1 > last[6] ? last[0] + 1 / fps : D;
      const tout = Math.min(D, Math.max(tin + 1 / fps, Math.round(nextT * fps) / fps)), k = g.tr.id + '|' + g.tr.asset, n = (segK.get(k) || 0) + 1; segK.set(k, n);
      const L = { name: layerName(g.tr.id, g.tr.asset, zh) + (nSeg.get(k) > 1 ? ` #${n}` : ''), src: { asset: a.id }, in: r4(tin), out: r4(tout), label: LABEL[g.tr.id.split('_')[0]] ?? 15, tr: {
        anchor: [rnd(a.ax * a.kx), rnd(a.ay * a.ky)], position: prop(fr, e => [(e[1] - V.x0) * K + OX, (e[2] - V.y0) * K + OY], 0.25 * tm), scale: prop(fr, e => [e[3] * K * 100 / a.kx, e[3] * K * 100 / a.ky], 0.25),
        rotation: prop(fr, e => e[4] * 180 / Math.PI, 0.2 * tm), opacity: prop(fr, e => Math.max(0, Math.min(100, e[5] * 100)), 0.5) } };
      if (g.tr.add) L.blend = 'add'; layers.push(L);
    }
    pushBlur();
    const audioFiles = [], ZH = n => (SFX_NAMES[n] || [0, n])[1];
    if (S.aeAudio !== 'none' && rec.sfx.length) try {
      if (S.aeAudio === 'both' || S.aeAudio === 'mixed') { const buf = await renderSfxOffline(rec.sfx, D, S); if (buf) { audioFiles.push({ name: 'audio/mix.wav', data: encodeWav(buf) }); assets.push({ id: 'mix', file: 'audio/mix.wav', folder: 'aud', name: 'mix.wav' }); layers.push({ name: zh ? '混合音轨' : 'Mixed audio', src: { asset: 'mix' }, label: LABEL.audio }); } }
      if (S.aeAudio === 'both' || S.aeAudio === 'events') {
        const kinds = new Set(rec.sfx.map(e => e.name));
        for (const k of kinds) { const buf = await renderSfxOffline([{ t: 0, name: k }], (SFX_DUR[k] || 0.4) + 0.2, S); if (!buf) continue; audioFiles.push({ name: `audio/sfx_${k}.wav`, data: encodeWav(buf) }); assets.push({ id: 'sfx_' + k, file: `audio/sfx_${k}.wav`, folder: 'aud', name: `sfx_${k}.wav` }); }
        const al = rec.sfx.map((e, i) => { const st = r4(e.t); return { name: `${zh ? '音效' : 'SFX'} ${i + 1} ${zh ? ZH(e.name) : e.name}`, src: { asset: 'sfx_' + e.name }, start: st, in: st, label: LABEL.audio }; });
        comps.push({ id: 'sfx', name: zh ? '音效_逐事件' : 'SFX_events', w: CW, h: CH, duration: D, fps, folder: 'pre', layers: al }); layers.push({ name: zh ? '音效_逐事件' : 'SFX_events', src: { comp: 'sfx' }, label: LABEL.audio });
      }
    } catch (e) { console.warn('audio export', e); }
    for (const e of rec.sfx) markers.push([r4(e.t), zh ? ZH(e.name) : e.name]);
    const d = new Date(), p2 = x => String(x).padStart(2, '0'), stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    comps.push({ id: 'main', name: zh ? '主合成_解环传送带' : 'Main_RingBelt', w: CW, h: CH, duration: D, fps, folder: 'root', bg: [0, 0, 0], layers, markers });
    if (!zh) for (const f of folders) f.name = { 解环传送带_AE工程: 'RingBelt_AE', 素材: 'Assets', 场景: 'Scene', 圆环与夹子: 'RingsClips', 球与盒子: 'BallsBoxes', 特效: 'FX', 界面: 'UI', 音频: 'Audio', 预合成: 'Precomps' }[f.name] || f.name;
    const keyCount = p => p && p.t ? p.t.length : 0, stats = { comps: comps.length, layers: 0, keys: 0, rings: new Set(segs.filter(g => g.tr.id.startsWith('ring_')).map(g => g.tr.id)).size, balls: new Set(segs.filter(g => g.tr.id.startsWith('ball_')).map(g => g.tr.id)).size, boxes: new Set(segs.filter(g => g.tr.id.startsWith('box_')).map(g => g.tr.id)).size, clips: new Set(segs.filter(g => g.tr.id.startsWith('clip_')).map(g => g.tr.id)).size, sfx: rec.sfx.length, blur: rec.blur.length > 0 };
    for (const c of comps) { stats.layers += c.layers.length; for (const l of c.layers) { if (l.tr) for (const k of ['position', 'scale', 'rotation', 'opacity']) { const kc = keyCount(l.tr[k]); if (kc > 1) stats.keys += kc; } if (l.fx && keyCount(l.fx.blur) > 1) stats.keys += keyCount(l.fx.blur); } }
    const timeline = { meta: { tool: 'ring-belt', version: api.version || '1.0.0', format: 1, created: d.toISOString(), fps, width: CW, height: CH, duration: D, design: [864, 1920], view: V, sampling: bake ? 'bake' : 'reduce', names: zh ? 'zh' : 'en', saveAep: S.aeSaveAep !== false, aepName: `ring-belt_${stamp}.aep`, newProject: true, stats, note: '图层从下到上排列；时间单位秒；位置/锚点单位像素（合成坐标 = 设计坐标减去可视区域左上角）；缩放为百分比' },
      folders, assets: assets.map(({ id, file, folder, w, h, name }) => ({ id, file, folder, w, h, name })), comps, mainComp: 'main' };
    await Promise.all(pending);
    const enc = new TextEncoder(), files = [{ name: 'build_ae_project.jsx', data: enc.encode(JSX_TEXT) }, { name: 'timeline.json', data: enc.encode(JSON.stringify(timeline)) }, { name: 'README_AE.md', data: enc.encode(README_TEXT) }, ...assetFiles.sort((a, b) => a.name < b.name ? -1 : 1), ...audioFiles];
    return { blob: makeZip(files), name: `ring-belt_ae_export_${stamp}.zip`, timeline, stats, files: files.length, fileList: files, segs: segs.map(g => ({ id: g.tr.id, asset: g.tr.asset, z: g.tr.z, s: g.s })), blur: rec.blur };
  }
  return { start, stop, sample, exportZip, get rec() { return R; }, set rec(v) { R = v; } };
}

