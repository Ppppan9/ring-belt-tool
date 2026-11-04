# 圆环传送带 · 核玩工具（ring-belt）
参考视频 ref/ref.mp4 的可玩复刻。单文件离线：`index.html`（美术已内联）。

- 构建：`npm run build`（src/ → dist/index.html → 拷贝为 ./index.html）
- 本地预览：`npm run serve` → http://localhost:8731/ （或直接双击 index.html）
- 对比图：`npm run compare` → compare/*.png + compare/metrics.md（左参考 | 右复刻）
- 美术：assets/named/*.png，映射见 ASSET_MAP.md；颜色映射在设置「关卡与玩法 → 颜色映射 JSON」（yellow→orange, pink→red 等）
- 关卡布局：src/levels.js（坐标/缺口/父子/z 序/sprite 覆盖字段），也可在设置里粘贴关卡 JSON
- 手指：src/default_hand.js 为占位，可在设置上传透明 PNG
- 测试钩子：`?det=1&seed=N` 确定性推进，`window.__step(n)`、`__auto(true)`、`__game`
- 第二阶段（未做）：AE 工程 / 3D / H5 导出按钮目前只提示。
