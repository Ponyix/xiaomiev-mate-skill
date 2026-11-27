# XiaomiEV Mate Agent Skill

这是面向本地 AI Agent 的 [XiaomiEV Mate](https://github.com/Ponyix/xiaomiev-mate) Skill。配置自部署服务地址和 API Key 后，可以用自然语言查询车辆、行程、充电和用车统计；Skill 通过本机连接器调用开放 API，无需额外部署服务。

## 能力

- 查询车辆列表、实时车况和充电状态，支持在多辆车之间选择。
- 查询历史行程、充电记录、能耗、智驾和城市足迹等已同步数据。
- 结合开放数据目录按条件筛选与统计，数据范围以服务端实际开放能力为准。
- 仅读取车辆数据；不提供车辆控制，不向 Agent 暴露账号凭据、坐标或原始响应。

## 安装

从 GitHub 获取项目：

```bash
git clone https://github.com/Ponyix/xiaomiev-mate-skill.git
```

将本项目完整目录安装到所用 Agent 的 Skill 目录（可命名为 `xiaomiev-mate`），保留 `SKILL.md`、`src/`、`bin/` 和 `VERSION` 的相对位置，然后刷新或重启 Agent 的 Skill 加载。各 Agent 的安装目录不同，请参照对应 Agent 的 Skill 安装说明。Agent 会直接使用 Skill 内的连接器，无需将 `bin/` 加入 PATH。

本机需安装 Node.js 20 或更新版本。首次在本机终端进入 Skill 目录，运行：

```bash
node src/xiaomiev.mjs setup
```

先在自己部署的 XiaomiEV Mate 开放平台创建带 `vehicle:read` 权限的 API Key。输入后端服务地址（例如 `https://你的域名` 或局域网服务地址）和 API Key（输入不回显）；配置后自动检查服务、车辆权限和灵活查询能力。之后在 Agent 中自然语言提问，例如“我的车还有多少电？”或“统计上个月的充电费用”。可在终端运行 `node src/xiaomiev.mjs doctor` 重新检查；它不会显示 API Key。安装后必须使用支持 Skill 且可以运行本机命令的 Agent。

## 本机配置位置

配置信息保存在运行 Agent 的本机：

| 系统 | 默认路径 |
| --- | --- |
| macOS / Linux | `~/.config/xiaomiev-mate-agent/config.json`（如设置 `XDG_CONFIG_HOME` 则使用它） |
| Windows | `%APPDATA%\\xiaomiev-mate-agent\\config.json` |

配置文件包含服务地址和 API Key；macOS/Linux 会设置为仅当前用户可读写。`setup` 在交互终端中隐藏 API Key 输入；请使用只含 `vehicle:read` 的 API Key，不要在聊天、URL、截图或日志中粘贴 Key。可设置 `XIAOMIEV_AGENT_CONFIG` 覆盖本机配置文件位置。

## 更新

Skill 不会自动更新。替换 Skill 文件后刷新 Agent，原有连接配置保持不变。

## 许可证

本项目采用 [MIT License](LICENSE)。
