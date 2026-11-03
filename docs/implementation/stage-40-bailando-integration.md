# Stage40 Bailando 模型接入（音乐→舞蹈生成）

## 本次做什么

调研确认 HuggingFace 上有可用的音乐→舞蹈生成方案，并在本机跑通：

1. **模型**：`ZeyuLing/Motius-Bailando-AISTPP`（HF，gpt 413MB + vqvae 250MB，S-Lab License 1.0 研究/非商用）。
2. **框架**：Motius（GitHub，自包含：模型+音频前端+pipeline+representation bridge），依赖 torch≥2.0。
3. **本机环境**：`~/.komorebi-motion-venv`（Python 3.13 venv + torch 2.15.0 MPS + diffusers/librosa 等，约 1.5GB 磁盘）。
4. **推理**：`BailandoPipeline.from_pretrained(...)("music.wav")` → `(1, frames, 24, 3)` AIST++ SMPL-24 关节位置 @60fps；70 秒音乐约 20 秒（MPS）。
5. **重定向**：AIST++ 24 关节 → VRM 骨骼（方向匹配 + lookAt 保持 roll + VRM0 180°Y 根旋转补偿 + **upperChest 链修正**），渲染到角色验证。

## 结果、验证与结论

- **真实歌曲**（ROTH BART BARON《赤と青》35 秒）生成舞蹈：站立/抬腿/跨步/摆臂等动作自然，见 `docs/evidence/bailando-real-song-v2.mp4`。
- **合成鼓点音乐**会生成怪异蹲姿（训练域不匹配）——说明该模型对真实音乐有效。
- **重定向问题与修复**：初版手臂向后/袖子拉伸，根因是 VRM humanoid 有 `upperChest` 骨骼而映射跳过了它（chest 以上父级链错位）；修正链 `hips→spine→chest→upperChest→neck→head` 后姿态正常。另修正渲染帧数映射（源 60fps → 输出 15fps）。
- **成本**：一次性 1.5GB 环境 + 663MB 权重；运行时无模型推理（离线生成）。

**结论**：模型路线在本机可行，输出动作质量明显优于程序化 freestyle。**下一步**：接入桌宠（舞蹈库离线生成 + 重定向播放 + 信号调制），需要解决"实时性"（离线生成 vs 实时反应）与"动作挑选/过渡"。

## 资源和调整

- 证据：`docs/evidence/bailando-real-song.mp4`（初版）、`bailando-real-song-v2.mp4`（修复 upperChest 后）、`bailando-real-song-joints.npy`（关节数据）。
- 环境：`~/.komorebi-motion-venv`（不入库）。
- 调研记录更新：`docs/research/music-to-dance-models.md`。

## 进一步评估与下一步

- 接入桌宠：离线用真实歌曲生成舞蹈库 → 播放时重定向 + 信号调制（能量/重音）。
- 需要决定"反应性"形式：预生成舞蹈循环（开销小）vs 分段实时生成（延迟 20-30 秒）。
- 动作质量仍需筛选/平滑（部分帧手臂伸展过长、裙装穿模可能）。
