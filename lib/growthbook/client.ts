import type { GrowthbookFeature } from './types';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MIN_DELAY_MS = 50;

export function getCustomHeaders(): Record<string, string> {
  const customHeaders: Record<string, string> = {};
  const prefix = 'GB_HTTP_HEADER_';

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(prefix) || !value) {
      continue;
    }

    const headerKey = key
      .slice(prefix.length)
      .split('_')
      .map((part) => {
        if (part.length === 1 || part === 'API' || part === 'ID') {
          return part;
        }
        return `${part.charAt(0)}${part.slice(1).toLowerCase()}`;
      })
      .join('-');

    customHeaders[headerKey] = value;
  }

  return customHeaders;
}

export function buildHeaders(
  apiKey: string,
  includeContentType = true
): Record<string, string> {
  const headers: Record<string, string> = {
    ...getCustomHeaders(),
    Authorization: `Bearer ${apiKey}`,
  };

  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

export async function handleResNotOk(res: Response): Promise<void> {
  if (res.ok) {
    return;
  }

  const errorText = await res.text();
  let message = `HTTP ${res.status} ${res.statusText}`;

  try {
    const body = JSON.parse(errorText);
    message += `: ${JSON.stringify(body)}`;
  } catch {
    if (errorText) {
      message += `: ${errorText}`;
    }
  }

  throw new Error(message);
}

export async function fetchWithRateLimit(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  await sleep(MIN_DELAY_MS);
  const response = await fetch(url, options);

  if (response.status === 429 && retries > 0) {
    const resetSeconds = parseInt(
      response.headers.get('RateLimit-Reset') || '5',
      10
    );
    await sleep(resetSeconds * 1000);
    return fetchWithRateLimit(url, options, retries - 1);
  }

  return response;
}

export async function fetchWithPagination(
  baseApiUrl: string,
  apiKey: string,
  endpoint: string,
  limit: number,
  offset: number,
  mostRecent: boolean,
  additionalParams?: Record<string, string>
): Promise<unknown> {
  const headers = buildHeaders(apiKey);

  if (!mostRecent || offset > 0) {
    const queryParams = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });

    if (additionalParams) {
      for (const [key, value] of Object.entries(additionalParams)) {
        if (value) {
          queryParams.append(key, value);
        }
      }
    }

    const res = await fetchWithRateLimit(`${baseApiUrl}${endpoint}?${queryParams}`, {
      headers,
    });
    await handleResNotOk(res);
    return res.json();
  }

  const countQueryParams = new URLSearchParams({ limit: '1' });
  if (additionalParams) {
    for (const [key, value] of Object.entries(additionalParams)) {
      if (value) {
        countQueryParams.append(key, value);
      }
    }
  }
  const countRes = await fetchWithRateLimit(`${baseApiUrl}${endpoint}?${countQueryParams}`, {
    headers,
  });
  await handleResNotOk(countRes);

  const countData = (await countRes.json()) as { total?: number };
  const total = countData.total ?? 0;
  const calculatedOffset = Math.max(0, total - limit);

  const queryParams = new URLSearchParams({
    limit: String(limit),
    offset: String(calculatedOffset),
  });

  if (additionalParams) {
    for (const [key, value] of Object.entries(additionalParams)) {
      if (value) {
        queryParams.append(key, value);
      }
    }
  }

  const res = await fetchWithRateLimit(`${baseApiUrl}${endpoint}?${queryParams}`, {
    headers,
  });
  await handleResNotOk(res);
  return res.json();
}

export async function fetchFeatureFlag(
  baseApiUrl: string,
  apiKey: string,
  featureId: string
): Promise<GrowthbookFeature> {
  const res = await fetchWithRateLimit(
    `${baseApiUrl}/api/v1/features/${featureId}`,
    {
      headers: buildHeaders(apiKey),
    }
  );
  await handleResNotOk(res);
  const data = (await res.json()) as { feature?: GrowthbookFeature };
  return data.feature || {};
}

export function mergeRuleIntoFeatureFlag(
  existingFeature: GrowthbookFeature,
  newRule: Record<string, unknown>,
  defaultEnvironments: string[]
): { environments: Record<string, unknown> } {
  const existingEnvironments = existingFeature.environments || {};
  const environments: Record<string, unknown> = {};

  for (const [env, rawEnv] of Object.entries(existingEnvironments)) {
    const rules = Array.isArray(rawEnv?.rules) ? rawEnv.rules : [];
    if (defaultEnvironments.includes(env)) {
      environments[env] = {
        ...rawEnv,
        rules: [...rules, newRule],
      };
    } else {
      environments[env] = rawEnv;
    }
  }

  for (const env of defaultEnvironments) {
    if (!environments[env]) {
      environments[env] = {
        enabled: false,
        rules: [newRule],
      };
    }
  }

  return { environments };
}
