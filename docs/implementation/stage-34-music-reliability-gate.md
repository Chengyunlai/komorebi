# Stage34 音乐信号可靠性门控（MUSIC-01 收尾）

## 本次做什么

两首真实歌曲对照（stage-33）暴露：宿主分析器的 BPM 在节奏密集型歌曲上不可用（Boom Boom Pow：误差 31.9%、置信度 0.20、tracking 9.9%），在节奏清晰的歌曲上可用（Kids：误差 1.6%、置信度 0.62、tracking 50.8%）。本阶段给下游加**可靠性门控**：根据最近 2 秒的特征样本判断信号是否可信，可信时用拍对齐的舞句计划，不可信时**降级为起音/能量反应式**（不用 BPM 网格）。

新增 `src/motion/music-reliability.mjs`：
- `judgeMusicReliability(samples)`：窗口内 tracking 占比 ≥50%、置信度中位 ≥0.55 → 可信；否则给出明确原因（`silent`/`low-tracking`/`low-confidence`/`insufficient-samples`）；
- `createReliabilityGate()`：带迟滞（0.8 秒），避免帧间抖动导致模式反复切换；模式 `beat-aligned` 或 `reactive`；
- `createReliabilityMonitor()`：滚动窗口便捷封装。

接入：`Character.vue` 新增 `reliabilityGate` prop——启用时每帧把 `state/confidence` 推入门控，`reactive` 模式下 planned 播放器淡出（`active=false`），由 vrm-dance 的即兴反应动作主导；报告附带 `reliability` 字段。研究窗口「音乐规划执行」模式自动启用，并显示当前门控状态与原因。

## 结果、验证与结论

**门控对两首真实歌曲判定正确**（用 stage-33 实测聚合值重放；证据 reliability-gate-assessment.json（本机研究产物：`../evidence/reliability-gate-assessment.json`））：

| 歌曲 | 实测置信度/tracking | 门控判定 | 模式 |
| --- | --- | --- | --- |
| MGMT《Kids》 | 0.62 / 50.8% | 可信（tracking-locked） | **拍对齐** |
| Black Eyed Peas《Boom Boom Pow》 | 0.20 / 9.9% | 不可信（low-tracking） | **反应式降级** |

**测试**：新增 5 项（可信判定、低置信/低跟踪判定、静音/稀疏/样本不足、迟滞门控、滚动监控），全套 **213 项通过**。

**结论**：真实歌曲下不再无条件相信 BPM——可靠时拍对齐、不可靠时反应式，这是"声音敏感陪伴者"的务实边界。**未验证**：真实歌曲下的实际观感（需要你播放歌曲并用研究窗口/桌宠观察降级效果）、门控阈值在更多歌曲上的鲁棒性。

## 资源和调整

- 新增 `src/motion/music-reliability.mjs`、`tests/music-reliability.test.cjs`；`Character.vue` 接入门控 prop 与报告；`MusicExecutionStudy.vue` 显示门控状态。
- 无新依赖；阈值可配置（`RELIABILITY_DEFAULTS`）。

## 进一步评估与下一步

- 真实播放验证：播放 Kids（应拍对齐）与 Boom Boom Pow（应降级）观察动作差异；
- 门控阈值需在更多歌曲上校准（可先用 10 首不同风格的采集数据做离线校准）；
- 反馈给独立信号项目：密集节奏型的拍跟踪是本轮唯一不可用的环节，可作为其真实歌曲基准的目标。
