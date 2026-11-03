# Komorebi 项目管理

木漏日：轻量桌面伙伴，音乐陪伴与任务气泡；产品方向已扩展为[声音敏感陪伴者](../design/sound-reactive-companion.md)（对系统声音/麦克风/输入事件做出反馈，舞蹈为其中一条响应路线，并行推进）。项目根目录 `~/work/my/komorebi`。2026-10-29 从实验工作区整理成独立本地项目；旧目录保留为迁移前快照，后续在本目录开发。

## 产品目标与当前状态

常驻形态是可拖动、置顶的角色及轻量气泡，管理界面按需打开。音乐信号独立于人物；身体适配与舞蹈编排分别负责执行与表达。核心用户验收：完整看起来连贯的舞蹈，并能明确回应音乐的拍点和段落。并行产品线「声音敏感陪伴者」：角色对系统声音、麦克风与输入事件做出可解释反应，舞蹈是其中一种反应；见[设计文档](../design/sound-reactive-companion.md)。

当前状态：可运行原型；音乐信号独立项目已存在；当前日常路线使用本机 23 支舞的连续窗口选段；播放连续性修复候选已接入，详见[记录](../implementation/motion-playback-continuity.md)。Stage26 根呈现实验仍独立保留。整体舞蹈观感尚未达标。测试通过不能替代观感验收。

- [任务看板](BACKLOG.md)：唯一当前优先级与任务状态入口。
- [里程碑与验收](MILESTONES.md)：按用户可见效果验收。
- [三块黑板](../design/music-dance-blackboard.md)：音乐、身体、舞蹈知识与接口。
- [工程问题](../design/music-dance-engineering.md)：技术依赖与历史阶段索引。
- [实现记录](../implementation/)与证据（本机研究产物：`../evidence/`）：保留来源及验证范围。

## 协作约定

每轮开始先选任务并写明本轮目标；完成后更新看板、验证证据和限制，按“本次做什么 / 结果、验证与结论 / 资源和调整 / 进一步评估与下一步”汇报。研究选项、代码完成、已构建、已打包、日常启用、视觉验收是不同状态，不互相替代。

新任务须包含问题、交付物、验收、依赖与状态。不为调参新增无边界阶段；证据不能支撑效果时回到整段对照。每轮优先推进一项用户可见主线。

## 代码、素材与独立项目

源码公开目标：[Chengyunlai/komorebi](https://github.com/Chengyunlai/komorebi)。当前看板继续以本地文档为准。公开 main 从干净快照开始，旧历史仅保留在本地备份分支。角色、BVH、运行时密钥留在应用私有目录，不入库；临时视频和构建产物不入库。原music-signal-lab仓库保持独立，地址 https://github.com/Chengyunlai/music-signal-lab ，没有复制成第二份维护分支。默认已vendor其版本，手动升级执行 `node scripts/sync-music-signal.cjs /absolute/path/to/music-signal-lab`。
