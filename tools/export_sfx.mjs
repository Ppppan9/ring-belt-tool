// 把 src/audio.js 的程序化 WebAudio 音效逐个离线渲染为 sfx/*.wav（44.1kHz 单声道 16-bit）
import { chromium } from 'playwright'; import fs from 'fs'; import { execSync } from 'child_process';
execSync('npx esbuild src/audio.js --bundle --format=iife --global-name=AU --outfile=/tmp/au.js');
const b = await chromium.launch(); const p = await b.newPage(); await p.setContent('<html></html>'); await p.addScriptTag({ path: '/tmp/au.js' });
const out = await p.evaluate(async () => { const r = {}; for (const n of Object.keys(AU.SFX_NAMES)) { const buf = await AU.renderSfxOffline([{ name: n, t: 0.01 }], AU.SFX_DUR[n] + 0.15, { sfxVolume: 0.8 }); let pk = 0; const ch = buf.getChannelData(0); for (const v of ch) pk = Math.max(pk, Math.abs(v)); r[n] = { wav: Array.from(AU.encodeWav(buf)), dur: buf.duration, peak: pk }; } return r; });
fs.mkdirSync('sfx', { recursive: true });
for (const [n, o] of Object.entries(out)) { fs.writeFileSync(`sfx/${n}.wav`, Buffer.from(o.wav)); console.log(n, o.dur.toFixed(2) + 's', 'peak', o.peak.toFixed(3)); }
await b.close();
