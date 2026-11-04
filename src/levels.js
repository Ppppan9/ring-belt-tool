// 内置 5 关（坐标基于 864x1920 设计分辨率，从参考视频逐帧量取）
// ring: id, color(key 或 #hex), x,y 圆心, R 中心线半径, gap:[中心角°, 宽度°]（屏幕坐标，0=右, 90=下），
//       parent: 父环 id（夹子在父环上）, anchor: 固定环（不可拖）, closed: 无缺口, hinge: 铰接（转到解锁即脱落）, balls: 球数
// boxes: 每列从上到下的颜色；plan: 自动通关顺序 [环id, 'detach'|'spill']
export const LEVELS = [
  { ballR: 20.5, rings: [
      { id: 'g', color: 'grey', x: 328, y: 470, R: 74, gap: [195, 50], anchor: true },
      { id: 'r', color: 'red', x: 490, y: 630, R: 119, gap: [291, 50], parent: 'g', balls: 12 },
    ], boxes: [['red', 'red'], ['red', 'red']], plan: [['r', 'detach']] },
  { ballR: 17.5, rings: [
      { id: 'a', color: 'sky', x: 433, y: 425, R: 64, gap: [268, 55], anchor: true },
      { id: 'r', color: 'red', x: 301, y: 561, R: 95, gap: [252, 58], parent: 'a', balls: 6 },
      { id: 'b', color: 'blue', x: 561, y: 567, R: 95, gap: [276, 54], parent: 'a', balls: 6 },
    ], boxes: [['red'], ['red'], ['blue'], ['blue']], plan: [['r', 'detach'], ['b', 'detach']] },
  { ballR: 17.5, rings: [
      { id: 'a', color: 'sky', x: 244, y: 411, R: 64, gap: [285, 55], anchor: true },
      { id: 'y', color: 'yellow', x: 340, y: 577, R: 96, gap: [284, 51], parent: 'a', balls: 6 },
      { id: 'gr', color: 'green', x: 553, y: 498, R: 96, gap: [299, 58], parent: 'y', balls: 6 },
      { id: 'r', color: 'red', x: 484, y: 746, R: 96, gap: [292, 58], parent: 'y', balls: 6 },
    ], boxes: [['green', 'yellow'], ['green', 'yellow'], ['red'], ['red']], plan: [['r', 'detach'], ['gr', 'detach', 1, 1.0], ['y', 'spill', 0.12, 2.3]] }, // 视频：黄环慢转，黄球逐颗滴落
  { ballR: 17.5, rings: [
      { id: 'p', color: 'lilac', x: 433, y: 494, R: 97, anchor: true, closed: true },
      { id: 'r', color: 'red', x: 203, y: 499, R: 93, gap: [274, 54], parent: 'p', hinge: true, balls: 6 },
      { id: 'gr', color: 'green', x: 660, y: 497, R: 93, gap: [297, 58], parent: 'p', hinge: true, balls: 6 },
      { id: 'b', color: 'blue', x: 319, y: 690, R: 93, gap: [240, 56], parent: 'p', hinge: true, balls: 6 },
      { id: 'y', color: 'yellow', x: 547, y: 690, R: 93, gap: [295, 58], parent: 'p', hinge: true, balls: 6 },
    ], boxes: [['red', 'yellow'], ['red', 'yellow'], ['blue', 'green'], ['blue', 'green']], plan: [['r', 'spill', 1, 0.43], ['b', 'spill', 1, 0.43], ['gr', 'spill', 1, 0.43], ['y', 'spill', 1, 0.43]] },
  { ballR: 17.5, rings: [
      { id: 'g', color: 'grey', x: 676, y: 517, R: 73, gap: [311, 57], anchor: true },
      { id: 'o', color: 'orange', x: 513, y: 686, R: 123, gap: [262, 70], parent: 'g', balls: 12 },
      { id: 'r', color: 'red', x: 280, y: 554, R: 107, gap: [265, 55], parent: 'o', balls: 9 },
      { id: 'pu', color: 'purple', x: 270, y: 823, R: 118, gap: [270, 55], parent: 'o', balls: 12 },
    ], boxes: [['purple', 'red', 'orange'], ['purple', 'red', 'orange'], ['purple', 'red', 'orange'], ['purple', 'orange']], plan: [['pu', 'spill', 1, 0.65], ['pu', 'detach', 1, 0.65], ['r', 'detach', 1, 0.65], ['o', 'spill', 1, 0.91]] } // 视频：紫环倒空后转开碎裂，再解红环，橙环只剩一个夹扣才能转,
];
// 可选美术字段（每个环）：sprite（资源 key，默认 ring_<color>）、pivot:[0~1,0~1] 环心在图中位置、spriteRot（图中缺口方向偏移°，
// 约定图中缺口朝右=0）、spriteScale、z（绘制层级，越大越上）；夹子：clampSprite、clampPivot、clampRot、clampScale。

// —— 第 20 关（最难）：风车式 3×3 环阵，不进 1–5 关循环；?level=20 或 设置“起始关卡”=20 直达 ——
// 中心灰色闭环为固定锚；上/左/右/下 4 个“中环”夹在锚上，每个中环再夹住一个角上的“叶环”（风车方向）：
//   nw→n, ne→e, sw→w, se→s。中环同时被锚夹住 + 夹着叶环 = 2 个夹扣 → 锁死不能转，必须先解掉它的叶环。
// 传送带只有 6 格：同时有 6 颗“没有开着的盒子可去”的球在带上就彻底堵死。盒子栈顺序（tools/l20_solver.py 求得）
// 使 2520 种合法拆环顺序里只有 1 种不堵：se → nw → n → sw → w → s → ne → e。
export const SPECIAL_LEVELS = {
  20: { label: 20, ballR: 17.5, beltSlots: 6, rings: [
      { id: 'a', color: 'grey', x: 432, y: 380, R: 95, anchor: true, closed: true },
      { id: 'w', color: 'red', x: 212, y: 380, R: 95, gap: [290, 56], parent: 'a', balls: 6 },
      { id: 'e', color: 'purple', x: 652, y: 380, R: 95, gap: [250, 56], parent: 'a', balls: 6 },
      { id: 's', color: 'cyan', x: 432, y: 600, R: 95, gap: [340, 56], parent: 'a', hinge: true, balls: 6 },
      { id: 'ww', color: 'green', x: 212, y: 600, R: 95, gap: [200, 56], parent: 'w', balls: 6 },
      { id: 'ee', color: 'cyan', x: 652, y: 600, R: 95, gap: [340, 56], parent: 'e', balls: 6 },
      { id: 'ss', color: 'orange', x: 432, y: 820, R: 95, gap: [225, 56], parent: 's', balls: 6 },
      { id: 'bl', color: 'blue', x: 212, y: 820, R: 95, gap: [290, 56], parent: 'ss', balls: 6 },
      { id: 'br', color: 'purple', x: 652, y: 820, R: 95, gap: [250, 56], parent: 'ss', balls: 6 },
    ], boxes: [['green', 'cyan', 'purple', 'cyan'], ['orange', 'cyan', 'red', 'purple'], ['purple', 'blue', 'cyan', 'blue'], ['purple', 'red', 'green', 'orange']],
    plan: [['br', 'detach', 1, 0.5], ['bl', 'detach', 1, 0.3, true], ['ee', 'detach', 1, 0.3, true], ['ww', 'detach', 1, 0.3, true], ['w', 'detach', 1, 0.3, true], ['ss', 'detach', 1, 0.3, true], ['s', 'detach', 1, 0.3, true], ['e', 'detach', 1, 0.3, true]] },
};

// —— 夹扣对接几何（phase10）：夹块中心必须落在子环管中心线上，且父环外沿到夹块内沿留出可见颈部 ——
// 需要的圆心距 D = 父R + 父管半宽(取各主题最大 0.205R) + CLIP_NECK_LEN + 夹块半高(29·子R/151·clampScale) + 子R。
// 不够就把子环（连同它的整棵子树）沿 父→子 方向推远；方向不变，所以缺口安全区角度不变。
export const CLIP_NECK_LEN = 10;
export const TUBE_HALF_MAX = R => R * 0.205;
export const clipBlockHalf = r => 29 * (r.R / 151) * (r.clampScale || 1);
export const jointNeed = (p, r) => p.R + TUBE_HALF_MAX(p.R) + CLIP_NECK_LEN + clipBlockHalf(r) + r.R;
export function spaceJoints(lv) {
  const by = Object.fromEntries(lv.rings.map(r => [r.id, r])), kids = id => lv.rings.filter(r => r.parent === id);
  const move = (r, dx, dy) => { r.x += dx; r.y += dy; kids(r.id).forEach(k => move(k, dx, dy)); };
  const visit = p => kids(p.id).forEach(r => { const dx = r.x - p.x, dy = r.y - p.y, d = Math.hypot(dx, dy), need = jointNeed(p, r) + 0.5; if (d < need) move(r, dx / d * (need - d), dy / d * (need - d)); visit(r); });
  lv.rings.filter(r => !r.parent).forEach(visit); return lv;
}
LEVELS.forEach(spaceJoints); Object.values(SPECIAL_LEVELS).forEach(spaceJoints);

// 开口环缺口安全区：夹子(夹在子环上)与颈部接点(在父环上)都不得落在 缺口半角 + GAP_SAFE_DEG 之内（否则视觉穿帮）
export const GAP_SAFE_DEG = 15;
export function gapSafeViolations(lv) {
  const by = Object.fromEntries(lv.rings.map(r => [r.id, r])), w = a => ((a % 360) + 540) % 360 - 180, out = [];
  for (const r of lv.rings) { if (!r.parent) continue; const p = by[r.parent], ac = Math.atan2(p.y - r.y, p.x - r.x) * 180 / Math.PI;
    for (const [ring, a, kind] of [[r, ac, 'clip'], [p, ac + 180, 'neck']]) if (ring.gap && !ring.closed) { const d = Math.abs(w(a - ring.gap[0])), lim = ring.gap[1] / 2 + GAP_SAFE_DEG; if (d < lim) out.push({ ring: ring.id, child: r.id, kind, d: +d.toFixed(1), lim }); } }
  return out;
}
