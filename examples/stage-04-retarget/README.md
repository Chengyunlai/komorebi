# 舞蹈上半身重定向

先看 [user_code](user_code/README.md)，再读 [core](core/README.md)。
图形入口：动作解剖 → 骨架 → 日和 · 映射。骨架与日和共享时间轴，支持慢放、逐帧、增益与镜像校验；近景可以关闭。
这不是音乐生成：输入为固定研究舞蹈，输出为可动范围受限的8通道动作；不补造腿脚或肘部自由度。
[实现记录](../../docs/implementation/stage-04-retarget.md)，当前未提交。
