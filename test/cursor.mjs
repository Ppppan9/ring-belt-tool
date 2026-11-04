import { open, ok, done } from './_page.mjs'; import fs from 'fs'; import os from 'os'; import path from 'path';
const { b, p, errs } = await open('?det&seed=3');
const cur = () => p.evaluate(() => document.getElementById('stage').style.cursor);
const box = await p.locator('#stage').boundingBox();
await p.evaluate(() => __setSettings({ manualHand: true, hideCursor: true }));
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.evaluate(() => __step(3));
ok(await cur() === 'none', 'manualHand+hideCursor: cursor none when hand visible');
ok(await p.evaluate(() => __items().some(i => i.id === 'hand')), 'hand item drawn');
await p.evaluate(() => __setSettings({ hideCursor: false })); await p.mouse.move(box.x + box.width / 2 + 5, box.y + box.height / 2); await p.evaluate(() => __step(2));
ok(await cur() === 'pointer', 'hideCursor=false → pointer');
await p.evaluate(() => __setSettings({ hideCursor: true, manualHand: false })); await p.mouse.move(box.x + 10, box.y + 10); await p.evaluate(() => __step(2));
ok(await cur() === 'pointer', 'manualHand=false → pointer, no hand');
await p.evaluate(() => __auto(true)); await p.evaluate(() => __step(80));
ok(await cur() === 'none', 'autoplay: hand visible → cursor none');
await p.evaluate(() => __auto(false)); await p.evaluate(() => __step(2));
ok(await cur() === 'pointer', 'autoplay stop → pointer');
const d = await p.evaluate(() => ({ h: __S().handSize, ax: __S().handAnchorX, img: __S().handImage.slice(0, 22) }));
ok(d.h === 0.42 && d.img.startsWith('data:image'), 'default hand = shared DEFAULT_HAND, size 0.42');
// export / import / migrate
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rb'));
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btnExport')]); const f = path.join(tmp, dl.suggestedFilename()); await dl.saveAs(f);
const J = JSON.parse(fs.readFileSync(f, 'utf8')); ok(J.app === 'ring-belt' && J.version === 4 && J.settings.theme === 'default' && J.settings && 'hideCursor' in J.settings && J.settings.unlockMargin === 3, 'export {app,version,settings}');
const old = { app: 'ring-belt', version: 1, settings: { handImage: '__default__', handSize: 0.2, handAnchorX: 0.3, handAnchorY: 0.03, h5GameName: '圆环传送带', autoSpeed: 1.7 } };
fs.writeFileSync(path.join(tmp, 'old.json'), JSON.stringify(old)); await p.setInputFiles('#importFile', path.join(tmp, 'old.json')); await p.waitForTimeout(500);
const m = await p.evaluate(() => { const S = __S(); return { h: S.handSize, ax: S.handAnchorX, n: S.h5GameName, a: S.autoSpeed, img: S.handImage.slice(0, 10) }; });
ok(m.h === 0.42 && m.ax === 0.2204 && m.n === '解环传送带' && m.a === 1.7 && m.img === 'data:image', 'migrate v1 → v2 (旧默认值替换，自定义保留) ' + JSON.stringify(m));
const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#btnShot')]); ok(/\.png$/.test(dl2.suggestedFilename()), 'screenshot download');
// button order
const order = await p.evaluate(() => [...document.querySelectorAll('#panelHead button')].map(b => b.id)); ok(order.join() === 'btnAuto,btnRec,btnRestart,btnNew,btnNext,btnShot,btnExport,btnImport,btnReset', 'button order');
ok(errs.length === 0, 'no console errors ' + errs.slice(0, 3).join('|'));
await b.close();
// recording in real time (non-det)
{ const { b, p, errs } = await open('?seed=4'); await p.evaluate(() => { __S().recFormat = 'webm'; });
  const dlP = p.waitForEvent('download', { timeout: 30000 }); await p.click('#btnRec'); await p.waitForTimeout(2500); await p.click('#btnRec'); const dl = await dlP;
  const fp = path.join(tmp, dl.suggestedFilename()); await dl.saveAs(fp); const sz = fs.statSync(fp).size; ok(sz > 10000, `recording ${dl.suggestedFilename()} ${sz}B`); ok(errs.length === 0, 'rec no errors'); await b.close(); }
done('test:cursor');
