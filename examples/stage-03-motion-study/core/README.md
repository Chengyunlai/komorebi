# 核心

正式源码 src/motion-lab：curves.mjs 解析4种曲线插值；bvh.mjs 按声明通道顺序执行正向运动学；MotionStage.vue 使用原生 CubismMotion.doUpdateParameters 直接播放原始参数，在掩码前与曲线采样对照。MotionLab.vue 提供时间轴、慢放、分组独看、参数曲线及完整骨架参考。
原生SDK仍负责动作文件的权威播放，手写采样器用于研究曲线和校验，不代替运行时SDK。
BVH研究参考仅保存在 userData/research-references，CC BY-NC 4.0，不放进源码和应用包。当前未提交。
