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
fs.copyFileSync(z, '/workspace/ring-belt/screenshots/ring_belt_ae_sample.zip');
ok(errs.length === 0, 'no console errors'); await b.close(); done('test:ae');
