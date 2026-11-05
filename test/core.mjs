import { open, ok, done } from './_page.mjs';
const { b, p, errs } = await open();
const ids = await p.evaluate(() => ['app', 'stageWrap', 'stage', 'panel', 'panelHead', 'panelBody', 'toast', 'status'].filter(i => !document.getElementById(i))); ok(ids.length === 0, 'DOM ids ' + ids);
ok(await p.evaluate(() => document.title.includes('解环传送带')), 'title');
const groups = await p.evaluate(() => [...document.querySelectorAll('#panelBody summary')].map(s => s.textContent)); console.log('  groups', groups.join(' / '));
const gi = n => groups.findIndex(g => g.includes(n)); ok(gi('音效') < gi('手指') && gi('手指') < gi('录制') && gi('录制') < gi('AE') && gi('AE') < gi('3D') && gi('3D') < gi('H5') && gi('H5') < gi('结束'), 'group order');
ok(await p.evaluate(() => typeof __game.time === 'number'), 'game clock');
// Phase 7：高级设置折叠
const adv = await p.evaluate(() => { const d = document.getElementById('advSettings'); return d && { open: d.open, last: d === document.getElementById('panelBody').lastElementChild, keys: [...d.querySelectorAll('[data-key]')].map(e => e.dataset.key) }; });
ok(adv && !adv.open && adv.last, 'advanced fold exists, closed, last');
ok(adv && ['gravity', 'bounce', 'levelsJson', 'colorMap'].every(k => adv.keys.includes(k)), 'advanced fold contains rare keys');
ok(adv && !['canvasW', 'canvasH', 'beltSpeed', 'startLevel', 'theme'].some(k => adv.keys.includes(k)), 'anim/export keys stay outside');
const gs = await p.evaluate(() => [...document.querySelectorAll('#panelBody > details > summary')].map(s => s.textContent));
ok(gs[0].includes('主题') && gs.findIndex(g => g.includes('主题')) < gs.findIndex(g => g.includes('关卡与玩法')), 'theme section above 关卡与玩法');
// Phase 7：主题切换
const th = await p.evaluate(() => { const bg0 = document.getElementById('stage').toDataURL().length; __setSettings({ theme: 'jade' }); __step(2); const keys = __spriteKeys(); const bg1 = document.getElementById('stage').toDataURL().length; const saved = JSON.stringify(localStorage).includes('jade'); __setSettings({ theme: 'default' }); __step(2); return { bg0, bg1, saved, pref: keys.some(k => k.startsWith('jade:')) }; });
ok(th.saved, 'theme persisted'); ok(th.pref, 'jade sprite keys prefixed'); ok(th.bg0 !== th.bg1, 'theme changes frame');
const mg = await p.evaluate(() => [__migrate({ version: 7, settings: { theme: 'realistic' } }).theme, __migrate({ version: 7, settings: { theme: 'jade' } }).theme]); ok(mg[0] === 'default' && mg[1] === 'jade', '旧存档超写实主题回落原版、玉石保留 ' + mg);
ok(errs.length === 0, 'no errors'); await b.close(); done('test');
