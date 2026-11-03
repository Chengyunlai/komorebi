# GitHub 实机演示视频

日期：2026-11-03。用户认可本轮起音回应修复候选，并要求上传代码、更新 40 秒真实录制视频。中英文首页已改为新版演示。

- 当前附件：https://github.com/user-attachments/assets/663b17d3-a19e-47e1-b2c2-a4897273cd81
- 实际源码：`029df6a`（保留起音强度与身体重音修复）。
- 录制范围：《Boom Boom Pow》歌曲开头，实际桌宠窗口和系统播放声音，原速；透明窗口区域垫深灰底便于观看。
- 导出：40.000 秒，290×500、30fps，H.264 + AAC（48kHz 单声道），2,991,555 字节；SHA256 `ac08d0c6b2e46e7b366383ecd32b2157ee0ac8c2c119c0b05ba94627da7a882e`。
- 录制未报告异常；音频平均 -13.4dB、峰值 -0.7dB，无削波。音画按首块 PCM 到达时间减去块时长与 screencast 时间戳对齐，属于传输延迟近似，不是零延迟校准。
- 来源：Black Eyed Peas《Boom Boom Pow》；用户本机导入的 Jessair Cute Model；权利边界见 [第三方说明](../../THIRD-PARTY-NOTICES.md)。
- 原始录制与中间帧保留本机 `docs/evidence/`，不提交。公开视频作为 GitHub 附件引用，中英首页使用同一个地址。

历史：用户此前选定的 30 秒版本保留于 https://github.com/user-attachments/assets/217548af-7558-4319-9b74-b3ae99c29fe9 ，由新版替换首页引用；附件关联记录保留在 [演示媒体 #5](https://github.com/Chengyunlai/komorebi/issues/5)。

本次认可和展示更新不代表精准踩拍、完整舞蹈或长期桌面里程碑全部通过。


## 手部烟花版40秒本机重录（2026-11-03）

用户要求重新录制同一首歌40秒。已录制 Boom Boom Pow 开头的实际桌宠窗口、歌词、手部烟花与实际系统播放声音，原速；只将透明区域垫深灰底。实际产物：`docs/evidence/github-preview/hand-fireworks-opening-40s/komorebi-boom-boom-pow-hand-fireworks-opening-40s.mp4`，本机保留，当前GitHub首页附件仍为上文公开版本。

规格：40.000秒，290×500，30fps/1200帧，H.264 + AAC/48kHz单声道，3,039,095字节；SHA256 `0509b4beba2180c2331797dd2463693e003ef3a1df368b6f5a9cc182394c8ae6`。录制44.66秒/1273原始帧，按screencast真实时间戳重采样至30fps；音画以MediaRemote当前播放进度反推歌曲零点，结合首PCM到达减块时长对齐，存在传输延迟近似。没有加速、补配音乐或后期补烟花。

录制未报告运行/采集gap异常；抽帧确认完整人物、歌词与可见手部烟花；音频平均约-13.5dB、峰值-0.3dB。导出后ffprobe确认音视频各40.000秒。曾发现首次拼接导出时长不足，已按真实帧时间戳重采样并重新导出，最终以ffprobe结果为准。

用户在录制后反馈切歌残留动作，修复另见[音乐会话重置](music-track-reset.md)。本录像先于该修复录制，不将单曲演示冒充切歌验证。


## 切歌修复后重新录制（2026-11-03，当前本机候选）

用户再次要求重录，已使用实际运行的切歌修复后版本录制同一首 Boom Boom Pow 开头40秒，包含人物、歌词、手部烟花与实际系统播放声音，原速。产物：`docs/evidence/github-preview/track-reset-fireworks-40s/komorebi-boom-boom-pow-track-reset-40s.mp4`。

录制前确认网易云已恢复为实际播放来源；播放状态下seek到0，重新启动日常音频会话，避免沿用此前音乐历史。原始1218帧/44.717秒，未报告运行或采集gap异常；按真实时间戳重采样1200帧，并按MediaRemote elapsedTimeNow反推歌曲零点。音画仍存在PCM传输延迟近似。

ffprobe确认音频/视频均40.000秒，290×500/30fps，H.264 + AAC（48kHz单声道），3,142,144字节；SHA256 `b9685991d8147a0c452f72944d57ec5170fe477bd87b3f96498ddc9c679cc695`。音频平均-13.5dB、峰值0.0dB；抽帧已确认人物、歌词和手部烟花。原始PCM、帧、元数据及视频均仅本机保留。本次为录像交付，未修改运行源码，不重复运行此前已通过的253项测试。

此版替代前一轮“修复前录像”作为当前本机观看候选；单曲录像不另充当快速切歌验收。


用户复核后反馈此候选观感退步。后续逐段检查确认捕获间隙与手势时机问题，当前本机候选观感未通过，见[录像复核](fireworks-recording-review.md)。40秒规格合格不代表动画连续性合格。


## 优化后原生窗口版（2026-11-03，当前本机候选）

已先完成捕获路径与手势烟花优化，再重新录制40秒。当前候选为 `docs/evidence/github-preview/optimized-fireworks-final-40s/komorebi-boom-boom-pow-optimized-40s.mp4`，音视频均40.000秒；原生捕获最大间隔33ms、rAF最大18ms，成片无>150ms冻结检出，4次手部烟花。规格、SHA256、对照证据和录制命令见[优化记录](fireworks-capture-optimization.md)。公开视频附件仍沿用最初公开版本，后续发布独立处理。
