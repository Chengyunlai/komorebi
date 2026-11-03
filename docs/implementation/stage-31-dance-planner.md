# Stage31 音乐驱动舞句规划（DANCE-03）

## 本次做什么

DANCE-03：把 DANCE-02 的结构标注接到音乐上——**离线舞句规划器** `planDancePhrases({structure, music, options})`，输入完整舞段结构（候选句、重音、接触、朝向）+ 音乐描述（BPM、能量曲线），输出可解释的 `dance-plan/v1`：每个音乐时窗选用哪个源舞句、时间伸缩多少、重音到拍点的对齐误差、为什么这样选。

核心策略（全部确定性启发式，无学习）：
- **音乐段**：能量曲线的 fast/slow 趋势与电平判 mode（quiet/flow/drive/rising/settling，复用 stage-11 词汇），合并成段；明确不是歌曲段落识别。
- **时间窗**：每段均匀切分（避免段尾被拉长），句长接近窗口的句优先，伸缩比限制在 0.8–1.25。
- **句选择**：长度匹配 + 新颖度（drive/rising 更爱新句，quiet/settling 更爱熟悉句）+ 能量匹配 + 支撑脚连续性；重复次数硬上限（语料不足时放宽并标记 `repeatLimitRelaxed`）。
- **对齐**：源句重音映射到音乐时间，统计到最近拍点的中位误差；每句输出 reason 与来源。

新增 example `examples/stage-31-dance-planner/` 与可视化脚本 `scripts/render-dance-plan-comparison.py`。

## 结果、验证与结论

**同一素材 × 三种音乐**（真实 63 秒舞段结构；合成能量曲线，无音频文件；证据 dance-plan-comparison.json（本机研究产物：`../evidence/dance-plan-comparison.json`）、对照图（本机研究产物：`../evidence/dance-plan-comparison.png`））：

| 音乐 | 句数 | 不同源句 | 重复 | 时间伸缩 | 重音→拍点中位误差 | 音乐模式 |
| --- | --- | --- | --- | --- | --- | --- |
| 90 BPM · 平缓 flow | 7 | 4 | 3 | 0.93–1.17× | 154 ms | flow |
| 120 BPM · 渐强 | 7 | 6 | 1 | 0.90–1.20× | 156 ms | quiet → flow → drive |
| 150 BPM · 高能量 drive | 7 | 7 | 0 | 0.84–1.26× | 136 ms | drive |

**可解释响应成立**：平缓音乐反复使用熟悉句（重复 3 次）；渐强音乐随能量递进换句（重复降至 1）；高能量音乐全部换新（重复 0）。时间伸缩被限制在约 0.84–1.26×，没有出现早期版本的 0.33×/1.60× 极端拉伸；重音对齐误差 136–156ms，均小于一拍（120 BPM 一拍 500ms）。

**测试**：新增 5 项（确定性、时间线无缝覆盖、90/120/150 BPM 对齐 ≤1 拍、能量形状改变计划、重复上限与可解释性、非法输入），全套 **199 项通过**。

**结论**：DANCE-03 交付成立——"同一动作库、不同音乐 → 可解释的不同舞句计划"的链路跑通，为后续接入实时播放（音乐时钟驱动）与 M2 验收提供基线。**注意**：这是离线规划与合成能量曲线验证，不是真实歌曲的听感验收，也未识别歌曲段落/小节。

## 资源和调整

- 新增 `src/motion/dance-planner.mjs`、`tests/dance-planner.test.cjs`、`examples/stage-31-dance-planner/`、`scripts/render-dance-plan-comparison.py`。
- 证据：`docs/evidence/dance-plan-comparison.json`、`docs/evidence/dance-plan-comparison.png`。
- 无新依赖。未接入日常桌宠播放器（规划仍是离线工具）。

## 进一步评估与下一步

- **接入实时播放**：把 plan 交给日常执行管线（音乐拍时钟 → 源帧映射 → 末端执行），替换 `createBeatMotionBank` 的三片段调度；需验证过渡连续性与静音收势。
- **真实歌曲对照**：用 MusicAnalyzer 实际特征流（而非合成曲线）驱动规划，检验半/倍速、漏拍与段落变化下的稳定性（MUSIC-01 的真实歌曲基准）。
- **M2 验收准备**：固定素材/人物/音乐，输出"音乐变化 → 动作变化"的对照视频，交用户做观感确认。
