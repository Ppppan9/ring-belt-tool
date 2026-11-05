// 玉石主题 + 夹扣颈部可见性
import { open, ok, done } from './_page.mjs';
const { b, p, errs } = await open('?det&seed=3');
const nLv = await p.evaluate(() => (window.__levels || __game.levels || []).length || 20);
// 1. 颈部：所有主题、所有关卡，每个夹扣颈部可见长度 > 0（且 ≥ CLIP_NECK_LEN-0.01）
for (const t of ['default', 'jade', 'wood', 'candy']) {
  const r = await p.evaluate(([t, n]) => { __setSettings({ theme: t }); const lvls = [...Array(n).keys(), 'L20']; let bad = [], cnt = 0, min = 1e9; for (const i of lvls) { if (i === 'L20') __game.loadLevel(19); else __game.loadLevel(i); __step(2); for (const c of __clipNecks()) { cnt++; min = Math.min(min, c.neck); if (!(c.neck >= 9.99) || !(c.centerErr >= 0 && c.centerErr <= 1)) bad.push(`L${i + 1}#${c.id}:neck${c.neck.toFixed(1)}/err${c.centerErr.toFixed(2)}`); } } return { bad, cnt, min }; }, [t, nLv]);
  ok(r.cnt > 0 && r.bad.length === 0 && r.min >= 9.99, `${t}: ${r.cnt} 个夹扣夹块居中于子环中心线(±1px)且颈部≥10 (min ${r.min.toFixed(1)}) ${r.bad.slice(0, 5).join(' ')}`);
}
// 2. 玉石：卡片、切换、持久化、精灵前缀
const card = await p.evaluate(() => !!document.querySelector('.theme-card[data-theme="jade"]'));
ok(card, '主题卡片 玉石 存在');
await p.evaluate(async () => { document.querySelector('.theme-card[data-theme="jade"]').click(); await new Promise(r => setTimeout(r, 80)); __game.loadLevel(0); __step(20); });
ok(await p.evaluate(() => document.querySelector('.theme-card.on')?.dataset.theme === 'jade'), '切换后设置为 jade');
const ls = await p.evaluate(() => JSON.stringify(localStorage));
ok(ls.includes('jade'), 'localStorage 持久化');
const keys = await p.evaluate(() => __spriteKeys());
ok(keys.some(k => /^jade:/.test(k)), `精灵使用主题前缀 (${keys.length} keys)`);
await p.reload(); await p.waitForFunction(() => window.__ready);
ok(await p.evaluate(() => JSON.stringify(localStorage).includes('jade')), '刷新后仍为 jade');
// 3. v6 迁移：旧存档 theme=original-ui → default
await p.evaluate(k => localStorage.setItem(k, JSON.stringify({ version: 5, settings: { theme: 'original-ui' } })), 'ring-belt-settings');
await p.reload(); await p.waitForFunction(() => window.__ready);
ok(await p.evaluate(() => document.querySelector('.theme-card.on')?.dataset.theme === 'default' && !document.querySelector('.theme-card[data-theme="original-ui"]')), '旧 original-ui 存档回落为 default，且卡片已移除');
ok(errs.length === 0, '无页面错误 ' + errs.slice(0, 3).join(' | '));
await b.close(); done('themes');
