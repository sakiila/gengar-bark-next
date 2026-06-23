# GrowthBook MCP 服务器：tools 核心实现设计汇总（Reference）

本文件基于本仓库中已克隆的 `./growthbook-mcp` 源码整理，目标是为后续“把 GrowthBook MCP 接入/对接你们现有 MCP 管线”提供精确的实现参考。

## 范围与不包含

- 包含：GrowthBook MCP 暴露的 **MCP tools** 的核心实现设计总结（18 个 tool）。
- 不包含：`resources`、`prompts`、`SDK integration` 的完整模板内容（只总结其生成方式与关键参数）。

## 工具总览（18 个）

1. `get_environments`
2. `get_projects`
3. `get_sdk_connections`
4. `create_sdk_connection`
5. `create_feature_flag`
6. `create_force_rule`
7. `get_feature_flags`
8. `list_feature_keys`
9. `get_stale_feature_flags`
10. `generate_flag_types`
11. `get_experiments`
12. `get_attributes`
13. `create_experiment`
14. `get_defaults`
15. `set_user_defaults`
16. `clear_user_defaults`
17. `get_metrics`
18. `search_growthbook_docs`

## 运行与配置前置条件（影响所有 tools）

### 传输方式与运行入口

- `src/index.ts` 创建 `McpServer` 并通过 `StdioServerTransport` 运行：服务端通过 stdin/stdout 与 MCP 客户端交互（典型是本地/IDE 内使用的 stdio 模式）。

### 必需环境变量与 API 行为

- `GB_API_KEY`：GrowthBook API Key（用于所有请求的 `Authorization: Bearer ...`）。
- `GB_EMAIL`：作为 `owner`/创建者等语义信息的来源；服务端启动时强制要求已设置（`GB_EMAIL is not set` 会直接抛错）。
- `GB_API_URL`（可选）：默认 `https://api.growthbook.io`，会去除尾部 `/`。
- `GB_APP_ORIGIN`（可选）：默认 `https://app.growthbook.io`，会去除尾部 `/`。
- `GB_HTTP_HEADER_*`（可选）：可注入额外自定义 HTTP 头。实现规则：
  - 变量前缀 `GB_HTTP_HEADER_`；
  - 下划线分段转为 Header 格式（`X_TENANT_ID` -> `X-Tenant-ID`，`CF_ACCESS_TOKEN` -> `Cf-Access-Token`）。

## 共享实现模式（跨 tool 复用）

### 统一 HTTP 请求封装

- `buildHeaders(apiKey, includeContentType)`：
  - 基于 `getCustomHeaders()` 加载 `GB_HTTP_HEADER_*`；
  - 强制写入 `Authorization: Bearer ${apiKey}`；
  - 默认包含 `Content-Type: application/json`。
- `handleResNotOk(res)`：
  - 如果 `res.ok` 为 false，则读取 `res.text()`；
  - 尝试将 body 解析为 JSON 并拼接错误信息；解析失败则退回原始文本；
  - 最终抛出 `Error(HTTP <status> <statusText>: <body>)` 类错误。
- `fetchWithRateLimit(url, options, retries=3)`：
  - 发送前 `sleep(50ms)` 轻微节流；
  - 若 `response.status === 429` 且尚有重试次数：
    - 从 `RateLimit-Reset` 读取秒数（默认 5）；
    - 等待 `resetSeconds * 1000` 后递归重试。

### 分页与 mostRecent 语义

- `paginationSchema`：
  - `limit: 1-100`，默认 100；
  - `offset: >=0`，默认 0；
  - `mostRecent: boolean`，默认 false。
- `fetchWithPagination(baseApiUrl, apiKey, endpoint, limit, offset, mostRecent, additionalParams?)`：
  - 普通模式（`!mostRecent || offset > 0`）：直接 `?limit&offset` 拉取。
  - mostRecent 模式：
    1. 先请求 `limit=1` 获取 `total`；
    2. 计算 `calculatedOffset = max(0, total - limit)`；
    3. 再请求 `?limit&offset=calculatedOffset`。

### SDK / 文档片段生成的核心逻辑

- `getDocsMetadata(extension)` 会依据 `fileExtension` 选择：
  - `language`（如 react/javascript/python/...）；
  - `stub`（来自 `getFeatureFlagDocs(language)` 的 SDK 代码片段）；
  - `docs` 链接（如 `https://docs.growthbook.io/lib/react`）。

### Feature flag 规则合并语义

- `mergeRuleIntoFeatureFlag(existingFeature, newRule, defaultEnvironments)`：
  - 遍历 `existingFeature.environments`：保留所有环境与其现有规则；
  - 对 `defaultEnvironments`：
    - 将 `newRule` append 到 `rules` 数组；
  - 如果 defaults 环境在现有 flag 中不存在，则补齐为 `{ enabled: false, rules: [newRule] }`。
  - 返回形状：`{ environments }`（供更新 feature flag 的 API 使用）。

## tool 逐个说明（按 tool-name 分节）

> 说明：每个 tool 都通过 `server.registerTool(name, { inputSchema, ... }, handler)` 注册；handler 返回的主要载体是 MCP 的 `content: [{type: "text", text: "..."}]` 数组。

---

### `get_environments`

**输入**：无

**核心执行流程**

1. `GET {baseApiUrl}/api/v1/environments`
2. 使用 `buildHeaders(apiKey)` + `fetchWithRateLimit`
3. `handleResNotOk` 校验后解析 JSON
4. 使用 `formatEnvironments(data)` 将环境列表格式化为可读文本

**输出**

- 返回单段文本：`content: [{ type: "text", text: formatEnvironments(...) }]`

**关键边界/错误**

- 错误通过 `formatApiError(error, "fetching environments", ["Check that ... read environments."])` 生成更可执行的提示。

---

### `get_projects`

**输入**

- `limit/offset/mostRecent`（来自 `paginationSchema`）

**核心执行流程**

1. `fetchWithPagination(baseApiUrl, apiKey, "/api/v1/projects", ...)`
2. mostRecent 且 `offset===0`：对 `data.projects` 做 `reverse()`，确保 newest-first 展示
3. `formatProjects(data)` 输出格式化文本

**输出**

- 单段文本内容：项目列表 + 说明用户用 `id` 做作用域。

---

### `get_sdk_connections`

**输入**

- `project?`（按项目过滤）
- `limit/offset/mostRecent`

**核心执行流程**

1. `fetchWithPagination(baseApiUrl, apiKey, "/api/v1/sdk-connections", ..., additionalParams)`
2. mostRecent 且 `offset===0`：反转 `data.connections`
3. `formatSdkConnections(data)` 生成可读文本（包含 client key）

**输出**

- 单段文本：连接数量、每条连接的 languages/environment/key/project。

---

### `create_sdk_connection`

**输入**

- `name`（SDK 连接名称）
- `language`（枚举：nocode-* 与多种平台）
- `environment?`（可选；缺失时会回退为让用户先选环境）
- `projects?`（可选：项目列表）

**核心执行流程**

1. 若未提供 `environment`：
  - 拉取 `GET {baseApiUrl}/api/v1/environments`
  - 返回 `formatEnvironments + 指导语`，要求用户选 environment id 后再调用本 tool。
2. 若提供 `environment`：
  - `POST {baseApiUrl}/api/v1/sdk-connections`，payload 含 `name/language/environment/(projects)`
  - `handleResNotOk` 校验
  - 返回创建结果文本：
    - 若 API 返回 `sdkConnection`：包含 key/environment/languages
    - 否则退回 JSON

**输出**

- 单段文本，通常含 `Client key`（供应用接入 GrowthBook SDK）。

**关键边界/错误**

- 创建失败通过 `formatApiError(..., "creating SDK connection", suggestions)` 给出排错建议：环境是否存在、language 参数合法性。

---

### `create_feature_flag`

**输入（来自 `featureFlagSchema`）**

- `id`（key：仅允许 `[a-zA-Z0-9_.:|_-]+`）
- `valueType`：`string|number|boolean|json`
- `defaultValue`
- `description`
- `archived`（schema 内含）
- `project?`
- `fileExtension`（用于生成 SDK stub 与 docs）
- `customFields?`

**核心执行流程**

1. 获取环境列表用于初始化 environments：
  - 优先使用 `getDefaults(apiKey, baseApiUrl).environments`
  - 若 defaults 不含 environments：
    - `GET {baseApiUrl}/api/v1/features/environments`
2. 构造 payload：
  - `owner: user`
  - `tags: ["mcp"]`
  - `environments`：把每个环境初始化成 `{ enabled: false, rules: [] }`
  - 可选追加 `project` 与 `customFields`
3. `POST {baseApiUrl}/api/v1/features` 创建 feature flag（初始禁用）
4. 用 `getDocsMetadata(fileExtension)` 生成：
  - `language`、`stub`、`docs` 链接
5. `formatFeatureFlagCreated(...)` 输出“创建结果 + SDK integration 片段 + docs 链接”

**输出**

- 单段文本：包含 `View in GrowthBook` link 与 SDK stub。

---

### `create_force_rule`

**输入**

- `featureId`
- `description?`（默认空字符串）
- `fileExtension`（用于 SDK stub）
- `condition?`（MongoDB-style JSON 字符串）
- `value`

**核心执行流程**

1. 先读取目标 feature flag：
  - `GET {baseApiUrl}/api/v1/features/{featureId}`（通过 `fetchFeatureFlag`）
  - 用于保留原有 rules/environments
2. 再获取 feature defaults（用于确定 defaultEnvironments）：
  - `getDefaults(apiKey, baseApiUrl).environments`
3. 构造 newRule：`{ type: "force", description, condition, value }`
4. `mergeRuleIntoFeatureFlag(existingFeature, newRule, defaultEnvironments)`
5. `POST {baseApiUrl}/api/v1/features/{featureId}` 更新 feature
6. 用 `getDocsMetadata(fileExtension)` 生成 SDK stub 与 docs：
  - 返回 `formatForceRuleCreated(...)`（“已添加 targeting rule + SDK 集成片段”）

**关键约束**

- tool 描述明确：这是 targeting without measurement，**不要用于 A/B**。

---

### `get_feature_flags`

**输入**

- `project?`
- `featureFlagId?`（二选一：提供则取单个；不提供则列表分页）
- `limit/offset/mostRecent`

**核心执行流程**

1. 若 `featureFlagId`：
  - `GET {baseApiUrl}/api/v1/features/{featureFlagId}`
  - `formatFeatureFlagDetail(data, appOrigin)` 输出完整规则/环境细节 + GrowthBook link
2. 否则：
  - `fetchWithPagination(..., "/api/v1/features", ...)` 拉取列表
  - 若 mostRecent 且 offset==0：`reverse()` 确保 newest-first
  - `formatFeatureFlagList(data)` 输出“flag 列表 + 每个环境开启/规则数”

**输出**

- 列表或详情的单段文本（均为 MCP `type:text`）。

---

### `list_feature_keys`

**输入**

- `projectId?`（可选过滤）

**核心执行流程**

1. 拼 query：`/api/v1/feature-keys?projectId=...`（无 projectId 则空）
2. `GET ...` -> JSON `string[]`
3. 返回：**${keys.length} ...**\n\n${k1}, ${k2}...（单段文本）

**关键用途**

- 大规模发现 flags 的 id（为后续 stale 检查准备）。

---

### `get_stale_feature_flags`

**输入**

- `featureIds?: string[]`（tool 描述中强调：必须传）

**核心执行流程**

1. 若 `featureIds` 为空：
  - 返回“缺少 featureIds 的指引文本”，建议用 `list_feature_keys` 或从上下文提取。
2. 否则：
  - `GET {baseApiUrl}/api/v1/stale-features?ids=<comma-joined>`
  - `formatStaleFeatureFlags(data, featureIds)` 生成清理建议：
    - 每个 flag：是否 stale、原因
    - stale 时提供替换值（若 env 确定一致，否则优先生产环境的值，并提示需用户确认）
    - 给出 search guidance：在代码中搜用法并替换

**输出**

- 单段文本：逐项 stale 检查结果 + 总结性的替换/清理建议。

---

### `generate_flag_types`

**输入**

- `currentWorkingDirectory`

**核心执行流程（重点：子进程）**

1. 在 `currentWorkingDirectory` 执行：
  - `npx -y growthbook@latest auth login -k ${apiKey} -u ${baseApiUrl} -p default`
2. 再执行生成 types：
  - `npx -y growthbook@latest features generate-types -u ${baseApiUrl}`
3. 将 `stdout` 作为输出嵌入返回文本，提示用户可把命令加到 package.json 的脚本里

**关键点**

- 这是唯一“会执行命令行（child_process.exec）”的 tool。

---

### `get_experiments`

**输入**

- `project?`
- `experimentId?`
- `mode: metadata|summary|full`（默认 `metadata`）
- `limit/offset/mostRecent`

**核心执行流程**

1. 若 `experimentId`：
  - 拉取实验详情：`GET /api/v1/experiments/{id}`
  - 根据 `mode`：
    - `metadata`：直接格式化实验配置
    - `summary`：也会在 tool 内触发 summary 统计（对多实验列表时走 summary 汇总逻辑）
    - `full`：
      - 若实验 `draft`：result 置为 `null`
      - 否则：再拉取 `GET /api/v1/experiments/{id}/results`
      - 解析 goals/guardrails/secondaryMetrics 的 metricIds，调用 `getMetricLookup` 解析 metric 名称
      - 返回“多块响应”：先概要（formatExperimentDetail），再附上 raw results JSON（JSON.stringify）
2. 若未传 `experimentId`（列表模式）：
  - `fetchWithPagination("/api/v1/experiments", ...)`
  - 若 mostRecent 且 offset==0：`reverse()` newest-first
  - 若 `mode` 是 `summary` 或 `full`：逐个实验拉取 results
    - draft 实验：result undefined
    - 其他实验：`/results`，失败会 `console.error` 但继续
  - `mode=summary`：调用 `handleSummaryMode(experiments, ...)` 计算统计卡片与聚合指标
  - `mode=full`：返回整页 JSON（`formatExperimentList` 不用）
  - `mode=metadata`：列表返回 `formatExperimentList`
3. 进度回报（可选）：
  - 当 `extra._meta.progressToken` 存在时，调用 `server.server.notification({ method: "notifications/progress" ... })`

**输出**

- `metadata`：实验列表/详情格式化文本
- `summary`：返回包含分页信息的 `summary` JSON 字符串（放在 `content[0].text`）
- `full`：返回 raw JSON（或单实验 raw result）

**关键设计：summary 统计模型**

- `getMetricLookup`：对 metricId->name/type/inverse 的解析带 TTL 缓存 + 并发限制（MAX_CONCURRENT_FETCHES=10）
- verdict/显著性：严格复刻 `ExperimentWinRate.tsx` 逻辑（通过 `computeVerdict` 与 `computePrimaryMetricResult`）

---

### `get_attributes`

**输入**：无

**核心执行流程**

- `GET {baseApiUrl}/api/v1/attributes?limit=100`
- `formatAttributes(data)` 输出可用于 targeting condition 的属性列表（property/datatype/hashAttribute）

**输出**

- 单段文本：属性清单 + 示例语句建议

---

### `create_experiment`

**输入（核心）**

- `name/description/hypothesis`
- `valueType`
- `variations: [{ name, value }]`
- `project?`
- `featureId?`（可选：若要把实验引用嵌入 feature flag 的规则里）
- `fileExtension`（必须，用于生成 SDK integration 片段）
- `confirmedDefaultsReviewed`（必须为 true，否则直接返回错误）
- `customFields?`

**核心执行流程**

1. 若未确认 defaults：
  - 返回错误提示：必须先调用 `get_defaults` 并 review 输出
2. 拉取实验 defaults：
  - `getDefaults(apiKey, baseApiUrl)`（会做自动检测 + 缓存/持久化；见下面 defaults 工具）
3. 构造实验 payload：
  - `owner: user`
  - `trackingKey`：由 `name` 规范化得到（小写 + 非 alnum -> `-`）
  - `tags: ["mcp"]`
  - `assignmentQueryId/datasourceId` 来自 defaults
  - variations：为每个 variation 赋 `key`（idx）并带 name
  - 可选 `project/customFields`
4. `POST {baseApiUrl}/api/v1/experiments` 创建 draft 实验
5. 若提供 `featureId`：
  - 先 `fetchFeatureFlag(featureId)` 拉取现有 flag
  - 构造 `experiment-ref` rule，把各 variations 的 `value` 与 growthbook variationId 对齐
  - `mergeRuleIntoFeatureFlag` 把新 rule 合并到 defaults 环境的 rules 里
  - `POST /api/v1/features/{featureId}` 更新 feature
6. 输出：
  - 用 `getDocsMetadata(fileExtension)` 选择 SDK stub + docs 链接
  - `formatExperimentCreated` 输出：
    - draft 实验的 review/link
    - variations/trackingKey
    - 若有 stub：包含 SDK integration 片段

**关键约束**

- 描述强调：这是 A/B measurement，不用于简单开关（开关用 feature flag tool，targeting-only 用 force rule tool）。

---

### `get_defaults`

**输入**：无

**核心执行流程（本地持久化 + 自动探测）**

1. 默认读取用户 defaults 文件：`envPaths("growthbook-mcp").config/user-defaults.json`
2. 若存在用户 defaults：
  - 仍会尝试读取/重用自动生成的 30 天缓存（`experiment-defaults.json`），只把 `name/hypothesis/description` 复用
  - 用用户文件覆盖 `datasourceId/assignmentQuery/environments`
3. 若不存在或缓存过期：
  - 调用 `createDefaults(apiKey, baseApiUrl)` 自动探测：
    - 拉取 `/api/v1/experiments` 以统计最常见的 `datasourceId/assignmentQueryId`
    - 若实验列表为空：回退拉取 `/api/v1/data-sources` 并取第一个 assignmentQuery
    - 拉取 `/api/v1/environments` 得到环境列表
4. 最终返回 experiment defaults 文本化输出（`formatDefaults`）

**输出**

- defaults 文本（datasource/assignmentQuery/environments + 最近命名示例/假设示例）

---

### `set_user_defaults`

**输入**

- `datasourceId`
- `assignmentQueryId`
- `environments: string[]`

**核心执行流程**

- 在本地 `experimentDefaultsDir` 写入 `user-defaults.json`
- 返回确认文本（包含写入文件路径与 JSON 展示）

**输出**

- 单段文本：持久化成功提示

---

### `clear_user_defaults`

**输入**：无

**核心执行流程**

- 尝试读取 `user-defaults.json`：
  - 存在：unlink 删除
  - 不存在：返回“未设置”的提示

**输出**

- 清除结果文本

---

### `get_metrics`

**输入**

- `project?`
- `metricId?`
- `limit/offset/mostRecent`

**核心执行流程**

1. 若 `metricId`：
  - `metricId` 以 `fact__` 开头 -> `GET /api/v1/fact-metrics/{id}`
  - 否则 -> `GET /api/v1/metrics/{id}`
  - `formatMetricDetail` 生成单段文本（含 GrowthBook link）
2. 若不传 `metricId`：
  - 分别分页拉取：
    - `/api/v1/metrics`
    - `/api/v1/fact-metrics`
  - mostRecent 且 offset==0：分别 reverse，确保 newest-first
  - `formatMetricsList` 输出 fact/legacy 两类的合并列表与提示

**输出**

- 列表或详情的单段文本

---

### `search_growthbook_docs`

**输入**

- `query`
- `maxResults`（默认 5；上限 10）

**核心执行流程**

1. 调用 `searchGrowthBookDocs(query, { hitsPerPage: maxResults })`
2. `searchGrowthBookDocs`：
  - 使用 Algolia（固定 Application ID/API Key/Index name）对官方 docs 做全文检索
  - 组装每条 result 的 `title/url/snippet/hierarchy`
  - 若 snippet 不存在：截断 `content/text` 作为 fallback（最多 300 字）
3. tool handler 将每条 result 格式化为：
  - `**title`** + （层级 breadcrumb）+（url）+（snippet）
  - 最终返回数组到 `content`（text 型多条）

**输出**

- `content`：多条 text 段落（每条对应一条 docs 搜索结果）

