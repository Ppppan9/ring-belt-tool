import fs from 'fs'; const m = await import('../src/h5/index.js');
const fn = m.makePlayableHtml || m.buildPlayableHtml; const base = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
for (const t of ['default', 'wood', 'candy', 'jade']) { const h = fn(base, { format: 'facebook', toolId: 'x', settings: { theme: t }, orientation: 1 }); const ok = h.length < 2 * 1048576 * 0.98; console.log(ok ? '  ✓' : '  ✗', t, (h.length / 1048576).toFixed(3), 'MB'); if (!ok) process.exitCode = 1; }
// phase34：每主题 H5 试玩须 < 2MB（facebook 渠道）
