# 调研：音乐→舞蹈生成模型（freestyle 的模型路线）

日期：2026-11-03。目的：评估是否引入"小模型"生成音乐驱动的舞蹈动作，替代/增强当前程序化与动作匹配方案。调研范围：GitHub 公开仓库（网络可达）+ 论文信息。

## 候选方案

| 方案 | 论文/年份 | 输出 | 依赖 | 权重 | 评估 |
| --- | --- | --- | --- | --- | --- |
| **Bailando**（lisiyao21/Bailando，442★） | CVPR 2022 | SMPL 参数序列 | PyTorch **1.6**、essentia、chumpy | 坚果云/Google Drive（可用） | 成熟；但 PyTorch 1.6 与 M2/MPS 不兼容，老依赖难装；需 SMPL 模型（License 申请） |
| **SoulDance**（xjli360，ICCV 2025） | ICCV 2025 | SMPL(X) 全身+手部+面部 | PyTorch 2.x（待确认） | 待查 | 最新质量高；数据集/权重门槛更高 |
| **EDGE**（Meta，CVPR 2023） | CVPR 2023 | SMPL 序列 | PyTorch | 官方仓库未直接检索到 | 可编辑舞蹈生成；SMPL 门槛 |
| **MACE-Dance**（AMAP-ML，SIGGRAPH 2026） | 2026 | 视频/动作 | PyTorch | 211MB 仓库 | 很新，视频生成向 |
| **TM2D**（ICCV 2023） | 2023 | SMPL | PyTorch | 16MB | 音乐+文本→舞蹈 |
| **OdoriVRM**（dulcean，Jupyter） | 2026 | **SMPL→VRM 重定向**（非生成模型） | python 3.11、librosa、mamba | 含 19MB 测试 VRM | 基础设施参考：convert_smpl.py / retarget notebook 可借鉴 |

## 共同障碍（桌面宠物场景）

1. **输出是 SMPL/SMPL-X 参数**：需 SMPL 模型文件（License 人工申请），或自行实现 rest pose/关节层级映射（公开信息但需验证）。
2. **运行环境**：多为 PyTorch 1.6/2.x + conda/mamba；本机（M2 Pro，无 conda，磁盘剩 6.8GB）装 PyTorch + 权重 + 数据约 3–4GB，紧张。
3. **离线生成而非实时**：生成 30 秒舞蹈需数秒–数十秒，不是"信号实时反应"；要实时需分段生成（延迟数秒），与"信号→动作反应"的即时性冲突。
4. **效果不可控**：AI 生成舞蹈的自然度/重心/裙装适配/桌宠尺寸需额外调优与验收。

## 结论与建议

- **模型路线可行但成本高、风险大**，且与"实时信号反应"目标有结构性冲突（离线生成 vs 实时反应）。
- **当前可行路线（已实施）**：真实舞蹈动作库（63 秒已验收素材）+ **信号调制动作匹配**——动作保持真实舞者幅度（踢腿/跳跃/大跨步），音乐能量/重音/速度驱动片段选择与幅度（重音时切换/强调，30 秒内 22 次重音对齐切换）。直接满足"信号→动作反应"，无新依赖。
- **模型作为后备**：若需更丰富动作风格，可用 Bailando/SoulDance 离线生成多风格舞蹈素材，作为动作库扩充（仍由实时信号驱动选段）。前置：SMPL 授权 + PyTorch 环境 + 重定向（参考 OdoriVRM）。
- 下一步：先把"信号调制动作匹配"在真实网易云上长期验证；素材不足时再投入模型路线。

## 更新（同日）：HuggingFace 上确有可用方案，已跑通

进一步检索 HF（直连不通，通过 hf-mirror.com 镜像可用）：

| 发现 | 内容 |
| --- | --- |
| **ZeyuLing/Motius-Bailando-AISTPP** | Bailando 权重（gpt.safetensors 413MB + vqvae.safetensors 250MB），S-Lab License 1.0（研究/非商用） |
| **ZeyuLing/Motius**（GitHub 669MB） | 自包含框架：模型+音频前端+pipeline+representation bridge+evaluator；**torch≥2.0**（非老 1.6） |
| 输出 | `(frames, 24, 3)` AIST++ SMPL-24 关节位置（Y-up，米），**不需要 SMPL 模型授权** |
| 一行 API | `BailandoPipeline.from_pretrained(...).__call__("music.wav")` |

**本机实测（Apple M2 Pro）**：
- 环境：venv + torch 2.15.0（MPS 可用）+ diffusers/librosa 等，磁盘 ~1.5GB（torch macOS wheel 小）
- 推理：70 秒合成音乐 → 4208 帧（60fps），耗时约 20 秒（MPS）
- 重定向：AIST++ 24 关节位置 → VRM 骨骼（方向匹配 + lookAt 保持 roll + VRM0 180°Y 根旋转补偿）→ 渲染正常
- **效果差异**：合成鼓点音乐会生成怪异蹲姿（训练域不匹配）；**真实歌曲（ROTH BART BARON《赤と青》）生成的舞蹈自然**（站立/抬腿/跨步/摆臂），见 `docs/evidence/bailando-real-song.mp4`

**结论**：模型路线**成本可控且可行**（一次性 1.5GB 环境 + 663MB 权重；运行时无模型推理）。下一步：接入桌宠（离线生成舞蹈库 + 重定向播放 + 信号调制），保留"信号→反应"的调制层。
