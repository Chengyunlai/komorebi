# 开发导航

先读 README.md → docs/context.md → examples/README.md → 对应实现记录。
Example 唯一根目录为 examples/，先运行 user_code，再读 core。公开 API、目录或调用路径变化时同步索引和记录。
不得把密钥、用户资料或模型权重提交到源码。音乐信号与人物动作决策分开维护。

音乐舞蹈架构与主线任务先读 docs/design/music-dance-blackboard.md → docs/design/music-dance-engineering.md，再读对应阶段。新增证据标明事实、假设和验收维度；工程问题须能追溯到音乐、身体或舞蹈知识的接口与缺口。

项目唯一开发根目录为 ~/work/my/komorebi。开始新轮先读 docs/project/README.md 与 BACKLOG.md，按 MILESTONES.md 的用户效果验收，勿以历史阶段数量代替进度。原实验输出目录保留快照，不再双向开发。每轮按用户约定的四项汇报。

# 帮用户安装

安装程序不等于已安装角色。主动提供 Jessair 演示角色官方下载页 https://booth.pm/ja/items/7100270 ，说明免费但禁止再分发、需要用户登录 BOOTH 并下载 Cute_Model.vrm（不是 .vroid）。取得本机授权文件后运行 `npm run setup:avatar -- "/absolute/path/to/model.vrm"`，安装前退出应用、安装后重新启动；已有角色默认不覆盖，用户明确要换角色时才加 `--replace`。尊重 `KOMOREBI_DATA_DIR` / `--data-dir`，不要把角色复制进源码、提交或上传，不绕过登录或重新托管。没有文件时报告“程序已安装，角色待下载”，提供下载位置及下一步命令。细节见 docs/avatar-setup.md。
