// file:// 打开冒烟：chromium / webkit(Safari 内核) / firefox，若已安装
import * as pw from 'playwright'; import path from 'path';
const f = process.argv[2] || 'index.html'; let bad = 0;
for (const k of ['chromium', 'webkit', 'firefox']) { let b; try { b = await pw[k].launch(); } catch { console.log(k, 'not installed'); continue; }
  const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  const t = Date.now(); await p.goto('file://' + path.resolve(f)); let ok = false;
  try { await p.waitForFunction(() => window.__ready, null, { timeout: 20000 }); ok = true; } catch {}
  const bg = ok ? await p.evaluate(() => !!(window.__bg && __bg())) : false;
  console.log(ok && bg && !errs.length ? '  ✓' : '  ✗', k, f, 'ready', ok, 'bg', bg, Date.now() - t + 'ms', errs.slice(0, 3)); if (!(ok && bg && !errs.length)) bad++; await b.close(); }
process.exit(bad ? 1 : 0);
