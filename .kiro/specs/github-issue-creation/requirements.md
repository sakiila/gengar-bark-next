# Requirements Document

## Introduction

为 Gengar Bark Slack 机器人添加 GitHub Issue 创建功能。支持传统命令模式（`gh`/`github`）和 AI Agent 自然语言模式两种触发路径。系统从 Slack 线程中提取上下文，通过 AI 生成 issue 的 title 和 body，并使用 GitHub API 创建 issue。Label 参考 Angular commit 风格前缀（bug/feat/ci/perf 等），但不限于此列表，用户可使用任意自定义 label。

## Glossary

- **GitHub_Issue_Creator**: 负责解析命令参数、调用 GitHub API 创建 issue 的核心模块
- **GitHub_Command**: 传统命令模式的入口，匹配 `gh` 或 `github` 前缀并解析参数
- **GitHub_Issue_Tool**: AI Agent 模式下的工具，接收结构化参数并调用 GitHub_Issue_Creator
- **AI_Summarizer**: 从 Slack 线程消息中提取 issue title 和 body 的 AI 摘要模块
- **Repo_Resolver**: 根据用户输入的仓库名，通过 GitHub API 匹配完整仓库路径的模块
- **Angular_Label**: 参考 Angular commit convention 的推荐 label 列表，包括 bug、feat、fix、ci、perf、docs、style、refactor、test、chore；用户也可使用不在此列表中的自定义 label

## Requirements

### Requirement 1: 传统命令触发

**User Story:** 作为 Slack 用户，我想通过输入 `gh <repo> [label] [title]` 或 `github <repo> [label] [title]` 命令来创建 GitHub Issue，以便快速从 Slack 对话中创建跟踪项。

#### Acceptance Criteria

1. WHEN 用户输入以 `gh ` 或 `github ` 开头的消息, THE GitHub_Command SHALL 匹配该消息并触发 issue 创建流程
2. THE GitHub_Command SHALL 解析命令文本，提取 repo（必填）、label（选填）和 title（选填）三个参数
3. WHEN label 参数未提供, THE GitHub_Issue_Creator SHALL 创建不带 label 的 issue
4. WHEN title 参数未提供, THE AI_Summarizer SHALL 从当前 Slack 线程中生成 title 和 body

### Requirement 2: AI Agent 自然语言触发

**User Story:** 作为 Slack 用户，我想通过自然语言描述来创建 GitHub Issue（例如"帮我在 gengar-bark 仓库创建一个 bug issue"），以便无需记忆命令格式。

#### Acceptance Criteria

1. THE GitHub_Issue_Tool SHALL 注册到 Agent 工具系统，包含 name、description 和 parameters schema
2. WHEN AI Agent 识别到用户意图为创建 GitHub Issue, THE GitHub_Issue_Tool SHALL 接收 repo、label、title 和 description 参数并调用 GitHub_Issue_Creator
3. THE GitHub_Issue_Tool SHALL 返回包含 success 状态、issue URL 和 displayText 的 ToolResult

### Requirement 3: 仓库名解析

**User Story:** 作为 Slack 用户，我想只输入仓库名（无需指定 owner）就能匹配到正确的仓库，以便简化命令输入。

#### Acceptance Criteria

1. WHEN 用户提供仓库名, THE Repo_Resolver SHALL 使用 GITHUB_PAT 调用 GitHub API 获取该 token 有权限访问的仓库列表
2. WHEN 仓库名与某个可访问仓库精确匹配, THE Repo_Resolver SHALL 返回该仓库的 owner 和 repo 信息
3. WHEN 仓库名与多个仓库模糊匹配, THE Repo_Resolver SHALL 选择最佳匹配结果
4. IF 仓库名无法匹配到任何可访问仓库, THEN THE Repo_Resolver SHALL 返回明确的错误信息，说明未找到匹配的仓库
5. THE Repo_Resolver SHALL 缓存仓库列表以避免重复 API 调用，缓存有效期为 10 分钟

### Requirement 4: AI 摘要生成

**User Story:** 作为 Slack 用户，我想让 AI 自动从 Slack 线程中提取 issue 的标题和描述，以便减少手动输入。

#### Acceptance Criteria

1. WHEN title 未由用户提供, THE AI_Summarizer SHALL 读取当前 Slack 线程的所有消息
2. THE AI_Summarizer SHALL 调用 GPT 模型，从线程消息中提取 summary（作为 issue title）和 description（作为 issue body 的一部分）
3. THE AI_Summarizer SHALL 返回符合 JSON 格式的结果，包含 summary 和 description 两个字段
4. IF AI 摘要调用超时（超过 6 秒）, THEN THE AI_Summarizer SHALL 返回空的 summary 和 description，允许流程继续

### Requirement 5: GitHub Issue 创建

**User Story:** 作为 Slack 用户，我想让系统通过 GitHub API 创建 issue 并返回链接，以便我能直接访问新创建的 issue。

#### Acceptance Criteria

1. THE GitHub_Issue_Creator SHALL 使用 GITHUB_PAT 环境变量进行 GitHub API 认证
2. THE GitHub_Issue_Creator SHALL 通过 GitHub REST API (`POST /repos/{owner}/{repo}/issues`) 创建 issue
3. THE GitHub_Issue_Creator SHALL 在 issue body 中包含以下内容：reporter 名称、Slack 线程链接（Markdown 可点击链接，格式为 `https://moegoworkspace.slack.com/archives/{channelId}/p{threadTs}`，其中 threadTs 需移除小数点；该链接用于从 GitHub Issue 快速溯源到 Slack 讨论上下文）、AI 生成的描述
4. WHEN label 参数已提供, THE GitHub_Issue_Creator SHALL 将该 label 附加到创建的 issue 上
5. WHEN issue 创建成功, THE GitHub_Issue_Creator SHALL 返回 issue 的 URL 和编号
6. IF GitHub API 返回错误, THEN THE GitHub_Issue_Creator SHALL 返回包含错误原因的明确错误信息
7. WHEN 存在关联的 Jira ticket 时, THE GitHub_Issue_Creator SHALL 在 issue title 末尾追加所有 Jira ticket 号，以空格间隔（如 `修复登录问题 MER-123 CRM-456`）

### Requirement 6: Label 体系

**User Story:** 作为 Slack 用户，我想使用类似 Angular commit 风格的前缀作为 issue label（如 bug、feat、ci、perf），以便 issue 分类与团队的 commit convention 保持一致。同时我也希望能使用自定义 label，不受限于固定列表。

#### Acceptance Criteria

1. THE GitHub_Issue_Creator SHALL 提供以下推荐 label 值作为参考：bug、feat、fix、ci、perf、docs、style、refactor、test、chore
2. WHEN 命令中 repo 之后的第一个参数为单个单词（不含空格）, THE GitHub_Command SHALL 将其识别为 label，无论该值是否在推荐列表中
3. THE GitHub_Issue_Creator SHALL 对 label 参数进行大小写不敏感的处理

### Requirement 7: 命令路由集成

**User Story:** 作为开发者，我想将 GitHub Issue 命令集成到现有的命令路由系统中，以便与其他命令（如 Jira、CI）保持一致的架构。

#### Acceptance Criteria

1. THE GitHub_Command SHALL 实现 Command 接口（matches 和 execute 方法）
2. THE GitHub_Command SHALL 在命令路由列表中注册，位于 JiraCommand 之后、AgentCommand 之前
3. THE GitHub_Issue_Tool SHALL 在 `createAllTools()` 中注册，并在 `getAvailableToolNames()` 中列出
4. THE HelpCommand SHALL 更新帮助文本，包含 GitHub Issue 创建命令的使用说明

### Requirement 8: Slack 反馈

**User Story:** 作为 Slack 用户，我想在 issue 创建成功或失败时收到明确的 Slack 消息反馈，以便了解操作结果。

#### Acceptance Criteria

1. WHEN issue 创建成功, THE GitHub_Command SHALL 在 Slack 线程中发送包含 issue 链接的成功消息
2. IF issue 创建失败, THEN THE GitHub_Command SHALL 在 Slack 线程中发送包含错误原因的失败消息
3. IF GITHUB_PAT 环境变量未配置, THEN THE GitHub_Issue_Creator SHALL 返回明确的配置缺失错误信息

### Requirement 9: Jira Ticket 关联

**User Story:** 作为 Slack 用户，我想在创建 GitHub Issue 时关联相关的 Jira ticket，以便在 GitHub 和 Jira 之间建立可追溯的链接。

#### Acceptance Criteria

1. WHEN AI_Summarizer 从 Slack 线程中提取摘要时, THE AI_Summarizer SHALL 同时识别线程消息中出现的 Jira ticket 号（格式为大写字母前缀+短横线+数字，如 MER-123、CRM-456、FIN-789）
2. WHEN 用户在命令中显式指定 Jira ticket 号（如 `gh gengar-bark bug 修复登录 MER-123 CRM-456`）, THE GitHub_Command SHALL 从命令文本中提取这些 ticket 号
3. WHEN 识别到一个或多个 Jira ticket 时, THE GitHub_Issue_Creator SHALL 在 issue body 中以 Markdown 链接形式附加这些 ticket（格式：`[MER-123](https://moego.atlassian.net/browse/MER-123)`）
4. WHEN 未识别到任何 Jira ticket 时, THE GitHub_Issue_Creator SHALL 正常创建 issue，不附加 Jira 关联区域，不影响 issue 创建流程

### Requirement 10: 功能文档

**User Story:** 作为开发者，我想阅读一份完整的功能文档来了解 GitHub Issue 创建模块的运作原理，以便快速上手维护和扩展该功能。

#### Acceptance Criteria

1. THE 文档 SHALL 创建在 `.docs/github-issue.md` 路径下
2. THE 文档 SHALL 包含功能概述，说明该模块的用途和支持的两种触发路径（传统命令 + AI Agent）
3. THE 文档 SHALL 包含完整的数据流说明，从 Slack 消息触发到 GitHub Issue 创建完成的全过程
4. THE 文档 SHALL 包含命令格式说明和使用示例（包括 `gh`/`github` 前缀、repo、label、title、Jira ticket 的各种组合）
5. THE 文档 SHALL 包含模块架构说明，列出涉及的源文件及其职责
6. THE 文档 SHALL 包含配置要求，说明所需的环境变量（`GITHUB_PAT`）和外部依赖（Redis 缓存）
7. THE 文档 SHALL 包含 Label 体系说明（推荐列表 + 自定义 label 支持）
8. THE 文档 SHALL 包含 Jira Ticket 关联机制说明（自动识别 + 显式指定）
9. THE 文档 SHALL 包含错误处理说明，列出常见错误场景和对应的用户反馈
10. THE 文档 SHALL 使用中文编写
