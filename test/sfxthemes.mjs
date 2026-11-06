// phase41：四主题 × 全部音效离线渲染，非静音且主题间音色不同
import { open, ok, done } from './_page.mjs';
const { b, p, errs } = await open('?det&seed=3', undefined, process.env.FILE);
const res = await p.evaluate(async () => { const out = {}; const A = window.__sfxApi; if (!A) return null;
  for (const th of ['default', 'wood', 'candy', 'jade']) for (const n of Object.keys(A.SFX_NAMES)) { const buf = await A.renderSfxOffline([{ name: n, t: 0.01 }], (A.SFX_DUR[n] || 0.3) * 2 + 0.2, { theme: th }); const d = buf.getChannelData(0); let e = 0, zc = 0; for (let i = 1; i < d.length; i++) { e += d[i] * d[i]; if ((d[i] > 0) !== (d[i - 1] > 0)) zc++; } out[th + ':' + n] = [Math.sqrt(e / d.length), zc]; }
  return out; });
ok(res, '__sfxApi 可用');
if (res) { const names = [...new Set(Object.keys(res).map(k => k.split(':')[1]))];
  for (const n of names) { for (const th of ['default', 'wood', 'candy', 'jade']) ok(res[th + ':' + n][0] > 1e-3, `${th} ${n} 非静音 rms=${res[th + ':' + n][0].toFixed(4)}`);
    ok(new Set(['default', 'wood', 'candy', 'jade'].map(th => res[th + ':' + n][1])).size >= 3, `${n} 四主题音色不同 zc=${['default', 'wood', 'candy', 'jade'].map(th => res[th + ':' + n][1])}`); } }
ok(!errs.length, 'no errors ' + errs.join('|')); await b.close(); done();
