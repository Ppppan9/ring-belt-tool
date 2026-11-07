// 导出流程：互斥锁 / 多主题打包结构 / 主题还原 / 失败释放锁（file:// 离线单文件下运行）
import { open, ok, done, saveDownload } from './_page.mjs'; import fs from 'fs'; import { execSync } from 'child_process';
const out = '/tmp/rb_flow'; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
const unz = (z, d) => execSync(`python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "${z}" "${d}"`);
const list = z => execSync(`python3 -c "import zipfile,sys; print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))" "${z}"`).toString().trim().split('\n');
const { b, p, errs } = await open(); const dls = []; p.on('download', d => dls.push(d.suggestedFilename()));
ok(p.url().startsWith('file://'), 'file:// 打开');
await p.evaluate(() => { __setSettings({ exportThemes: 'default,jade', theme: 'wood' }); __game.loadLevel(0); __aeStart(); __step(60); __aeStop(); });
// 1. 并发：两次 AE 导出 + 一次 H5 → 只出一个包
const r = await p.evaluate(async () => { const a = __aeExport(), c = __aeExport(), h = __exportH5(); const busy = __exportBusy(); const dis = document.getElementById('btn_exportH5').disabled; const res = await Promise.all([a, c, h]); return { busy, dis, names: res.map(x => x && x.name), after: __exportBusy(), dis2: document.getElementById('btn_exportH5').disabled, theme: __S().theme, live: __theme().id }; });
await p.waitForTimeout(500);
ok(r.busy === 'AE' && r.dis, `导出中加锁且按钮禁用 (${r.busy}, disabled=${r.dis})`);
ok(r.names[0] && !r.names[1] && !r.names[2], '并发的第二次 AE / H5 被拒绝 ' + JSON.stringify(r.names));
ok(dls.length === 1, '只产生 1 个下载 ' + dls.join(','));
ok(r.after === null && !r.dis2, '完成后解锁、按钮恢复');
ok(r.theme === 'wood' && r.live === 'wood', `导出后当前主题还原为 wood (${r.theme}/${r.live})`);
// 2. 多主题 AE 包结构
const za = await saveDownload(p, () => __aeExport(), out); const L = list(za);
ok(/ring-belt_ae_themes_\d+_\d+\.zip$/.test(za), '多主题总包命名 ' + za.split('/').pop());
ok(L.length === 2 && L.some(n => /^default\/ring-belt_ae_default_/.test(n)) && L.some(n => /^jade\/ring-belt_ae_jade_/.test(n)), '总包内按主题分目录 ' + L.join(','));
unz(za, out + '/ae'); for (const n of L) { const d = out + '/ae/' + n.replace(/\.zip$/, ''); unz(out + '/ae/' + n, d); for (const f of ['build_ae_project.jsx', 'timeline.json', 'README_AE.md']) ok(fs.existsSync(d + '/' + f), `${n.split('/')[0]} 含 ${f}`); const TL = JSON.parse(fs.readFileSync(d + '/timeline.json', 'utf8')); const th = n.split('/')[0]; const pngs = execSync(`find "${d}" -name '*.png' | wc -l`).toString().trim(); ok(+pngs > 5, `${th} 素材 PNG ${pngs} 张`); ok(JSON.stringify(TL).includes(th === 'default' ? 'ring' : 'jade'), `${th} 时间线引用对应主题素材`); }
// 3. 多主题 H5（file://）
await p.evaluate(() => __setSettings({ h5Format: 'google,mintegral,tiktok,generic' }));
const zh = await saveDownload(p, () => __exportH5(), out); const LH = list(zh);
ok(LH.some(n => n.startsWith('default/')) && LH.some(n => n.startsWith('jade/')), 'H5 多主题分目录 ' + LH.join(','));
unz(zh, out + '/h5'); const inner = execSync(`find ${out}/h5 -name '*.zip'`).toString().trim().split('\n'); let chOk = 0;
for (const z of inner) { const n = list(z); if (['google', 'mintegral', 'tiktok', 'generic'].every(c => n.some(x => x.startsWith(c + '/') && x.endsWith('index.html')))) chOk++; }
ok(chOk === 2, `每个主题包含 google/mintegral/tiktok/generic 四渠道 index.html (${chOk}/2)`);
ok(await p.evaluate(() => __S().theme) === 'wood', 'H5 导出后主题仍为 wood');
// 4. 失败释放锁
const f = await p.evaluate(async () => { const o = __ae.exportZip; __ae.exportZip = async () => { throw new Error('模拟失败'); }; let e = ''; try { await __aeExport(); } catch (x) { e = x.message; } __ae.exportZip = o; return { e, busy: __exportBusy(), theme: __S().theme, live: __theme().id }; });
ok(f.e === '模拟失败' && f.busy === null, '导出失败抛出错误并释放锁');
ok(f.theme === 'wood' && f.live === 'wood', '失败后主题仍还原');
// 5. 导出中禁止切主题
const t = await p.evaluate(async () => { const pr = __aeExport(); document.querySelector('.theme-card[data-theme="candy"]').click(); await pr; await new Promise(r => setTimeout(r, 300)); return __S().theme; });
ok(t === 'wood', '导出期间点击主题卡被拦截，导出后仍为 wood (' + t + ')');
ok(errs.length === 0, '无页面错误 ' + errs.slice(0, 2).join('|')); await b.close(); done('exportflow');
