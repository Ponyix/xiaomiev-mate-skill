---
name: xiaomiev-mate
description: 查询用户自部署的 Xiaomi EV Mate 小米汽车数据，包括 Xiaomi EV 车辆实时车况、电量续航、历史行程、充电记录及费用、能耗、智驾和城市足迹；支持自然语言只读查询。
version: 1.0.3
---

# Xiaomi EV Mate 本地 Agent Skill

本文件所在目录是 Skill 根目录。Agent 必须直接执行该目录的 `node <Skill根目录>/src/xiaomiev.mjs`（要求 Node.js 20+），无需将 `bin/` 加入 PATH；以下示例的 `xiaomiev` 均指这一命令。使用连接器访问用户自己部署的 Xiaomi EV Mate 开放 API。不要请求、记录或显示 API Key；收到 401 时解释 Key 可能无效、过期或已吊销，引导用户在开放平台创建新 Key 并在本机重新运行 setup，保留原地址，不能让用户在聊天中发送 Key；若连接未配置，提示用户在本机终端进入 Skill 根目录运行 `node src/xiaomiev.mjs setup`，不要让用户在聊天中粘贴密钥。需要命令帮助时执行 `xiaomiev help`；`xiaomiev doctor` 检查配置、连接、车辆读取权限、车辆数量和数据目录可用性，不显示 API Key。

Skill 版本由根目录 `VERSION` 管理；执行 `xiaomiev version` 可查看本地 Skill 版本。Skill 与用户 Docker 部署的 Xiaomi EV Mate 独立更新，不能因为 Skill 更新而自动升级后端。

## 版本检查与更新

每个对话首次使用本 Skill 时，在不影响车辆查询的前提下运行 `xiaomiev check-update` 检查 GitHub 已发布的稳定版本。完成用户本次请求后，仅当结果为 `update_available` 时，在最终回答末尾简短提示当前版本和新版本；没有更新、网络失败、限流或结果未知时不提及版本检查，也不要回复“已是最新版本”。用户主动询问版本或更新情况时，可以如实说明检查结果。不要在每次查询时反复检查，也不要自动执行更新。

用户明确要求更新时，先说明这只更新本机 Skill，不升级后端 Docker。若通过 `npx skills` 全局安装，执行 `npx skills update xiaomiev-mate -g -y`，检查执行结果；手动复制安装或无法确认安装来源时提供更新指导，不要擅自覆盖其他目录。更新不会主动修改服务地址和 API Key 配置。更新后提示用户刷新或新建 Agent 会话，并重新检查版本；不得把已下载但未加载的新指令视为当前会话已生效。

## 能力自发现与查询策略

- 面对不确定后端是否支持的新只读需求，优先执行 `xiaomiev capabilities` 获取当前后端开放的全部只读端点与参数说明。
- 对于 `capabilities` 返回的任何 `GET /openapi/v1/**` 只读端点，即使尚未封装独立快捷命令，也可以直接通过通用只读入口调用：
  ```bash
  xiaomiev get /openapi/v1/vehicles/1/overview --query startDate=2026-11-01 --query endDate=2026-11-26
  ```
- 优先使用数据目录与灵活查询组合已有业务字段；固定聚合接口适用于其明确提供的口径。

## 车辆选择

1. 首次需要车辆时执行 `xiaomiev vehicles`。
2. 只有一辆车时直接使用它的 `id`。
3. 多辆车时，若用户明确给出且能唯一匹配车辆名/车型则直接使用；否则列出可选车辆，让用户选择。
4. 同一对话中的追问默认沿用最近选中的车辆；用户明确指定其他车辆时立即切换。用户说“换一辆”且不能唯一确定目标时列出可选车辆；同名或同车型无法区分时询问，不猜测。
5. 用户要求对比多辆车时逐辆查询，明确标注车辆、相同时间范围和单位；没有数据的车辆应如实标记。只在当前对话记住选择，不保存为长期默认车辆；内部 ID 仅用于请求路径，不向用户要求或主动展示。

## 自然语言时间

用户不需要输入接口时间格式。Agent 按 `Asia/Shanghai` 转换为接口所需格式后调用命令：

- 明细列表（`trips`、`charges`）使用 `yyyy-MM-dd HH:mm:ss` 左闭右开区间：
  - 今天：当天 `00:00:00` 到次日 `00:00:00`。
  - 昨天：昨天 `00:00:00` 到今天 `00:00:00`。
  - 本周：本周一 `00:00:00` 到下周一 `00:00:00`。
  - 上周：上周一 `00:00:00` 到本周一 `00:00:00`。
  - 本月：本月 1 日到下月 1 日。
  - “11 月 20 日”：默认当前年份当天到次日；日期落在未来且用户语义不清时再追问。
  - “最近一次”：先查近 90 天，若为空继续按不超过 366 天的窗口向前查询；直到找到记录或达到已知数据起点。若起点未知或达到合理查询上限，说明已查范围，不能断言全部历史没有记录。
- 统计/趋势/足迹/健康接口（`overview`、`statistics`、`trend`、`footprints`、`health`）使用 `yyyy-MM-dd` 日期；月度报告（`monthly-report`）使用 `yyyyMM`（省略时默认当前月）。

## 常用命令

```bash
# 能力自发现与通用只读入口
xiaomiev capabilities
xiaomiev get <path> [--query key=value ...]

# 车辆与实时车况
xiaomiev vehicles
xiaomiev realtime --car-id 1
xiaomiev charging-detect --car-id 1

# 历史明细（Cursor 分页）
xiaomiev trips --car-id 1 --start-time "2026-11-20 00:00:00" --end-time "2026-11-21 00:00:00"
xiaomiev trip-detail --car-id 1 --trip-id 100
xiaomiev charges --car-id 1 --start-time "2026-11-01 00:00:00" --end-time "2026-12-01 00:00:00"
xiaomiev charge-detail --car-id 1 --record-id 200

# 统计、月报、智驾、足迹与健康
xiaomiev overview --car-id 1 --start-date 2026-11-01 --end-date 2026-11-26
xiaomiev statistics --car-id 1 --start-date 2026-11-01 --end-date 2026-11-26
xiaomiev monthly-report --car-id 1 --month 202611
xiaomiev trend --car-id 1 --days 30 --stat-date 2026-11-26
xiaomiev footprints --car-id 1 --level PROVINCE
xiaomiev footprint-detail --car-id 1 --level CITY --keyword 杭州 --page-num 1 --page-size 20
xiaomiev health --car-id 1 --start-date 2026-11-01 --end-date 2026-11-26
```

用户要求全部记录时，历史列表返回 `nextCursor` 应保持车辆、时间范围和 pageSize 继续翻页；灵活查询返回 `hasMore` 时增加 page。遇到失败、限制或中止时必须说明实际覆盖范围和结果不完整，不将第一页冒充全部。避免无限翻页，超过合理调用量时告知用户并确认是否继续。

## 行程与充电记录的回答和分析

- 展示充电记录的积分抵扣时使用 `pointsDeducted`：1 表示已抵扣，0 表示未抵扣（默认）；旧版缺少字段或返回 null 时表示暂不可用，不得推断。
- 展示充电列表时优先显示每条 `costAmount`；金额为 0 是有效金额，只有字段明确为 null 才表示未记录，不能把缺少字段当作没有费用。
- 如果列表不包含 `costAmount` 字段（例如旧版后端），对本次展示的记录按需调用 `charge-detail` 查询费用；逐条对应内部记录 ID，保留列表顺序。详情为空或查询失败时标记“费用暂不可用”，不能说未记录。需要处理大量记录时先说明查询范围并控制请求量，不要无界逐条调用。
- 列出行程或充电记录后，默认根据已取得的真实数据补充 1 至 3 条简短观察；用户只要求数据或不需要分析时尊重其要求。单次记录可观察里程、时长、电量变化、费用或实际有值的能耗；多次记录可比较费用、充入电量或时长，并说明对比范围。
- 发现值得关注的变化或数据不足时，在有依据的观察后给出 1 至 2 条具体建议。例如费用缺失时建议检查费用是否已录入及数据同步；相同计费电量口径下费用差异明显时建议核对电价、时段或服务费，原因须标明需要核实；单次行程能耗偏离该车可比历史时建议查看相近路线与温度、速度等条件。没有可信基准时不要称为“不达标”，而应说明数据不足或只描述差异。
- 分析只引用有值字段和明确口径，说明比较样本与时间范围；不推测充电类型、路径、故障、电池衰减或费用来源。充电时间包含等待等不确定因素时不把时长当作实际充电功率。缺失、样本不足或详情获取失败时如实说明，不能编造结论。涉及安全疑虑时建议用户结合车辆提示并联系专业人员，不把数据分析当作故障诊断。

## 隐私与回答

- 可以向用户返回行程起点/终点文字地点、充电地点以及行政区足迹名称。
- 不返回或推测经纬度、轨迹点、小米外部 ID、原始响应、诊断码、账号凭据或 API Key。
- 实时车况和充电检测沿用 Xiaomi EV Mate 原有实时处理逻辑；历史明细与统计分析只读取已同步的本地记录。
- 缺失字段保持“暂无数据”，不得用零值或常识补造。

## 灵活查询本地业务数据

当现有接口不能直接回答问题时，先执行 `xiaomiev data-catalog`，只使用返回的字段及其含义，随后通过标准输入向 `xiaomiev data-query --car-id <内部ID> --json-stdin` 传递结构化 JSON 并执行只读查询；不要把查询内容写入命令行参数或临时文件。此能力属于 `vehicle:read`；旧后端未提供时如实告知，不尝试访问数据库或凭据。

查询 JSON 支持 `dataset`、`startDate`、`endDate`（均必填，日期两端包含，Asia/Shanghai）、`fields`、`filters`、`groupBy`、`measures`、`orderBy`、`orderDirection`、`page`、`pageSize`。明细用 `fields`；聚合用 `groupBy` 和 `measures`，不能与 `fields` 混用。`groupBy` 支持目录字段和通用 `day`、`month`；`measures` 每项包含 `function`、`field`、`alias`，支持 `COUNT`（field 可省略）、`COUNT_DISTINCT`、`SUM`、`AVG`、`MIN`、`MAX`。筛选每项包含 `field`、`operator`、`value`，操作支持 `EQ`、`NE`、`GT`、`GTE`、`LT`、`LTE`、`CONTAINS`、`IS_NULL`、`NOT_NULL`。使用 `hasMore` 继续分页；单页最多 100 条。

示例，按月统计充电次数与已记录费用（费用缺失不是零）：

```json
{"dataset":"charges","startDate":"2026-01-01","endDate":"2026-11-26","groupBy":["month"],"measures":[{"function":"COUNT","alias":"sessions"},{"function":"COUNT","field":"cost","alias":"pricedSessions"},{"function":"SUM","field":"cost","alias":"cost"}],"orderBy":"month"}
```

必须依目录的字段说明解释单位、行粒度及缺失值；例如足迹每行是一个行程端点，统计到访行程数应使用 `COUNT_DISTINCT` 的 `tripId`。对查询无法表达的关联或数据不足，明确说明，不猜测、不伪造。禁止要求用户提供 SQL，也不要向用户展示 SQL 或结构化查询参数；查询内容可能包含个人地点，避免记录或持久化。

## 结果口径与兼容性

- 回答时说明车辆、时间范围、单位及缺失数据；分组统计与明细的时间边界不同，按对应接口规则处理。
- 平均充电价格应使用有费用记录的同一批会话计算，明确所用电量为车辆充入量还是桩端输出量；电量缺失、为零或费用缺失的会话不计入该比值，并说明遗漏。不要对累计智驾快照按日期求和。
- 数据目录或 capabilities 不存在时，不推断整个服务不可用；已有车辆、实时状态及历史接口仍可分别尝试。确实依赖新能力的问题说明后端需要升级，不虚构结果。
- 查询接口只读取已经同步的数据；没有天气等字段、无法表达关联或数据未同步时，解释缺失并避免推断。

- 历史行程、充电、足迹和健康查询使用 POST JSON；后端不支持时说明需要升级后端。
