import { open, ok, done } from './_page.mjs';
const { b, p, errs } = await open();
const r = await p.evaluate(() => {
  const f = __parseExportThemes;
  return {
    has: typeof f === 'function',
    all: f(null),
    csv: f('jade,wood'),
    bad: f('jade,nope,wood'),
    arr: f(['candy']),
    empty: f(''),
    ver: __app.SETTINGS_VERSION,
    def: __S().exportThemes,
    multi: !!document.querySelector('.theme-picker.multi'),
    cards: document.querySelectorAll('.theme-picker.multi .theme-card').length,
    inp: document.querySelector('input[data-key=exportThemes]')?.value,
  };
});
ok(r.has, '__parseExportThemes 已挂载');
ok(r.ver >= 9, 'SETTINGS_VERSION ≥ 9');
ok(r.all.length === 4 && r.all.includes('jade'), 'null → 4 主题');
ok(r.csv.join(',') === 'jade,wood', 'CSV 解析');
ok(r.bad.join(',') === 'jade,wood', '忽略未知 id');
ok(r.arr.join(',') === 'candy', '数组输入');
ok(r.empty.length === 4, '空 → 全部');
ok(r.multi && r.cards === 4, '面板有导出主题多选卡片 ×4');
ok(typeof r.inp === 'string' && r.inp.includes('jade'), 'exportThemes 默认含 jade');
ok(errs.length === 0, '无页面错误 ' + errs.join('|'));
await b.close();
done('exportThemes');
