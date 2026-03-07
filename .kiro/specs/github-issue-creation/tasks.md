# Implementation Plan: GitHub Issue Creation

## Overview

为 Gengar Bark Slack 机器人新增 GitHub Issue 创建功能。按照现有 Jira 创建的架构模式，实现核心模块（create-issue.ts）、传统命令（GitHubCommand）、AI Agent 工具（GitHubIssueTool），并集成到命令路由和工具注册系统中。

## Tasks

- [-] 1. 实现 GitHub Issue 创建核心模块
  - [x] 1.1 创建 `lib/github/create-issue.ts`，实现 `parseGitHubCommand()` 函数
    - 解析 `gh/github <repo> [label] [title] [JIRA-123 ...]` 格式的命令文本
    - 提取 repo（必填）、label（单个单词即视为 label，不限于推荐列表）、title（剩余部分）、jiraTickets（正则 `/[A-Z]+-\d+/g`）
    - 从 title 中移除已提取的 Jira ticket 号
    - 导出 `SUGGESTED_LABELS` 常量、`CreateGitHubIssueParams`、`GitHubIssueResult` 等类型
    - _Requirements: 1.2, 6.1, 6.2, 6.3, 9.2_

  - [x] 1.2 编写 `parseGitHubCommand()` 单元测试
    - 在 `lib/github/__tests__/create-issue.test.ts` 中编写测试
    - 覆盖：带 label + title、自定义 label、无 label 多词 title、仅 repo、仅 label 无 title、带 Jira ticket、多个 Jira ticket、从 title 中提取并移除 ticket
    - _Requirements: 1.2, 6.2, 9.2_

  - [x] 1.3 实现 `resolveRepo()` 函数
    - 使用 `GITHUB_PAT` 调用 `GET /user/repos`（per_page=100, sort=updated）
    - 结果缓存到 Upstash Redis（key: `github:repos`，TTL: 600s）
    - 精确匹配优先，否则模糊匹配（包含关系）
    - 无匹配时抛出明确错误
    - Redis 读写失败时静默降级为直接调用 API
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 1.4 编写 `resolveRepo()` 单元测试
    - Mock GitHub API 和 Redis
    - 覆盖：精确匹配、模糊匹配、精确优先、无匹配抛错、缓存命中不调 API、缓存未命中调 API 并写缓存
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 1.5 实现 `aiSummaryForGitHub()` 函数
    - 复用 `getThreadReplies()` 获取线程消息，复用 `getGPT()` 调用 GPT 模型
    - Prompt 要求返回 JSON：`{ summary, description, jiraTickets }`
    - 超时 6 秒返回空值（Promise.race）
    - JSON 解析失败返回空值
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 9.1_

  - [x] 1.6 实现 `createGitHubIssue()` 核心函数
    - 检查 `GITHUB_PAT` 环境变量
    - 调用 `resolveRepo()` 解析仓库
    - title 为空时调用 `aiSummaryForGitHub()`
    - 合并命令中显式指定的 jiraTickets 与 AI 识别的 jiraTickets（去重）
    - 如果有 jiraTickets，在 title 末尾追加所有 ticket 号（空格间隔，如 `修复登录问题 MER-123 CRM-456`）
    - 构建 issue body：reporter、Slack 线程链接（`https://moegoworkspace.slack.com/archives/{channelId}/p{threadTs}`，threadTs 移除小数点）、description、Related Jira Tickets 区域（仅在有 ticket 时附加）
    - `POST /repos/{owner}/{repo}/issues`，有 label 时附加 labels 字段
    - 返回 `GitHubIssueResult`，不抛出异常
    - 处理 401/403/404 等 GitHub API 错误
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 8.3, 9.3, 9.4_

  - [x] 1.7 编写 `createGitHubIssue()` 单元测试
    - Mock resolveRepo、aiSummaryForGitHub、axios
    - 覆盖：成功创建、body 包含 reporter/thread link/description、有 label、无 title 调 AI、AI 超时降级、PAT 未配置、有 jiraTickets 时 body 包含链接、无 jiraTickets 时不包含、合并去重、Jira 链接格式正确、有 jiraTickets 时 title 末尾追加 ticket 号
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 9.3, 9.4_

- [x] 2. Checkpoint - 核心模块验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. 实现 GitHubCommand 传统命令
  - [x] 3.1 在 `lib/commands/gengar-commands.ts` 中新增 `GitHubCommand` 类
    - 实现 Command 接口（matches + execute）
    - `matches()`: 匹配 `/^(gh|github)\s+\S+/i`
    - `execute()`: 调用 `parseGitHubCommand()` + `createGitHubIssue()`
    - 成功时发送包含 issue 链接的 Slack 消息，失败时发送错误消息
    - 命令格式错误（缺少 repo）时返回使用说明
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 8.1, 8.2_

  - [x] 3.2 编写 `GitHubCommand` 的 matches 单元测试
    - 覆盖：`gh gengar-bark` → true、`github repo bug title` → true、`GH Repo` → true、`jira MER Bug` → false、`ghrepo` → false
    - _Requirements: 1.1_

- [x] 4. 实现 GitHubIssueTool Agent 工具
  - [x] 4.1 创建 `lib/agent/tools/github-issue-tool.ts`
    - 实现 Tool 接口，name: `create_github_issue`
    - parameters schema: repo (required), label (optional), title (optional), description (optional), jiraTickets (optional, string[])
    - 调用 `createGitHubIssue()` 并返回 ToolResult
    - 导出 `createGitHubIssueTool()` 工厂函数
    - _Requirements: 2.1, 2.2, 2.3, 7.3_

  - [x] 4.2 编写 `GitHubIssueTool` 单元测试
    - 在 `lib/agent/tools/__tests__/github-issue-tool.test.ts` 中编写
    - 覆盖：成功返回 ToolResult、失败返回 error、工具 name 和 parameters schema 正确、jiraTickets 可选参数
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. 集成到命令路由和工具注册系统
  - [x] 5.1 在 `lib/events-handlers/chat.ts` 中注册 GitHubCommand
    - 在命令列表中添加 `new GitHubCommand(channel, ts, userId)`
    - 位置：JiraCommand 之后、FileCommand 之前
    - 添加 import 语句
    - _Requirements: 7.2_

  - [x] 5.2 在 `lib/agent/tools/index.ts` 中注册 GitHubIssueTool
    - 在 `createAllTools()` 中添加 `createGitHubIssueTool()`
    - 在 `getAvailableToolNames()` 中添加 `create_github_issue`
    - 添加 import 和 re-export 语句
    - _Requirements: 7.3_

  - [x] 5.3 更新 `HelpCommand` 帮助文本
    - 在帮助信息中添加 GitHub Issue 创建命令的使用说明
    - 格式参考现有 Jira 命令的帮助文本
    - _Requirements: 7.4_

- [x] 6. 编写功能文档
  - [x] 6.1 创建 `.docs/github-issue.md`
    - 功能概述：模块用途、两种触发路径（传统命令 + AI Agent）
    - 数据流：Slack 消息 → 命令解析/Agent 识别 → 仓库解析 → AI 摘要 → GitHub API → Slack 反馈
    - 命令格式与使用示例：各种参数组合（repo、label、title、Jira ticket）
    - 模块架构：涉及的源文件及职责（create-issue.ts、github-issue-tool.ts、gengar-commands.ts、chat.ts、tools/index.ts）
    - 配置要求：GITHUB_PAT 环境变量、Redis 缓存依赖
    - Label 体系：推荐列表 + 自定义 label
    - Jira Ticket 关联：自动识别 + 显式指定、合并去重
    - 错误处理：常见错误场景与用户反馈
    - 中文编写
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10_

- [x] 7. Final checkpoint - 全部验证
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- 标记 `*` 的子任务为可选测试任务，可跳过以加速 MVP
- 每个任务引用了具体的 requirements 编号以确保可追溯性
- 测试使用 vitest，运行命令：`npx vitest run`（非监听模式）
- 外部依赖（GitHub API、Slack API、OpenAI、Redis）在测试中使用 mock
- 不使用属性测试（PBT），仅使用 vitest 纯单元测试
