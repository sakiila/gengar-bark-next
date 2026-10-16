export interface GrowthbookConfig {
  token: string;
  apiHost: string;
  appOrigin: string;
}

export interface GrowthbookFeatureEnvironment {
  enabled?: boolean;
  rules?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface GrowthbookFeature {
  id?: string;
  environments?: Record<string, GrowthbookFeatureEnvironment>;
  [key: string]: unknown;
}

export interface GrowthbookUserDefaults {
  datasourceId: string;
  assignmentQueryId: string;
  environments: string[];
  timestamp: string;
}

export interface GrowthbookExperimentDefaults {
  name: string[];
  hypothesis: string[];
  description: string[];
  datasource: string;
  assignmentQuery: string;
  environments: string[];
  filePaths: {
    experimentDefaultsFile: string;
    userDefaultsFile: string;
  };
  timestamp: string;
}

export interface GrowthbookListExperimentsResponse {
  experiments?: Array<{
    name: string;
    hypothesis: string;
    description: string;
    settings: {
      datasourceId: string;
      assignmentQueryId: string;
    };
  }>;
  hasMore?: boolean;
  total?: number;
  count?: number;
  offset?: number;
}

export interface GrowthbookListDataSourcesResponse {
  dataSources?: Array<{
    id: string;
    assignmentQueries?: Array<{
      id: string;
    }>;
  }>;
}

export interface GrowthbookListEnvironmentsResponse {
  environments?: Array<{
    id: string;
  }>;
}
