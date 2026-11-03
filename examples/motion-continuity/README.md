# 连续动作播放与手部碎抖回归

```sh
node examples/motion-continuity/user_code/main.mjs
```

仅使用合成姿态，不需要 VRM、BVH、动作库或音乐文件。先运行 `user_code/main.mjs`，再读 `core/README.md`。

同一播放器输入“只有手动”和“身体协调运动”两段录制，叠加快速能量/重音变化。断言有身体材料时不选手部独动片段，停止后权重归零。额外回归见 `tests/freestyle-motion.test.cjs`，覆盖连续窗口、移动过渡、素材边界、静止源不被能量抖动和启停。

此例验证控制契约，不代表真实人物观感通过。实际动作库仍由用户在本机提供。见[实现记录](../../docs/implementation/motion-playback-continuity.md)。
