# 当前日常播放（2026-11-03）

日常动作库按实际源段范围独立采样，4.8s 连续窗口与移动过渡；音乐不再逐帧缩放骨骼角度；最新候选改用预录素材对称平滑，未知节奏默认原速，起音做短促身体响应，可信音乐与材料周期做有界相位修正。渲染前增加手/前臂/指端的裙摆代理体避让，见 [手裙与节奏修复](implementation/garment-clearance-rhythm.md)。可见窗口逐 rAF 更新；Bailando 改为显式研究入口，不与日常库同时写身体。动作库不再依赖旧 BVH 研究参考才能加载。见 [播放连续性修复](implementation/motion-playback-continuity.md) 和 [可运行回归](../examples/motion-continuity/README.md)。本机已载入修复候选，整段观感仍待用户确认。

# 当前公开快照说明（2026-11-03）

当前入口以 [README](../README.md)、[使用说明](usage.md) 和 [文档导航](README.md) 为准。下文是按时间追加的实现演进记录，早期“当前/默认”描述可能已被后续记录覆盖。当前源码保留所有实验实现，但不附本机角色、研究动作、模型权重和证据素材；日常待机新增原创后备，不再依赖日和素材启动。开源整理见 [实施记录](implementation/open-source-snapshot.md)。

# 项目上下文

音乐舞蹈主线的统一研究入口为 [三块黑板](design/music-dance-blackboard.md)，对应 [工程问题](design/music-dance-engineering.md)。当前日常时钟/选段沿用stage-13，身体执行以stage-23为准（Y-up完整旋转与踝目标，不叠加旧接触锁脚）；stage-14–22为统一记录与研究基线。舞蹈编排和真实听感同步仍待后续，不能从阶段局部指标推断整体舞蹈自然。

木漏日使用 Electron/Vue，日常人物为Three.js/three-vrm；Pixi Live2D仅保留研究窗口。日常入口为透明置顶人物与轻气泡，管理界面按需打开。
音乐 PCM 分析由独立 music-signal-lab 负责；行为意图由桌宠侧 electron/behavior.cjs 接收，Laya 按需本地推理。音乐小面板与普通气泡都支持行为指令；短舞动请求交给 Laya 分类，明确接受后驱动动作，其他请求仍走原有任务链路。
执行 npm test、npm run build；本地模型真实验证见 [examples](../examples/README.md)。

日和研究保留 src/motion/music-motion-simulator.mjs；日常VRM真实音频使用 src/motion/vrm-dance.mjs 和 vrm-phrases.mjs，禁止行为模板覆盖真实信号轨迹。无音频固定动作仅作为明确标注的试跳；流失效时不得伪造音频驱动。

动作研究窗口独立于日常桌宠：src/motion-lab。日和原始动作由原生Cubism播放，曲线采样器只做研究与校验；3D BVH仅作完整舞蹈对照，不自动转换为Live2D参数。研究样本位于本机userData/research-references，不随项目分发。

完整舞蹈到日和的实验映射在 src/motion-lab/retarget.mjs：几何/相对旋转特征 → 首帧校准、压缩与平滑限速 → 8参数motion3，由原生Cubism播放。派生研究动作仅本机生成。当前未接音乐驱动与日常桌宠。

VRM全身实验：src/motion-lab/vrm-retarget.mjs + VRMStage.vue；Jessair Cute Model 由用户下载并放在userData/local-models，仅本机使用。13个方向关节加髋部姿态/高度，未接入音乐或日常桌宠；实现见stage-05。

日常VRM已接音频：src/Character.vue + src/motion/vrm-dance.mjs。音乐片段驱动肘膝等标准骨骼，VRM0方向适配；未使用研究BVH。模型导入在配置与管理，userData本机存储。见stage-06。

全身片段与支撑脚：vrm-clips.mjs定义五类原创动作，vrm-dance.mjs基于起音/频段/能量调度；foot-ik.mjs双骨腿求解。短鼓间隙完成片段，明确静音收势。不使用研究BVH；见stage-07。

当前日常动作以stage-08为准：A/B连续八拍舞句、共享承重步法、速度连续接缝、内部相位持续运行；音频调tempo与力度，可信起音轻校正，非已识别小节。五类独立片段仅留作历史研究。

当前以stage-09为准：六类连续主题，主题特定步法和身体/手臂配合，全部兼容八拍边界；平滑音乐特征和风格/近期使用情况选择主题。内部时钟与足约束延续stage-08。

默认待机以stage-10为准：vrm-idle.mjs将用户指定hiyori_m05解释为VRM轻动作，舞句优先、收势后恢复，减少动态效果禁用位移；源动作/角色素材保留原许可。

音乐主线以stage-11为准：MusicalDirector启发式表达状态与主题/呼应/对比/回归；稳定输入不再强求遍历六类，可信BPM短空窗保持和半/倍拍处理，低力度音乐舞句也优先于待机。未识别真实歌曲段落/副歌。

当前本机研究版本以stage-12为准：存在本机研究BVH时，预采样VRM姿态并建立12段动作库；音乐控制激活、速度和活跃度选择，片段按姿态/速度/接触代价选择并重叠过渡。没有本机参考时保留原创程序舞句。研究源及派生姿态仅内存使用，不随app分发。见 [stage-12](../examples/stage-12-motion-bank/README.md)。

当前音乐舞步以stage-13为准：本机参考自动估计落脚与接触，选三个两拍交替步，使用统一音乐拍时钟映射源时间；保留源脚高度并防止脚踝穿过参考面。研究窗口新增“音乐 · 踩拍验证”，显示时钟、锚点、脚踝高度与可见落脚偏拍。接触为运动学估计，不代表真实承重；见 [stage-13](../examples/stage-13-beat-steps/README.md)。

E0首版与E1/E2身体基线已落地stage-14：motion-record/source-record/replay-experiment记录并回放源→重定向→rest混合→足约束→最终；研究窗口“分层回放”。独立于日常音乐编排，音乐观测只附带记录且时钟关系明确未映射。根位移坐标转换修正为水平朝向映射，保持Y-up。见 [stage-14](implementation/stage-14-dance-blackboard.md)。

E2旋转基线以stage-15补充：研究“分层回放”可切direction/rotation（首帧校准源世界旋转增量），保留原基线与明确残差定义。默认direction，日常未切换；首帧绝对twist未知，保留变化不等于舞蹈自然。

Stage-16新增分层回放“完整段落对照”：三条件、约束前/最终残差及连续性候选，支持取消；源精确帧时间回读的浮点错帧已修复。实际连续区间表明旧足约束有显著改写，日常映射未自动切换。下一步按E3/E4补源动作材料、接触语义与衔接。

Stage-17研究基线：完整源动作材料独立于VRM，显式保存单位、层级和有向速度；两侧移动窗口过渡不再混向静态首帧。接触/原曲节拍未知时保留未知，未自动替换日常舞步播放器。见 [stage-17](implementation/stage-17-source-material.md)。

Stage-18：源材料/移动过渡经FK直接进入旋转身体适配，研究窗口新增“材料 · 连续过渡”。旧按BVH时间回放保持对照；接触/音乐和根对齐仍独立待评估。见 [stage-18](implementation/stage-18-material-execution.md)。

Stage-19研究对照：材料过渡可对齐两段髋部水平位置与朝向，固定变换作用整个入段并保留Y高度差；新增固定地面/跟随镜头与俯角。空间对齐不等于接触或后继兼容。见 [stage-19](implementation/stage-19-planar-alignment.md)。

Stage-20研究：踝部运动学接触证据与候选后继边界评估，保留估计/标注来源；姿态、有向速度和高度阈值可拒绝候选，未知/估计接触保持待复核。材料研究页支持检索和手动预览，不自动切换日常舞蹈。见 [stage-20](implementation/stage-20-successor-assessment.md)。

Stage-21完整脚部窗口诊断：研究预览与评估共用源动作采样，混合期接触未知；逐脚比较源/目标踝部路径、速度和位移增量差，显式区分位置水平映射与旋转基变换。未将踝部指标当脚底接触或滑脚真值。见 [stage-21](implementation/stage-21-foot-window-assessment.md)。

Stage-22研究对照：旋转映射后可开启源踝轨迹跟随；双骨腿保留脚部世界朝向，带余量可达域投影报告原目标残差与旋转改写。不推断接触，髋关节中心适配位移单独记录，研究开关默认关闭，日常播放器未切换。见 [stage-22](implementation/stage-22-source-ankle-tracking.md)。

Stage-23当前日常身体执行：Y-up完整旋转、in-place-feet-midpoint源踝目标预采样，姿态/根/踝目标共同混合后由末端执行器收尾，旧接触锁脚不再覆盖本地动作；原三段两拍选择和内部时钟沿用。新增“音乐执行 · 集成”运行实际Character与原创PCM分析。见 [stage-23](implementation/stage-23-daily-music-execution.md)。

Stage-24研究归因：音乐执行页可分开sample/预混合/独立限速/一致下身/计划下身，并同时报告IK改写、最终关节速度与目标滞后；新增朝向对齐运动预备段及0.3/0.6/1拍对照。候选存在滞后或根动态取舍，日常legacy/static默认未切换。主进程执行诊断白名单同步修复。见 [stage-24](implementation/stage-24-limiter-attribution.md)。

Stage25：[根轨迹与原地化归因](implementation/stage-25-root-recentring.md)，离线源窗口证据表明瞬时减双踝中心会增加根动态；未修改日常默认，尚待实际目标链路及视觉对照。

Stage27（声音陪伴线 SOUND-01）：[全系统输出声音采集](implementation/stage-27-system-sound-capture.md)——audio-tap.swift 新增 `--system` 全局 tap（`monoGlobalTapButExcludeProcesses:`），MusicAudio.start 支持 system 模式，音乐面板新增「系统声音跟拍」；任意应用出声产生特征流实测通过，网易云入口回归不变，187 测试与构建通过。已知边界：全局 tap 会捕获 Komorebi 自身播放的声音，v1 未排除。

Stage28（DANCE-01）：[完整舞段视觉基准](implementation/stage-28-dance-visual-baseline.md)——用户人工确认同一 VRM 完整播放 63 秒源舞段观感合格；失效归属=编排层（`createBeatMotionBank` 仅保留 3 个两拍片段），绑定/重定向非主瓶颈；全段三条件数值证据见 `docs/evidence/full-segment-assessment.json`。注意：人工确认基于研究窗口几何重定向回放，stage-23 日常执行在完整舞段上的回放仍待验证（BODY-01 遗留）。

Stage29（DANCE-01 补充）：[日常执行管线 × 完整回放视觉验证](implementation/stage-29-full-replay-visual-verification.md)——prepareLocalDance 新增 `full` 完整回放（950 帧顺序播放、不切片、淡入淡出），研究窗口新增「完整回放」按钮；Electron 离屏渲染 950 帧合成 63 秒视频（docs/evidence/full-replay.mp4），抽帧与帧差分析通过（无抖动/穿模/跳变，0 帧超 2×p99）；日常身体执行层完整承载源舞段合格，DANCE-02 就绪。渲染像素比同步改为屏幕原生倍率（修复桌宠模糊/锯齿）。

Stage30（DANCE-02）：[完整舞句与结构标注](implementation/stage-30-dance-structure.md)——新增 dance-structure.mjs，从完整源材料生成 dance-structure/v1：准备 0–11.0s / 主体 11.0–61.3s / 恢复 61.4–63.3s、69 重音锚点（67 落脚）、137 接触区间、33 朝向转折、17 候选舞句边界；全部 kinematic-estimate，不修改完整材料。证据：docs/evidence/dance-structure-annotation.json + dance-structure-timeline.png；194 测试通过。DANCE-03 就绪。

Stage31（DANCE-03）：[音乐驱动舞句规划](implementation/stage-31-dance-planner.md)——新增 dance-planner.mjs，从结构标注+音乐描述（BPM/能量曲线）生成 dance-plan/v1：每段均匀切窗、句长优先匹配、伸缩比限制 0.8–1.25、重复上限、支撑脚连续性、每句 reason；同素材×90/120/150BPM 对照：平缓反复熟悉句、渐强递进换新、高能量全换新，重音对齐 136–156ms；199 测试通过。证据 docs/evidence/dance-plan-comparison.json/.png。待接入实时播放与真实歌曲对照。

Stage32（DANCE-03 执行接入）：[舞句计划接入实时执行](implementation/stage-32-planned-execution.md)——新增 planned-phrase-player.mjs：音乐拍时钟→plan 选句→源帧插值→日常执行，句切换 0.35s smoothstep 过渡；Character.configurePlannedPhrases + 研究窗口「音乐规划执行」按钮；数值验证 10 句/112ms 对齐/mean 0.285rad 每步，27 秒执行视频 docs/evidence/planned-execution.mp4，202 测试通过。日常默认未切换，真实歌曲对照待做。用户反馈 v1 句间衔接过快后，改为自适应过渡（0.3–1.0s，按姿态距离）并在规划层加朝向连续性代价，v2 视频见 docs/evidence/planned-execution-v2.mp4。用户进一步反馈"有的正常、有的慢、有的快"后，改为统一节奏：选句后按伸缩范围反推窗口（0.85–1.15×）、固定 0.45s 过渡、多粒度句库（1/2/3 组合并）、静音尾收尾；v4 证据 docs/evidence/planned-execution-v4.mp4（5 句/4 切换/伸缩 0.95–1.15×/对齐 58–146ms）。又按用户反馈把含转身的句限速到 1.0× 并留白收尾，v5 证据 docs/evidence/planned-execution-v5.mp4（6 句/伸缩 0.95–1.0×/13 秒转身处 1.0×）。用户确认"这一版没问题"，DANCE-03 验收通过。

Stage33（MUSIC-01）：[音乐信号基准](implementation/stage-33-music-baseline.md)——合成鼓点已知真值评分：BPM 误差≤0.5%、起音召回100%、半拍陷阱未误导、静音缺口 silent→恢复正确、端到端特征→规划可用；真实歌曲对照（Boom Boom Pow，系统采集 45s）暴露：检测 BPM 171.43 vs 参考 130（误差 31.9%）、置信度 0.20、tracking 仅 9.9%，但起音召回 100%——真实歌曲不能依赖全局 BPM，起音/能量可靠；DANCE-03 规划器需改用起音对齐或反应式响应。两首对照修正结论：MGMT《Kids》检测 125 vs 参考 123（误差 1.6%、置信度 0.62、tracking 50.8%）可用，Boom Boom Pow 误差 31.9% 不可用——分析器对节奏型敏感而非整体不可靠；真实歌曲需可靠性门控（低置信时降级起音/能量反应式）。证据 docs/evidence/live-music-analysis.json。


Stage35（真实音乐执行）：[真实音乐执行接入](implementation/stage-35-real-music-execution.md)——研究窗口「真实音乐 · 系统声音」：系统采集→特征→规划→执行→门控→每10秒增量重规划；修复窗口广播/后台节流/IPC 白名单；合成音乐 120BPM 全链路验证通过（扩展触发确认）。素材仅一段 61 秒 BVH。

Stage36（风格路由）：[BPM 驱动选句](implementation/stage-36-style-routing.md)——targetActivity 路由，真实结构 150BPM 密度 0.631 vs 90/120 0.588（幅度受单段素材限制）；214 测试通过。

Stage34（MUSIC-01 收尾）：[可靠性门控](implementation/stage-34-music-reliability-gate.md)——judgeMusicReliability + 迟滞门控：可见 tracking≥50% 且置信度≥0.55 时拍对齐，否则 planned 播放器淡出、vrm-dance 反应式主导；两首真实歌曲判定正确（Kids 可信/Boom 低跟踪降级）；213 测试通过。

## 独立项目迁移

2026-10-29：活动根目录为 `/Users/cyrus/work/my/komorebi`；原实验目录保留快照。当前优先级以 `docs/project/BACKLOG.md` 为准，下一项DANCE-01完整舞段视觉基准。新路径187测试与生产构建通过。本轮未推送远程、未更换正在运行的桌宠。

Stage37（freestyle 日常集成）：[Freestyle 与自动跟拍](implementation/stage-37-freestyle-daily.md)——vrm-dance 即兴基线视频；日常桌宠自动跟拍网易云（播放自动开启 netease 采集、暂停自动关闭）；实测 Kids 自动 tracking、beat 增长。用户目标：freestyle + 长期实际音乐测试。

Stage38（freestyle 多样性）：[动作多样性改进](implementation/stage-38-freestyle-variety.md)——主题 6→12、探索式调度（85%边界换/未用主题加成/近期重复惩罚）、切换过渡；27 秒内 5 个不同主题（旧版 3 个）；v2 视频 docs/evidence/freestyle-v2.mp4；214 测试。

Stage39（分层手臂）：[分层手臂动作](implementation/stage-39-layered-arms.md)——手臂从主题解耦为独立 2 拍时钟（8 种动作：摆臂/挥手/举起/指/抱胸/张开/交替摆/弹手 + 0.45 拍过渡），脚步/躯干保持 8 拍主题；合成信号 10 秒内 10 次手臂变化；214 测试通过。

调研（music→dance 模型）：[模型方案评估](research/music-to-dance-models.md)——Bailando/SoulDance/EDGE/MACE/TM2D 均输出 SMPL、依赖老/大 PyTorch、需 SMPL License、离线生成非实时；OdoriVRM 提供 SMPL→VRM 重定向参考。结论：模型路线成本高且与实时反应冲突，当前采用「真实舞段 + 信号调制动作匹配」（重音对齐切换/能量驱动选段/幅度调制）。

Stage40（Bailando 模型接入）：[音乐→舞蹈生成](implementation/stage-40-bailando-integration.md)——HF Motius-Bailando 权重 + Motius 框架（torch 2.15 MPS）跑通：70s 音乐→4208 帧 24 关节；已实现 AIST++→VRM 重定向（修正 upperChest 链）；真实歌曲生成动作自然（docs/evidence/bailando-real-song-v2.mp4）。环境 ~1.5GB（~/.komorebi-motion-venv，不入库）。下一步接入桌宠。

Stage41（流式生成接入）：[实时音乐→舞蹈](implementation/stage-41-streaming-dance.md)——Python 常驻服务 + PCM 缓冲 + 每 3 秒生成下一段（0.7-0.9s/段，MPS）+ AIST++→VRM 重定向 + 交叉淡化；桌宠实测动作随音乐流畅变化（延迟约 1-2 秒）；217 测试通过。

Stage42（舞蹈多样性修复）：[采样温度](implementation/stage-42-dance-diversity.md)——Bailando 默认 greedy top-k=1 导致动作单调；改为温度采样 0.92 + 每段随机种子 + 上一段 8 帧作 initial_motion；多样性测试段间姿态距离 0.671m，桌宠实测动作明显多样。

Stage43（连续律动引擎）：[无动作库即兴反应](implementation/stage-43-continuous-groove.md)——continuous-groove.mjs：音乐信号连续驱动全身（能量/节拍/频谱/onset 分层 + 平滑），无动作库无切换；修复多拍周期需用连续拍数（否则 sin 跳变）；桌宠用 BPM 自建节拍时钟。局限：表现力有限（无大幅编舞动作）。

Stage44（真人舞蹈动作库）：[23 支 BVH 信号驱动](implementation/stage-44-real-dance-library.md)——tulay-hub/dance-dataset（MIT，23 支真人舞蹈 BVH）→ Mixamo→BT 关节映射 → 批量编译为 VRM 库（15364 帧/1024 秒/33MB）→ 桌宠 motion matching 播放（信号驱动）；桌宠实测真人舞蹈质感、动作各异。

Stage45（裙摆稳定）：[裙摆限幅](implementation/stage-45-skirt-clamp.md)——VRM 裙摆弹簧骨加固（stiffness×4/阻尼×2.2/重力×0.25）+ 腿部旋转限幅（大腿 57°/膝盖 109°），解决大幅抬腿带飞裙子问题。

Stage46（播放连续性）：[低活动段修复](implementation/stage-46-motion-continuity.md)——motion matching 选段跳过近静止起点（活动度下限 45%）+ 播放中低活动提前切换；解决"一直卡住"（实际是选到静止片段）。
