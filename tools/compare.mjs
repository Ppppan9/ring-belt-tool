// 生成对比图：左=参考视频帧，右=复刻（确定性自动通关），并计算 SSIM/PSNR（tools/metrics.py）
import { chromium } from 'playwright'; import fs from 'fs'; import { execSync } from 'child_process';
const OUT = 'compare'; fs.mkdirSync(OUT + '/raw', { recursive: true });
// [标签, 参考时间(s), 复刻锚点事件(第N关的事件), 偏移(s)]
const M = [
  ['L1_开局', 0.5, 1, 'levelStart', 0.5], ['L1_拖环碎裂', 1.9, 1, 'detach', 0.15], ['L1_传送带', 3.0, 1, 'detach', 1.3], ['L1_过关', 5.0, 1, 'levelComplete', 0.8],
  ['L2_开局', 6.0, 2, 'levelStart', 0.5], ['L2_传送带', 8.5, 2, 'detach', 1.2], ['L2_过关', 10.4, 2, 'levelComplete', 0.8],
  ['L3_开局', 11.5, 3, 'levelStart', 0.6], ['L3_中途', 17.0, 3, 'detach', 0.6], ['L3_过关', 23.8, 3, 'levelComplete', 0.8],
  ['L4_开局', 25.0, 4, 'levelStart', 0.6], ['L4_倒球', 29.0, 4, 'grab', 1.2], ['L4_过关', 35.0, 4, 'levelComplete', 0.8],
  ['L5_开局', 37.0, 5, 'levelStart', 0.8], ['L5_中途', 41.0, 5, 'detach', 0.8], ['L5_收尾', 45.5, 5, 'levelComplete', -0.8], ['L5_过关', 47.5, 5, 'levelComplete', 1.0],
];
const b = await chromium.launch(); const url = 'file://' + process.cwd() + '/index.html?det=1&seed=7';
async function run(cb) { const p = await b.newPage({ viewport: { width: 900, height: 1000 } }); p.on('pageerror', e => console.log('ERR', e.message)); await p.goto(url); await p.waitForFunction(() => window.__ready); await p.evaluate(() => { localStorage.clear(); window.__setSettings({ handSize: 0.2 }); window.__auto(true); }); let t = 0; await cb(p, async n => { await p.evaluate(n => __step(n), n); t += n / 50; return t; }); await p.close(); }
let ev; await run(async (p, step) => { for (let i = 0; i < 100; i++) { await step(50); } ev = await p.evaluate(() => __game.events.map(e => ({ n: e.name, t: e.t, l: e.level }))); });
const target = M.map(([lab, rt, l, n, off]) => { const e = ev.find(e => e.l === l && e.n === n); return e ? Math.round((e.t + off) * 50) : null; });
const shots = {};
await run(async (p, step) => { let f = 0; const order = target.map((t, i) => [t, i]).filter(x => x[0] != null).sort((a, b) => a[0] - b[0]); for (const [t, i] of order) { if (t > f) { await step(t - f); f = t; } const d = await p.evaluate(() => document.getElementById('stage').toDataURL()); fs.writeFileSync(`${OUT}/raw/rep_${i}.png`, Buffer.from(d.split(',')[1], 'base64')); shots[i] = f / 50; } });
await b.close();
const meta = M.map(([lab, rt], i) => ({ i, lab, rt, rep: shots[i] ?? null }));
meta.forEach(m => execSync(`ffmpeg -loglevel error -y -ss ${m.rt} -i ref/ref.mp4 -frames:v 1 ${OUT}/raw/ref_${m.i}.png`));
fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify({ meta, events: ev.filter(e => !['land', 'box'].includes(e.n)) }, null, 1));
execSync(`python3 tools/metrics.py`, { stdio: 'inherit' });
