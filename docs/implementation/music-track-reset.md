# 切歌取消旧动作

日期：2026-11-03。用户在手部烟花录像过程中指出切歌后仍延续上一首未完成动作。本轮归属 M3 音乐生命周期与动作执行接口。

## 事实、问题与修复

1. 原宿主仅在 playing 状态变化时启停网易云采集。playing→playing 的曲目变化不重置分析器，因此旧能量、起音、BPM 历史可进入新歌。新增 `electron/music-track-boundary.cjs`，按 source/title/artist/album 判断曲目变化；歌词后补 songId、进度和歌词状态不触发重置。
2. `MusicAudio.resetTrack()` 清空近期 PCM，发布 signal:null，将 reset-track/epoch 发给现有 worker；worker 重新建立分析器及起音交付状态，产生新 streamId，宿主丢弃旧 epoch 已在途的特征。不重启原生 tap，不改变独立 vendor DSP。切歌时也停止显式研究生成器，避免旧生成队列继续写身体。
3. `createFreestyleMotionPlayer.step()` 原先接收 clockEpoch 却完全忽略，因此新流/暂停后仍沿用原 current、position、outgoing、segmentAge、选段历史、rate 和重音包络。现在 epoch 改变即清理会话；若仍有可见旧姿态，冻结这一帧并在至多180ms内淡出，不再推进旧素材。随后按新能量重新选窗，正常350ms淡入。新增 reset() 使用同一清理逻辑；素材预处理缓存保留。
4. 原创程序后备同样清除音乐风格/手臂选择历史与旧可信速度。为保持身体连续，当前 features 和单调内部 beat 数值保留；这是动画时钟，不代表上一首的舞句继续执行。`createLocalDanceExecutor` 原有 epoch 边界清理仍工作。

调用索引：`main.musicChanged` → `createMusicTrackBoundary` → `MusicAudio.resetTrack` → worker 新 streamId → Character/VRMDanceController 新 clockEpoch → freestyle 会话释放/重新选窗。Character 新增 danceSession/danceTransition 只读 DOM 诊断。

## 验证与边界

- `npm run verify`：253项测试通过、Vite生产构建通过；Electron CJS 语法检查与 diff 检查通过。新增测试覆盖 playing→playing 边界、歌词补全不误判、不重启tap的重置、真实worker新流/epoch、播放中取消窗口与静态淡出、旧pulse归零和新曲入场等。
- 本机桌宠重启载入新主进程和渲染构建；任务队列为空后才重启。实机从 Boom Boom Pow 切到 Dont Stop Movin'，音频流 netease-1-2 → netease-3-2 → netease-3-3，动作会话1→2→3，旧源帧约293.74/301.75，曲目更新后重新选到72.00，权重为0、pulse为0，随后新曲重新进入库动作。
- 这次实际播放器中间产生暂停/重启，旧姿态已自然淡出，所以未采到 session-release 帧；不能据此宣称实际播放已覆盖不中断的 playing→playing 收势。该分支由确定性回归覆盖：旧动作不再前进，短释放后匹配干净播放器的新选段。实机摘要 `/tmp/komorebi-track-reset-live.json`。
- 曲目元数据到达之前无法预知用户已切歌，最多仍受播放器元数据交付延迟影响；未声称零延迟。不同曲目完全相同标题/歌手/专辑时仍无法仅凭这些字段区分。长期/快速连切观感待用户确认。

首版40秒烟花演示在此修复之前录制；用户再次要求重录后，已另交付切歌修复后版本的40秒候选（track-reset-fireworks-40s目录）。见[视频记录](github-demo-video.md)。M1/M2/M3整体状态不因此标为完成。
