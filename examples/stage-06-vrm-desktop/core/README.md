# 核心定位

- src/Character.vue：透明VRM桌宠、VRM0坐标适配、待机、语音播放及aa口型、渲染器清理。
- src/motion/vrm-dance.mjs：音乐片段组合到标准骨骼的弧度/米姿态；独立肘/膝，不读取研究BVH。
- src/motion/music-motion-simulator.mjs：原有因果起音/频段/能量片段调度，未移动到信号项目。
- electron/main.cjs：只允许管理窗口用系统选择器导入模型；读取本机缓存，诊断包含renderer与肘/膝值。

单击与拖动仍由App.vue和原有Electron窗口逻辑处理，角色渲染器不修改任务权限。
