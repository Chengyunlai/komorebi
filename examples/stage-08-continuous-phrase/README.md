# 连续舞句

先运行 `node examples/stage-08-continuous-phrase/user_code/main.mjs`，再读 [core](core/README.md)。
输出A→B接缝位置/速度差，以及同一舞句在90/120 BPM下的连续相位。

桌面角色默认使用此控制器。右键 → 音乐 · 网易云，开启真实跟拍或原创试跳。无音频行为试用也使用同一舞句，仍标记为预览。

为可复现的本机集成测试，已运行且角色加载完成后可执行：
`open -n release/Komorebi.app --args --music-demo`（播放24秒原创音频并分析同一PCM）；
`open -n release/Komorebi.app --args --music-audio`（分析网易云当前音频，不控制播放器）。这些是已运行实例的测试命令，首次启动仍走正常角色载入。

八拍是内部编排单位，不是已识别的歌曲小节。低置信度用配置拍速估计；没有预知未来声音。连续性与接触测试不能替代舞蹈审美评审。
