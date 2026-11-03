# Stage30 完整舞句与结构标注（DANCE-02）

## 本次做什么

DANCE-02：为完整 63 秒源舞段生成**可追溯的结构标注**——准备/主体/恢复分段、动作重音锚点、朝向转折、脚部接触区间与候选舞句边界。全部标注为**运动学估计**（`kinematic-estimate`）：不是歌曲节拍、不是人工编舞标签、不是足底受力；完整材料不被修改，切片留给 DANCE-03。

实现：`src/motion/dance-structure.mjs` 新增 `annotateDanceStructure(material, {fps, phases})`，输入 `source-motion-material/v1`（stage-17），输出 `dance-structure/v1`：
- 活动度包络：关节角速度模长均值 + 根水平线速度加权，滑动平均；
- 分段：迟滞阈值（峰值 42%/22%）+ 最小持续帧，可由 `phases` 显式覆盖；
- 重音：接触估计的落脚事件 + 活动度局部峰值（标注来源）；
- 朝向：髋宽轴水平角，平滑后检测 ≥2.0 rad/s 转折（0.5s 去抖）；
- 接触：复用 `contact-analysis.mjs` 共享水平面运动学估计，转为区间（plant/airborne/unknown）；
- 候选舞句边界：每 4 个重音一组（明确标注为候选，需人工/听感复核）。

新增 example `examples/stage-30-dance-structure/`；时间线可视化脚本 `scripts/render-dance-structure-timeline.py`。

## 结果、验证与结论

**真实 BVH（dance-short.bvh，1901 帧 @30fps = 63.3 秒）标注结果**（证据：dance-structure-annotation.json（本机研究产物：`../evidence/dance-structure-annotation.json`）、时间线图（本机研究产物：`../evidence/dance-structure-timeline.png`））：

| 项 | 结果 |
| --- | --- |
| 分段 | preparation 0–11.0s（331 帧）｜main 11.0–61.3s（1513 帧）｜recovery 61.4–63.3s（58 帧） |
| 重音锚点 | 69 个（落脚 67 + 动作峰值 2）；主体重音中位间距 0.58s → 动作节奏约 103 BPM（**非歌曲 tempo**） |
| 接触区间 | 137 段（plant 68 / airborne 68 / unknown 1），左右脚交替 |
| 朝向转折 | 33 次（≥2.0 rad/s，0.5s 去抖） |
| 候选舞句边界 | 17 个（每 4 重音一组，约 3.5–5s/组，标注 candidate-group） |

**与视频观察的一致性**：0–8s 入场准备、8s 起持续动作、61s 后收势——分段与视觉一致；46–48s 的高侧踢落在主体段内并被重音锚点覆盖。

**测试**：新增 4 项（分段/重音/接触/朝向/来源标记/显式 phases/错误输入），全套 **194 项通过**。示例运行 0.74 秒完成（1901 帧材料 + 标注）。

**结论**：DANCE-02 交付成立——完整舞段有了可追溯的结构标注与证据，日常/后续切片可以基于重音与候选边界设计，而不必依赖"三个两拍片段"的硬编码。

**人工验证（用户）**：用户对照时间线图与回放视频抽查分段边界、重音锚点、接触区间与朝向曲线，反馈「没问题」——DANCE-02 验收通过。

## 资源和调整

- 新增 `src/motion/dance-structure.mjs`、`tests/dance-structure.test.cjs`、`examples/stage-30-dance-structure/`、`scripts/render-dance-structure-timeline.py`。
- 证据：`docs/evidence/dance-structure-annotation.json`、`docs/evidence/dance-structure-timeline.png`。
- 无新依赖；时间线图用工作区捆绑 Pillow 渲染（运行：`PYTHONNOUSERSITE=1 PYTHONPATH=<dsh python site-packages> <dsh python> scripts/render-dance-structure-timeline.py`）。
- 注意：分段/重音/接触均为运动学估计；候选舞句边界是重音计数分组，不等同真实编舞句。

## 进一步评估与下一步

- **DANCE-03 音乐驱动舞句规划就绪**：用重音锚点与候选边界作为时间对齐候选，同素材不同音乐对照，检验拍点/段落响应、连续过渡与重复控制。
- 可让日常桌宠从"三片段切片"升级为"完整舞句 + 标注锚点驱动"，先在无音乐下跑通完整舞句，再接音乐时钟。
- 若需要人工/听感复核的舞句边界，可在此标注上叠加人工标注字段（材料 schema 已保留 `annotations` 槽位）。
