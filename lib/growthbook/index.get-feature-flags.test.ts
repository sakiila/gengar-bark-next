import { getFeatureFlags } from './index';
import type { GrowthbookFeature } from './types';

jest.mock('./config', () => ({
  getGrowthbookConfig: jest.fn(() => ({
    token: 'test-token',
    apiHost: 'https://example.growthbook.test',
    appOrigin: 'https://app.growthbook.io',
  })),
}));

const fetchWithPaginationMock = jest.fn();

jest.mock('./client', () => ({
  buildHeaders: jest.fn(),
  fetchFeatureFlag: jest.fn(),
  fetchWithPagination: (...args: unknown[]) => fetchWithPaginationMock(...args),
  fetchWithRateLimit: jest.fn(),
  handleResNotOk: jest.fn(),
  mergeRuleIntoFeatureFlag: jest.fn(),
}));

jest.mock('./defaults', () => ({
  clearUserDefaults: jest.fn(),
  getDefaults: jest.fn(),
  setUserDefaults: jest.fn(),
}));

describe('getFeatureFlags', () => {
  beforeEach(() => {
    fetchWithPaginationMock.mockReset();
  });

  it('returns guidance when project is not a valid project id/name', async () => {
    fetchWithPaginationMock.mockResolvedValueOnce({
      projects: [
        { id: 'prj_1', name: 'Website' },
        { id: 'prj_2', name: 'Sample Data' },
      ],
    });

    const text = await getFeatureFlags({ project: 'obc' }, {} as any);
    const result = JSON.parse(text) as {
      error?: string;
      availableProjects?: Array<{ id: string; name: string }>;
    };

    expect(result.error).toContain('Invalid project');
    expect(result.availableProjects).toEqual([
      { id: 'prj_1', name: 'Website' },
      { id: 'prj_2', name: 'Sample Data' },
    ]);
  });

  it('filters features by query when query is provided', async () => {
    fetchWithPaginationMock
      .mockResolvedValueOnce({
        projects: [
          { id: 'prj_1', name: 'Website' },
          { id: 'prj_2', name: 'Sample Data' },
        ],
      })
      .mockResolvedValueOnce({
        features: [
          {
            id: 'obc_enable_checkout',
            description: 'Enable OBC checkout',
            tags: ['billing'],
          },
          {
            id: 'capital_market_entry',
            description: 'Capital market toggle',
            tags: ['growth'],
          },
        ] as GrowthbookFeature[],
        limit: 100,
        offset: 0,
        count: 2,
        total: 2,
        hasMore: false,
        nextOffset: null,
      });

    const text = await getFeatureFlags({ project: 'Website', query: 'obc' }, {} as any);
    const result = JSON.parse(text) as {
      features: GrowthbookFeature[];
      total: number;
      count: number;
    };

    expect(result.features).toHaveLength(1);
    expect(result.features[0].id).toBe('obc_enable_checkout');
    expect(result.total).toBe(1);
    expect(result.count).toBe(1);
  });
});
