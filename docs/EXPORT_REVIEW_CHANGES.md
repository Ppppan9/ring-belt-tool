# 导出功能审查与优化清单（解环+传送带 ring-belt-tool）

基线：main `cfabfe9`（v12 / phase49）。对照：mahjong / screw / coffee-sort / block-shooter 四工具共享 H5 / AE / 3D 导出模块。
结论：本仓库的导出实现（AE 独立图层+素材+音频+JSX、3D glTF/FBX/Blender、H5 八渠道 + 机型/自适应 + file:// 回退、多主题批量导出）已**领先**四个旧工具的共享模块，不需要重写；本次只修确定的问题。

## 改动

| # | 改了什么 | 原问题 | 怎么改 | 验证 |
|---|---|---|---|---|
| 1 | AE / 3D / H5 导出互斥锁 | 三种导出都会临时把 `S.theme` 逐个切到各导出主题再打包。双击按钮、录制结束自动导出 AE 同时手动点导出、或 AE 未完成又点 H5 时，会并发切主题，产生重复下载，也可能串主题 | `src/app.js` 新增 `exportLock()`：同一时间只允许一个导出任务；其它请求提示“正在导出 X，请等待”并返回 null；导出中禁用三个导出按钮（面板重建后仍保持禁用）；结束或出错都会在 finally 里解锁 | `test/exportflow.mjs`：并发 2×AE+1×H5 只出 1 个包、按钮禁用后恢复 |
| 2 | 导出中禁止切换主题 / 导出主题 | 导出过程中切主题，导出结束后 `restoreLiveTheme` 会把它改回导出前的主题，用户的操作被悄悄覆盖 | `set()` 在导出期间拦截 `theme` / `exportThemes`，提示后重建面板 | exportflow：导出时点“彩块”主题卡被拦截，导出后仍是 wood |
| 3 | 多主题导出进度显示 (i/n) | 默认导出 4 个主题，3D 要几十秒到数分钟，状态栏只显示主题名，看不出进度 | 状态改为“正在打包 AE（2/4）：玉石…”；只导一个主题时不显示序号 | 代码审查；没有专门的自动断言（exportflow 只覆盖流程回归） |
| 4 | 失败提示 | 失败只有 toast，状态栏还停在“正在打包…” | 锁的 catch 里把状态栏改成“X 导出失败：原因”，并继续向上抛错（保留原 toast） | exportflow：模拟 exportZip 抛错后锁已释放、主题已还原 |
| 5 | file:// H5 导出不再报控制台错误 | 离线单文件下 `fetchBaseHtml` 会先 fetch 自身，Chrome 报 `URL scheme "file" is not supported` 两次，然后才回退到 DOM 序列化 | `src/h5/index.js`：协议为 file: 时跳过 fetch，直接序列化 DOM（http/https 行为不变） | exportflow 断言“无页面错误”；h5 / h5size / fitcheck 回归通过 |
| 6 | 修复过期测试，test:all 可跑 | 设置升到 v9、多主题导出改了文件名（`_ae_<主题>_` / `_ae_themes_`）后，belt / cursor / ae / 3d 测试仍按 v8 和旧文件名断言，而且多主题导出超过 120 s 下载超时；ae / 3d 还把样例写到不存在的 `/workspace/ring-belt/screenshots` | 断言改为 v9；单主题断言前先设 `exportThemes` 为当前主题；文件名正则改为新命名；样例改写到仓库内的 `screenshots/`（已在 gitignore） | 见下方测试结果 |
| 7 | 新增 `test/exportflow.mjs`，并接入 `test:all` | 没有测试覆盖“多主题总包结构 / 并发 / 失败 / 主题还原” | 在 file:// 下检查：AE 总包按主题分目录，每个主题都有 jsx / timeline / README / PNG 素材，且时间线引用该主题的素材；H5 每个主题都有 google、mintegral、tiktok、generic 的 index.html；`exportThemes` 也加入了 test:all | 25/25 |
| 8 | 修正 themeswitch 第 5 项过期的采样时机 | 断言“主题材质生成期间自动演示继续推进”。phase49 起改为按关卡懒生成，4× 降速下玉石首屏约 2.1–2.3 s 就生成完，而旧测试在点击后约 2.6 s 才开始采样，采到的忙碌样本为 0–1 个，所以必然失败。探针逐 250 ms 记录确认：忙碌期间演示步骤计时、游戏时间都在推进（不是用户可见 bug） | 采样从点击后立即开始，与主线程响应检测同步进行；阈值不变（≥3 种状态、游戏时间 ≥1 s、自动演示仍开启） | 连续 3 次 14/14（忙碌采样 5–7，状态 5–6 种） |

未改：玩法、美术、配色、渠道列表、AE / 3D 数据格式。

## 测试结果（box，headless Chromium，file://）
通过：core 13/13 · themes 11/11 · belt 31/31 · logic 29/29 · panel 10/10 · cursor 14/14 · ae 81/81（含 ES3 + AE 约束 mock）· 3d 34/34（含 gltf-validator）· h5 PASS · clipfixed 23/23 · bg 10/10 · exportThemes 10/10 · exportflow 25/25 · open/h5size/fitcheck 20/20。
themeswitch 14/14（连续 3 次）。第 5 项原先失败（main 上也失败），根因是测试采样时机过期，已按第 8 条修正，未降低阈值。

## 剩余限制 / 未验证
- AE：只在 Node 里用 mock（ES3 语法 + AE API 约束）静态验证，**没有在真实 After Effects 里跑过**。
- 3D：通过了 gltf-validator 和 three.js 渲染截图，**没有在 UE5 / C4D / Blender 里实际导入**。
- H5：只做了离线结构和多尺寸 headless 检查，**没有上传各广告平台后台审核**。
- 默认导出 4 个主题，3D 导出比较慢；如果只需要一个主题，可以在“导出主题”里只勾选一个。
- `tools/*.mjs` 开发脚本里仍然写死了 `/workspace/ring-belt` 路径，与导出无关，没有修改。
