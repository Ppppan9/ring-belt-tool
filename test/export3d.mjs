import { open, ok, done, runAuto, saveDownload } from './_page.mjs'; import fs from 'fs'; import { execSync } from 'child_process'; import validator from 'gltf-validator';
const { b, p, errs } = await open(); const out = '/tmp/rb_3d'; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
await p.evaluate(() => { __setSettings({ loopLevels: false }); __game.loadLevel(1); __aeStart(); }); await p.evaluate(() => __auto(true));
for (let i = 0; i < 60 && !(await p.evaluate(() => __game.state === 'lc' && __game.lcT > 2)); i++) await p.evaluate(() => __step(50));
const z = await saveDownload(p, async () => { __aeStop(); await __export3d(); }, out); ok(/ring-belt_3d_export_/.test(z), 'zip ' + z);
execSync(`cd ${out} && python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall('x')" "${z}"`);
const ls = execSync(`cd ${out}/x && find . -type f | sort`).toString(); console.log(ls.split('\n').slice(0, 12).join(' '));
for (const n of ['scene3d.json', 'README_3D.md', 'blender_import.py', 'timeline.json']) ok(fs.existsSync(`${out}/x/${n}`), 'has ' + n);
ok(/audio\//.test(ls), 'has audio'); const glb = ls.split('\n').find(l => l.endsWith('.glb')); ok(!!glb, 'has glb');
const J = JSON.parse(fs.readFileSync(`${out}/x/scene3d.json`, 'utf8')); ok(J.format === 'export3d/1' && J.tool === 'ring-belt', 'scene3d meta');
const rep = await validator.validateBytes(new Uint8Array(fs.readFileSync(`${out}/x/${glb}`))); ok(rep.issues.numErrors === 0, `gltf-validator errors=${rep.issues.numErrors} warn=${rep.issues.numWarnings}`);
const info = rep.info || {}; console.log('  glb', JSON.stringify({ meshes: info.meshCount, anim: info.animationCount, nodes: info.nodeCount }));
// torus/sphere present
const g = fs.readFileSync(`${out}/x/${glb}`); const jl = g.readUInt32LE(12); const gj = JSON.parse(g.slice(20, 20 + jl).toString());
const mats = gj.materials.map(m => m.name || ''); ok(mats.some(n => /^mat_ring_/.test(n)) && gj.nodes.some(n => /_Ring_/.test(n.name || '')), 'torus meshes (mat_ring_*)'); ok(mats.some(n => /^mat_ball_/.test(n)), 'sphere meshes (mat_ball_*)');
ok(fs.existsSync(`${out}/x/scene.fbx`) || /fbx/i.test(fs.readFileSync(`${out}/x/README_3D.md`, 'utf8')), 'fbx (or documented Blender path)');
fs.copyFileSync(z, '/workspace/ring-belt/screenshots/ring_belt_3d_sample.zip');
ok(errs.length === 0, 'no console errors'); await b.close(); done('test:3d');
