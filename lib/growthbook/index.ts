import { getGrowthbookConfig } from './config';
import {
  buildHeaders,
  fetchFeatureFlag,
  fetchWithPagination,
  fetchWithRateLimit,
  handleResNotOk,
  mergeRuleIntoFeatureFlag,
} from './client';
import { clearUserDefaults, getDefaults, setUserDefaults } from './defaults';
import type { AgentContext } from '@/lib/agent/types';
import type { GrowthbookFeature } from './types';

function toText(data: unknown): string {
  if (typeof data === 'string') return data;
  return JSON.stringify(data, null, 2);
}

type GrowthbookProject = {
  id?: string;
  name?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function formatPageInfo(payload: Record<string, unknown>): string {
  const limit = Number(payload.limit ?? 0);
  const offset = Number(payload.offset ?? 0);
  const total = Number(payload.total ?? payload.count ?? 0);
  const currentPage = limit > 0 ? Math.floor(offset / limit) + 1 : 1;
  const totalPages = limit > 0 && total > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
  return `分页信息：第 ${currentPage}/${totalPages} 页（offset=${offset}, limit=${limit || '未知'}）`;
}

function formatFeatureLine(feature: GrowthbookFeature): string {
  const id = String(feature.id ?? 'unknown');
  const description = String((feature as { description?: unknown }).description ?? '无描述');
  const tagsRaw = (feature as { tags?: unknown }).tags;
  const tags = Array.isArray(tagsRaw) && tagsRaw.length > 0 ? tagsRaw.map(String).join(', ') : '无';
  return `- ${id}｜描述：${description}｜标签：${tags}`;
}

function summarizeFeatureList(data: unknown, params: Record<string, unknown>): string {
  const payload = asRecord(data);
  const features = Array.isArray(payload.features) ? (payload.features as GrowthbookFeature[]) : [];
  const total = Number(payload.total ?? payload.count ?? features.length);
  const project = params.project ? `，项目：${String(params.project)}` : '';
  const query = params.query ? `，关键词：${String(params.query)}` : '';
  const scannedPages = Number(params.__scannedPages ?? 0);
  const scannedCount = Number(params.__scannedCount ?? 0);
  const scanSummary =
    scannedPages > 0
      ? `共扫描 ${scannedPages} 页，累计检查 ${scannedCount} 条候选记录，`
      : '';
  const header = `已完成 Feature Flag 查询${project}${query}，${scanSummary}本次返回 ${features.length} 条，匹配总数 ${total}。`;
  const pageInfo = formatPageInfo(payload);

  if (features.length === 0) {
    return `${header}\n${pageInfo}\n当前页没有可展示的 Feature Flag。`;
  }

  const lines = features.slice(0, 30).map(formatFeatureLine);
  const truncated = features.length > 30 ? `\n（仅展示前 30 条，其余 ${features.length - 30} 条可通过分页继续查看）` : '';
  return `${header}\n${pageInfo}\n\n${lines.join('\n')}${truncated}`;
}

function summarizeInvalidProject(project: string, availableProjects: Array<{ id: string; name: string }>): string {
  const list = availableProjects.length
    ? availableProjects.map((item) => `- ${item.name} (${item.id})`).join('\n')
    : '- 当前未读取到可用项目';
  return `项目 "${project}" 无法匹配到有效的 project id/name。\n请改用以下项目之一后重试：\n${list}`;
}

function summarizeFeatureUpsert(action: '创建' | '编辑', data: unknown, fallbackId: string): string {
  const payload = asRecord(data);
  const feature = asRecord(payload.feature);
  const id = String((feature.id ?? payload.id ?? fallbackId) || 'unknown');
  const description = String(feature.description ?? payload.description ?? '无描述');
  const environments = asRecord(feature.environments);
  const envCount = Object.keys(environments).length;
  return `${action} Feature Flag 成功：${id}\n描述：${description}\n已包含环境数量：${envCount}`;
}

function summarizeEnvironments(data: unknown): string {
  const payload = asRecord(data);
  const envs = Array.isArray(payload.environments) ? payload.environments.map((x) => asRecord(x)) : [];
  const names = envs
    .map((env) => String(env.id ?? env.name ?? '').trim())
    .filter(Boolean);
  if (names.length === 0) {
    return '已查询 environments，当前未返回环境数据。';
  }
  return `已查询 environments，共 ${names.length} 个：\n${names.map((name) => `- ${name}`).join('\n')}`;
}

function summarizeProjects(data: unknown): string {
  const payload = asRecord(data);
  const projects = Array.isArray(payload.projects) ? payload.projects.map((x) => asRecord(x)) : [];
  const count = projects.length;
  const pageInfo = formatPageInfo(payload);
  if (count === 0) {
    return `已查询项目列表，本次返回 0 条。\n${pageInfo}`;
  }
  const lines = projects
    .slice(0, 30)
    .map((project) => `- ${String(project.name ?? 'unknown')} (${String(project.id ?? 'unknown')})`);
  const truncated = count > 30 ? `\n（仅展示前 30 条，其余 ${count - 30} 条请翻页查看）` : '';
  return `已查询项目列表，本次返回 ${count} 条。\n${pageInfo}\n\n${lines.join('\n')}${truncated}`;
}

function summarizeFeatureKeys(data: unknown, projectId?: string): string {
  const payload = asRecord(data);
  const keysRaw = payload.keys ?? payload.featureKeys ?? payload.features ?? [];
  const keys = Array.isArray(keysRaw)
    ? keysRaw.map((item) => (typeof item === 'string' ? item : String(asRecord(item).id ?? asRecord(item).key ?? ''))).filter(Boolean)
    : [];
  const scope = projectId ? `（projectId=${projectId}）` : '';
  if (!keys.length) {
    return `已查询 Feature Keys${scope}，当前没有可展示数据。`;
  }
  return `已查询 Feature Keys${scope}，共 ${keys.length} 个：\n${keys.map((key) => `- ${key}`).join('\n')}`;
}

function summarizeStaleFeatures(ids: string[], data: unknown): string {
  const payload = asRecord(data);
  const staleIdsRaw = payload.staleFeatures ?? payload.staleFeatureIds ?? payload.stale ?? [];
  const staleIds = Array.isArray(staleIdsRaw)
    ? staleIdsRaw.map((item) => (typeof item === 'string' ? item : String(asRecord(item).id ?? ''))).filter(Boolean)
    : [];
  const freshCount = Math.max(0, ids.length - staleIds.length);
  return `已完成 stale 检查，共检查 ${ids.length} 个 flag：\n- stale：${staleIds.length}\n- 非 stale：${freshCount}${
    staleIds.length ? `\n\nstale flags:\n${staleIds.map((id) => `- ${id}`).join('\n')}` : ''
  }`;
}

function summarizeAttributes(data: unknown): string {
  const payload = asRecord(data);
  const attrs = Array.isArray(payload.attributes) ? payload.attributes.map((x) => asRecord(x)) : [];
  if (!attrs.length) {
    return '已查询 Attributes，当前没有返回属性。';
  }
  const lines = attrs
    .slice(0, 40)
    .map((attr) => `- ${String(attr.id ?? attr.identifier ?? 'unknown')}｜类型：${String(attr.datatype ?? attr.type ?? 'unknown')}`);
  const truncated = attrs.length > 40 ? `\n（仅展示前 40 条，其余 ${attrs.length - 40} 条请缩小范围后再查）` : '';
  return `已查询 Attributes，共 ${attrs.length} 个：\n${lines.join('\n')}${truncated}`;
}

function summarizeDefaults(data: unknown): string {
  const payload = asRecord(data);
  const environments = Array.isArray(payload.environments) ? payload.environments.map(String) : [];
  const datasourceId = String(payload.datasourceId ?? payload.datasource ?? '未设置');
  const assignmentQueryId = String(payload.assignmentQueryId ?? payload.assignmentQuery ?? '未设置');
  return `已读取默认配置：\n- datasourceId：${datasourceId}\n- assignmentQueryId：${assignmentQueryId}\n- environments：${
    environments.length ? environments.join(', ') : '未设置'
  }`;
}

function summarizeSetDefaults(data: unknown): string {
  const payload = asRecord(data);
  const environments = Array.isArray(payload.environments) ? payload.environments.map(String) : [];
  return `已更新用户默认配置：\n- datasourceId：${String(payload.datasourceId ?? '未提供')}\n- assignmentQueryId：${String(
    payload.assignmentQueryId ?? '未提供'
  )}\n- environments：${environments.length ? environments.join(', ') : '未设置'}`;
}

function summarizeExperiments(data: unknown, mode: string): string {
  const payload = asRecord(data);
  const detail = asRecord(payload.experiment ?? payload);
  const experiments = Array.isArray(payload.experiments) ? payload.experiments.map((x) => asRecord(x)) : [];
  if (experiments.length) {
    const pageInfo = formatPageInfo(payload);
    const lines = experiments
      .slice(0, 20)
      .map((exp) => `- ${String(exp.id ?? exp.key ?? exp.name ?? 'unknown')}｜名称：${String(exp.name ?? '无')}`);
    const truncated = experiments.length > 20 ? `\n（仅展示前 20 条）` : '';
    return `已查询 Experiments（mode=${mode}），本次返回 ${experiments.length} 条。\n${pageInfo}\n\n${lines.join('\n')}${truncated}`;
  }
  const expId = String(detail.id ?? detail.key ?? detail.name ?? 'unknown');
  const status = String(detail.status ?? detail.phase ?? 'unknown');
  return `已查询 Experiment 详情（mode=${mode}）：\n- 实验：${expId}\n- 状态：${status}`;
}

function summarizeMetrics(data: unknown): string {
  const payload = asRecord(data);
  const metricsPayload = asRecord(payload.metrics);
  const factPayload = asRecord(payload.factMetrics);
  const metrics = Array.isArray(metricsPayload.metrics) ? metricsPayload.metrics.map((x) => asRecord(x)) : [];
  const factMetrics = Array.isArray(factPayload.factMetrics) ? factPayload.factMetrics.map((x) => asRecord(x)) : [];

  const topMetrics = metrics.slice(0, 10).map((item) => `- ${String(item.id ?? item.name ?? 'unknown')}（metric）`);
  const topFactMetrics = factMetrics
    .slice(0, 10)
    .map((item) => `- ${String(item.id ?? item.name ?? 'unknown')}（fact-metric）`);
  const lines = [...topMetrics, ...topFactMetrics];
  const total = metrics.length + factMetrics.length;

  if (!total) {
    return '已查询 Metrics，当前没有可展示指标。';
  }
  return `已查询 Metrics，共 ${total} 个（metrics: ${metrics.length}, factMetrics: ${factMetrics.length}）。\n${lines.join('\n')}`;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function matchesQuery(feature: GrowthbookFeature, query: string): boolean {
  if (!query) return true;
  const q = normalizeText(query);
  const id = normalizeText(feature.id);
  const description = normalizeText((feature as { description?: unknown }).description);
  const tagsRaw = (feature as { tags?: unknown }).tags;
  const tags = Array.isArray(tagsRaw) ? tagsRaw.map((tag) => normalizeText(tag)).join(' ') : '';

  return id.includes(q) || description.includes(q) || tags.includes(q);
}

async function resolveProjectId(
  apiHost: string,
  token: string,
  rawProject: string
): Promise<{ ok: true; projectId: string } | { ok: false; availableProjects: Array<{ id: string; name: string }> }> {
  const normalized = normalizeText(rawProject);
  if (!normalized) {
    return { ok: true, projectId: '' };
  }

  const projectData = await fetchWithPagination(apiHost, token, '/api/v1/projects', 100, 0, false);
  const projects = Array.isArray((projectData as { projects?: GrowthbookProject[] })?.projects)
    ? (projectData as { projects: GrowthbookProject[] }).projects
    : [];

  const byIdOrName = projects.find((project) => {
    const id = normalizeText(project.id);
    const name = normalizeText(project.name);
    return id === normalized || name === normalized;
  });

  if (byIdOrName?.id) {
    return { ok: true, projectId: byIdOrName.id };
  }

  return {
    ok: false,
    availableProjects: projects
      .filter((project) => project.id && project.name)
      .map((project) => ({ id: String(project.id), name: String(project.name) })),
  };
}

export async function getEnvironments(_params: Record<string, unknown>, _context: AgentContext): Promise<string> {
  const { token, apiHost } = getGrowthbookConfig();
  const res = await fetchWithRateLimit(`${apiHost}/api/v1/environments`, {
    headers: buildHeaders(token),
  });
  await handleResNotOk(res);
  return summarizeEnvironments(await res.json());
}

export const growthbookGetEnvironments = getEnvironments;

export async function getProjects(params: Record<string, unknown>, _context: AgentContext): Promise<string> {
  const { token, apiHost } = getGrowthbookConfig();
  const data = await fetchWithPagination(
    apiHost,
    token,
    '/api/v1/projects',
    Number(params.limit ?? 100),
    Number(params.offset ?? 0),
    Boolean(params.mostRecent ?? false)
  );
  if (
    Boolean(params.mostRecent ?? false) &&
    Number(params.offset ?? 0) === 0 &&
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { projects?: unknown[] }).projects)
  ) {
    (data as { projects: unknown[] }).projects = [...(data as { projects: unknown[] }).projects].reverse();
  }
  return summarizeProjects(data);
}

export const growthbookGetProjects = getProjects;

export async function createFeatureFlag(params: Record<string, unknown>, _context: AgentContext): Promise<string> {
  const { token, apiHost } = getGrowthbookConfig();
  const defaults = await getDefaults(token, apiHost);
  const payload = {
    id: params.id,
    valueType: params.valueType,
    defaultValue: params.defaultValue,
    description: params.description,
    tags: ['mcp'],
    environments: defaults.environments.reduce((acc: Record<string, unknown>, env: string) => {
      acc[env] = { enabled: false, rules: [] };
      return acc;
    }, {}),
    ...(params.project ? { project: params.project } : {}),
    ...(params.customFields ? { customFields: params.customFields } : {}),
  };
  const res = await fetchWithRateLimit(`${apiHost}/api/v1/features`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });
  await handleResNotOk(res);
  const data = await res.json();
  return summarizeFeatureUpsert('创建', data, String(params.id ?? ''));
}

export const growthbookCreateFeatureFlag = createFeatureFlag;

export async function createForceRule(params: Record<string, unknown>, _context: AgentContext): Promise<string> {
  const { token, apiHost } = getGrowthbookConfig();
  const featureId = String(params.featureId || '');
  const existingFeature = await fetchFeatureFlag(apiHost, token, featureId);
  const defaults = await getDefaults(token, apiHost);
  const newRule = {
    type: 'force',
    description: params.description || '',
    condition: params.condition,
    value: params.value,
  };
  const payload = mergeRuleIntoFeatureFlag(existingFeature, newRule, defaults.environments);
  const res = await fetchWithRateLimit(`${apiHost}/api/v1/features/${featureId}`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });
  await handleResNotOk(res);
  const data = await res.json();
  return `${summarizeFeatureUpsert('编辑', data, featureId)}\n已追加 force rule，目标 flag：${featureId}`;
}

export const growthbookCreateForceRule = createForceRule;

export async function getFeatureFlags(params: Record<string, unknown>, _context: AgentContext): Promise<string> {
  const { token, apiHost } = getGrowthbookConfig();
  const featureFlagId = params.featureFlagId ? String(params.featureFlagId) : '';
  if (featureFlagId) {
    const res = await fetchWithRateLimit(`${apiHost}/api/v1/features/${featureFlagId}`, {
      headers: buildHeaders(token),
    });
    await handleResNotOk(res);
    const data = await res.json();
    const payload = asRecord(data);
    const feature = asRecord(payload.feature);
    const id = String(feature.id ?? payload.id ?? featureFlagId);
    const description = String(feature.description ?? payload.description ?? '无描述');
    const tagsRaw = feature.tags ?? payload.tags;
    const tags = Array.isArray(tagsRaw) && tagsRaw.length ? tagsRaw.map(String).join(', ') : '无';
    return `已查询 Feature Flag 详情：${id}\n描述：${description}\n标签：${tags}`;
  }
  const project = params.project ? String(params.project) : '';
  const originalQuery = params.query ? String(params.query).trim() : '';
  const resolvedProject = await resolveProjectId(apiHost, token, project);
  let effectiveProjectId = '';
  let effectiveQuery = originalQuery;
  let fallbackToProjectKeyword = false;

  if (!resolvedProject.ok) {
    // Compatibility fallback: when the model/user puts keyword into `project`,
    // reuse it as fuzzy query instead of hard failing.
    if (!originalQuery && project.trim()) {
      effectiveQuery = project.trim();
      fallbackToProjectKeyword = true;
    } else {
      return summarizeInvalidProject(project, resolvedProject.availableProjects);
    }
  } else {
    effectiveProjectId = resolvedProject.projectId;
  }

  const data = await fetchWithPagination(
    apiHost,
    token,
    '/api/v1/features',
    Number(params.limit ?? 100),
    Number(params.offset ?? 0),
    Boolean(params.mostRecent ?? false),
    effectiveProjectId ? { projectId: effectiveProjectId } : undefined
  );

  let scannedPages = 1;
  let scannedCount = Array.isArray((data as { features?: unknown[] }).features)
    ? ((data as { features?: unknown[] }).features?.length ?? 0)
    : 0;

  const effectiveLimit = Number(params.limit ?? 100);
  const effectiveOffset = Number(params.offset ?? 0);
  const maxPagesForQuery = 10;

  if (
    effectiveQuery &&
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { features?: GrowthbookFeature[] }).features)
  ) {
    const allFeatures: GrowthbookFeature[] = [...(data as { features: GrowthbookFeature[] }).features];
    let currentOffset = Number((data as { nextOffset?: unknown }).nextOffset ?? effectiveOffset + effectiveLimit);
    let hasMore = Boolean((data as { hasMore?: unknown }).hasMore);

    while (hasMore && scannedPages < maxPagesForQuery) {
      const nextPage = await fetchWithPagination(
        apiHost,
        token,
        '/api/v1/features',
        effectiveLimit,
        currentOffset,
        Boolean(params.mostRecent ?? false),
        effectiveProjectId ? { projectId: effectiveProjectId } : undefined
      );
      const nextFeatures = Array.isArray((nextPage as { features?: GrowthbookFeature[] }).features)
        ? ((nextPage as { features: GrowthbookFeature[] }).features ?? [])
        : [];
      allFeatures.push(...nextFeatures);
      scannedPages += 1;
      scannedCount += nextFeatures.length;
      hasMore = Boolean((nextPage as { hasMore?: unknown }).hasMore);
      currentOffset = Number((nextPage as { nextOffset?: unknown }).nextOffset ?? currentOffset + effectiveLimit);
    }

    const filtered = allFeatures.filter((feature) => matchesQuery(feature, effectiveQuery));
    (data as { features: GrowthbookFeature[] }).features = filtered;
    (data as { total?: number }).total = filtered.length;
    (data as { count?: number }).count = filtered.length;
    (data as { hasMore?: boolean }).hasMore = false;
    (data as { nextOffset?: number | null }).nextOffset = null;
  }

  if (
    Boolean(params.mostRecent ?? false) &&
    Number(params.offset ?? 0) === 0 &&
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { features?: unknown[] }).features)
  ) {
    (data as { features: unknown[] }).features = [...(data as { features: unknown[] }).features].reverse();
  }
  const summaryParams: Record<string, unknown> = {
    ...params,
    query: effectiveQuery,
    __scannedPages: scannedPages,
    __scannedCount: scannedCount,
  };
  if (!effectiveProjectId) {
    delete summaryParams.project;
  } else {
    summaryParams.project = project;
  }
  const summary = summarizeFeatureList(data, summaryParams);
  return fallbackToProjectKeyword
    ? `未匹配到项目 "${project}"，已自动按关键词 "${effectiveQuery}" 执行模糊查询。\n\n${summary}`
    : summary;
}

export const growthbookGetFeatureFlags = getFeatureFlags;

export async function listFeatureKeys(params: Record<string, unknown>, _context: AgentContext): Promise<string> {
  const { token, apiHost } = getGrowthbookConfig();
  const projectId = params.projectId ? String(params.projectId) : '';
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const res = await fetchWithRateLimit(`${apiHost}/api/v1/feature-keys${query}`, {
    headers: buildHeaders(token),
  });
  await handleResNotOk(res);
  return summarizeFeatureKeys(await res.json(), projectId || undefined);
}

export const growthbookListFeatureKeys = listFeatureKeys;

export async function getStaleFeatureFlags(params: Record<string, unknown>, _context: AgentContext): Promise<string> {
  const { token, apiHost } = getGrowthbookConfig();
  const ids = Array.isArray(params.featureIds) ? params.featureIds.map(String) : [];
  if (!ids.length) {
    return 'featureIds is required for stale checks.';
  }
  const res = await fetchWithRateLimit(
    `${apiHost}/api/v1/stale-features?ids=${encodeURIComponent(ids.join(','))}`,
    { headers: buildHeaders(token) }
  );
  await handleResNotOk(res);
  return summarizeStaleFeatures(ids, await res.json());
}

export const growthbookGetStaleFeatureFlags = getStaleFeatureFlags;

export async function generateFlagTypes(params: Record<string, unknown>, _context: AgentContext): Promise<string> {
  const { token, apiHost } = getGrowthbookConfig();
  const cwd = String(params.currentWorkingDirectory || '');
  if (!cwd) {
    throw new Error('currentWorkingDirectory is required');
  }
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  await execAsync(`npx -y growthbook@latest auth login -k ${token} -u ${apiHost} -p default`, { cwd });
  const { stdout } = await execAsync(`npx -y growthbook@latest features generate-types -u ${apiHost}`, {
    cwd,
  });
  return stdout || 'Types generated.';
}

export const growthbookGenerateFlagTypes = generateFlagTypes;

export async function getExperiments(params: Record<string, unknown>, _context: AgentContext): Promise<string> {
  const { token, apiHost } = getGrowthbookConfig();
  const experimentId = params.experimentId ? String(params.experimentId) : '';
  const mode = String(params.mode || 'metadata');
  if (experimentId) {
    const res = await fetchWithRateLimit(`${apiHost}/api/v1/experiments/${experimentId}`, {
      headers: buildHeaders(token),
    });
    await handleResNotOk(res);
    const data = (await res.json()) as Record<string, unknown>;
    if (mode === 'full') {
      const resultsRes = await fetchWithRateLimit(`${apiHost}/api/v1/experiments/${experimentId}/results`, {
        headers: buildHeaders(token, false),
      });
      await handleResNotOk(resultsRes);
      data.result = (await resultsRes.json() as { result?: unknown }).result;
    }
    return summarizeExperiments(data, mode);
  }
  const project = params.project ? String(params.project) : '';
  const data = await fetchWithPagination(
    apiHost,
    token,
    '/api/v1/experiments',
    Number(params.limit ?? 100),
    Number(params.offset ?? 0),
    Boolean(params.mostRecent ?? false),
    project ? { projectId: project } : undefined
  );
  if (
    Boolean(params.mostRecent ?? false) &&
    Number(params.offset ?? 0) === 0 &&
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { experiments?: unknown[] }).experiments)
  ) {
    (data as { experiments: unknown[] }).experiments = [
      ...(data as { experiments: unknown[] }).experiments,
    ].reverse();
  }
  return summarizeExperiments(data, mode);
}

export const growthbookGetExperiments = getExperiments;

export async function getAttributes(_params: Record<string, unknown>, _context: AgentContext): Promise<string> {
  const { token, apiHost } = getGrowthbookConfig();
  const res = await fetchWithRateLimit(`${apiHost}/api/v1/attributes?limit=100`, {
    headers: buildHeaders(token),
  });
  await handleResNotOk(res);
  return summarizeAttributes(await res.json());
}

export const growthbookGetAttributes = getAttributes;

export async function growthbookGetDefaults(_params: Record<string, unknown>, _context: AgentContext): Promise<string> {
  const { token, apiHost } = getGrowthbookConfig();
  const data = await getDefaults(token, apiHost);
  return summarizeDefaults(data);
}

export async function growthbookSetUserDefaults(params: Record<string, unknown>, _context: AgentContext): Promise<string> {
  const payload = await setUserDefaults(
    String(params.datasourceId || ''),
    String(params.assignmentQueryId || ''),
    Array.isArray(params.environments) ? params.environments.map(String) : []
  );
  return summarizeSetDefaults(payload);
}

export async function growthbookClearUserDefaults(_params: Record<string, unknown>, _context: AgentContext): Promise<string> {
  const cleared = await clearUserDefaults();
  return cleared ? 'User defaults cleared.' : 'No user defaults were set.';
}

export async function getMetrics(params: Record<string, unknown>, _context: AgentContext): Promise<string> {
  const { token, apiHost } = getGrowthbookConfig();
  const metricId = params.metricId ? String(params.metricId) : '';
  if (metricId) {
    const endpoint = metricId.startsWith('fact__') ? 'fact-metrics' : 'metrics';
    const res = await fetchWithRateLimit(`${apiHost}/api/v1/${endpoint}/${metricId}`, {
      headers: buildHeaders(token),
    });
    await handleResNotOk(res);
    const payload = await res.json();
    const detail = asRecord(payload.metric ?? payload);
    return `已查询 Metric 详情：\n- id：${String(detail.id ?? metricId)}\n- 名称：${String(detail.name ?? '未知')}\n- 类型：${
      endpoint === 'fact-metrics' ? 'fact-metric' : 'metric'
    }`;
  }
  const project = params.project ? String(params.project) : '';
  const listParams = project ? { projectId: project } : undefined;
  const [metrics, factMetrics] = await Promise.all([
    fetchWithPagination(
      apiHost,
      token,
      '/api/v1/metrics',
      Number(params.limit ?? 100),
      Number(params.offset ?? 0),
      Boolean(params.mostRecent ?? false),
      listParams
    ),
    fetchWithPagination(
      apiHost,
      token,
      '/api/v1/fact-metrics',
      Number(params.limit ?? 100),
      Number(params.offset ?? 0),
      Boolean(params.mostRecent ?? false),
      listParams
    ),
  ]);
  if (
    Boolean(params.mostRecent ?? false) &&
    Number(params.offset ?? 0) === 0 &&
    metrics &&
    typeof metrics === 'object' &&
    Array.isArray((metrics as { metrics?: unknown[] }).metrics)
  ) {
    (metrics as { metrics: unknown[] }).metrics = [...(metrics as { metrics: unknown[] }).metrics].reverse();
  }
  if (
    Boolean(params.mostRecent ?? false) &&
    Number(params.offset ?? 0) === 0 &&
    factMetrics &&
    typeof factMetrics === 'object' &&
    Array.isArray((factMetrics as { factMetrics?: unknown[] }).factMetrics)
  ) {
    (factMetrics as { factMetrics: unknown[] }).factMetrics = [
      ...(factMetrics as { factMetrics: unknown[] }).factMetrics,
    ].reverse();
  }
  return summarizeMetrics({ metrics, factMetrics });
}

export const growthbookGetMetrics = getMetrics;
