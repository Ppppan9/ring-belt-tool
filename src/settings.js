import { DEFAULT_HAND } from './default_hand.js';
import { h5DeviceSelectOptions } from './h5/index.js';
import { SFX_NAMES } from './audio.js';
import { THEME_OPTIONS, DEFAULT_EXPORT_THEMES } from './themes.js';
// 默认手指：统一使用共享手图（标准 2026-10-18），锚点/旋转/翻转按共享默认
export const DEFAULT_HAND_SIZE = 0.42, DEFAULT_HAND_ANCHOR_X = 0.2204, DEFAULT_HAND_ANCHOR_Y = 0.0367, DEFAULT_HAND_ROTATION = 0, DEFAULT_HAND_FLIP = false;
export const TOOL_ID = 'ring-belt';
export const TOOL_ZH = '解环传送带';
export const TOOL_EN = 'RingBelt';
export const SETTINGS_VERSION = 9;
const LS_KEY = 'ring-belt-settings';
// [key, label, type, default, extra]   type: num/range/bool/select/text/file/button/area/color
// extra.adv = true → 不常用参数，面板上统一收进底部折叠的「高级设置」（按原分组小标题列出）；
// 规则（TOOLKIT_STANDARD §面板分层）：基础调整 + 影响动画/导出的参数留在外面，物理内部参数/调试项进高级设置。
export const ADV_GROUP = '高级设置';
export const SCHEMA = [
  ['主题', [
    ['theme', '美术主题（实时预览；导出请用下方「导出主题」）', 'select', 'default', { options: THEME_OPTIONS }],
    ['exportThemes', '导出主题（可多选，AE/3D/H5 共用）', 'text', DEFAULT_EXPORT_THEMES, { options: THEME_OPTIONS, multiTheme: true }],
    ['beltFaceBright', '传送带带面·明度（玉石主题）', 'range', 1, { min: 0.3, max: 2, step: 0.01 }],
    ['beltFaceSat', '传送带带面·饱和度', 'range', 1, { min: 0, max: 2.5, step: 0.01 }],
    ['beltFaceHue', '传送带带面·色相(°)', 'range', 0, { min: -180, max: 180, step: 1 }],
    ['beltFaceContrast', '传送带带面·对比度', 'range', 1, { min: 0.3, max: 2, step: 0.01, adv: true }],
    ['beltFaceImage', '传送带带面·替换图片(PNG/JPG，自动缩放压缩)', 'file', ''],
    ['_beltFaceReset', '带面恢复默认', 'button', null],
  ]],
  ['关卡与玩法', [
    ['canvasW', '画布宽(px)', 'num', 864, { min: 360, max: 2160, step: 1 }],
    ['canvasH', '画布高(px)', 'num', 1920, { min: 640, max: 3840, step: 1 }],
    ['startLevel', '起始关卡（6=最难关）', 'num', 1, { min: 1, max: 6, step: 1 }],
    ['loopLevels', '最后一关后回到第 1 关', 'bool', true],
    ['beltSpeed', '传送带速度(px/s)', 'num', 900, { min: 40, max: 1200, step: 10 }],
    ['beltSlots', '传送带格子数', 'num', 23, { min: 12, max: 40, step: 1 , adv: true }],
    ['boxCapacity', '每个盒子容量(球)', 'num', 3, { min: 1, max: 8, step: 1 }],
    ['gravity', '重力(px/s²)', 'num', 4200, { min: 300, max: 8000, step: 50 , adv: true }],
    ['bounce', '弹性', 'num', 0.25, { min: 0, max: 0.9, step: 0.01 , adv: true }],
    ['ballRadius', '球半径(px)', 'num', 24, { min: 10, max: 40, step: 0.5 }],
    ['ringThick', '圆环粗细(px，碰撞用；美术管粗≈0.33×半径)', 'num', 30, { min: 8, max: 50, step: 1 , adv: true }],
    ['dropTime', '球落入盒子耗时(ms)', 'num', 120, { min: 40, max: 800, step: 10 }],
    ['showHint', '第 1 关显示提示文字', 'bool', true],
    ['hintText', '提示文字', 'text', 'Drag a ring to turn it'],
    ['lcDelay', '清空后判定过关延迟(ms)', 'num', 60, { min: 0, max: 4000, step: 10 , adv: true }],
    ['shatter', '圆环脱落时碎裂', 'bool', true],
    ['colorMap', '颜色映射 JSON（视频色→美术色）', 'text', '{"yellow":"orange","pink":"red","sky":"cyan","lilac":"purple","grey":"gray"}', { adv: true }],
    ['useArtGap', '开口环缺口角度(°，按美术图，0=按关卡数据)', 'num', 58, { min: 0, max: 120, step: 1 , adv: true }],
    ['unlockMargin', '解锁余量(°，缺口须完全越过卡扣再脱落)', 'num', 3, { min: 0, max: 30, step: 0.5 , adv: true }],
    ['unlockClear', '脱开判定：夹扣占位系数（1=缺口完全居中才脱；越小越早脱，避免夹扣悬空）', 'num', 1, { min: 0.2, max: 1, step: 0.05 , adv: true }],
    ['unlockSnap', '夹扣进入缺口后自动吸附脱开（防止夹扣悬空）', 'bool', true, { adv: true }],
    ['clipFollowParent', '子环脱落后残留夹扣粘在父环上随父环转动（关=固定在场景）', 'bool', true, { adv: true }],
    ['autoUnlockFirst', '自动通关优先解环（不先倒球、不等球落定，直接转缺口脱扣）', 'bool', true],
    ['autoPatient', '自动通关耐心版（解一个环后，等传送带小球消除完再解下一个）', 'bool', false],
    ['lockMultiJoint', '同时被两个夹扣约束的环不能转动', 'bool', true, { adv: true }],
    ['hingeRelease', '铰接环转到解锁即脱落（全部脱开后中心环碎裂）', 'bool', true, { adv: true }],
    ['colRed', '红色', 'color', '#f23a4e'], ['colBlue', '蓝色', 'color', '#4a7cf0'], ['colGreen', '绿色', 'color', '#22c457'],
    ['colYellow', '黄色', 'color', '#f2a90c'], ['colPurple', '紫色', 'color', '#9a4ee6'], ['colOrange', '橙色', 'color', '#f78c1c'], ['colCyan', '青色', 'color', '#2fbbea'],
    ['levelsJson', '关卡布局 JSON（留空=内置 5 关）', 'area', '', { adv: true }],
  ]],
  ['音效', [
    ['sfxMute', '静音', 'bool', false],
    ['sfxVolume', '总音量', 'num', 0.8, { min: 0, max: 1.5, step: 0.05 }],
    ...Object.values(SFX_NAMES).map(([k, zh]) => [k, '音效：' + zh, 'bool', true]),
  ]],
  ['手指 / 自动通关', [
    ['autoSpeed', '整体速度倍率', 'num', 1, { min: 0.25, max: 6, step: 0.05 }],
    ['moveMin', '移动耗时最小(ms)', 'num', 300, { min: 50, max: 2000, step: 10 }],
    ['moveMax', '移动耗时最大(ms)', 'num', 520, { min: 50, max: 3000, step: 10 }],
    ['delayMin', '点击间隔最小(ms)', 'num', 150, { min: 0, max: 2000, step: 10 }],
    ['delayMax', '点击间隔最大(ms)', 'num', 400, { min: 0, max: 4000, step: 10 }],
    ['thinkChance', '“思考停顿”概率', 'num', 0.1, { min: 0, max: 0.6, step: 0.01 }],
    ['thinkMax', '思考停顿最长(ms)', 'num', 900, { min: 0, max: 4000, step: 10 }],
    ['jitter', '落点随机抖动(px)', 'num', 6, { min: 0, max: 40, step: 1 }],
    ['handSize', '手指大小(画面宽比例)', 'num', DEFAULT_HAND_SIZE, { min: 0.1, max: 0.9, step: 0.01 }],
    ['handAnchorX', '指尖锚点 X(0~1)', 'num', DEFAULT_HAND_ANCHOR_X, { min: 0, max: 1, step: 0.01 , adv: true }],
    ['handAnchorY', '指尖锚点 Y(0~1)', 'num', DEFAULT_HAND_ANCHOR_Y, { min: 0, max: 1, step: 0.01 , adv: true }],
    ['handImage', '上传手指图片(透明PNG，不上传则不显示手指)', 'file', DEFAULT_HAND],
    ['pressDepth', '按压幅度（按下时手指缩小比例）', 'num', 0.08, { min: 0, max: 0.3, step: 0.01 }],
    ['pressEnabled', '点击按下效果', 'bool', true],
    ['tapRipple', '点击处显示波纹圈（参考视频没有）', 'bool', false],
    ['hideCursor', '手指出现时隐藏鼠标', 'bool', true, { adv: true }],
    ['handRotation', '手指旋转(度)', 'num', DEFAULT_HAND_ROTATION, { min: -180, max: 180, step: 1 }],
    ['handFlip', '手指水平翻转', 'bool', DEFAULT_HAND_FLIP],
    ['manualHand', '手动游玩时手指跟随指针', 'bool', true, { adv: true }],
    ['autoStartDelay', '自动通关开始延迟(ms)', 'num', 1000, { min: 0, max: 5000, step: 10 }],
    ['dragSpeed', '拖动转环角速度(度/秒)', 'num', 260, { min: 30, max: 1500, step: 10 }],
  ]],
  ['录制', [
    ['recFps', '帧率', 'select', 30, { options: [[24, '24'], [25, '25'], [30, '30'], [50, '50'], [60, '60']] }],
    ['recFormat', '格式', 'select', 'auto', { options: [['auto', '自动(优先 MP4)'], ['mp4', 'MP4'], ['webm', 'WebM']] }],
    ['recBitrate', '码率(Mbps)', 'num', 8, { min: 1, max: 40, step: 1 }],
    ['autoRec', '自动通关开始时自动录制（默认关）', 'bool', false],
    ['autoStop', '自动通关通关后停止录制并下载（仅在正在录制时）', 'bool', true],
    ['tailSec', '通关后继续录制(秒)', 'num', 2.5, { min: 0, max: 10, step: 0.1 }],
  ]],
  ['导出 AE 工程', [
    ['_aeToggle', '● 开始记录', 'button'],
    ['_aeExport', '⬇ 导出 ZIP', 'button'],
    ['aeWithRec', '录制视频时同步记录，停止录制后自动导出', 'bool', true],
    ['aeFps', 'AE 合成帧率', 'select', 30, { options: [[24, '24'], [25, '25'], [30, '30'], [60, '60']] }],
    ['aeSize', 'AE 合成尺寸', 'select', 'canvas', { options: [['canvas', '画布尺寸'], ['720x1280', '720x1280'], ['1080x1920', '1080x1920']] }],
    ['aeSampling', '关键帧方式', 'select', 'reduce', { options: [['reduce', '精简(reduce)'], ['bake', '逐帧(bake)']] }],
    ['aeNames', '图层命名', 'select', 'zh', { options: [['zh', '中文'], ['en', 'English']] }],
    ['aeAudio', '音频', 'select', 'both', { options: [['both', '混合+逐事件'], ['mixed', '仅混合'], ['events', '仅逐事件'], ['none', '无']] }],
    ['aeSaveAep', '脚本跑完后提示另存为 .aep', 'bool', true],
  ]],
  ['导出 3D 动画（UE5 / C4D / Blender）', [
    ['_export3d', '导出 3D 动画 (glTF/FBX/Blender)', 'button'],
    ['export3dFps', '3D 动画帧率', 'select', 30, { options: [[24, '24'], [25, '25'], [30, '30'], [60, '60']] }],
    ['export3dHand', '包含手指（贴图平面；结束页是否显示仍按“结束页显示手指”）', 'bool', true],
  ]],
  ['导出 H5 试玩广告', [
    ['_exportH5', '⬇ 导出 H5 试玩 ZIP', 'button'],
    ['h5Format', '渠道（多选，逗号分隔）', 'text', 'applovin,facebook,google,mintegral,moloco,tiktok,unity,generic'],
    ['h5Orientation', '试玩方向', 'select', 1, { options: [[0, '0 双端'], [1, '1 竖屏'], [2, '2 横屏']] }],
    ['h5Device', '预览机型', 'select', 'adaptive', { options: h5DeviceSelectOptions() }],
    ['h5DeviceW', '预览宽度(px)', 'num', 390, { min: 240, max: 1440, step: 1 , adv: true }],
    ['h5DeviceH', '预览高度(px)', 'num', 844, { min: 400, max: 2560, step: 1 , adv: true }],
    ['h5CtaText', 'CTA 按钮文案', 'text', '立即下载'],
    ['h5StoreUrl', '应用商店 / 落地页 URL', 'text', 'https://example.com/store'],
    ['h5GameName', '游戏名（可选，显示在 CTA 旁）', 'text', TOOL_ZH],
    ['h5Icon', '应用图标（可选）', 'file', ''],
    ['h5MaxMb', '单渠道 / 总包体积告警阈值(MB)', 'num', 5, { min: 1, max: 50, step: 1 , adv: true }],
    ['h5AutoPlay', '试玩打开后自动通关演示', 'bool', false],
  ]],
  ['结束页(End Card)', [
    ['endCard', '显示结束页', 'bool', false],
    ['endCardHand', '结束页显示手指（自动通关点按钮）', 'bool', false],
    ['endDelay', '通关后出现延迟(ms)', 'num', 600, { min: 0, max: 5000, step: 10 }],
    ['endTitle', '标题', 'text', ''],
  ]],
];
export const DEFAULTS = {};
SCHEMA.forEach(([, items]) => items.forEach(([k, , t, d]) => { if (t !== 'button') DEFAULTS[k] = d; }));
// 旧默认值表：{ version: {key: oldDefault} } —— 仍等于旧默认的项换成新默认
const OLD_DEFAULTS = { 2: { beltSpeed: 720, lcDelay: 200, gravity: 2600, dropTime: 160 }, 1: { handImage: '__default__', h5GameName: '圆环传送带', handAnchorX: 0.3, handAnchorY: 0.03, handSize: 0.2, ballRadius: 21, lcDelay: 450, beltSpeed: 600, gravity: 2600, dropTime: 160, colRed: '#cb374e', colBlue: '#426ad0', colGreen: '#1ca74b', colPurple: '#823ec4', colOrange: '#df7e17', colCyan: '#2a9ecc' } };
const REMOVED = ['coinStart', 'coinPerLevel']; // v5：取消金币功能，旧存档里的金币键直接丢弃
const RENAMES = {}; // oldKey: [newKey, convertFn]
export function migrate(raw) {
  const v = raw && raw.version || 0, src = Object.assign({}, (raw && raw.settings) || {}); REMOVED.forEach(k => delete src[k]);
  for (const [ok, [nk, fn]] of Object.entries(RENAMES)) if (ok in src && !(nk in src)) { src[nk] = fn ? fn(src[ok]) : src[ok]; delete src[ok]; }
  for (let ver = v; ver < SETTINGS_VERSION; ver++) { const od = OLD_DEFAULTS[ver] || {}; for (const k in od) if (k in src && src[k] === od[k]) src[k] = DEFAULTS[k]; }
  for (const [k, lo, hi] of [['beltFaceBright', 0.3, 2], ['beltFaceSat', 0, 2.5], ['beltFaceHue', -180, 180], ['beltFaceContrast', 0.3, 2]]) if (k in src) { const n = +src[k]; src[k] = isFinite(n) ? Math.min(hi, Math.max(lo, n)) : DEFAULTS[k]; } // v7：带面调色
  if (src.theme === 'original-ui') src.theme = 'default'; if (src.theme === 'realistic') src.theme = 'default'; // v8：超写实主题已删除，回落原版；v6：原创UI 主题已被「玉石」替换，旧存档回落到原版
  if (!src.exportThemes) src.exportThemes = DEFAULT_EXPORT_THEMES; // v9：导出主题多选
  const out = {};
  for (const k in DEFAULTS) out[k] = (k in src) ? src[k] : DEFAULTS[k];
  return out;
}
export function loadSettings() {
  try { const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); return migrate(raw); } catch (e) { return migrate(null); }
}
export function saveSettings(S) { try { localStorage.setItem(LS_KEY, JSON.stringify({ version: SETTINGS_VERSION, settings: S })); } catch (e) { } }
export function exportSettingsJSON(S) { return JSON.stringify({ app: TOOL_ID, version: SETTINGS_VERSION, settings: S }, null, 2); }
export function importSettingsJSON(txt) { const o = JSON.parse(txt); if (o.app && o.app !== TOOL_ID) throw new Error('不是本工具的设置文件: ' + o.app); return migrate(o); }
