# 文档导航

面向使用者：[中文介绍](../README.md) · [English](../README.en.md) · [使用与配置](usage.md)。

角色：[图鉴、来源与许可对照](avatars.md) · [English avatar guide](avatars.en.md) · [更换命令与 AI 安装约定](avatar-setup.md)；[默认角色接入与验收](implementation/default-avatar.md)、[安装器实现](implementation/avatar-setup.md)。

面向贡献者：[贡献指南](../CONTRIBUTING.md) → [当前上下文](context.md) → [可运行示例](../examples/README.md)。

| 目的 | 入口 |
| --- | --- |
| 选择角色、查看图片与官方下载 | [角色参考与资源导航](avatars.md) |
| 安装、更换或恢复内置角色 | [角色安装](avatar-setup.md) |
| 看当前优先级与验收 | [项目管理](project/README.md)、[看板](project/BACKLOG.md)、[里程碑](project/MILESTONES.md) |
| 理解音乐/身体/舞蹈职责 | [知识黑板](design/music-dance-blackboard.md) → [工程依赖](design/music-dance-engineering.md) |
| 理解声音陪伴方向 | [声音响应设计](design/sound-reactive-companion.md) |
| 追溯历史决策 | [实现记录](implementation/)（Stage 仅表示当时实验，不等于当前默认行为） |
| 排查角色发虚、截图选区被遮挡 | [渲染像素比与截图层级修复](implementation/character-resolution-capture.md) |
| 查看导航与配图的维护依据 | [角色参考资料与验证记录](implementation/avatar-reference-navigation.md) |
| 查看第三方边界 | [第三方说明](../THIRD-PARTY-NOTICES.md) |
| 查看手裙避让和节奏响应 | [身体约束与音乐时间接口](implementation/garment-clearance-rhythm.md) |
| 查看切歌动作清理 | [曲目边界、分析与动作会话重置](implementation/music-track-reset.md) |
| 查看烟花优化与重新录制 | [姿态门控、原生窗口录制及40秒验证](implementation/fireworks-capture-optimization.md) |
| 查看烟花录像观感问题 | [停顿、手势时机与验收边界](implementation/fireworks-recording-review.md) |
| 查看音乐烟花 | [音乐重音、手部投影、粒子密度与实机检查](implementation/music-fireworks.md) |
| 查看节奏感退步修复 | [起音传递与身体重音](implementation/rhythm-onset-delivery.md) |
| 查看动作连续性修复 | [播放控制、选窗与实机验证](implementation/motion-playback-continuity.md) |
| 查看公开演示来源 | [GitHub 实机演示视频](implementation/github-demo-video.md) |
| 查看本次公开整理 | [开源快照记录](implementation/open-source-snapshot.md) |
| 查看依赖升级策略与验证 | [依赖维护记录](implementation/dependency-maintenance.md) |

`brief.md`、`qa.md` 是早期原型范围与阶段 QA；实际运行入口以 README、源码与当前看板为准。`context.md` 保留演进记录，应结合最后阶段与当前实现阅读。历史记录提及的本机图像、歌曲分析与动作数据不随开源发布，见 [证据说明](evidence/README.md)。
