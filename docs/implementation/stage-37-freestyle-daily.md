# Stage37 Freestyle 日常桌宠与自动跟拍

## 本次做什么

用户明确目标：①根据音乐信息 **freestyle**（即兴，而非编排式舞句拼接）；②用**实际音乐**（日常开网易云）长期测试。本轮：

1. **评估现有 freestyle 能力**：`vrm-dance.mjs` 本身就是参数化即兴引擎——6 个 8 拍主题（侧踏摆臂/宽步绕臂/前点胸腰/提膝对摆/斜踏伸展/后点低律动）× 每 8 拍主题变奏 × 音乐特征（能量/频段/重音/段落）驱动全身参数，不是固定舞段。渲染基线视频 `docs/evidence/freestyle-baseline.mp4` 验证实际表现（27 秒，含静音收势）。
2. **日常桌宠自动跟拍**：此前播放网易云时需要手动点「音频跟拍」；现在 `musicChanged` 在网易云开始播放且 `musicEnabled` 开启时自动 `musicAudio.start('netease')`，暂停/停止时自动关闭采集（不静默保持 tap）。

## 结果、验证与结论

**Freestyle 基线**：视频抽帧确认动作正常（侧踏、摆臂、身体倾、脚步移动、静音段收势）。6 主题 + 8 拍变奏 + 音乐驱动，属"程序化即兴"。

**日常桌宠实测**（真实网易云 MGMT《Kids》播放中）：
- app 启动后 **自动**进入 `musicAudio mode=netease / status=active / state=tracking`（无需手动）
- pet 窗口：`danceBeat` 从 33.2 → 40.6 持续增长、支撑脚 left/right 切换、timing 由 estimated 转 tracking
- 暂停播放时自动停止采集（避免长期静默占用 tap）

**结论**：日常桌宠现在"开着网易云 = 自动 freestyle"，满足用户长期测试要求。freestyle 动作丰富度按用户选择**先保持现状观察**。

## 资源和调整

- 修改 `electron/main.cjs`（musicChanged 自动启动/停止 netease 采集）。
- 证据：`docs/evidence/freestyle-baseline.mp4`（vrm-dance 基线）。
- 214 测试通过。

## 进一步评估与下一步

- 用户长期观察（一天开着网易云）：重点看切歌、暂停恢复、高能量段落、长时间运行的稳定性与 CPU。
- 若动作丰富度不足，再增强主题/动作词汇（按音乐结构调度）。
- 若自动采集带来系统权限或性能问题，回退为手动开关。
