import { open, ok, done, runAuto, saveDownload } from './_page.mjs'; import { runMock } from './ae-mock.mjs'; import fs from 'fs'; import { execSync } from 'child_process';
const { b, p, errs } = await open(); const out = '/tmp/rb_ae'; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
await p.evaluate(() => { __game.loadLevel(3); __aeStart(); }); ok(await runAuto(p, 120), 'L4–L5 auto to end');
const z = await saveDownload(p, async () => { __aeStop(); await __aeExport(); }, out); ok(/ring-belt_ae_export_\d+_\d+\.zip$/.test(z), 'zip name ' + z);
execSync(`cd ${out} && python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall('x')" "${z}"`);
const TL = JSON.parse(fs.readFileSync(out + '/x/timeline.json', 'utf8'));
ok(TL.comps.some(c => c.name === '主合成_解环传送带'), 'main comp zh'); ok(TL.meta.tool === 'ring-belt' || JSON.stringify(TL.meta).includes('ring-belt'), 'tool id');
for (const n of ['build_ae_project.jsx', 'README_AE.md', 'audio/mix.wav']) ok(fs.existsSync(out + '/x/' + n), 'has ' + n);
const names = TL.comps.flatMap(c => c.layers.map(l => l.name)); for (const k of ['圆环', '球', '盒子', '传送带凹槽']) ok(names.some(n => n.includes(k)), 'layer name ' + k);
const r = runMock(out + '/x'); ok(r.errs.length === 0, `ae-mock (ES3 + AE 约束): layers ${r.stats?.layers} keys ${r.stats?.keys} ${r.errs.slice(0, 3).join('|')}`);
// en names
const z2 = await saveDownload(p, async () => { await __aeExport(undefined, { ...__S(), aeNames: 'en' }); }, out + '');
fs.rmSync(out + '/y', { recursive: true, force: true }); execSync(`cd ${out} && python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall('y')" "${z2}"`);
const T2 = JSON.parse(fs.readFileSync(out + '/y/timeline.json', 'utf8')); ok(T2.comps.some(c => c.name === 'Main_RingBelt'), 'main comp en'); ok(runMock(out + '/y').errs.length === 0, 'ae-mock en');

// ===== 发生在真实 AE 里的常见报错点（静态审计）=====
function audit(dir, tag) {
  const jsx = fs.readFileSync(dir + '/build_ae_project.jsx', 'utf8');
  ok(/^[\x00-\x7f]*$/.test(jsx), `${tag} jsx 纯 ASCII（中文转 \\uXXXX，避免 GBK 区域下解码出错）`);
  const code = jsx.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/"(?:[^"\\]|\\.)*"/g, '""');
  const bad = [/\bconst\b/, /\blet\b/, /=>/, /\bJSON\./, /\.forEach\(/, /\.map\(/, /\.filter\(/, /\.indexOf\(/, /Object\.keys/, /,\s*[\]}]/, /`/].filter(r => r.test(code));
  ok(bad.length === 0, `${tag} jsx 无 ES5+ 写法 ${bad.join(' ')}`);
  const TL = JSON.parse(fs.readFileSync(dir + '/timeline.json', 'utf8'));
  const badF = TL.assets.filter(a => !/^(assets|audio)\/[A-Za-z0-9._-]+$/.test(a.file)), miss = TL.assets.filter(a => !fs.existsSync(dir + '/' + a.file));
  ok(badF.length === 0, `${tag} 素材文件名仅 ASCII 安全字符 ${badF.slice(0, 3).map(a => a.file).join('|')}`);
  ok(miss.length === 0, `${tag} 素材全部存在 (${TL.assets.length}) ${miss.slice(0, 3).map(a => a.file).join('|')}`);
  const lower = TL.assets.map(a => a.file.toLowerCase()); ok(new Set(lower).size === lower.length, `${tag} 素材文件名大小写不冲突`);
  for (const c of TL.comps) {
    ok(c.w >= 4 && c.h >= 4 && c.w <= 30000 && c.h <= 30000 && c.duration > 0 && c.duration <= 10800 && c.fps >= 1 && c.fps <= 99, `${tag} 合成 ${c.name} 尺寸/时长/帧率 ${c.w}x${c.h} ${c.duration}s ${c.fps}fps`);
    const ns = c.layers.map(l => l.name), dup = ns.filter((n, i) => ns.indexOf(n) !== i); ok(dup.length === 0, `${tag} 合成 ${c.name} 图层名唯一 (${ns.length}) ${dup.slice(0, 3).join('|')}`);
  }
  ok(!JSON.stringify(TL).includes('expression'), `${tag} 不使用表达式（无表达式引擎兼容问题）`);
  const r = runMock(dir); ok(r.errs.length === 0, `${tag} ae-mock ${r.stats?.layers} layers ${r.errs.slice(0, 3).join('|')}`);
}
audit(out + '/x', 'zh'); audit(out + '/y', 'en');
for (const th of ['default', 'jade', 'wood', 'candy']) {
  await p.evaluate(t => document.querySelector(`.theme-card[data-theme="${t}"]`).click(), th);
  for (let i = 0; i < 900 && await p.evaluate(() => __themeBusy && __themeBusy()); i++) await p.evaluate(() => __step(50));
  await p.evaluate(() => { __game.loadLevel(0); __aeStart(); }); await runAuto(p, 60);
  const zt = await saveDownload(p, async () => { __aeStop(); await __aeExport(); }, out); const d = `${out}/t_${th}`; fs.rmSync(d, { recursive: true, force: true });
  execSync(`cd ${out} && python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "${zt}" t_${th}`);
  audit(d, th);
}
fs.copyFileSync(z, '/workspace/ring-belt/screenshots/ring_belt_ae_sample.zip');
ok(errs.length === 0, 'no console errors'); await b.close(); done('test:ae');
