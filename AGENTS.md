# 开发导航

先读 README.md → docs/context.md → examples/README.md → 对应实现记录。
Example 唯一根目录为 examples/，先运行 user_code，再读 core。公开 API、目录或调用路径变化时同步索引和记录。
不得把密钥、用户资料或模型权重提交到源码。音乐信号与人物动作决策分开维护。

音乐舞蹈架构与主线任务先读 docs/design/music-dance-blackboard.md → docs/design/music-dance-engineering.md，再读对应阶段。新增证据标明事实、假设和验收维度；工程问题须能追溯到音乐、身体或舞蹈知识的接口与缺口。

项目唯一开发根目录为 ~/work/my/komorebi。开始新轮先读 docs/project/README.md 与 BACKLOG.md，按 MILESTONES.md 的用户效果验收，勿以历史阶段数量代替进度。原实验输出目录保留快照，不再双向开发。每轮按用户约定的四项汇报。

# 帮用户安装

默认角色为千驮谷筱 / Sendagaya Shino（pixiv，CC0），已随源码和应用包提供；新安装应直接启动并验证角色可见，无需引导用户另行下载。已有用户导入角色优先使用。唯一允许入库的 VRM 为 assets/avatars/sendagaya-shino/Sendagaya_Shino.vrm，须连同来源、校验和、CC0 许可维护；其他角色、模型权重与私有素材仍不得提交或上传。

用户要更换角色时，可在偏好设置导入，或退出应用后运行 `npm run setup:avatar -- "/absolute/path/to/model.vrm"`。已有角色默认不覆盖，明确要替换才加 `--replace`；换回内置角色用 `npm run setup:avatar -- --default --replace`。尊重 `KOMOREBI_DATA_DIR` / `--data-dir`。旧演示角色 Jessair Cute Model 仍禁止再分发，用户指定它时提供 https://booth.pm/ja/items/7100270 ，由用户登录下载 .vrm，不绕过登录或重新托管。细节见 docs/avatar-setup.md。
