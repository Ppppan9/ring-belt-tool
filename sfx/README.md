# 解环传送带 音效（sfx/）

全部音效由 `src/audio.js` 用 WebAudio 程序化合成（无外部素材、无版权问题）。
本目录的 .wav 是用 OfflineAudioContext 离线渲染出的同一份声音（44.1kHz、单声道、16-bit PCM，音量 0.8）。
重新生成：`node tools/export_sfx.mjs`

| 文件 | 设置项 | 何时播放 |
|---|---|---|
| pop.wav | sfxPop 入盒 | 球从传送带落进对应颜色的盒子孔位 |
| tick.wav | sfxTick 抓环 | 拖动一个被锁住（还挂着子环）的环时，环抖动提示 |
| land.wav | sfxLand 上传送带 | 球从漏斗落到传送带孔位上 |
| shatter.wav | sfxShatter 碎裂 | 环被解开 / 碎裂消失 |
| boxDone.wav | sfxBoxDone 盒满 | 一个盒子装满，飞走 |
| complete.wav | sfxComplete 过关 | 关卡完成 |
| click.wav | sfxClick 按钮 | 已定义但当前游戏流程中没有调用（预留的按钮音） |
