# 音乐表达与舞句组织

先运行 `node examples/stage-11-musical-director/user_code/main.mjs`，再读 [core](core/README.md)。
示例使用合成信号契约，展示轻柔→中等→强烈→回落时的响应与编排，不播放商业音乐。

六类动作仍可用，但不再为了遍历素材而每句必换。稳定音乐中允许主题重复、呼应和回归；明显能量变化在下一个兼容边界重新选择。内部八拍/四句结构是程序编排，不是准确识别的音乐小节、主歌或副歌。

真实播放入口保持不变；角色已加载时 `open -n release/Komorebi.app --args --music-audio` 用于本机网易云集成复测，`--music-demo` 用于24秒原创音频。
