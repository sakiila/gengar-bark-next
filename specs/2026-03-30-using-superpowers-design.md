# GrowthBook Local ToolRegistry + REST API Tools Design

Date: 2026-03-30
Status: Approved (design)
Scope: Current repository only (`gengar-bark-next`)

## 1) Scope And Goals

### Goal
Implement a local set of GrowthBook tools in the current project via existing `ToolRegistry` (OpenAI function tools) and direct GrowthBook REST API calls.

### Why
The local `growthbook-mcp` repository is reference-only and will not be shipped with this project. Therefore, this project must own equivalent business behavior internally.

### Tool Naming
All new tool names use the `growthbook_` prefix to avoid collisions with existing or future tools.

### Included Tools (14)
- `growthbook_get_environments`
- `growthbook_get_projects`
- `growthbook_create_feature_flag`
- `growthbook_create_force_rule`
- `growthbook_get_feature_flags`
- `growthbook_list_feature_keys`
- `growthbook_get_stale_feature_flags`
- `growthbook_generate_flag_types`
- `growthbook_get_experiments`
- `growthbook_get_attributes`
- `growthbook_get_defaults`
- `growthbook_set_user_defaults`
- `growthbook_clear_user_defaults`
- `growthbook_get_metrics`

### Excluded
- `search_growthbook_docs` (explicitly out of scope)

### Owner Field Policy
- Never send `owner` in create payloads.
- Any existing reference behavior that injects owner must not be copied into this implementation.

### Schema Policy
- Keep local `ToolParameterSchema` as close as possible to GrowthBook MCP schema shape and optionality.
- Prefer MCP-compatible field names and argument semantics.

## 2) Architecture And File Layout

### Runtime Data Flow
1. Slack message enters `AgentCommand`.
2. `Orchestrator` asks OpenAI with all registered local tools.
3. OpenAI chooses `growthbook_*` tool.
4. `ToolRegistry` executes tool `execute(params, context)`.
5. Tool calls shared GrowthBook REST client utilities.
6. Tool returns `ToolResult` (`success`, `displayText`, optional `data`).

### Directory Layout

Add a GrowthBook domain module under `lib/`:

- `lib/growthbook/config.ts`
  - Resolve env/config values:
    - API token: `GB_TOKEN` (primary)
    - API host: `GB_API_HOST`
    - app origin: `GB_APP_ORIGIN` (fallback to `https://app.growthbook.io`)
  - Normalize URL tails.

- `lib/growthbook/client.ts`
  - `buildHeaders()`
  - `getCustomHeaders()` from `GB_HTTP_HEADER_*`
  - `handleResNotOk()`
  - `fetchWithRateLimit()`
  - `fetchWithPagination()`
  - `fetchFeatureFlag()`
  - `mergeRuleIntoFeatureFlag()`

- `lib/growthbook/defaults.ts`
  - `getDefaults()`
  - `setUserDefaults()`
  - `clearUserDefaults()`
  - local file cache (`experiment-defaults.json`, `user-defaults.json`)

- `lib/growthbook/format.ts` (or split by topic)
  - Response formatting for list/detail/create flows.
  - Keep text style close to MCP output, but concise enough for Slack readability.

- `lib/growthbook/services/*.ts` (optional but recommended)
  - Thin domain functions per area: environments/projects/features/experiments/metrics/attributes.

Add new tools under existing agent tools:

- `lib/agent/tools/growthbook/*.ts`
  - one tool class per command (or grouped classes with one exported factory per tool)
- `lib/agent/tools/growthbook/index.ts`
  - export all factories and helper `createGrowthbookTools()`.
- update `lib/agent/tools/index.ts`
  - include `...createGrowthbookTools()` in `createAllTools()`.

### Existing MCP Path
Do not change existing MCP dynamic injection (`mcp_<configId>_<toolName>`). GrowthBook local tools are separate first-class local tools.

## 3) Tool Mapping And API Behavior

## 3.1 Tool Name Mapping

- `growthbook_get_environments` -> `GET /api/v1/environments`
- `growthbook_get_projects` -> `GET /api/v1/projects`
- `growthbook_create_feature_flag` -> `POST /api/v1/features`
- `growthbook_create_force_rule` -> `GET /api/v1/features/{id}` + `POST /api/v1/features/{id}`
- `growthbook_get_feature_flags` -> `GET /api/v1/features` or `GET /api/v1/features/{id}`
- `growthbook_list_feature_keys` -> `GET /api/v1/feature-keys`
- `growthbook_get_stale_feature_flags` -> `GET /api/v1/stale-features?ids=...`
- `growthbook_generate_flag_types` -> shell exec (`npx growthbook ...`)
- `growthbook_get_experiments` -> `GET /api/v1/experiments` (+ optional `/results`)
- `growthbook_get_attributes` -> `GET /api/v1/attributes?limit=100`
- `growthbook_get_defaults` -> defaults resolver + GrowthBook APIs
- `growthbook_set_user_defaults` -> local file write
- `growthbook_clear_user_defaults` -> local file delete
- `growthbook_get_metrics` -> `GET /api/v1/metrics` + `GET /api/v1/fact-metrics`

## 3.2 Parameter Schema Policy (MCP-Compatible)

- Match MCP field names and optionality as closely as possible.
- Keep pagination fields aligned:
  - `limit` (1..100, default 100)
  - `offset` (>=0, default 0)
  - `mostRecent` (default false)
- Preserve MCP-style fields in mutation tools where applicable (e.g., `fileExtension`, `confirmedDefaultsReviewed`).

## 3.3 Caching Policy

- Cacheable read tools:
  - environments/projects/feature reads/list keys/stale check/attributes/defaults/metrics/experiments read paths
- Non-cacheable mutation tools:
  - create feature, create force rule, set defaults, clear defaults, generate types

Note: final cache flags are set per tool class based on side effects.

## 3.4 Error Strategy

- Standard HTTP error normalization using status + response body.
- Return practical suggestions in user-facing text (permission/id mismatch/missing prerequisites).
- For MCP-like guidance flows (e.g., missing `featureIds` in stale check), return actionable text instead of hard throwing.

## 4) Key Decisions And Constraints

### Environment Variables

Required:
- `GB_TOKEN`
- `GB_API_HOST`

Optional:
- `GB_APP_ORIGIN` (default `https://app.growthbook.io`)
- `GB_HTTP_HEADER_*` (forwarded as custom headers)

### Owner
- Hard constraint: never include `owner` in payload.

### Docs Search
- `search_growthbook_docs` intentionally not implemented.

### Compatibility
- `growthbook-mcp` code remains reference material only.
- No runtime dependency on local `growthbook-mcp` build output.

## 5) Phased Delivery Plan

### Phase 1: Foundation
- Add `lib/growthbook/config.ts`
- Add `lib/growthbook/client.ts`
- Add common formatting/error helpers
- Add defaults persistence module

### Phase 2: Core Read Tools
- `growthbook_get_environments`
- `growthbook_get_projects`
- `growthbook_get_feature_flags`
- `growthbook_list_feature_keys`
- `growthbook_get_attributes`
- `growthbook_get_metrics`

### Phase 3: Core Mutation Tools
- `growthbook_create_feature_flag`
- `growthbook_create_force_rule`
- `growthbook_set_user_defaults`
- `growthbook_clear_user_defaults`

### Phase 4: Advanced Tools
- `growthbook_get_defaults`
- `growthbook_get_stale_feature_flags`
- `growthbook_get_experiments` (`metadata` first, then `summary/full` as needed)
- `growthbook_generate_flag_types`

### Phase 5: Registry Integration
- Add all new tools into `createAllTools()`
- Ensure tool names are included in available tool list docs/helpers

## 6) Testing Plan

### Unit Tests
- client helpers:
  - header building
  - rate-limit retry
  - pagination (normal vs mostRecent)
- defaults:
  - cache hit/expiry
  - user defaults override
  - clear behavior
- tool-level:
  - schema validation
  - success display text
  - error display text

### Integration Tests
- Mock GrowthBook API responses to verify end-to-end tool execute behavior.
- Validate that `createAllTools()` registers all 14 `growthbook_*` names.
- Validate no create payload contains `owner`.

### Manual Verification
- Trigger at least one read and one write tool from agent flow.
- Confirm Slack output readability and error messaging quality.
- Confirm `search_growthbook_docs` is absent.

## 7) Risks And Mitigations

- Experiment summary/full parity complexity
  - Mitigation: deliver metadata first, then iterative parity for summary/full.

- Shell-based type generation environment limits
  - Mitigation: detect unsupported runtime and return explicit guidance.

- Drift from upstream MCP behavior over time
  - Mitigation: keep schema and endpoint mapping table in this spec as source of truth and update when needed.

- Defaults file location collision/confusion
  - Mitigation: namespace defaults storage under this project-specific app key/path.

## 8) Non-Goals

- No branch/worktree orchestration in this design.
- No migration of existing user-configured MCP server flow.
- No direct import/reuse of `growthbook-mcp` runtime modules in production path.

## 9) Definition Of Done

- 14 local `growthbook_*` tools implemented and registered.
- Direct REST API behavior working against configured GrowthBook host/token.
- No owner field in mutation payloads.
- `search_growthbook_docs` absent.
- Tests cover core helper logic + representative tool success/failure paths.
- Documentation reflects final names, env vars, and known limitations.

