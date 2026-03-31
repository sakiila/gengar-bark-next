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

function toText(data: unknown): string {
  if (typeof data === 'string') return data;
  return JSON.stringify(data, null, 2);
}

type GrowthbookProject = {
  id?: string;
  name?: string;
};

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
  const data = await res.json();
  return toText(data);
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
  return toText(data);
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
  return toText(await res.json());
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
  return toText(await res.json());
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
    return toText(await res.json());
  }
  const project = params.project ? String(params.project) : '';
  const resolvedProject = await resolveProjectId(apiHost, token, project);
  if (!resolvedProject.ok) {
    return toText({
      error: `Invalid project "${project}". Please provide a valid project id or project name.`,
      availableProjects: resolvedProject.availableProjects,
    });
  }

  const query = params.query ? String(params.query).trim() : '';
  const data = await fetchWithPagination(
    apiHost,
    token,
    '/api/v1/features',
    Number(params.limit ?? 100),
    Number(params.offset ?? 0),
    Boolean(params.mostRecent ?? false),
    resolvedProject.projectId ? { projectId: resolvedProject.projectId } : undefined
  );

  if (
    query &&
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { features?: GrowthbookFeature[] }).features)
  ) {
    const filtered = (data as { features: GrowthbookFeature[] }).features.filter((feature) =>
      matchesQuery(feature, query)
    );
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
  return toText(data);
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
  return toText(await res.json());
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
  return toText(await res.json());
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
    return toText(data);
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
  return toText(data);
}

export const growthbookGetExperiments = getExperiments;

export async function getAttributes(_params: Record<string, unknown>, _context: AgentContext): Promise<string> {
  const { token, apiHost } = getGrowthbookConfig();
  const res = await fetchWithRateLimit(`${apiHost}/api/v1/attributes?limit=100`, {
    headers: buildHeaders(token),
  });
  await handleResNotOk(res);
  return toText(await res.json());
}

export const growthbookGetAttributes = getAttributes;

export async function growthbookGetDefaults(_params: Record<string, unknown>, _context: AgentContext): Promise<string> {
  const { token, apiHost } = getGrowthbookConfig();
  const data = await getDefaults(token, apiHost);
  return toText(data);
}

export async function growthbookSetUserDefaults(params: Record<string, unknown>, _context: AgentContext): Promise<string> {
  const payload = await setUserDefaults(
    String(params.datasourceId || ''),
    String(params.assignmentQueryId || ''),
    Array.isArray(params.environments) ? params.environments.map(String) : []
  );
  return toText(payload);
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
    return toText(await res.json());
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
  return toText({ metrics, factMetrics });
}

export const growthbookGetMetrics = getMetrics;
