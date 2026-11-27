# Skill 发布流程

每次发布：

1. 更新 `VERSION`，使用语义化版本号。
2. 在 `CHANGELOG.md` 记录用户可见变化、兼容性或安全变化。
3. 若 Skill 的 API 使用方式发生变化，同步修改 `SKILL.md`、`README.md` 和示例。
4. 在本机运行：

   ```bash
   ./bin/xiaomiev version
   ./bin/xiaomiev help
   node --check src/xiaomiev.mjs
   node --test test/connector.test.mjs
   ```

5. 从当前目录生成分发包：

   ```bash
   zip -r XiaomiEV-Mate-Agent-Skill-$(cat VERSION).zip \
     VERSION CHANGELOG.md LICENSE RELEASE.md SKILL.md README.md bin src
   ```

6. 用户在本机替换 Skill 文件后重启或刷新 Agent 的 Skill 加载；用户已有的本机连接配置不应被覆盖。

## 兼容性

- Skill 当前调用 XiaomiEV Mate `/api/openapi/v1/**`。
- Skill 版本与后端 Docker 版本独立；新 Skill 调用返回 HTTP 404 时，通常表示用户部署的 XiaomiEV Mate 后端过旧，应升级其 Docker 镜像后再试。
- Skill 不会自动更新，用户可通过 `npx skills update xiaomiev-mate -g` 更新。
