/**
 * GitHubIssueTool 单元测试
 * 覆盖：execute 成功/失败、schema 校验、工厂函数
 */

import { GitHubIssueTool, createGitHubIssueTool } from '../github-issue-tool';
import { AgentContext } from '../../types';

// ─── Mock 外部依赖 ────────────────────────────────────────────────────────────

jest.mock('@/lib/github/create-issue', () => ({
  createGitHubIssue: jest.fn(),
}));

import { createGitHubIssue } from '@/lib/github/create-issue';

// ─── 测试辅助 ─────────────────────────────────────────────────────────────────

const mockContext: AgentContext = {
  channel: 'C123',
  threadTs: '1234567890.123456',
  userId: 'U123',
  userName: 'testuser',
  conversationHistory: [],
  requestId: 'req-001',
  timestamp: new Date('2024-01-01'),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GitHubIssueTool', () => {
  let tool: GitHubIssueTool;

  beforeEach(() => {
    jest.resetAllMocks();
    tool = new GitHubIssueTool();
  });

  // ── Schema & metadata ───────────────────────────────────────────────────

  describe('name and parameters schema', () => {
    it('tool.name === "create_github_issue"', () => {
      expect(tool.name).toBe('create_github_issue');
    });

    it('parameters has all 5 properties', () => {
      const props = Object.keys(tool.parameters.properties);
      expect(props).toEqual(
        expect.arrayContaining(['repo', 'label', 'title', 'description', 'jiraTickets'])
      );
      expect(props).toHaveLength(5);
    });

    it('repo is required', () => {
      expect(tool.parameters.required).toContain('repo');
    });

    it('jiraTickets is optional and type is array', () => {
      expect(tool.parameters.required).not.toContain('jiraTickets');
      expect(tool.parameters.properties.jiraTickets.type).toBe('array');
    });
  });

  // ── execute: success ────────────────────────────────────────────────────

  describe('execute — success', () => {
    it('returns ToolResult with success=true, data, and displayText', async () => {
      (createGitHubIssue as jest.Mock).mockResolvedValue({
        success: true,
        issueUrl: 'https://github.com/moego/gengar-bark/issues/42',
        issueNumber: 42,
      });

      const result = await tool.execute({ repo: 'gengar-bark', title: 'test issue' }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        issueUrl: 'https://github.com/moego/gengar-bark/issues/42',
        issueNumber: 42,
      });
      expect(result.displayText).toContain('#42');
    });

    it('passes all params and context to createGitHubIssue', async () => {
      (createGitHubIssue as jest.Mock).mockResolvedValue({
        success: true,
        issueUrl: 'https://github.com/moego/gengar-bark/issues/1',
        issueNumber: 1,
      });

      await tool.execute(
        { repo: 'gengar-bark', label: 'bug', title: 'fix', description: 'desc', jiraTickets: ['MER-1'] },
        mockContext
      );

      expect(createGitHubIssue).toHaveBeenCalledWith({
        repoName: 'gengar-bark',
        label: 'bug',
        title: 'fix',
        description: 'desc',
        channel: 'C123',
        threadTs: '1234567890.123456',
        userName: 'testuser',
        jiraTickets: ['MER-1'],
      });
    });
  });

  // ── execute: failure from createGitHubIssue ─────────────────────────────

  describe('execute — createGitHubIssue returns failure', () => {
    it('returns ToolResult with success=false and error', async () => {
      (createGitHubIssue as jest.Mock).mockResolvedValue({
        success: false,
        error: 'token 无效或已过期',
      });

      const result = await tool.execute({ repo: 'gengar-bark', title: 'test' }, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('token 无效或已过期');
      expect(result.displayText).toContain('token 无效或已过期');
    });
  });

  // ── execute: missing repo ───────────────────────────────────────────────

  describe('execute — missing repo', () => {
    it('returns error when repo is empty string', async () => {
      const result = await tool.execute({ repo: '' }, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('repo');
      expect(createGitHubIssue).not.toHaveBeenCalled();
    });

    it('returns error when repo is not provided', async () => {
      const result = await tool.execute({}, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('repo');
      expect(createGitHubIssue).not.toHaveBeenCalled();
    });
  });

  // ── execute: exception thrown ───────────────────────────────────────────

  describe('execute — exception', () => {
    it('catches thrown Error and returns error result', async () => {
      (createGitHubIssue as jest.Mock).mockRejectedValue(new Error('Network failure'));

      const result = await tool.execute({ repo: 'gengar-bark' }, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network failure');
      expect(result.displayText).toContain('Network failure');
    });

    it('handles non-Error thrown values', async () => {
      (createGitHubIssue as jest.Mock).mockRejectedValue('string error');

      const result = await tool.execute({ repo: 'gengar-bark' }, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error occurred');
    });
  });

  // ── userName fallback ───────────────────────────────────────────────────

  describe('execute — userName fallback', () => {
    it('uses userId when userName is not provided', async () => {
      (createGitHubIssue as jest.Mock).mockResolvedValue({
        success: true,
        issueUrl: 'https://github.com/moego/repo/issues/1',
        issueNumber: 1,
      });

      const contextWithoutName: AgentContext = { ...mockContext, userName: undefined };
      await tool.execute({ repo: 'repo' }, contextWithoutName);

      expect(createGitHubIssue).toHaveBeenCalledWith(
        expect.objectContaining({ userName: 'U123' })
      );
    });
  });
});

// ─── Factory function ─────────────────────────────────────────────────────────

describe('createGitHubIssueTool', () => {
  it('returns a GitHubIssueTool instance', () => {
    const tool = createGitHubIssueTool();
    expect(tool).toBeInstanceOf(GitHubIssueTool);
    expect(tool.name).toBe('create_github_issue');
  });
});
