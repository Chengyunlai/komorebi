# PCM → 信号 → 动作片段

先运行 [user_code](user_code/README.md)，再读 [core](core/README.md)。
项目根目录命令：`node examples/stage-02-audio-motion/user_code/main.mjs`。
输入是24秒原创PCM，输出能量、频段、触发次数及片段名称；14–16秒静音段收势。这里测试真实音频分析与动作组合，不测试商业歌曲 BPM 准确率、审美或真实音频采集延迟。
[实现记录](../../docs/implementation/stage-02-audio-motion.md)，当前未提交。
