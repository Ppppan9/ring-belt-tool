import { open, ok, done, runAuto } from './_page.mjs';
const { b, p, errs } = await open();
const L = await p.evaluate(() => __game.levels().length); ok(L === 5, 'levels = 5');
for (let lv = 0; lv < L; lv++) {
  await p.evaluate(l => { __auto(false); __game.loadLevel(l); __game.lcCount = 0; __auto(true); }, lv);
  let t = 0; for (; t < 80; t++) { await p.evaluate(() => __step(50)); if (await p.evaluate(() => __game.lcCount > 0)) break; }
  const r = await p.evaluate(() => ({ st: __game.lcCount > 0 ? 'lc' : __game.state, lt: (__game.lastLC || {}).levelTime || 0, balls: __game.balls.length, boxed: __game.balls.filter(b => b.state === 'boxed').length }));
  ok(r.st === 'lc', `L${lv + 1} 自动通关 ${r.lt.toFixed(1)}s，球 ${r.balls}`);
}
// 解锁几何：脱落时卡扣必须已完全进入缺口
await p.evaluate(() => { __auto(false); __game.loadLevel(0); window.__det = []; const g = __game, od = g.detach.bind(g); g.detach = r => { const cw = g.clampWorld(r), a = Math.atan2(cw[1] - r.c[1], cw[0] - r.c[0]); let loc = a - r.rot - r.gapC; loc = Math.atan2(Math.sin(loc), Math.cos(loc)); const clear = r.gapW / 2 - Math.asin(Math.min(1, g.clipClear(r) / r.R)); __det.push({ id: r.id, loc: Math.abs(loc), clear }); return od(r); }; __auto(true); });
await p.evaluate(() => { __game.lcCount = 0; });
for (let t = 0; t < 120 && !(await p.evaluate(() => __game.lcCount > 0)); t++) await p.evaluate(() => __step(50));
const det = await p.evaluate(() => __det); ok(det.length > 0 && det.every(d => d.loc <= d.clear + 1e-3), 'L1 脱落时缺口已越过卡扣 ' + JSON.stringify(det.map(d => [d.id, +(d.loc * 57.3).toFixed(1), +(d.clear * 57.3).toFixed(1)])));
// 手动：转到缺口边缘接触卡扣（未越过）不得脱落
const early = await p.evaluate(() => { __auto(false); __game.loadLevel(0); const g = __game, r = g.rings.find(x => x.p && !x.hinge && !x.closed); const cw = g.clampWorld(r), a = Math.atan2(cw[1] - r.c[1], cw[0] - r.c[0]); r.rot = a - r.gapC - (r.gapW / 2 - 0.02); r._loc = null; g.checkDetach(); const alive1 = r.alive; r.rot = a - r.gapC; g.checkDetach(); return [alive1, r.alive]; });
ok(early[0] === true && early[1] === false, '缺口刚碰到卡扣不脱落、正对卡扣才脱落 ' + early);
// 双夹扣锁定：L3 黄环同时夹着绿、红环并被蓝环夹住 → 拖不动；释放到只剩一个夹扣后可转
const lk = await p.evaluate(() => { __auto(false); __game.loadLevel(2); const g = __game, y = g.rings.find(r => r.id === 'y'); const drag = () => { const r0 = y.rot; const gp = g.grabPoint(y); g.pointerDown(gp.x, gp.y, y); for (let i = 0; i < 20; i++) { const a = Math.atan2(gp.y - y.c[1], gp.x - y.c[0]) + i * 0.05; g.pointerMove(y.c[0] + y.R * Math.cos(a), y.c[1] + y.R * Math.sin(a)); __step(1); } g.pointerUp(); return Math.abs(y.rot - r0); };
  const j0 = g.joints(y), d0 = drag(); g.detach(g.rings.find(r => r.id === 'r')); const j1 = g.joints(y), d1 = drag(); g.detach(g.rings.find(r => r.id === 'gr')); const j2 = g.joints(y), d2 = drag(); return { j0, d0, j1, d1, j2, d2, ev: g.events.some(e => e.name === 'locked') }; });
ok(lk.j0 === 3 && lk.d0 < 1e-6 && lk.j1 === 2 && lk.d1 < 1e-6 && lk.j2 === 1 && lk.d2 > 0.3 && lk.ev, 'L3 黄环多夹扣锁定、只剩一个后可转 ' + JSON.stringify(lk));
// L4：紫色中心环 4 个夹扣全部脱开 → 紫环碎裂
const l4 = await p.evaluate(() => { __auto(false); __setSettings({ lcDelay: 4000 }); __game.loadLevel(3); const g = __game; g.balls.forEach(b => { if (b.state === 'free') b.state = 'boxed'; }); const kids = g.rings.filter(r => r.hinge); let early = null;
  for (const r of kids) { const t = g.planTarget(r, 'detach'); const n = 60; for (let i = 0; i < n; i++) { g.rotateRing(r, t / n); g.checkDetach(); if (!r.alive) break; } if (early === null && r !== kids[kids.length - 1]) early = g.rings.find(x => x.id === 'p').alive; __step(2); }
  __step(30); const res = { kids: kids.map(r => r.alive), purple: g.rings.find(x => x.id === 'p').alive, early }; __setSettings({ lcDelay: 60 }); return res; });
ok(l4.kids.every(a => !a) && l4.early === true && l4.purple === false, 'L4 夹扣全脱开后紫环碎裂 ' + JSON.stringify(l4));

// —— L4 e2e：真实鼠标拖动（同一输入路径）把铰接环转到解锁，环应立刻碎；4 个子环都没了紫色中心环碎 ——
async function e2eDrag(id, fast) { const info = await p.evaluate(id => { const g = __game, r = g.rings.find(r => r.id === id); return { c: r.c, R: r.R, t: g.planTarget(r, 'detach') }; }, id);
  const n = fast ? 24 : 200, da = fast ? (info.t > 0 ? info.t : info.t + 2 * Math.PI) / 20 : Math.PI * 2 / 72; let inside = -1;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i * da; const [cx, cy] = await p.evaluate(([x, y]) => __toClient(x, y), [info.c[0] + info.R * Math.cos(a), info.c[1] + info.R * Math.sin(a)]);
    if (i === 0) { await p.mouse.move(cx, cy); await p.mouse.down(); } else await p.mouse.move(cx, cy);
    const s = await p.evaluate(id => { const g = __game, r = g.rings.find(r => r.id === id); const k = g.balls.filter(b => b.state === 'free' && Math.hypot(b.x - r.c[0], b.y - r.c[1]) < r.R).length; __step(1); return { alive: r.alive, k }; }, id);
    if (!s.alive) break; inside = s.k; }
  await p.mouse.up(); await p.evaluate(() => __step(3)); return { alive: await p.evaluate(id => __game.rings.find(r => r.id === id).alive, id), inside }; }
for (const fast of [true, false]) {
  await p.evaluate(() => { __auto(false); __game.loadLevel(3); });
  const res = {}; for (const id of ['gr', 'y', 'b', 'r']) res[id] = await e2eDrag(id, fast);
  await p.evaluate(() => __step(20));
  const st = await p.evaluate(() => Object.fromEntries(__game.rings.map(r => [r.id, r.alive])));
  ok(['gr', 'y', 'b', 'r'].every(id => !res[id].alive), `L4 e2e(${fast ? '带球快转' : '倒空慢转'})：鼠标转到解锁后 4 个铰接环都碎 ${JSON.stringify(res)}`);
  if (fast) ok(Object.values(res).some(x => x.inside > 0), 'L4 e2e：环内仍有球时转到解锁也会碎（球随之洒出）');
  ok(st.p === false, `L4 e2e：子环全部脱开后紫色中心环碎 ${JSON.stringify(st)}`);
}
// 无结算页：手动玩过关后停在完成盘面，不自动换关；点面板“⏭ 下一关”才换关；自动通关会自行续关
const man = await p.evaluate(() => { __auto(false); __game.loadLevel(0); __game.balls.forEach(b => b.state = 'boxed'); for (let i = 0; i < 200; i++) __step(1); return { st: __game.state, idx: __game.levelIdx, items: __items().filter(it => /lc_|coin|reward|continue/i.test(it.id || it.name || '')).length }; });
ok(man.st === 'lc' && man.idx === 0 && man.items === 0, '手动过关停在完成盘面、无结算面板 ' + JSON.stringify(man));
await p.click('#btnNext'); ok(await p.evaluate(() => __game.levelIdx === 1 && __game.state === 'play'), '点 ⏭ 下一关 才进入第 2 关');
const au = await p.evaluate(() => { __auto(false); __game.loadLevel(0); __auto(true); let t = 0; while (__game.levelIdx === 0 && t < 900) { __step(1); t++; } const ev = __game.events.filter(e => e.name === 'levelComplete' || e.name === 'levelStart').slice(-2); __auto(false); return { idx: __game.levelIdx, gap: ev.length === 2 ? +(ev[1].t - ev[0].t).toFixed(2) : -1 }; });
ok(au.idx === 1 && au.gap > 0.8 && au.gap < 2.5, '自动通关自行续关 ' + JSON.stringify(au));
await p.evaluate(() => { __auto(false); __game.loadLevel(4); });
ok(await p.evaluate(() => __game.isEnded() === false), 'isEnded false during play');
ok(await runAuto(p), 'L5 → 结束页 isEnded');
const ev = await p.evaluate(() => __game.events.map(e => e.name)); ok(ev.includes('shatter') || ev.includes('detach'), 'events recorded');
// —— L20（最难关）：按唯一解顺序用真实鼠标拖动通关；错序（先 bl 后 br）会卡死 ——
const L20 = ['br', 'bl', 'ee', 'ww', 'w', 'ss', 's', 'e'];
const settle20 = () => p.evaluate(() => { const g = __game; for (let i = 0; i < 900; i++) { const loose = g.balls.some(b => b.state === 'free' && !g.rings.some(q => q.alive && Math.hypot(b.x - q.c[0], b.y - q.c[1]) < q.R)); if (!loose && i > 20) break; __step(1); } });
async function drag20(id) { const info = await p.evaluate(id => { const g = __game, r = g.rings.find(r => r.id === id); const gp = g.grabPoint(r); return { c: r.c, R: r.R, t: g.planTarget(r, 'detach'), a0: Math.atan2(gp.y - r.c[1], gp.x - r.c[0]) }; }, id);
  let t = info.t; while (t > Math.PI) t -= 2 * Math.PI; while (t < -Math.PI) t += 2 * Math.PI; const n = 30, da = (t + Math.sign(t) * 0.25) / n;
  for (let i = 0; i <= n; i++) { const a = info.a0 + i * da; const [cx, cy] = await p.evaluate(([x, y]) => __toClient(x, y), [info.c[0] + info.R * Math.cos(a), info.c[1] + info.R * Math.sin(a)]);
    if (i === 0) { await p.mouse.move(cx, cy); await p.mouse.down(); } else await p.mouse.move(cx, cy);
    if (!(await p.evaluate(id => { __step(1); return __game.rings.find(r => r.id === id).alive; }, id))) break; }
  await p.mouse.up(); return p.evaluate(id => __game.rings.find(r => r.id === id).alive, id); }
await p.evaluate(() => { __auto(false); __game.loadLevel(19); });
const l20a = await p.evaluate(() => ({ lv: __game.levelIdx + 1, slots: __game.belt.cap, n: __game.rings.length }));
ok(l20a.lv === 20 && l20a.slots === 6 && l20a.n === 9, 'L20 可直接载入（9 环 / 传送带容量 6）' + JSON.stringify(l20a));
const locked20 = await p.evaluate(() => { const g = __game; return ['a', 'w', 'e', 's', 'ss'].every(id => g.isLocked(g.rings.find(r => r.id === id))) && ['ww', 'ee', 'bl', 'br'].every(id => !g.isLocked(g.rings.find(r => r.id === id))); });
ok(locked20, 'L20 开局只有 4 个叶子环可转，其余被多夹扣锁死');
const alive20 = []; for (const id of L20) { alive20.push(await drag20(id)); await settle20(); }
await p.evaluate(() => { for (let i = 0; i < 300 && __game.state !== 'lc'; i++) __step(1); });
const e2e20 = await p.evaluate(() => ({ st: __game.state, boxed: __game.balls.filter(b => b.state === 'boxed').length }));
ok(alive20.every(a => !a) && e2e20.st === 'lc' && e2e20.boxed === 48, 'L20 e2e：鼠标拖动按 br→bl→ee→ww→w→ss→s→e 通关 ' + JSON.stringify({ alive20, e2e20 }));
await p.evaluate(() => { __auto(false); __game.loadLevel(19); });
for (const id of ['bl', 'br', 'ee', 'ww', 'w', 'ss', 's', 'e']) { await drag20(id); await settle20(); }
await p.evaluate(() => __step(600));
const bad20 = await p.evaluate(() => ({ st: __game.state, belt: __game.belt.slots.filter(Boolean).length }));
ok(bad20.st === 'play' && bad20.belt === 6, 'L20 错序（bl 先于 br）→ 传送带塞满卡死 ' + JSON.stringify(bad20));
const au20 = await p.evaluate(() => { __auto(false); __game.loadLevel(19); __auto(true); let t = 0; while (__game.state !== 'lc' && t < 3600) { __step(1); t++; } __auto(false); return { st: __game.state, sec: +(t / 60).toFixed(1) }; });
ok(au20.st === 'lc', 'L20 自动通关脚本可通关 ' + JSON.stringify(au20));
{ const { LEVELS, SPECIAL_LEVELS, gapSafeViolations, GAP_SAFE_DEG } = await import('../src/levels.js');
  const bad = [...LEVELS.map((l, i) => [i + 1, l]), ...Object.entries(SPECIAL_LEVELS)].flatMap(([n, l]) => gapSafeViolations(l).map(v => ({ lv: n, ...v })));
  ok(bad.length === 0, `开口环缺口安全区（半角+${GAP_SAFE_DEG}°）内无夹子/颈部（L1–5、L20）` + " " + JSON.stringify(bad)); }
{ const z = await p.evaluate(() => { __auto(false); __game.loadLevel(4); __step(1); const it = __items(), zz = id => (it.find(x => x.id === id) || {}).z; return { o: zz('ring_L5_o'), r: zz('ring_L5_r'), linkR: zz('link_L5_r'), clipR: zz('clip_L5_r') }; });
  ok(z.linkR < z.o && z.clipR < z.o && z.clipR > z.r, '夹子/颈部画在所属(父)环之下、被夹环之上 ' + JSON.stringify(z)); }
ok(errs.length === 0, 'no console errors ' + errs.slice(0, 3).join('|'));
await b.close(); done('test:logic');

