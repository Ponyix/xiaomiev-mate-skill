# XiaomiEV Mate Agent Skill

这是面向本地 AI Agent 的 [XiaomiEV Mate](https://github.com/Ponyix/xiaomiev-mate) Skill。配置自部署服务地址和 API Key 后，可以用自然语言查询车辆、行程、充电和用车统计；Skill 通过本机连接器调用开放 API，无需额外部署服务。

## 能力

- 查询车辆列表、实时车况和充电状态，支持在多辆车之间选择。
- 查询历史行程、充电记录、能耗、智驾和城市足迹等已同步数据。
- 结合开放数据目录按条件筛选与统计，数据范围以服务端实际开放能力为准。
- 仅读取车辆数据；不提供车辆控制，不向 Agent 暴露账号凭据、坐标或原始响应。

## 使用前准备

请先部署 [XiaomiEV Mate](https://github.com/Ponyix/xiaomiev-mate)，并在开放平台创建具有“车辆信息”权限的 API Key。运行 Agent 的电脑需要安装 Node.js 20 或更新版本，且能够访问你的服务。

## 安装

### 方式一：npx 安装

在运行 Agent 的电脑上执行：

```bash
npx skills add Ponyix/xiaomiev-mate-skill -g
```

按提示选择需要安装的 Agent。安装器支持 Codex、Claude Code、Cursor、OpenCode、Gemini CLI、GitHub Copilot 等。

### 方式二：从 GitHub 手动安装

```bash
git clone https://github.com/Ponyix/xiaomiev-mate-skill.git
```

将下载的 `xiaomiev-mate-skill` 完整目录复制到所用 Agent 的 Skill 目录，目录可以命名为 `xiaomiev-mate`。请保留 `SKILL.md`、`src/`、`bin/` 和 `VERSION` 的相对位置；不同 Agent 的 Skill 目录请参考该 Agent 的安装说明。

### 配置并使用

两种方式安装完成后，进入 Agent 的 Skill 目录中的 `xiaomiev-mate`，在本机终端执行：

```bash
node src/xiaomiev.mjs setup
```

输入服务地址和 API Key（输入不回显）；随后刷新或重启 Agent，即可自然语言提问，例如“我的车还有多少电？”或“统计上个月的充电费用”。连接异常时，可在同一目录运行 `node src/xiaomiev.mjs doctor` 检查。

## 本机配置位置

配置信息保存在运行 Agent 的本机：

| 系统 | 默认路径 |
| --- | --- |
| macOS / Linux | `~/.config/xiaomiev-mate-agent/config.json`（如设置 `XDG_CONFIG_HOME` 则使用它） |
| Windows | `%APPDATA%\\xiaomiev-mate-agent\\config.json` |

配置文件包含服务地址和 API Key；macOS/Linux 会设置为仅当前用户可读写。`setup` 在交互终端中隐藏 API Key 输入；请使用只含 `vehicle:read` 的 API Key，不要在聊天、URL、截图或日志中粘贴 Key。可设置 `XIAOMIEV_AGENT_CONFIG` 覆盖本机配置文件位置。

## 更新

Skill 不会自动更新。需要更新时可使用 `npx skills update xiaomiev-mate -g`；刷新 Agent 后生效，原有连接配置保持不变。

## 卸载

通过 `npx skills` 安装的用户，可以在终端运行：

```bash
npx skills remove xiaomiev-mate -g
```

按照提示确认卸载范围。部分 Agent 共用 Skill 目录，移除共用目录中的 Skill 后，读取该目录的其他 Agent 也可能无法再使用它。刷新或重启 Agent 后，技能列表会更新。

从 GitHub 手动安装的用户，请删除自己复制到 Agent Skill 目录中的 `xiaomiev-mate` 文件夹。

卸载 Skill 不会删除保存在本机的服务地址和 API Key 配置。如果以后不再使用，可按上方“本机配置位置”手动删除配置文件；也可以在 XiaomiEV Mate 开放平台吊销对应 API Key。

## 许可证

本项目采用 [MIT License](LICENSE)。
