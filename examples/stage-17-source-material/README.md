# 完整源动作与移动窗口

先执行 `node examples/stage-17-source-material/user_code/main.mjs`，使用原创合成骨架；传入本机BVH及明确的单位尺度时可检查研究源（不会写出原始姿态）：

```
node examples/stage-17-source-material/user_code/main.mjs /absolute/reference.bvh 0.01
```

0.01是调用者声明一个源单位等于一厘米，不是格式自动检测的结论。当前例子仅研究材料/过渡数值，未替换日常播放器。实现与限制见 [记录](../../docs/implementation/stage-17-source-material.md)。
