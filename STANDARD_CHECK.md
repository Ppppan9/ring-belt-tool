# 解环传送带 · 规范逐条核对（STANDARD_CHECK）

对照：`/workspace/ring-belt/TOOLKIT_STANDARD.md` 与 `/workspace/ref-tools/shared/docs/TOOLKIT_STANDARD.md`。
`diff` 结果：两份**仅差末尾一个空行**（第 155 行），内容完全一致。STUDY.md 中「两份规范有差异」的说法不成立，以本文件为准。

状态：✅ 已满足 / 🟡 部分 / ❌ 未做

## 顶部硬性要求
| 条款 | 状态 | 说明 |
|---|---|---|
| 默认内置导出 AE 工程 | ✅ | `createAERecorder`，test:ae 15/0（jsx mock，zh/en） |
| 默认内置导出 3D（glTF / FBX / Blender） | 🟡 | 已出 scene.glb + blender_import.py + scene3d.json（gltf-validator 0 错误）；**scene.fbx 未生成**（盒子没有 Blender，README_3D 已说明，可用 blender_import.py 导出 FBX） |
| 每个元素是独立图层/节点并带关键帧 | ✅ | 渲染以 items 驱动，AE 约 2609 层，glb 每层一个节点（q####_Ring_…） |
| 导入透明 PNG 生成关卡 | ❌ | 本工具不适用/未做（关卡是数据驱动的 levels.js） |
| 默认手指用麻将手图 | ✅ | src/default_hand.js |
| 手指出现时 cursor:none，没有手指时为 pointer；锚点 0 偏移 | ✅ | test:cursor 14/0 |
| H5 面板位置（3D 之后、结束页之前） | ✅ | |

## §1 单文件与设置
| 条款 | 状态 | 说明 |
|---|---|---|
| npm run build → 单文件离线 index.html | ✅ | esbuild（build.mjs） |
| localStorage + version + migrate 只替换「仍等于旧默认值」的项 | ✅ | OLD_DEFAULTS 列表（含本轮的 ballRadius、颜色、lcDelay、beltSpeed） |
| 顶部按钮的顺序和文字 | ✅ | test:cursor 校验按钮顺序 |
| 导出设置 JSON `{app, version, settings}` | ✅ | test:cursor 校验 导出/导入/迁移 |

## §2 通用参数
| 条款 | 状态 | 说明 |
|---|---|---|
| 分组顺序与键名、标签 | ✅ | SCHEMA 与表一致 |
| 默认值 | 🟡 | handSize 默认 0.42 符合规范，但视频中手指约 0.2（对比脚本用 0.2）；endCard 默认 false（参考视频没有结束页，与打螺丝一致）；thinkChance 0.1 |

## §3 AE 导出 ZIP
| 条款 | 状态 | 说明 |
|---|---|---|
| 包结构、文件名、timeline.json 字段、文件夹、图层字段 | ✅ | test:ae |
| 主合成名、音频（混合音轨 + 逐事件预合成）、标记 | ✅ | |
| 手指 / 背景等固定图层名 | ✅ | |
| jsx 行为 + `$.global.__RING_BELT_BUILD_STATS` | ✅ | ae-mock 校验 |

## §4 3D 导出 ZIP
| 条款 | 状态 | 说明 |
|---|---|---|
| scene.glb / scene3d.json / blender_import.py / README_3D / timeline / audio | ✅ | format `export3d/1`，test:3d 13/0 |
| scene.fbx | ❌ | 需要 Blender（盒子未安装） |
| 复用 AE 记录（bake/en/canvas） | ✅ | |

## §5 H5 试玩广告
| 条款 | 状态 | 说明 |
|---|---|---|
| 8 渠道子目录 + tiktok/config.json + README | ✅ | |
| 自包含、不带编辑器、contain/letterbox、safe-area | ✅ | 7 个视口冒烟通过 |
| 各渠道 CTA | ✅ | 8 渠道 channel-smoke 全部 PASS |
| 体积 < h5MaxMb | 🟡 | 单渠道 1.35 MB（Facebook ≤2MB 达标）；**总 ZIP 5.69 MB，超过 5 MB**（UI 会告警） |
| 试玩不带手指、h5AutoPlay 默认 false、state()/isEnded() | ✅ | test:h5 |
| editOutsideScripts、共享 API | ✅ | src/h5 拷贝自 shared |

## §6 测试
| 条款 | 状态 | 说明 |
|---|---|---|
| test / test:logic / test:cursor / test:ae / test:h5 | ✅ | 5/0、10/0、14/0、15/0、全部 PASS |
| test:3d「Blender 导入 + 渲染对比」 | 🟡 | 改用 gltf-validator 做结构校验，以及节点、材质、动画检查；没有 Blender，无法做渲染对比 |

## §7 控制台分层 / 主题
- [ ] 不常用参数均 `adv: true`，收进末尾默认折叠的「高级设置」(#advSettings)；影响动画/导出的参数在外层
- [ ] 分组顺序与标准 id、key、导出结构未变；test 校验折叠存在、关闭、内容正确
- [ ] 「主题」分组在「关卡与玩法」之上；切换实时、持久化；导出使用当前主题；test 校验
## §8 缺口安全区
- [ ] 所有关卡 gapSafeViolations() 为空（缺口半角 + 15°）
- [ ] 夹扣/颈部 z 序：父环之下、子环之上（test:logic 校验）
