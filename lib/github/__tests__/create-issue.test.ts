/**
 * GitHub Issue 创建模块单元测试
 * 覆盖：parseGitHubCommand、resolveRepo、createGitHubIssue
 */

import {
  parseGitHubCommand,
  resolveRepo,
  createGitHubIssue,
  fetchIssueTemplates,
  selectTemplateWithAI,
  buildBodyFromTemplate,
  buildDefaultBody,
  IssueTemplate,
} from '../create-issue';

// ─── Mock 外部依赖 ────────────────────────────────────────────────────────────

jest.mock('@/lib/upstash/upstash', () => ({
  getCache: jest.fn(),
  setCacheEx: jest.fn(),
}));

jest.mock('@/lib/slack/gengar-bolt', () => ({
  getThreadReplies: jest.fn(),
}));

jest.mock('@/lib/ai/openai', () => ({
  getGPT: jest.fn(),
  cleanText: jest.fn((t: string) => t),
}));

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    __esModule: true,
    default: {
      ...actual.default,
      get: jest.fn(),
      post: jest.fn(),
    },
    AxiosError: actual.AxiosError,
  };
});

import { getCache, setCacheEx } from '@/lib/upstash/upstash';
import { getThreadReplies } from '@/lib/slack/gengar-bolt';
import { getGPT } from '@/lib/ai/openai';
import axios from 'axios';

// ─── parseGitHubCommand ───────────────────────────────────────────────────────

describe('parseGitHubCommand', () => {
  it('带 label + title', () => {
    expect(parseGitHubCommand('gh gengar-bark bug 修复登录')).toEqual({
      repo: 'gengar-bark',
      label: 'bug',
      title: '修复登录',
    });
  });

  it('自定义 label（不在推荐列表中）', () => {
    expect(parseGitHubCommand('gh gengar-bark hotfix 紧急修复')).toEqual({
      repo: 'gengar-bark',
      label: 'hotfix',
      title: '紧急修复',
    });
  });

  it('无 label，中文 title（单 token）', () => {
    expect(parseGitHubCommand('gh gengar-bark 修复登录问题')).toEqual({
      repo: 'gengar-bark',
      title: '修复登录问题',
    });
  });

  it('仅 repo', () => {
    expect(parseGitHubCommand('gh gengar-bark')).toEqual({
      repo: 'gengar-bark',
    });
  });

  it('仅 label 无 title', () => {
    expect(parseGitHubCommand('gh gengar-bark bug')).toEqual({
      repo: 'gengar-bark',
      label: 'bug',
    });
  });

  it('带单个 Jira ticket', () => {
    expect(parseGitHubCommand('gh gengar-bark bug 修复登录 MER-123')).toEqual({
      repo: 'gengar-bark',
      label: 'bug',
      title: '修复登录',
      jiraTickets: ['MER-123'],
    });
  });

  it('带多个 Jira ticket', () => {
    expect(parseGitHubCommand('gh gengar-bark bug 修复登录 MER-123 CRM-456')).toEqual({
      repo: 'gengar-bark',
      label: 'bug',
      title: '修复登录',
      jiraTickets: ['MER-123', 'CRM-456'],
    });
  });

  it('从 title 中提取并移除 ticket', () => {
    expect(parseGitHubCommand('gh gengar-bark 修复 MER-123 的问题')).toEqual({
      repo: 'gengar-bark',
      title: '修复 的问题',
      jiraTickets: ['MER-123'],
    });
  });

  it('使用 github 前缀', () => {
    expect(parseGitHubCommand('github my-repo feat add feature')).toEqual({
      repo: 'my-repo',
      label: 'feat',
      title: 'add feature',
    });
  });

  it('大小写不敏感前缀', () => {
    expect(parseGitHubCommand('GH my-repo bug')).toEqual({
      repo: 'my-repo',
      label: 'bug',
    });
  });

  it('无效命令返回 null — jira 前缀', () => {
    expect(parseGitHubCommand('jira MER Bug')).toBeNull();
  });

  it('无效命令返回 null — 无空格', () => {
    expect(parseGitHubCommand('ghrepo')).toBeNull();
  });
});

// ─── resolveRepo ─────────────────────────────────────────────────────────────

describe('resolveRepo', () => {
  const mockRepos = [
    { owner: 'moego', repo: 'gengar-bark', fullName: 'moego/gengar-bark' },
    { owner: 'moego', repo: 'moego-web', fullName: 'moego/moego-web' },
    { owner: 'moego', repo: 'gengar', fullName: 'moego/gengar' },
  ];

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.GITHUB_PAT = 'test-pat';
  });

  it('精确匹配', async () => {
    (getCache as jest.Mock).mockResolvedValue(JSON.stringify(mockRepos));
    const result = await resolveRepo('gengar-bark');
    expect(result).toEqual({ owner: 'moego', repo: 'gengar-bark' });
  });

  it('模糊匹配（包含关系）', async () => {
    const repos = [
      { owner: 'moego', repo: 'moego-web', fullName: 'moego/moego-web' },
      { owner: 'moego', repo: 'gengar-bark-next', fullName: 'moego/gengar-bark-next' },
    ];
    (getCache as jest.Mock).mockResolvedValue(JSON.stringify(repos));
    const result = await resolveRepo('gengar-bark');
    expect(result).toEqual({ owner: 'moego', repo: 'gengar-bark-next' });
  });

  it('精确匹配优先于模糊匹配', async () => {
    // 列表中同时有 gengar 和 gengar-bark，查询 gengar 应返回精确匹配
    (getCache as jest.Mock).mockResolvedValue(JSON.stringify(mockRepos));
    const result = await resolveRepo('gengar');
    expect(result).toEqual({ owner: 'moego', repo: 'gengar' });
  });

  it('无匹配时抛出错误', async () => {
    (getCache as jest.Mock).mockResolvedValue(JSON.stringify(mockRepos));
    await expect(resolveRepo('nonexistent-repo')).rejects.toThrow('未找到匹配的仓库: nonexistent-repo');
  });

  it('Redis 缓存命中时不调用 GitHub API', async () => {
    (getCache as jest.Mock).mockResolvedValue(JSON.stringify(mockRepos));
    await resolveRepo('gengar-bark');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('Redis 缓存未命中时调用 API 并写入缓存', async () => {
    (getCache as jest.Mock).mockResolvedValue(null as any);
    (axios.get as jest.Mock).mockResolvedValue({
      data: [
        { full_name: 'moego/gengar-bark', name: 'gengar-bark', owner: { login: 'moego' } },
      ],
    });
    (setCacheEx as jest.Mock).mockResolvedValue(undefined as any);

    const result = await resolveRepo('gengar-bark');
    expect(result).toEqual({ owner: 'moego', repo: 'gengar-bark' });
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(setCacheEx).toHaveBeenCalledWith(
      'github:repos',
      expect.any(String),
      600
    );
  });

  it('Redis 读取失败时降级调用 API', async () => {
    (getCache as jest.Mock).mockRejectedValue(new Error('Redis error'));
    (axios.get as jest.Mock).mockResolvedValue({
      data: [
        { full_name: 'moego/gengar-bark', name: 'gengar-bark', owner: { login: 'moego' } },
      ],
    });

    const result = await resolveRepo('gengar-bark');
    expect(result).toEqual({ owner: 'moego', repo: 'gengar-bark' });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('GITHUB_PAT 未配置时抛出错误', async () => {
    delete process.env.GITHUB_PAT;
    await expect(resolveRepo('gengar-bark')).rejects.toThrow('GITHUB_PAT 环境变量未配置');
  });
});

// ─── createGitHubIssue ────────────────────────────────────────────────────────

describe('createGitHubIssue', () => {
  const baseParams = {
    repoName: 'gengar-bark',
    channel: 'C123',
    threadTs: '1234567890.123456',
    userName: 'testuser',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.GITHUB_PAT = 'test-pat';

    // 默认 resolveRepo 成功（通过 Redis 缓存）
    // getCache 根据 key 返回不同值：repos 缓存命中，templates 缓存未命中
    (getCache as jest.Mock).mockImplementation((key: string) => {
      if (key === 'github:repos') {
        return Promise.resolve(
          JSON.stringify([{ owner: 'moego', repo: 'gengar-bark', fullName: 'moego/gengar-bark' }])
        );
      }
      // 模板缓存默认未命中，且 fetchIssueTemplates 的 axios.get 也不会命中（未 mock）
      // 所以默认走无模板回退路径
      return Promise.resolve(null);
    });

    // 默认 axios.get 对模板目录返回 404（无模板）
    (axios.get as jest.Mock).mockRejectedValue({ response: { status: 404 } });

    // 默认 axios.post 成功
    (axios.post as jest.Mock).mockResolvedValue({
      data: { html_url: 'https://github.com/moego/gengar-bark/issues/42', number: 42 },
    });
  });

  it('成功创建返回 success + issueUrl + issueNumber', async () => {
    const result = await createGitHubIssue({ ...baseParams, title: '修复登录' });
    expect(result).toEqual({
      success: true,
      issueUrl: 'https://github.com/moego/gengar-bark/issues/42',
      issueNumber: 42,
    });
  });

  it('issue body 包含 reporter 和 thread link', async () => {
    await createGitHubIssue({ ...baseParams, title: '修复登录' });
    const postCall = (axios.post as jest.Mock).mock.calls[0];
    const body = (postCall[1] as any).body as string;
    expect(body).toContain('Reporter: testuser');
    expect(body).toContain('https://moegoworkspace.slack.com/archives/C123/p1234567890123456');
  });

  it('threadTs 中的小数点被移除', async () => {
    await createGitHubIssue({ ...baseParams, title: '修复登录', threadTs: '1234567890.123456' });
    const postCall = (axios.post as jest.Mock).mock.calls[0];
    const body = (postCall[1] as any).body as string;
    expect(body).toContain('p1234567890123456');
    expect(body).not.toContain('p1234567890.123456');
  });

  it('有 label 时请求包含 labels 字段', async () => {
    await createGitHubIssue({ ...baseParams, title: '修复登录', label: 'bug' });
    const postCall = (axios.post as jest.Mock).mock.calls[0];
    expect((postCall[1] as any).labels).toEqual(['bug']);
  });

  it('无 label 时请求不包含 labels 字段', async () => {
    await createGitHubIssue({ ...baseParams, title: '修复登录' });
    const postCall = (axios.post as jest.Mock).mock.calls[0];
    expect((postCall[1] as any).labels).toBeUndefined();
  });

  it('无 title 时调用 AI 摘要', async () => {
    (getThreadReplies as jest.Mock).mockResolvedValue([]);
    (getGPT as jest.Mock).mockResolvedValue({
      choices: [{ message: { content: '{"summary":"AI title","description":"AI desc","jiraTickets":[]}' } }],
    } as any);

    const result = await createGitHubIssue({ ...baseParams });
    expect(result.success).toBe(true);
    const postCall = (axios.post as jest.Mock).mock.calls[0];
    expect((postCall[1] as any).title).toBe('AI title');
  });

  it('AI 摘要超时时降级继续创建（title 为空）', async () => {
    (getThreadReplies as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve([]), 10000))
    );

    const result = await createGitHubIssue({ ...baseParams });
    expect(result.success).toBe(true);
    const postCall = (axios.post as jest.Mock).mock.calls[0];
    // title 为空时使用 "(no title)"
    expect((postCall[1] as any).title).toBe('(no title)');
  }, 10000);

  it('GITHUB_PAT 未配置时返回错误', async () => {
    delete process.env.GITHUB_PAT;
    const result = await createGitHubIssue({ ...baseParams, title: '修复登录' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('GITHUB_PAT');
  });

  it('有 jiraTickets 时 body 包含 Related Jira Tickets 区域', async () => {
    await createGitHubIssue({ ...baseParams, title: '修复登录', jiraTickets: ['MER-123'] });
    const postCall = (axios.post as jest.Mock).mock.calls[0];
    const body = (postCall[1] as any).body as string;
    expect(body).toContain('## Related Jira Tickets');
    expect(body).toContain('[MER-123](https://moego.atlassian.net/browse/MER-123)');
  });

  it('无 jiraTickets 时 body 不包含 Related Jira Tickets 区域', async () => {
    await createGitHubIssue({ ...baseParams, title: '修复登录' });
    const postCall = (axios.post as jest.Mock).mock.calls[0];
    const body = (postCall[1] as any).body as string;
    expect(body).not.toContain('Related Jira Tickets');
  });

  it('有 jiraTickets 时 title 末尾追加 ticket 号', async () => {
    await createGitHubIssue({ ...baseParams, title: '修复登录', jiraTickets: ['MER-123', 'CRM-456'] });
    const postCall = (axios.post as jest.Mock).mock.calls[0];
    expect((postCall[1] as any).title).toBe('修复登录 MER-123 CRM-456');
  });

  it('命令中显式指定的 jiraTickets 与 AI 识别的合并去重', async () => {
    (getThreadReplies as jest.Mock).mockResolvedValue([]);
    (getGPT as jest.Mock).mockResolvedValue({
      choices: [{ message: { content: '{"summary":"","description":"","jiraTickets":["MER-123","FIN-789"]}' } }],
    } as any);

    // 无 title 触发 AI，AI 返回 MER-123 + FIN-789，命令中已有 MER-123
    await createGitHubIssue({ ...baseParams, jiraTickets: ['MER-123'] });
    const postCall = (axios.post as jest.Mock).mock.calls[0];
    const body = (postCall[1] as any).body as string;
    // MER-123 链接只出现一次（去重），markdown 链接格式包含两次文本
    const merLinkCount = (body.match(/- \[MER-123\]/g) || []).length;
    expect(merLinkCount).toBe(1);
    expect(body).toContain('FIN-789');
  });

  it('Jira ticket 链接格式正确', async () => {
    await createGitHubIssue({ ...baseParams, title: '修复', jiraTickets: ['MER-123'] });
    const postCall = (axios.post as jest.Mock).mock.calls[0];
    const body = (postCall[1] as any).body as string;
    expect(body).toContain('[MER-123](https://moego.atlassian.net/browse/MER-123)');
  });

  it('GitHub API 401 返回 token 无效错误', async () => {
    const err = Object.assign(new Error('Unauthorized'), {
      response: { status: 401, data: { message: 'Bad credentials' } },
      isAxiosError: true,
    });
    (axios.post as jest.Mock).mockRejectedValue(err);

    const result = await createGitHubIssue({ ...baseParams, title: '修复登录' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('token 无效或已过期');
  });

  it('GitHub API 403 返回权限不足错误', async () => {
    const err = Object.assign(new Error('Forbidden'), {
      response: { status: 403, data: { message: 'Forbidden' } },
      isAxiosError: true,
    });
    (axios.post as jest.Mock).mockRejectedValue(err);

    const result = await createGitHubIssue({ ...baseParams, title: '修复登录' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('没有权限');
  });

  it('GitHub API 404 返回仓库不存在错误', async () => {
    const err = Object.assign(new Error('Not Found'), {
      response: { status: 404, data: { message: 'Not Found' } },
      isAxiosError: true,
    });
    (axios.post as jest.Mock).mockRejectedValue(err);

    const result = await createGitHubIssue({ ...baseParams, title: '修复登录' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('不存在或无权访问');
  });

  it('issue body 包含 AI 生成的 description', async () => {
    (getThreadReplies as jest.Mock).mockResolvedValue([]);
    (getGPT as jest.Mock).mockResolvedValue({
      choices: [{ message: { content: '{"summary":"AI title","description":"AI generated description","jiraTickets":[]}' } }],
    } as any);

    await createGitHubIssue({ ...baseParams });
    const postCall = (axios.post as jest.Mock).mock.calls[0];
    const body = (postCall[1] as any).body as string;
    expect(body).toContain('AI generated description');
  });

  it('有匹配模板时使用模板格式构建 body', async () => {
    const bugTemplate: IssueTemplate = {
      fileName: 'bug_report.md',
      name: 'Bug Report',
      about: 'Create a report to help us improve',
      labels: ['bug'],
      defaultTitle: '',
      body: '## Describe the bug\nA clear description.\n\n## Steps to Reproduce\n1.\n2.\n3.',
    };

    // 模板缓存命中
    (getCache as jest.Mock).mockImplementation((key: string) => {
      if (key === 'github:repos') {
        return Promise.resolve(
          JSON.stringify([{ owner: 'moego', repo: 'gengar-bark', fullName: 'moego/gengar-bark' }])
        );
      }
      if (key === 'github:templates:moego/gengar-bark') {
        return Promise.resolve(JSON.stringify([bugTemplate]));
      }
      return Promise.resolve(null);
    });

    // AI 选择模板索引 0
    (getGPT as jest.Mock).mockResolvedValue({
      choices: [{ message: { content: '0' } }],
    } as any);

    await createGitHubIssue({ ...baseParams, title: '修复登录', label: 'bug' });
    const postCall = (axios.post as jest.Mock).mock.calls[0];
    const body = (postCall[1] as any).body as string;
    expect(body).toContain('## Describe the bug');
    expect(body).toContain('### Additional Context');
    expect(body).toContain('**Reporter**: testuser');
  });

  it('AI 选择无匹配模板（-1）时回退默认格式', async () => {
    const template: IssueTemplate = {
      fileName: 'feature.md',
      name: 'Feature Request',
      about: 'Suggest an idea',
      labels: ['enhancement'],
      defaultTitle: '',
      body: '## Feature description',
    };

    (getCache as jest.Mock).mockImplementation((key: string) => {
      if (key === 'github:repos') {
        return Promise.resolve(
          JSON.stringify([{ owner: 'moego', repo: 'gengar-bark', fullName: 'moego/gengar-bark' }])
        );
      }
      if (key === 'github:templates:moego/gengar-bark') {
        return Promise.resolve(JSON.stringify([template]));
      }
      return Promise.resolve(null);
    });

    // AI 返回 -1（无匹配）
    (getGPT as jest.Mock).mockResolvedValue({
      choices: [{ message: { content: '-1' } }],
    } as any);

    await createGitHubIssue({ ...baseParams, title: '修复登录', label: 'bug' });
    const postCall = (axios.post as jest.Mock).mock.calls[0];
    const body = (postCall[1] as any).body as string;
    // 回退默认格式：直接以 Reporter 开头
    expect(body).toMatch(/^Reporter: testuser/);
    expect(body).not.toContain('## Feature description');
  });

  it('模板获取失败时回退默认格式', async () => {
    await createGitHubIssue({ ...baseParams, title: '修复登录' });
    const postCall = (axios.post as jest.Mock).mock.calls[0];
    const body = (postCall[1] as any).body as string;
    expect(body).toMatch(/^Reporter: testuser/);
  });
});

// ─── fetchIssueTemplates ──────────────────────────────────────────────────────

describe('fetchIssueTemplates', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.GITHUB_PAT = 'test-pat';
  });

  it('从 Redis 缓存返回模板', async () => {
    const cached: IssueTemplate[] = [{
      fileName: 'bug.md', name: 'Bug', about: 'Report a bug',
      labels: ['bug'], defaultTitle: '', body: '## Bug',
    }];
    (getCache as jest.Mock).mockResolvedValue(JSON.stringify(cached));

    const result = await fetchIssueTemplates('moego', 'gengar-bark');
    expect(result).toEqual(cached);
    // 不应调用 GitHub API
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('缓存未命中时调用 GitHub API 并写入缓存', async () => {
    (getCache as jest.Mock).mockResolvedValue(null);

    const templateContent = `---\nname: Bug Report\nabout: Report a bug\nlabels: bug\ntitle: ''\n---\n## Describe the bug\nDetails here.`;

    // 目录列表
    (axios.get as jest.Mock)
      .mockResolvedValueOnce({
        data: [{ name: 'bug_report.md', download_url: 'https://raw.githubusercontent.com/moego/gengar-bark/main/.github/ISSUE_TEMPLATE/bug_report.md' }],
      })
      // 文件内容
      .mockResolvedValueOnce({ data: templateContent });

    (setCacheEx as jest.Mock).mockResolvedValue(undefined);

    const result = await fetchIssueTemplates('moego', 'gengar-bark');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bug Report');
    expect(result[0].labels).toEqual(['bug']);
    expect(result[0].body).toBe('## Describe the bug\nDetails here.');
    expect(setCacheEx).toHaveBeenCalledWith(
      'github:templates:moego/gengar-bark',
      expect.any(String),
      600
    );
  });

  it('GitHub API 失败时返回空数组', async () => {
    (getCache as jest.Mock).mockResolvedValue(null);
    (axios.get as jest.Mock).mockRejectedValue({ response: { status: 404 } });

    const result = await fetchIssueTemplates('moego', 'gengar-bark');
    expect(result).toEqual([]);
  });

  it('GITHUB_PAT 未配置时返回空数组', async () => {
    delete process.env.GITHUB_PAT;
    const result = await fetchIssueTemplates('moego', 'gengar-bark');
    expect(result).toEqual([]);
  });

  it('解析数组格式的 labels', async () => {
    (getCache as jest.Mock).mockResolvedValue(null);

    const templateContent = `---\nname: Bug\nabout: Bug\nlabels: [bug, needs-triage]\ntitle: ''\n---\n## Bug`;

    (axios.get as jest.Mock)
      .mockResolvedValueOnce({ data: [{ name: 'bug.md', download_url: 'https://example.com/bug.md' }] })
      .mockResolvedValueOnce({ data: templateContent });

    const result = await fetchIssueTemplates('moego', 'gengar-bark');
    expect(result[0].labels).toEqual(['bug', 'needs-triage']);
  });
});

// ─── selectTemplateWithAI ─────────────────────────────────────────────────────

describe('selectTemplateWithAI', () => {
  const templates: IssueTemplate[] = [
    { fileName: 'bug.md', name: 'Bug Report', about: 'Report a bug', labels: ['bug'], defaultTitle: '', body: '## Bug' },
    { fileName: 'feat.md', name: 'Feature Request', about: 'Suggest a feature', labels: ['enhancement'], defaultTitle: '', body: '## Feature' },
  ];

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('AI 返回有效索引时返回对应模板', async () => {
    (getGPT as jest.Mock).mockResolvedValue({
      choices: [{ message: { content: '0' } }],
    } as any);

    const result = await selectTemplateWithAI(templates, { label: 'bug' });
    expect(result).toEqual(templates[0]);
  });

  it('AI 返回 -1 时返回 null', async () => {
    (getGPT as jest.Mock).mockResolvedValue({
      choices: [{ message: { content: '-1' } }],
    } as any);

    const result = await selectTemplateWithAI(templates, { label: 'ci' });
    expect(result).toBeNull();
  });

  it('空模板列表返回 null', async () => {
    const result = await selectTemplateWithAI([], { label: 'bug' });
    expect(result).toBeNull();
    expect(getGPT).not.toHaveBeenCalled();
  });

  it('AI 返回非数字时返回 null', async () => {
    (getGPT as jest.Mock).mockResolvedValue({
      choices: [{ message: { content: 'I think template 0 is best' } }],
    } as any);

    const result = await selectTemplateWithAI(templates, { label: 'bug' });
    expect(result).toBeNull();
  });

  it('AI 调用异常时返回 null', async () => {
    (getGPT as jest.Mock).mockRejectedValue(new Error('API error'));

    const result = await selectTemplateWithAI(templates, { label: 'bug' });
    expect(result).toBeNull();
  });
});

// ─── buildBodyFromTemplate / buildDefaultBody ─────────────────────────────────

describe('buildBodyFromTemplate', () => {
  const ctx = {
    userName: 'alice',
    threadLink: 'https://moegoworkspace.slack.com/archives/C123/p111',
    description: 'Login fails on mobile',
    jiraTickets: ['MER-123'],
  };

  it('模板 body 在顶部，补充上下文在底部', () => {
    const body = buildBodyFromTemplate('## Describe the bug\nPlaceholder', ctx);
    // 模板内容在前
    expect(body.indexOf('## Describe the bug')).toBeLessThan(body.indexOf('### Additional Context'));
    // 补充上下文包含 reporter 和 thread link
    expect(body).toContain('**Reporter**: alice');
    expect(body).toContain('**Slack Thread**: https://moegoworkspace.slack.com/archives/C123/p111');
  });

  it('包含 description', () => {
    const body = buildBodyFromTemplate('## Bug', ctx);
    expect(body).toContain('Login fails on mobile');
  });

  it('包含 Jira tickets', () => {
    const body = buildBodyFromTemplate('## Bug', ctx);
    expect(body).toContain('### Related Jira Tickets');
    expect(body).toContain('[MER-123](https://moego.atlassian.net/browse/MER-123)');
  });

  it('无 jiraTickets 时不包含 Jira 区域', () => {
    const body = buildBodyFromTemplate('## Bug', { ...ctx, jiraTickets: [] });
    expect(body).not.toContain('Related Jira Tickets');
  });

  it('无 description 时不追加空描述', () => {
    const body = buildBodyFromTemplate('## Bug', { ...ctx, description: '' });
    // Additional Context 后面直接没有多余空行+文本
    const lines = body.split('\n');
    const ctxIdx = lines.findIndex(l => l.includes('### Additional Context'));
    // 下一行应该是 Reporter，不是空描述
    expect(lines[ctxIdx + 1]).toContain('**Reporter**');
  });
});

describe('buildDefaultBody', () => {
  it('包含 reporter 和 thread link', () => {
    const body = buildDefaultBody({
      userName: 'bob',
      threadLink: 'https://slack.com/thread',
      description: '',
      jiraTickets: [],
    });
    expect(body).toContain('Reporter: bob');
    expect(body).toContain('Slack Thread: https://slack.com/thread');
  });

  it('有 description 时包含', () => {
    const body = buildDefaultBody({
      userName: 'bob',
      threadLink: 'https://slack.com/thread',
      description: 'Some desc',
      jiraTickets: [],
    });
    expect(body).toContain('Some desc');
  });

  it('有 jiraTickets 时包含 Related Jira Tickets', () => {
    const body = buildDefaultBody({
      userName: 'bob',
      threadLink: 'https://slack.com/thread',
      description: '',
      jiraTickets: ['CRM-1'],
    });
    expect(body).toContain('## Related Jira Tickets');
    expect(body).toContain('[CRM-1](https://moego.atlassian.net/browse/CRM-1)');
  });
});
