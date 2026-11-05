import { open, ok, done, saveDownload, ROOT } from './_page.mjs'; import fs from 'fs'; import { execSync } from 'child_process'; import validator from 'gltf-validator'; import { chromium } from 'playwright';
// 1) 导出：原版主题 L2（原有用例）+ 玉石主题 L1
async function exportFor(theme, lv, out) {
  const { b, p, errs } = await open(); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
  await p.evaluate(([th, lv]) => { __setSettings({ loopLevels: false, theme: th }); __game.loadLevel(lv); __aeStart(); }, [theme, lv]); await p.evaluate(() => __auto(true));
  for (let i = 0; i < 60 && !(await p.evaluate(() => __game.state === 'lc' && __game.lcT > 2)); i++) await p.evaluate(() => __step(50));
  const z = await saveDownload(p, async () => { __aeStop(); await __export3d(); }, out); ok(/ring-belt_3d_export_/.test(z), `[${theme}] zip ` + z.split('/').pop());
  execSync(`cd ${out} && python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall('x')" "${z}"`);
  ok(errs.length === 0, `[${theme}] no console errors ` + errs.slice(0, 2).join('|')); await b.close(); return z;
}
const OUT = { default: '/tmp/rb_3d', jade: '/tmp/rb_3d_jade' };
const z = await exportFor('default', 1, OUT.default); await exportFor('jade', 0, OUT.jade);
const out = OUT.default;
const ls = execSync(`cd ${out}/x && find . -type f | sort`).toString(); console.log(ls.split('\n').slice(0, 12).join(' '));
for (const n of ['scene3d.json', 'README_3D.md', 'blender_import.py', 'timeline.json']) ok(fs.existsSync(`${out}/x/${n}`), 'has ' + n);
ok(/audio\//.test(ls), 'has audio'); ok(fs.existsSync(`${out}/x/scene.glb`), 'has glb');
const J = JSON.parse(fs.readFileSync(`${out}/x/scene3d.json`, 'utf8')); ok(J.format === 'export3d/1' && J.tool === 'ring-belt', 'scene3d meta');
const gltfJson = f => { const g = fs.readFileSync(f); const jl = g.readUInt32LE(12); return JSON.parse(g.slice(20, 20 + jl).toString()); };
for (const th of ['default', 'jade']) {
  const f = `${OUT[th]}/x/scene.glb`, rep = await validator.validateBytes(new Uint8Array(fs.readFileSync(f))); ok(rep.issues.numErrors === 0, `[${th}] gltf-validator errors=${rep.issues.numErrors} warn=${rep.issues.numWarnings}`);
  const gj = gltfJson(f), mats = gj.materials.map(m => m.name || '');
  ok(mats.some(n => /^mat_ring_/.test(n)) && gj.nodes.some(n => /_Ring_/.test(n.name || '')), `[${th}] torus meshes (mat_ring_*)`); ok(mats.some(n => /^mat_ball_/.test(n)), `[${th}] sphere meshes (mat_ball_*)`);
  ok(mats.some(n => /^mat_clip_/.test(n)), `[${th}] clip meshes (mat_clip_*)`);
  ok(gj.nodes.some(n => n.name === 'camera_ortho_topdown') && gj.nodes.some(n => /_vis$/.test(n.name || '')), `[${th}] 层级：相机 + *_vis 显隐父节点`);
  if (th === 'jade') {
    const used = gj.extensionsUsed || []; ok(['KHR_materials_transmission', 'KHR_materials_ior', 'KHR_materials_volume', 'KHR_materials_clearcoat'].every(e => used.includes(e)), `[jade] PBR 扩展 ${used.join(',')}`);
    const jr = gj.materials.find(m => /^mat_ring_/.test(m.name) && m.extensions?.KHR_materials_transmission); ok(jr && jr.pbrMetallicRoughness.baseColorTexture, '[jade] 玉环：透射 + baseColorTexture');
    ok(gj.materials.some(m => /^mat_(ring|clip)_/.test(m.name) && m.pbrMetallicRoughness.metallicFactor === 1), '[jade] 金/银：metallic=1');
  }
}
// 2) three.js 渲染：加载 glb，检查几何比例/材质，非空渲染，存截图
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const BUNDLE = '/tmp/three_render.js'; execSync(`npx esbuild ${ROOT}/test/three/render.js --bundle --outfile=${BUNDLE} --log-level=warning`, { cwd: ROOT });
for (const th of ['jade', 'default']) {
  const pg = await br.newPage({ viewport: { width: 900, height: 1100 } }); const perr = []; pg.on('pageerror', e => perr.push(e.message));
  await pg.setContent('<body style="margin:0"></body>'); await pg.addScriptTag({ path: BUNDLE });
  const info = await pg.evaluate(b64 => renderGLB(b64, 1.0), fs.readFileSync(`${OUT[th]}/x/scene.glb`).toString('base64'));
  ok(perr.length === 0, `[three ${th}] 加载无错误 ${perr[0] || ''}`);
  ok(info.rings.length > 0 && info.balls > 0 && info.clips > 0, `[three ${th}] 可见网格 rings=${info.rings.length} balls=${info.balls} clips=${info.clips}`);
  const rr = info.rings.map(r => r.h / r.w); // 管径/环外径：2D 视觉 tubeHalf=0.205R → h/w ≈ 2·0.205R/(2R+0.41R) ≈ 0.17
  ok(rr.every(x => x > 0.12 && x < 0.24), `[three ${th}] 环管粗细比例 ${rr.map(x => x.toFixed(3)).join(',')}`);
  if (th === 'jade') { const jm = Object.entries(info.mats).filter(([n, m]) => /^mat_ring_/.test(n) && m.transmission > 0); ok(jm.length && jm.every(([, m]) => m.type === 'MeshPhysicalMaterial' && m.map && m.clearcoat > 0), '[three jade] MeshPhysicalMaterial(transmission+clearcoat+map)'); }
  ok(info.nonBg > 0.02, `[three ${th}] 非空渲染 ${(info.nonBg * 100).toFixed(1)}%`);
  await pg.locator('canvas').screenshot({ path: `${ROOT}/screenshots/three_${th}_L${th === 'jade' ? 1 : 2}.png` }); await pg.close();
}
await br.close();
fs.copyFileSync(z, '/workspace/ring-belt/screenshots/ring_belt_3d_sample.zip');
ok(fs.existsSync(`${out}/x/scene.fbx`) || /fbx/i.test(fs.readFileSync(`${out}/x/README_3D.md`, 'utf8')), 'fbx (or documented Blender path)');
done('test:3d');
