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

  it('falls back to fuzzy query when project is invalid and query is empty', async () => {
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
            id: 'enable_obc_improvement',
            description: 'Enable OBC improvement',
            tags: ['growth'],
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

    const text = await getFeatureFlags({ project: 'obc' }, {} as any);
    expect(text).toContain('未匹配到项目 "obc"，已自动按关键词 "obc" 执行模糊查询');
    expect(text).toContain('本次返回 1 条，匹配总数 1');
    expect(text).toContain('- enable_obc_improvement');
    expect(text).not.toContain('capital_market_entry');
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
    expect(text).toContain('共扫描 1 页');
    expect(text).toContain('本次返回 1 条，匹配总数 1');
    expect(text).toContain('- obc_enable_checkout');
    expect(text).not.toContain('capital_market_entry');
  });

  it('scans multiple pages when fuzzy query is enabled', async () => {
    fetchWithPaginationMock
      .mockResolvedValueOnce({
        projects: [{ id: 'prj_1', name: 'Website' }],
      })
      .mockResolvedValueOnce({
        features: [
          { id: 'alpha_feature', description: 'alpha', tags: [] },
          { id: 'beta_feature', description: 'beta', tags: [] },
        ] as GrowthbookFeature[],
        limit: 2,
        offset: 0,
        count: 2,
        total: 4,
        hasMore: true,
        nextOffset: 2,
      })
      .mockResolvedValueOnce({
        features: [
          { id: 'enable_obc_improvement', description: 'Enable OBC improvement', tags: [] },
          { id: 'gamma_feature', description: 'gamma', tags: [] },
        ] as GrowthbookFeature[],
        limit: 2,
        offset: 2,
        count: 2,
        total: 4,
        hasMore: false,
        nextOffset: null,
      });

    const text = await getFeatureFlags({ project: 'Website', query: 'obc', limit: 2, offset: 0 }, {} as any);
    expect(text).toContain('共扫描 2 页');
    expect(text).toContain('累计检查 4 条候选记录');
    expect(text).toContain('- enable_obc_improvement');
    expect(text).not.toContain('- alpha_feature');
  });
});
