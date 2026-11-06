// phase47：真实界面路径——面板勾选「自动通关耐心版」+ 点自动通关按钮（非 det 实时），记录每次解环前的等待
import { open, ok, done } from './_page.mjs';
const { b, p, errs } = await open('?level=6', { width: 540, height: 1200 }, process.env.FILE);
const run = async on => {
  await p.evaluate(on => { const i = document.querySelector('input[data-key="autoPatient"]'); if (i.checked !== on) i.click(); window.__autoLog = []; __game.loadLevel(5); __game.state = 'play'; }, on);
  const chk = await p.evaluate(() => [document.querySelector('input[data-key="autoPatient"]').checked, __S().autoPatient]);
  const t0 = Date.now(); await p.evaluate(() => __auto(true));
  while (Date.now() - t0 < 150000 && await p.evaluate(() => __game.state !== 'lc')) await new Promise(r => setTimeout(r, 500));
  const res = await p.evaluate(() => ({ st: __game.state, log: window.__autoLog }));
  await p.evaluate(() => __auto(false)); return { chk, sec: (Date.now() - t0) / 1000, ...res };
};
const off = await run(false), on = await run(true);
console.log('OFF', JSON.stringify(off)); console.log('ON', JSON.stringify(on));
ok(off.st === 'lc' && on.st === 'lc', '耐心版开/关都能通关');
ok(on.chk[0] && on.chk[1], '面板勾选后设置生效');
ok(on.log.length >= 7 && on.log.filter(l => l.waited > 0.3).length >= 3, `耐心版每次解环前确有等待 ${on.log.map(l => l.waited).join(',')}`);
ok(off.log.length === 0, '关闭时不等待');
ok(on.sec > off.sec + 5, `耐心版总耗时更长 ${off.sec}s → ${on.sec}s`);
ok(!errs.length, 'no errors ' + errs.join('|')); await b.close(); done();
