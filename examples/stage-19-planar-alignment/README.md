# 交接位置与朝向

运行 `node examples/stage-19-planar-alignment/user_code/main.mjs`，默认原创合成骨架；可传本机BVH路径和明确的米/源单位尺度：

```
node examples/stage-19-planar-alignment/user_code/main.mjs /absolute/reference.bvh 0.01
```

研究窗口：材料 · 连续过渡 → 空间对齐切换“未对齐 / 水平位置与朝向”；默认固定地面机位、18°俯角。不同方案使用相同源时刻，不修改源动作。

[实现记录](../../docs/implementation/stage-19-planar-alignment.md)
