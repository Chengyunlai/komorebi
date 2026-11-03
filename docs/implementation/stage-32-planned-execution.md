# Stage32 舞句计划接入实时执行

## 本次做什么

把 DANCE-03 的离线舞句计划接进实时执行链路：音乐时钟驱动、按计划选句与时间伸缩、身体执行复用日常管线。新增 `src/motion/planned-phrase-player.mjs` 的 `createPlannedPhrasePlayer(frames, plan, opts)`：

- 接口与日常播放器一致：`step({dt, active, beat, clockEpoch, bpm, timing})` → pose（rotations/hips/feet/weight/source…），直接交给 `createLocalDanceExecutor`。
- 映射：`musicTime = beat × beatSeconds` → 找到 plan 中的 phrase → `sourceTime = phrase.source.startTime + (musicTime - phrase.startTime) / timeScale` → 在编译帧（15Hz）上插值（四元数 slerp + 位置线性插值）。
- **句切换 crossfade**：切换时从上一句当前姿态在 `transitionSeconds`（默认 0.35s）内 smoothstep 混合到新句姿态——消除不同源句拼接的硬跳。
- 输出 `plan` 诊断字段（当前句/源句/伸缩/模式/reason），供研究窗口与报告展示。

接入点：
- `prepareLocalDance(..., {full:true})` 现在把编译帧附到 `player.bank.frames`；
- `Character.vue` 新增 `configurePlannedPhrases({music})`：编译完整帧 → 构建源材料 → 结构标注（DANCE-02）→ 规划（DANCE-03）→ 建 planned player；dance-frame 报告附带 `planned` 信息；
- 研究窗口「音乐执行 · 集成」页新增「音乐规划执行 · 展开舞句」按钮：离线分析 demo PCM（27 秒确定性音频）得到能量曲线与 BPM → 规划 → 用同一音频流驱动播放，面板实时显示当前句/源句/伸缩/模式。

## 结果、验证与结论

**数值验证**（真实 VRM 编译帧 + 真实结构 + demo 音乐 plan，模拟 30fps 执行 27 秒）：

| 项 | 结果 |
| --- | --- |
| 计划 | 10 句、8 个不同源句、重复 2 次、重音→拍点中位误差 **112 ms** |
| 执行 | 11 次句切换、权重淡入到 1、全程无 NaN |
| 姿态连续性 | 每步关节最大变化 mean **0.285 rad**（约 16°/步）、max 0.975 rad 来自源动作本身（改变过渡时长 0.25→0.35s 不改变 max，说明不是切换硬跳） |

**视觉证据**：planned-execution.mp4（本机研究产物：`../evidence/planned-execution.mp4`）（27 秒，15fps；10 个舞句按计划切换、带过渡；12 帧抽查无穿模/无跳变）。

**测试**：新增 3 项（音乐拍→源时间映射、边界钳制/淡出/时钟重置、非法输入），全套 **202 项通过**。

**用户反馈与修正（v2）**：用户观看 v1 后反馈"有些动作衔接会过于快，其它正常"。原因：固定 0.35 秒 crossfade 对姿态差异大的句间拼接不够。修正为**自适应过渡**——切换时用两句话的姿态距离（关节最大角差 + 双脚位置差）计算过渡时长：`clamp(0.25 + maxAngle*0.3 + feetDistance*0.8, 0.3, 1.0)` 秒，并新增 4 项测试（大差异过渡更长）。同时规划层加入**朝向连续性代价**（句间髋宽朝向差越大代价越高，减少大转向拼接）。修正后 27 秒执行视频的 9 次切换过渡时长为 [1,1,1,1,1,1,1,0.94,1] 秒（v1 固定 0.35s）。证据：planned-execution-v2.mp4（本机研究产物：`../evidence/planned-execution-v2.mp4`）；v1 保留为 planned-execution.mp4（本机研究产物：`../evidence/planned-execution.mp4`） 对照。测试 203 项通过。

**节奏一致性修正（v4）**：v2 的自适应过渡导致"有的正常、有的慢、有的快"（用户反馈）。根因是**每句时间伸缩在 0.41–2.16× 之间跳变**（均匀窗口与所选句长不匹配），过渡时长又随姿态差异变化。修正：
1. **选句后反推窗口**：先选源句，再按伸缩范围 [0.85,1.15] 定窗口长度，使每句速度接近 1.0×；
2. **固定过渡**：句间 crossfade 统一 0.45 秒（不再自适应）；
3. **多粒度句库**：单组/2组/3组合并句，使 5–6 秒的长句可选（原候选句约 3 秒，只能靠拉伸）；
4. **能量收尾检测**：音乐静音前的计划结束（demo 的 24–27 秒零信号不再被拉伸填满）。
真实验证（demo 音乐 27 秒）：**5 句、4 次切换（每句 4.2–4.8 秒）、伸缩 0.95–1.15×、重音对齐 58–146ms**。证据：planned-execution-v4.mp4（本机研究产物：`../evidence/planned-execution-v4.mp4`）（v1/v2 保留对照）。203 测试通过。

**转身句限速（v5）**：用户指出"第 13 秒转身会很快，其它正常"。定位：该句含源舞段转身（orientation.turns 在 12.4/12.9s），却被 1.15× 加速。修正：**含转身的句子不给加速**（速度上限 1.0×），慢句仍可加速；同时尾部剩余不足时留白收尾（消除 0.68× 慢动作尾句）。v5 实测：6 句、伸缩 [0.95,1,1,1,1,1]、13 秒附近 1.0×、对齐中位 158ms。证据：planned-execution-v5.mp4（本机研究产物：`../evidence/planned-execution-v5.mp4`）。

**人工验收（用户）**：用户观看 v5 后确认"可以，这一版没问题"——DANCE-03 的计划→执行链路与节奏一致性验收通过。

**结论**：DANCE-03 的"计划 → 实时执行"链路跑通——同一动作库、音乐驱动选句与伸缩、可解释诊断，替换了原先固定三片段调度的硬编码路径（当前只在研究页启用，未切换日常默认）。**未验证**：真实歌曲（非 demo PCM）下的半/倍速与漏拍稳定性、日常桌宠默认启用、完整观感（需用户看视频/研究窗口确认）。

## 资源和调整

- 新增 `src/motion/planned-phrase-player.mjs`、`tests/planned-phrase-player.test.cjs`；`local-dance.mjs` 暴露编译帧；`Character.vue` 新增 `configurePlannedPhrases` 与报告字段；`MusicExecutionStudy.vue` 新增规划执行按钮与状态显示。
- 证据：`docs/evidence/planned-execution.mp4`。
- 无新依赖；离屏渲染脚本为一次性验证工具，未入仓库。

## 进一步评估与下一步

- 用**真实歌曲**（MusicAnalyzer 实际特征流）驱动同一规划+执行链路，检验半/倍速、漏拍、段落变化（MUSIC-01）。
- 若观感合格，把 planned player 设为日常桌宠的默认舞句路径（替换 `createBeatMotionBank` 三片段），并做 M2「音乐组织舞蹈」对照验收（同素材/同人物/不同音乐的视频矩阵）。
- 过渡与切点仍可优化：句间可尝试接触/朝向连续性约束（stage-20 的思路）而非仅支撑脚代价。
