import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { buildHeaders, fetchWithRateLimit, handleResNotOk } from './client';
import type {
  GrowthbookExperimentDefaults,
  GrowthbookListDataSourcesResponse,
  GrowthbookListEnvironmentsResponse,
  GrowthbookListExperimentsResponse,
  GrowthbookUserDefaults,
} from './types';

const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;
const defaultsDir = join(homedir(), '.config', 'gengar-bark-next', 'growthbook');
const experimentDefaultsFile = join(defaultsDir, 'experiment-defaults.json');
const userDefaultsFile = join(defaultsDir, 'user-defaults.json');

interface DataSourceCount {
  ds: string;
  aq: string;
  count: number;
}

interface ExperimentStatsAccumulator {
  name: string[];
  hypothesis: string[];
  description: string[];
  datasource: Record<string, DataSourceCount>;
}

async function createDefaults(
  apiKey: string,
  baseApiUrl: string
): Promise<GrowthbookExperimentDefaults> {
  const experimentsRes = await fetchWithRateLimit(`${baseApiUrl}/api/v1/experiments`, {
    headers: buildHeaders(apiKey, false),
  });
  await handleResNotOk(experimentsRes);

  const experimentData = (await experimentsRes.json()) as GrowthbookListExperimentsResponse;
  if (!experimentData.experiments?.length) {
    const dataSourceRes = await fetchWithRateLimit(`${baseApiUrl}/api/v1/data-sources`, {
      headers: buildHeaders(apiKey, false),
    });
    await handleResNotOk(dataSourceRes);
    const dataSources = (await dataSourceRes.json()) as GrowthbookListDataSourcesResponse;

    if (!dataSources.dataSources?.length) {
      throw new Error(
        'No data source or assignment query found. Set these up in GrowthBook and try again.'
      );
    }

    const assignmentQuery =
      dataSources.dataSources[0].assignmentQueries?.[0]?.id || '';

    const environmentsRes = await fetchWithRateLimit(`${baseApiUrl}/api/v1/environments`, {
      headers: buildHeaders(apiKey, false),
    });
    await handleResNotOk(environmentsRes);
    const environmentsData = (await environmentsRes.json()) as GrowthbookListEnvironmentsResponse;
    const environments = (environmentsData.environments || []).map(({ id }) => id);

    return {
      name: [],
      hypothesis: [],
      description: [],
      datasource: '',
      assignmentQuery,
      environments,
      filePaths: {
        experimentDefaultsFile,
        userDefaultsFile,
      },
      timestamp: new Date().toISOString(),
    };
  }

  let experiments = experimentData.experiments || [];
  if (experimentData.hasMore) {
    const total = experimentData.total ?? 0;
    const count = experimentData.count ?? 0;
    const initialOffset = experimentData.offset ?? 0;
    const capped = Math.min(50, count + initialOffset);
    const newestOffset = Math.max(0, total - capped);

    const mostRecentRes = await fetchWithRateLimit(
      `${baseApiUrl}/api/v1/experiments?offset=${newestOffset}&limit=${capped}`,
      {
        headers: buildHeaders(apiKey, false),
      }
    );
    await handleResNotOk(mostRecentRes);
    const mostRecentData = (await mostRecentRes.json()) as GrowthbookListExperimentsResponse;
    experiments = mostRecentData.experiments || [];
  }

  const stats = experiments.reduce<ExperimentStatsAccumulator>(
    (acc, experiment) => {
      acc.name.push(experiment.name);
      acc.hypothesis.push(experiment.hypothesis);
      acc.description.push(experiment.description);

      const datasourceId = experiment.settings?.datasourceId || '';
      const assignmentQueryId = experiment.settings?.assignmentQueryId || '';
      const dsKey = `${datasourceId}-${assignmentQueryId}`;
      const previous = acc.datasource[dsKey];
      acc.datasource[dsKey] = {
        ds: datasourceId,
        aq: assignmentQueryId,
        count: (previous?.count || 0) + 1,
      };
      return acc;
    },
    { name: [], hypothesis: [], description: [], datasource: {} }
  );

  let mostFrequent: DataSourceCount = { ds: '', aq: '', count: 0 };
  for (const value of Object.values(stats.datasource)) {
    if (value.count > mostFrequent.count) {
      mostFrequent = value;
    }
  }

  const environmentsRes = await fetchWithRateLimit(`${baseApiUrl}/api/v1/environments`, {
    headers: buildHeaders(apiKey, false),
  });
  await handleResNotOk(environmentsRes);
  const environmentsData = (await environmentsRes.json()) as GrowthbookListEnvironmentsResponse;
  const environments = (environmentsData.environments || []).map(({ id }) => id);

  return {
    name: stats.name,
    hypothesis: stats.hypothesis,
    description: stats.description,
    datasource: mostFrequent.ds,
    assignmentQuery: mostFrequent.aq,
    environments,
    filePaths: {
      experimentDefaultsFile,
      userDefaultsFile,
    },
    timestamp: new Date().toISOString(),
  };
}

async function readUserDefaults(): Promise<GrowthbookUserDefaults | null> {
  try {
    const content = await readFile(userDefaultsFile, 'utf8');
    return JSON.parse(content) as GrowthbookUserDefaults;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function readExperimentDefaults(): Promise<GrowthbookExperimentDefaults | null> {
  try {
    const content = await readFile(experimentDefaultsFile, 'utf8');
    return JSON.parse(content) as GrowthbookExperimentDefaults;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function isFresh(timestamp?: string): boolean {
  if (!timestamp) {
    return false;
  }
  return new Date(timestamp).getTime() > Date.now() - THIRTY_DAYS_MS;
}

export async function getDefaults(
  apiKey: string,
  baseApiUrl: string
): Promise<GrowthbookExperimentDefaults> {
  const userDefaults = await readUserDefaults();
  const cachedDefaults = await readExperimentDefaults();

  if (userDefaults) {
    let autoDefaults = cachedDefaults;
    if (!autoDefaults || !isFresh(autoDefaults.timestamp)) {
      autoDefaults = await createDefaults(apiKey, baseApiUrl);
      await mkdir(defaultsDir, { recursive: true });
      await writeFile(experimentDefaultsFile, JSON.stringify(autoDefaults));
    }

    return {
      name: autoDefaults.name || [],
      hypothesis: autoDefaults.hypothesis || [],
      description: autoDefaults.description || [],
      datasource: userDefaults.datasourceId,
      assignmentQuery: userDefaults.assignmentQueryId,
      environments: userDefaults.environments,
      filePaths: {
        experimentDefaultsFile,
        userDefaultsFile,
      },
      timestamp: new Date().toISOString(),
    };
  }

  if (cachedDefaults && isFresh(cachedDefaults.timestamp)) {
    return cachedDefaults;
  }

  const generatedDefaults = await createDefaults(apiKey, baseApiUrl);
  await mkdir(defaultsDir, { recursive: true });
  await writeFile(experimentDefaultsFile, JSON.stringify(generatedDefaults));
  return generatedDefaults;
}

export async function setUserDefaults(
  datasourceId: string,
  assignmentQueryId: string,
  environments: string[]
): Promise<GrowthbookUserDefaults> {
  const payload: GrowthbookUserDefaults = {
    datasourceId,
    assignmentQueryId,
    environments,
    timestamp: new Date().toISOString(),
  };

  await mkdir(defaultsDir, { recursive: true });
  await writeFile(userDefaultsFile, JSON.stringify(payload));
  return payload;
}

export async function clearUserDefaults(): Promise<boolean> {
  try {
    await readFile(userDefaultsFile, 'utf8');
    await unlink(userDefaultsFile);
    return true;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}
