# Stage41 流式音乐→舞蹈生成（实时接入桌宠）

## 本次做什么

按用户选择（流式生成，延迟 1-2 秒）实现：

1. **Python 常驻服务** `scripts/bailando-stream-server.py`：启动加载 Bailando（MPS），stdin/stdout JSON 协议；每条请求 = 最近音乐窗口 → 生成下一段动作（step 秒），仅返回新增部分。
2. **音频 PCM 缓冲**：`music-audio.cjs` 增加环形缓冲（保留最近 16 秒 PCM）+ `recentWav(seconds)`，供流式生成取音频窗口。
3. **主进程管理器** `dance-stream.cjs`：启动/停止 Python 服务、每 `stepSeconds`（3s）取最近 10s 音频 → 写临时 WAV → 请求生成 → 广播 `dance-stream` 段到桌宠；音乐播放自动启动、暂停自动停止。
4. **渲染侧**（Character.vue）：
   - 重定向：AIST++ 24 关节 → VRM（方向匹配 + lookAt 保持 roll + VRM0 180°Y 根旋转补偿 + upperChest 链）；
   - 播放：段队列 + 播放头（60fps 源，渲染按 dt 推进）；**启动缓冲 2 段**避免卡顿；**段边界交叉淡化 0.22s** 消除跳变；无数据时淡出回本地 freestyle；
   - pet 窗口监听 `dance-stream` 事件。

## 结果、验证与结论

**本机实测（M2 Pro）**：
- 模型加载 5.3s；首段生成 ~2.9s（预热）；**后续每段 0.7–0.9s**（3 秒动作）→ 生成速度 ~14x 实时
- 流式测试：12 段、1908 帧（31.8s 动作），拼接连续
- 桌宠实测（真实网易云歌曲《ぽいぽい?》/《Kissy Kissy》）：流式状态 running，连续生成 10-23 段；连续帧截图显示动作随音乐流畅变化（张臂/踢腿/举手/跨步），无跳变
- 217 测试通过

**结论**：流式实时舞蹈链路跑通——音乐 → 采集 → 每 3 秒生成下一段 → 重定向 → 播放，延迟约 1–2 秒（生成 ~0.8s + 窗口）。无需预生成素材库。

## 资源和调整

- 新增 `scripts/bailando-stream-server.py`、`electron/dance-stream.cjs`；修改 `music-audio.cjs`（PCM 缓冲）、`main.cjs`（管理器/IPC/自动启动）、`preload.cjs`、`Character.vue`（重定向/播放/交叉淡化）。
- 环境：`~/.komorebi-motion-venv`（torch 2.15 MPS，不入库）。

## 进一步评估与下一步

- 调参：step 3s/窗口 10s → 可换 2s/8s 降低延迟（动作连续性可能下降）。
- 稳定性：长时间运行（用户日常开网易云）、切歌、暂停恢复、MPS 占用。
- 动作质量筛选/平滑仍需用户实际观感反馈。
