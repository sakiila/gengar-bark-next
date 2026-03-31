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
    expect(text).toContain('项目 "obc" 无法匹配到有效的 project id/name');
    expect(text).toContain('Website (prj_1)');
    expect(text).toContain('Sample Data (prj_2)');
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
    expect(text).toContain('已完成 Feature Flag 查询');
    expect(text).toContain('项目：Website');
    expect(text).toContain('关键词：obc');
    expect(text).toContain('本次返回 1 条，匹配总数 1');
    expect(text).toContain('- obc_enable_checkout');
    expect(text).not.toContain('capital_market_entry');
  });
});
