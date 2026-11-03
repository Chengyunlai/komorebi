# Stage27 全系统输出声音采集（SOUND-01）

## 本次做什么

产品定位扩展为「声音敏感陪伴者」后的第一项工程：把[声音敏感陪伴者设计](../design/sound-reactive-companion.md)中的 SOUND-01 落地——将原本只 tap 网易云进程的音频采集扩展为**全系统输出采集**，任意应用出声都能进入同一 MusicAnalyzer 特征流；网易云入口保持不变。

实现：`electron/native/audio-tap.swift` 新增 `--system` 模式，使用 `CATapDescription(monoGlobalTapButExcludeProcesses:)`（混合除指定进程外的所有进程输出音频，macOS 12+ 提供的全局 tap），创建私有 tap 后沿用既有 aggregate device + IOProc + 定时泵出管道。`electron/music-audio.cjs` 支持 `start('system')`：以 `--system` 参数启动二进制、worker 沿用同一分析器、状态与提示文案区分系统/网易云。UI：音乐面板新增「系统声音跟拍」按钮，桌宠/歌词/主进程诊断白名单同步加入 system 模式。权限描述文案改为覆盖本机音频（`NSAudioCaptureUsageDescription`）。

## 结果、验证与结论

**验收断言（本机 macOS 26.3，arm64）**：

1. 全系统输出采集：`komorebi-audio-tap --system` 上报 format（48000Hz mono f32le，mode=system）。用 `afplay` 播放 `say` 生成的语音（独立于 Komorebi 的进程），特征流出现能量 0.8–1.0、检出 5 个起音、静音期能量 0 / −120dBFS；播放结束后恢复静音态。→ **任意应用出声产生特征流成立**。
2. 生产链路：`MusicAudio.start('system')` 状态从 starting→active（"正在分析系统音频 · 仅在本机"），信号 streamId=`system-1-2`、sampleFrame 持续推进；静音态正确发布。
3. 网易云回归：`--list` 正常返回进程数（本机为 1）；netease 模式 tap 建立成功并上报 mode=netease（当前未播放故 PCM 为空，无崩溃）。
4. 质量基线：`npm test` 187 项全部通过；`npm run build` 生产构建通过。

证据：本机 CLI 实测输出见本记录文末摘录。H-声音1（macOS 14.2+ 全系统输出 tap 可行）已由实测确认：`monoGlobalTapButExcludeProcesses:` 经 `AudioHardwareCreateProcessTap` 创建成功。

**结论**：SOUND-01 代码完成、已构建、采集链路实测通过；「网易云入口回归不变」成立；**应用内验收已由用户确认**（点击「系统声音跟拍」后桌宠随播放的测试音乐律动、静音收势）。尚未验证的点：麦克风与输入事件（SOUND-02/03 未动）、以及全局 tap 会捕获 Komorebi 自身播放的声音（TTS/预览）这一已知边界（v1 未排除自身进程，记录为后续任务）。

## 资源和调整

- 无新依赖、无新资产；Swift 二进制重新构建并签名（`npm run build:audio`）。
- 新增 CLI 参数 `--system`；`MusicAudio.start` 模式集合扩展为 demo/netease/system。
- 已知边界：全局 tap 会包含 Komorebi 自身出声（系统语音播报、预览音频），v1 不做自身排除，避免影响行为；后续可按进程/包名排除（macOS 26 还提供 `bundleIDs` + `processRestoreEnabled`）。
- 未新增 examples 目录：本阶段是操作系统集成能力，验证走 CLI/集成 harness（记录于本文件），不属于纯算法 example。

## 进一步评估与下一步

- SOUND-01 待验收：由用户在实际运行的应用内点击「系统声音跟拍」确认观感与权限流程。
- 下一步声音线：SOUND-02 麦克风（复用同一特征管线 + 新权限）或 SOUND-03 输入事件；事件分类 RESP-01 依赖 SOUND-01 的特征层，可先做「通知声 vs 音乐」小实验验证 H-声音2。
- 舞蹈主线 DANCE-01（P0）不受影响，仍为下一项主验收。

## 实测证据摘录（本机）

```text
FORMAT: {"mode":"system","channels":1,"format":"f32le","sampleRate":48000}
-- playing afplay test speech --
featureCount: 168  onsets: 5
states seen: silent -> lost -> warming -> silent
maxEnergy: 1.000 | minEnergy: 0.000 | maxPcmRms: 0.2342
（静音期 energy 0 / dbfs -120；播放期 energy 0.8–1.0 / dbfs -12~-25；结束后恢复静音）

集成：start('system') → status active → streamId system-1-2 → sampleFrame 324960（约6.8s）
回归：netease 模式 format {mode:"netease",sampleRate:48000}，--list count=1
```
