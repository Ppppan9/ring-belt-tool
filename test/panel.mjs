import { open, ok, done, ROOT } from './_page.mjs'; import path from 'path';
const { b, p, errs } = await open();
const sw = await p.evaluate(() => { const a = [...document.querySelectorAll('#panelBody input[data-key]')].filter(i => i.type === 'checkbox'); return { n: a.length, bad: a.filter(i => i.getAttribute('role') !== 'switch' || i.getAttribute('aria-checked') !== String(i.checked) || !i.closest('.switch')).length }; });
ok(sw.n > 0 && sw.bad === 0, `所有布尔项为 role=switch 滑动开关（${sw.n} 个）`);
// 点击开关：设置值 + aria-checked 同步
const r = await p.evaluate(async () => { const i = [...document.querySelectorAll('#panelBody details[open] .switch-input')][0]; const k = i.dataset.key, v0 = i.checked; i.click(); await new Promise(r => setTimeout(r, 50)); const res = { k, v0, v1: i.checked, aria: i.getAttribute('aria-checked') }; i.click(); return res; });
ok(r.v1 === !r.v0 && r.aria === String(r.v1), `点击开关切换 ${r.k} 且 aria-checked 同步`);
// 手风琴：点开 → 高度动画 → open；再点 → 收起
const sel = '#panelBody > details:not([open]):not(#advSettings) > summary';
const idx = await p.evaluate(s => { const su = document.querySelector(s); return [...document.querySelectorAll('#panelBody > details')].indexOf(su.parentElement); }, sel);
await p.click(sel); await p.waitForTimeout(80);
const mid = await p.evaluate(i => { const d = document.querySelectorAll('#panelBody > details')[i]; return { open: d.open, h: d.querySelector('.sec-body').getBoundingClientRect().height }; }, idx);
await p.waitForTimeout(500);
const end = await p.evaluate(i => { const d = document.querySelectorAll('#panelBody > details')[i]; const bd = d.querySelector('.sec-body'); return { open: d.open, h: bd.getBoundingClientRect().height, op: getComputedStyle(bd).opacity }; }, idx);
ok(mid.open && mid.h < end.h && end.h > 20 && end.op === '1', `手风琴展开带高度动画（${mid.h.toFixed(0)}→${end.h.toFixed(0)}px）`);
await p.click(`#panelBody > details:nth-of-type(${idx + 1}) > summary`); await p.waitForTimeout(500);
ok(await p.evaluate(i => !document.querySelectorAll('#panelBody > details')[i].open, idx), '再次点击收起');
ok(await p.evaluate(() => { const l = document.querySelector('#panelBody > details:last-of-type'); return l.id === 'advSettings' && !l.open; }), '#advSettings 仍为最后且默认收起');
// 主题卡片
const th = await p.evaluate(async () => { const c = document.querySelector('.theme-card:not(.on)'); c.click(); await new Promise(r => setTimeout(r, 50)); return { want: c.dataset.theme, got: document.querySelector('select[data-key=theme]').value, on: c.classList.contains('on') }; });
ok(th.want === th.got && th.on, `主题卡片切换到 ${th.got}`);
ok(errs.length === 0, '无页面错误 ' + errs.join('|'));
// 截图：全部展开（含高级）
await p.evaluate(() => { __setSettings({ theme: 'jade' }); document.querySelectorAll('#panelBody details').forEach(d => d.open = true); });
await p.waitForTimeout(300);
const ph = await p.evaluate(() => document.getElementById('panelBody').scrollHeight + document.getElementById('panelHead').offsetHeight + 40);
await p.setViewportSize({ width: 1400, height: Math.min(ph, 7000) }); await p.waitForTimeout(400);
await p.locator('#panel').screenshot({ path: path.join(ROOT, 'screenshots/panel_phase8.png') });
await p.setViewportSize({ width: 1400, height: 1000 }); await p.waitForTimeout(300);
await p.locator('#panel').screenshot({ path: path.join(ROOT, 'screenshots/panel_phase8_view.png') });
await b.close(); done('panel');
