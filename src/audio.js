// WebAudio 程序化音效（无版权素材）。所有输出接 master，可送往录制流（recDest/dest）。
// 接口与其它核玩工具一致：SFX_NAMES / SFX_DUR / renderSfxOffline / encodeWav / sfx.hook(name, o)（AE 记录器用）。
export const SFX_NAMES = { pop: ['sfxPop', '入盒'], tick: ['sfxTick', '抓环'], land: ['sfxLand', '上传送带'], shatter: ['sfxShatter', '碎裂'], boxDone: ['sfxBoxDone', '盒满'], complete: ['sfxComplete', '过关'], click: ['sfxClick', '按钮'] };
export const SFX_DUR = { pop: 0.12, tick: 0.05, land: 0.1, shatter: 0.35, boxDone: 0.4, complete: 1.2, click: 0.1 };
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
    const t = this._t != null ? this._t : c.currentTime, f = this['_' + name]; if (f) f.call(this, c, t, o, this._t != null ? v : 1);
  }
  _env(c, t, a, d, peak) { const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(this.master); return g; }
  _osc(c, t, type, f0, f1, dur, peak, a = 0.004) { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); o.connect(this._env(c, t, a, dur, peak)); o.start(t); o.stop(t + dur + a + 0.02); }
  _nz(c, t, dur, freq, q, peak) { const s = c.createBufferSource(); s.buffer = this._noise; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q; s.connect(bp); bp.connect(this._env(c, t, 0.003, dur, peak)); s.start(t, 0.1); s.stop(t + dur + 0.05); }
  _pop(c, t, o, v) { const p = 1 + (o.pitch || 0) * 0.06; this._osc(c, t, 'sine', 520 * p, 1100 * p, 0.09, 0.5 * v); this._osc(c, t, 'triangle', 1300 * p, 1800 * p, 0.05, 0.12 * v); }
  _tick(c, t, o, v) { this._osc(c, t, 'square', 1800, 1200, 0.02, 0.05 * v); }
  _land(c, t, o, v) { this._osc(c, t, 'sine', 300, 180, 0.06, 0.18 * v); this._nz(c, t, 0.04, 2500, 2, 0.08 * v); }
  _shatter(c, t, o, v) { this._nz(c, t, 0.25, 3000, 0.8, 0.6 * v); this._nz(c, t + 0.02, 0.18, 6000, 1.5, 0.35 * v); for (let i = 0; i < 5; i++) this._osc(c, t + i * 0.025, 'triangle', 2400 + i * 300, 900, 0.05, 0.12 * v); }
  _boxDone(c, t, o, v) { [880, 1175, 1568].forEach((f, i) => this._osc(c, t + i * 0.05, 'sine', f, f * 1.01, 0.18, 0.25 * v)); this._nz(c, t, 0.2, 5000, 1, 0.1 * v); }
  _complete(c, t, o, v) { [523, 659, 784, 1047, 1319].forEach((f, i) => { this._osc(c, t + i * 0.08, 'triangle', f, f, 0.35, 0.28 * v); this._osc(c, t + i * 0.08, 'sine', f * 2, f * 2, 0.25, 0.08 * v); }); this._nz(c, t + 0.05, 0.5, 4000, 0.6, 0.15 * v); for (let i = 0; i < 8; i++) this._osc(c, t + 0.45 + i * 0.04, 'sine', 2000 + i * 180, 2600, 0.08, 0.06 * v); }
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
