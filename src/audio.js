// WebAudio 程序化音效（无版权素材）。所有输出接 master，可送往录制流（recDest/dest）。
// 接口与其它核玩工具一致：SFX_NAMES / SFX_DUR / renderSfxOffline / encodeWav / sfx.hook(name, o)（AE 记录器用）。
export const SFX_NAMES = { pop: ['sfxPop', '入盒'], tick: ['sfxTick', '抓环'], land: ['sfxLand', '上传送带'], shatter: ['sfxShatter', '碎裂'], boxDone: ['sfxBoxDone', '盒满'], complete: ['sfxComplete', '过关'], click: ['sfxClick', '按钮'], unlock: ['sfxUnlock', '解扣脱环'] };
export const SFX_DUR = { pop: 0.12, tick: 0.05, land: 0.1, shatter: 0.35, boxDone: 0.4, complete: 1.2, click: 0.1, unlock: 0.18 };
// phase41：按主题换音色（原版=合成清脆；木质=低沉木击；彩块=弹跳糖果；玉石=清亮玉磬）。p=音高倍率 w=波形 n=噪声频率倍率 rg=玉磬余韵
export const THEME_SFX = { default: {}, wood: {}, candy: {}, jade: {} }; // phase43：主题音效改为材质合成（见 MAT 段），不再是简单变调
export class Sfx {
  constructor(getS) { this.getS = getS || (() => ({})); this.ctx = null; this.last = {}; this.events = []; }
  ensure() {
    if (this.ctx) return this.ctx;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    try { this.ctx = new C(); } catch (e) { return null; }
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    try { this.dest = this.recDest = this.ctx.createMediaStreamDestination(); this.master.connect(this.dest); } catch (e) { }
    this.makeNoise(); return this.ctx;
  }
  makeNoise() { const len = this.ctx.sampleRate, b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0); let s = 7; for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; } this._noise = b; }
  resume() { const c = this.ensure(); if (c && c.state === 'suspended') c.resume(); }
  play(name, o = {}) {
    const S = this.getS(), [k] = SFX_NAMES[name] || []; if (!k) return;
    if (this._t == null) { const now = this.clock ? this.clock() : performance.now() / 1000; const l = this.last[name]; if (l != null && now >= l && now - l < (o.minGap ?? 0.03)) return; this.last[name] = now; }
    if (S.sfxMute || S[k] === false) return;
    if (this.hook && this._t == null) try { this.hook(name, o); } catch (e) { }
    this.events.push({ name, t: performance.now() });
    const c = this.ensure(); if (!c) return; if (this._t == null && c.state !== 'running') return;
    const v = (S.sfxVolume ?? 0.8); if (v <= 0) return; if (this._t == null) this.master.gain.value = v;
    this._th = THEME_SFX[S.theme] || THEME_SFX.default; const t = this._t != null ? this._t : c.currentTime, f = (S.theme && S.theme !== 'default' && this['_' + S.theme + '_' + name]) || this['_' + name]; if (f) f.call(this, c, t, o, this._t != null ? v : 1);
  }
  _env(c, t, a, d, peak) { const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(this.master); return g; }
  _osc(c, t, type, f0, f1, dur, peak, a = 0.004) { const th = this._th || {}; if (th.p) { f0 *= th.p; f1 *= th.p; } if (th.w && type !== 'sine') type = th.w; if (th.d) dur *= th.d; if (th.rg && dur > 0.04) { const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(f1 * 2.76, t); o2.connect(this._env(c, t, a, dur * 1.6, peak * 0.18)); o2.start(t); o2.stop(t + a + dur * 1.6 + 0.02); } const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); o.connect(this._env(c, t, a, dur, peak)); o.start(t); o.stop(t + dur + a + 0.02); }
  _nz(c, t, dur, freq, q, peak) { const th = this._th || {}; if (th.n) freq *= th.n; if (th.rg) peak *= 0.6; const s = c.createBufferSource(); s.buffer = this._noise; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q; s.connect(bp); bp.connect(this._env(c, t, 0.003, dur, peak)); s.start(t, 0.1); s.stop(t + dur + 0.05); }
  _pop(c, t, o, v) { const p = 1 + (o.pitch || 0) * 0.06; this._osc(c, t, 'sine', 520 * p, 1100 * p, 0.09, 0.5 * v); this._osc(c, t, 'triangle', 1300 * p, 1800 * p, 0.05, 0.12 * v); }
  _tick(c, t, o, v) { this._osc(c, t, 'square', 1800, 1200, 0.02, 0.05 * v); }
  _land(c, t, o, v) { this._osc(c, t, 'sine', 300, 180, 0.06, 0.18 * v); this._nz(c, t, 0.04, 2500, 2, 0.08 * v); }
  _shatter(c, t, o, v) { this._nz(c, t, 0.25, 3000, 0.8, 0.6 * v); this._nz(c, t + 0.02, 0.18, 6000, 1.5, 0.35 * v); for (let i = 0; i < 5; i++) this._osc(c, t + i * 0.025, 'triangle', 2400 + i * 300, 900, 0.05, 0.12 * v); }
  _boxDone(c, t, o, v) { [880, 1175, 1568].forEach((f, i) => this._osc(c, t + i * 0.05, 'sine', f, f * 1.01, 0.18, 0.25 * v)); this._nz(c, t, 0.2, 5000, 1, 0.1 * v); }
  _complete(c, t, o, v) { [523, 659, 784, 1047, 1319].forEach((f, i) => { this._osc(c, t + i * 0.08, 'triangle', f, f, 0.35, 0.28 * v); this._osc(c, t + i * 0.08, 'sine', f * 2, f * 2, 0.25, 0.08 * v); }); this._nz(c, t + 0.05, 0.5, 4000, 0.6, 0.15 * v); for (let i = 0; i < 8; i++) this._osc(c, t + 0.45 + i * 0.04, 'sine', 2000 + i * 180, 2600, 0.08, 0.06 * v); }
  _unlock(c, t, o, v) { this._osc(c, t, 'triangle', 900, 1500, 0.07, 0.22 * v); this._osc(c, t + 0.05, 'sine', 1500, 1500, 0.1, 0.14 * v); this._nz(c, t, 0.05, 4000, 2, 0.06 * v); }

  // ===== phase43 材质音效：模态合成（若干衰减正弦分音）+ 摩擦噪声 =====
  _mode(c, t, f, ratios, decs, amps, peak, a = 0.001) { ratios.forEach((r, i) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f * r, t); const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * amps[i]), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + decs[i]); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + a + decs[i] + 0.02); }); }
  _hitNz(c, t, dur, type, freq, q, peak) { const s = c.createBufferSource(); s.buffer = this._noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(this.master); s.start(t, ((t * 7.31) % 0.5)); s.stop(t + dur + 0.02); }
  _scrape(c, t, dur, freq, peak, rough = 40) { const s = c.createBufferSource(); s.buffer = this._noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.frequency.linearRampToValueAtTime(freq * 1.25, t + dur); f.Q.value = 3; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); const n = Math.max(3, Math.round(dur * rough)); for (let i = 0; i <= n; i++) g.gain.linearRampToValueAtTime(peak * (0.35 + 0.65 * Math.abs(Math.sin(i * 2.399))) * Math.sin(Math.PI * i / n), t + dur * i / n); s.connect(f); f.connect(g); g.connect(this.master); s.start(t, ((t * 7.31) % 0.5)); s.stop(t + dur + 0.02); }
  // 玉石：硬质碰撞（高频非谐分音、短衰减、清亮余音）+ 轻摩擦
  _jadeHit(c, t, f, peak, ring = 1) { this._mode(c, t, f, [1, 2.32, 4.25, 6.63], [0.22 * ring, 0.12 * ring, 0.06, 0.03], [1, 0.55, 0.3, 0.18], peak); this._hitNz(c, t, 0.012, 'highpass', 5000, 0.7, peak * 0.5); }
  _jade_tick(c, t, o, v) { this._jadeHit(c, t, 2600, 0.09 * v, 0.35); this._scrape(c, t + 0.005, 0.06, 4200, 0.035 * v); }
  _jade_land(c, t, o, v) { this._jadeHit(c, t, 1700, 0.16 * v, 0.6); this._scrape(c, t + 0.01, 0.09, 3200, 0.04 * v); }
  _jade_pop(c, t, o, v) { const p = 1 + (o.pitch || 0) * 0.05; this._jadeHit(c, t, 2100 * p, 0.2 * v, 0.8); this._jadeHit(c, t + 0.045, 2300 * p, 0.07 * v, 0.4); }
  _jade_boxDone(c, t, o, v) { [1568, 2093, 2637].forEach((f, i) => this._jadeHit(c, t + i * 0.06, f, 0.16 * v, 1.6)); }
  _jade_shatter(c, t, o, v) { this._hitNz(c, t, 0.18, 'highpass', 3500, 0.8, 0.35 * v); for (let i = 0; i < 9; i++) this._jadeHit(c, t + i * 0.018 + (i % 3) * 0.007, 1800 + ((i * 977) % 2600), 0.09 * v, 0.5); }
  _jade_complete(c, t, o, v) { [1047, 1319, 1568, 2093, 2637].forEach((f, i) => this._jadeHit(c, t + i * 0.1, f, 0.17 * v, 2.2)); }
  _jade_unlock(c, t, o, v) { this._scrape(c, t, 0.09, 3600, 0.05 * v); this._jadeHit(c, t + 0.08, 2400, 0.14 * v, 0.7); }
  _jade_click(c, t, o, v) { this._jadeHit(c, t, 2800, 0.1 * v, 0.3); }
  // 木质：木头敲击（低频短衰减分音 + 低通“咚”噪声）+ 柔和刮擦
  _woodHit(c, t, f, peak, d = 1) { this._mode(c, t, f, [1, 2.76, 5.4], [0.06 * d, 0.03 * d, 0.015], [1, 0.45, 0.2], peak); this._hitNz(c, t, 0.035 * d, 'lowpass', 1400, 0.8, peak * 0.9); }
  _wood_tick(c, t, o, v) { this._woodHit(c, t, 520, 0.13 * v, 0.6); this._scrape(c, t + 0.005, 0.07, 900, 0.03 * v, 25); }
  _wood_land(c, t, o, v) { this._woodHit(c, t, 300, 0.22 * v, 1); this._scrape(c, t + 0.01, 0.08, 700, 0.03 * v, 25); }
  _wood_pop(c, t, o, v) { const p = 1 + (o.pitch || 0) * 0.05; this._woodHit(c, t, 420 * p, 0.26 * v, 1.1); this._woodHit(c, t + 0.05, 460 * p, 0.08 * v, 0.6); }
  _wood_boxDone(c, t, o, v) { [392, 523, 659].forEach((f, i) => this._woodHit(c, t + i * 0.07, f, 0.22 * v, 1.6)); }
  _wood_shatter(c, t, o, v) { this._hitNz(c, t, 0.2, 'bandpass', 900, 0.7, 0.4 * v); for (let i = 0; i < 6; i++) this._woodHit(c, t + i * 0.03, 280 + ((i * 331) % 500), 0.12 * v, 0.8); this._scrape(c, t, 0.22, 1200, 0.06 * v, 60); }
  _wood_complete(c, t, o, v) { [262, 330, 392, 523, 659].forEach((f, i) => this._woodHit(c, t + i * 0.11, f, 0.24 * v, 2.2)); }
  _wood_unlock(c, t, o, v) { this._scrape(c, t, 0.1, 800, 0.05 * v, 25); this._woodHit(c, t + 0.09, 480, 0.2 * v, 0.9); }
  _wood_click(c, t, o, v) { this._woodHit(c, t, 600, 0.15 * v, 0.6); }
  // 彩块：塑料/糖果弹跳（中频亮分音 + 音高上扬 + 二次小弹）
  _candyHit(c, t, f, peak, bounce = 1) { this._mode(c, t, f, [1, 1.98, 3.1], [0.05, 0.035, 0.02], [1, 0.4, 0.2], peak); const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f * 0.7, t); o.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.05); o.connect(this._env(c, t, 0.003, 0.05, peak * 0.5)); o.start(t); o.stop(t + 0.08); this._hitNz(c, t, 0.008, 'bandpass', 3000, 1.2, peak * 0.6); if (bounce > 0.3) this._candyHit(c, t + 0.07 * bounce, f * 1.08, peak * 0.4, bounce * 0.45); }
  _candy_tick(c, t, o, v) { this._candyHit(c, t, 1400, 0.09 * v, 0); }
  _candy_land(c, t, o, v) { this._candyHit(c, t, 900, 0.17 * v, 1); }
  _candy_pop(c, t, o, v) { const p = 1 + (o.pitch || 0) * 0.06; this._candyHit(c, t, 1100 * p, 0.2 * v, 1); }
  _candy_boxDone(c, t, o, v) { [880, 1109, 1319].forEach((f, i) => this._candyHit(c, t + i * 0.06, f, 0.17 * v, 0.6)); }
  _candy_shatter(c, t, o, v) { this._hitNz(c, t, 0.12, 'bandpass', 2200, 0.9, 0.3 * v); for (let i = 0; i < 7; i++) this._candyHit(c, t + i * 0.028, 700 + ((i * 523) % 1100), 0.1 * v, 0.5); }
  _candy_complete(c, t, o, v) { [659, 784, 988, 1175, 1319].forEach((f, i) => this._candyHit(c, t + i * 0.09, f, 0.19 * v, 0.8)); }
  _candy_unlock(c, t, o, v) { this._candyHit(c, t, 1200, 0.16 * v, 1); }
  _candy_click(c, t, o, v) { this._candyHit(c, t, 1500, 0.11 * v, 0); }
  _click(c, t, o, v) { this._osc(c, t, 'sine', 700, 400, 0.08, 0.35 * v); }
}
export async function renderSfxOffline(events, dur, S) {
  const C = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!C) return null;
  const sr = 44100, oc = new C(1, Math.max(1, Math.ceil(sr * dur)), sr);
  const S2 = { ...S, sfxMute: false }; for (const k in SFX_NAMES) S2[SFX_NAMES[k][0]] = true;
  const x = new Sfx(() => S2); x.ctx = oc; x.master = oc.createGain(); x.master.connect(oc.destination); x.makeNoise();
  for (const e of events) { x._t = e.t; x.play(e.name, e); }
  return await oc.startRendering();
}
export function encodeWav(buf) {
  const ch = buf.getChannelData(0), n = ch.length, dv = new DataView(new ArrayBuffer(44 + n * 2));
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, ch[i])); dv.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
  return new Uint8Array(dv.buffer);
}
