// phase13：玉石主题 —— 阻隔板(盘框/漏斗分隔板)渲染 + 带面调色/上传 + 设置 v7 迁移 + AE/3D/H5 导出一致
import { open, ok, done, saveDownload } from './_page.mjs'; import fs from 'fs'; import { execSync } from 'child_process'; import { chromium } from 'playwright';
const out = '/tmp/rb_belt'; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
const py = (code, ...a) => execSync(`python3 -c ${JSON.stringify(code)} ${a.map(x => JSON.stringify(x)).join(' ')}`).toString().trim();
const unzip = (z, d) => execSync(`python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "${z}" "${d}"`);
const { b, p, errs } = await open('?det&seed=3');
// 1. 阻隔板：玉石主题下 漏斗分隔板 / 左右盘框 必须画出（不透明薄荷玉，而不是背景透出）
const WALL_PTS = [[300, 1165], [560, 1165], [8, 600], [856, 600], [8, 1500]];
const wallPx = () => p.evaluate(pts => { const c = __bg(), g = c.getContext('2d'); return pts.map(([x, y]) => [...g.getImageData(x, y, 1, 1).data]); }, WALL_PTS);
await p.evaluate(() => { __setSettings({ theme: 'jade' }); __game.loadLevel(0); __step(5); });
for (const lv of [1, 5, 12, 20]) {
  await p.evaluate(l => { __game.loadLevel(l - 1); __step(5); }, lv);
  const px = await wallPx(); ok(px.every(([r, g, b2, a]) => a === 255 && g > 120 && g > r && g >= b2 - 10), `L${lv} 玉石阻隔板可见 (${px.map(v => v.slice(0, 3).join(',')).join(' | ')})`);
}
// 板必须与盘面有明显区别（不能是透明/同色）
const contrast = await p.evaluate(() => { const g = __bg().getContext('2d'), a = g.getImageData(300, 1165, 1, 1).data, c = g.getImageData(300, 1080, 1, 1).data; return Math.abs(a[0] - c[0]) + Math.abs(a[1] - c[1]) + Math.abs(a[2] - c[2]); });
ok(contrast > 25, `阻隔板与盘面可区分 Δ=${contrast}`);
ok((await p.evaluate(() => __spriteKeys())).includes('jade:background'), '背景(含阻隔板)以 jade:background 精灵进入 AE/3D 管线');
// 2. 面板滑块：存在、实时预览、持久化
for (const k of ['beltFaceBright', 'beltFaceSat', 'beltFaceHue', 'beltFaceContrast']) ok(await p.evaluate(k => !!document.querySelector(`input[type=range][data-key="${k}"]`), k), `面板滑块 ${k}`);
ok(await p.evaluate(() => !!document.querySelector('[data-key="beltFaceImage"]')), '面板上传 beltFaceImage');
const avg0 = await p.evaluate(() => __beltAvg());
const setRange = (k, v) => p.evaluate(([k, v]) => { const r = document.querySelector(`input[type=range][data-key="${k}"]`); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }, [k, v]);
await setRange('beltFaceHue', 150); await p.waitForTimeout(300);
const avgH = await p.evaluate(() => __beltAvg()); ok(avgH && avgH.reduce((a, v, i) => a + Math.abs(v - avg0[i]), 0) > 40, /* phase19：带面改紫玉，改为与主题无关的色相变化量判定 */ `色相 150° 实时生效 ${avg0} → ${avgH}`);
await setRange('beltFaceHue', 0); await setRange('beltFaceBright', 1.8); await p.waitForTimeout(300);
const avgB = await p.evaluate(() => __beltAvg()); ok(avgB[1] > avg0[1] * 1.25, `明度 1.8 ${avg0} → ${avgB}`);
await setRange('beltFaceBright', 1); await setRange('beltFaceSat', 0); await p.waitForTimeout(300);
const avgS = await p.evaluate(() => __beltAvg()); ok(Math.max(...avgS) - Math.min(...avgS) < 8, `饱和度 0 → 灰 ${avgS}`);
await setRange('beltFaceSat', 1); await setRange('beltFaceContrast', 2); await p.waitForTimeout(300);
const avgC = await p.evaluate(() => __beltAvg()); ok(avgC.join() !== avg0.join(), `对比度 2 改变带面 ${avgC}`);
await p.evaluate(() => document.querySelector('#btn_beltFaceReset')?.click() || __setSettings({ beltFaceBright: 1, beltFaceSat: 1, beltFaceHue: 0, beltFaceContrast: 1 })); await p.waitForTimeout(300);
const avgR = await p.evaluate(() => __beltAvg()); ok(avgR.every((v, i) => Math.abs(v - avg0[i]) <= 2), `恢复默认 ${avgR}`);
// 3. 上传图片（大 PNG → 自动缩放，dataURL < 180000 保证 H5 打包保留）
py(`from PIL import Image,ImageDraw;im=Image.new('RGB',(2400,600),(200,30,40));d=ImageDraw.Draw(im);[d.rectangle([x,0,x+80,600],fill=(240,200,40)) for x in range(0,2400,240)];im.save('${out}/up.png')`);
await p.locator('[data-key="beltFaceImage"] input[type=file], input[type=file][data-key="beltFaceImage"]').first().setInputFiles(out + '/up.png');
await p.waitForFunction(() => (__S().beltFaceImage || '').startsWith('data:'), null, { timeout: 10000 }); await p.waitForTimeout(600);
const len = await p.evaluate(() => __S().beltFaceImage.length); ok(len < 180000, `上传图已缩放 dataURL ${len} 字符`);
const avgU = await p.evaluate(() => __beltAvg()); ok(avgU[0] > avgU[1] && avgU[0] > 120, `带面替换为上传图 ${avgU}`);
await setRange('beltFaceHue', 120); await p.waitForTimeout(400);
const avgUH = await p.evaluate(() => __beltAvg()); ok(avgUH[0] < avgU[0] - 30, `上传图同样受色相调整 ${avgUH}`);
// 4. 持久化 + v7
const st = await p.evaluate(() => JSON.parse(localStorage.getItem('ring-belt-settings'))); ok(st.version === 8 && st.settings.beltFaceHue === 120 && st.settings.beltFaceImage.startsWith('data:'), '设置 v8 持久化');
await p.reload(); await p.waitForFunction(() => window.__ready); await p.waitForTimeout(500);
ok((await p.evaluate(() => __beltAvg())).join() === avgUH.join(), '刷新后带面一致');
// 5. 导出一致：AE / 3D 背景贴图 与 页面带面同色；H5 内页面带面同色
const ref = await p.evaluate(() => __beltAvg()), R = await p.evaluate(() => __beltRect());
const imgAvg = f => JSON.parse(py(`import sys,json;from PIL import Image;im=Image.open(sys.argv[1]).convert('RGB');s=im.width/864;x,y,w,h=[float(v)*s for v in sys.argv[2:6]];c=im.crop((int(x+w*0.2),int(y+h*0.1),int(x+w*0.2)+int(w*0.6),int(y+h*0.1)+int(h*0.25)));px=list(c.getdata());print(json.dumps([round(sum(p[i] for p in px)/len(px)) for i in range(3)]))`, f, R.x, R.y, R.w, R.h));
const wallOk = f => +py(`import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert('RGBA');s=im.width/864;p=im.getpixel((int(300*s),int(1165*s)));q=im.getpixel((int(300*s),int(1080*s)));print(1 if p[3]>250 and p[1]>120 and sum(abs(p[i]-q[i]) for i in range(3))>25 else 0)`, f) === 1;
await p.evaluate(() => { __game.loadLevel(0); __aeStart(); __step(60); });
const za = await saveDownload(p, async () => { __aeStop(); await __aeExport(); }, out); unzip(za, out + '/ae');
const bgA = execSync(`find ${out}/ae -iname '*background*.png' | head -1`).toString().trim(); ok(!!bgA, 'AE 背景贴图 ' + bgA.replace(out, ''));
if (bgA) { const a = imgAvg(bgA); ok(a.every((v, i) => Math.abs(v - ref[i]) <= 4), `AE 带面一致 ${a} vs ${ref}`); ok(wallOk(bgA), 'AE 背景含玉石阻隔板'); }
await p.evaluate(() => { __aeStart(); __step(60); __aeStop(); });
const z3 = await saveDownload(p, () => __export3d(), out); let bg3 = '';
if (/\.zip$/.test(z3)) { unzip(z3, out + '/3d'); bg3 = execSync(`python3 test/glb_bg.py ${out}/3d/scene.glb ${out}/bg3.png`).toString().trim(); }
ok(!!bg3, '3D 背景贴图 ' + bg3.replace(out, '')); if (bg3) { const a = imgAvg(bg3); ok(a.every((v, i) => Math.abs(v - ref[i]) <= 4), `3D 带面一致 ${a}`); ok(wallOk(bg3), '3D 背景含玉石阻隔板'); }
// H5 导出需读取工具自身 HTML → 用 http 打开（同一 localStorage 设置不共享，故直接写入当前设置）
const { spawn } = await import('child_process'); const srv = spawn('python3', ['-m', 'http.server', '8799', '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
const curS = await p.evaluate(() => JSON.stringify(__S())); await p.goto('http://127.0.0.1:8799/index.html?det&seed=3'); await p.waitForFunction(() => window.__ready);
await p.evaluate(s => __setSettings(JSON.parse(s)), curS); await p.waitForTimeout(800);
const zh = await saveDownload(p, () => __exportH5(), out); srv.kill(); unzip(zh, out + '/h5');
const hf = execSync(`find ${out}/h5 -name '*.html' | head -1`).toString().trim(); ok(!!hf, 'H5 html ' + hf.replace(out, ''));
if (hf) { const b2 = await chromium.launch(); const q = await (await b2.newContext({ viewport: { width: 720, height: 1280 } })).newPage(); await q.goto('file://' + hf); await q.waitForFunction(() => window.__ready, null, { timeout: 30000 }); await q.waitForTimeout(800);
  const h = await q.evaluate(() => [__S().theme, __beltAvg(), [...__bg().getContext('2d').getImageData(300, 1165, 1, 1).data]]); ok(h[0] === 'jade' && h[1].every((v, i) => Math.abs(v - ref[i]) <= 4), `H5 玉石 + 带面一致 ${h[1]}`); ok(h[2][3] === 255 && h[2][1] > 120, 'H5 阻隔板可见 ' + h[2]); await b2.close(); }
ok(errs.length === 0, '无页面错误 ' + errs.slice(0, 3).join(' | ')); await b.close(); done('test:belt');
