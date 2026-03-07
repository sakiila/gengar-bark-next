/**
 * GitHubCommand matches 单元测试
 */

import { GitHubCommand } from '../gengar-commands';

// Mock 外部依赖（GitHubCommand 构造函数不需要真实值）
jest.mock('@/lib/utils/id-utils', () => ({ extractId: jest.fn(), IdType: {} }));
jest.mock('@/lib/database/services/appointment-slack', () => ({ sendAppointmentToSlack: jest.fn(), sendOrderToSlack: jest.fn() }));
jest.mock('@/lib/moego/moego', () => ({ execute_moego: jest.fn() }));
jest.mock('@/lib/ai/openai', () => ({ generatePromptFromThread: jest.fn(), getGPT: jest.fn(), cleanText: jest.fn() }));
jest.mock('@/lib/slack/gengar-bolt', () => ({ getThreadReplies: jest.fn(), postMessage: jest.fn() }));
jest.mock('@/lib/database/supabase', () => ({ getUser: jest.fn(), postgres: { from: jest.fn() } }));
jest.mock('@/lib/jira/create-issue', () => ({ createIssue: jest.fn() }));
jest.mock('@/lib/utils/file-utils', () => ({ detectFileTypeFromUrl: jest.fn(), formatFileSize: jest.fn() }));
jest.mock('@/lib/github/create-issue', () => ({ parseGitHubCommand: jest.fn(), createGitHubIssue: jest.fn() }));

describe('GitHubCommand.matches', () => {
  const cmd = new GitHubCommand('C123', '1234.5678', 'U123');

  it('gh gengar-bark → true', () => {
    expect(cmd.matches('gh gengar-bark')).toBe(true);
  });

  it('github repo bug title → true', () => {
    expect(cmd.matches('github repo bug title')).toBe(true);
  });

  it('GH Repo → true（大小写不敏感）', () => {
    expect(cmd.matches('GH Repo')).toBe(true);
  });

  it('jira MER Bug → false', () => {
    expect(cmd.matches('jira MER Bug')).toBe(false);
  });

  it('ghrepo → false（缺少空格）', () => {
    expect(cmd.matches('ghrepo')).toBe(false);
  });
});
