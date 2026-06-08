process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

const createMockTool = (name: string) => ({
  name,
  description: `mock ${name}`,
  parameters: { type: 'object', properties: {}, required: [] },
  execute: async () => ({ success: true, displayText: 'ok' }),
});

jest.mock('../jira-tool', () => ({
  JiraTool: class JiraTool {},
  createJiraTool: jest.fn(() => createMockTool('create_jira_issue')),
}));

jest.mock('../jira-summary-tool', () => ({
  JiraSummaryTool: class JiraSummaryTool {},
  createJiraSummaryTool: jest.fn(() => createMockTool('summarize_for_jira')),
}));

jest.mock('../appointment-tool', () => ({
  AppointmentTool: class AppointmentTool {},
  createAppointmentTool: jest.fn(() => createMockTool('lookup_appointment')),
}));

jest.mock('../ci-tool', () => ({
  CITool: class CITool {},
  createCITool: jest.fn(() => createMockTool('manage_ci_subscription')),
}));

jest.mock('../qa-tool', () => ({
  QATool: class QATool {},
  createQATool: jest.fn(() => createMockTool('ask_question')),
}));

jest.mock('../github-review-tool', () => ({
  GitHubReviewTool: class GitHubReviewTool {},
  createGitHubReviewTool: jest.fn(() => createMockTool('github_review')),
}));

jest.mock('../github-issue-tool', () => ({
  GitHubIssueTool: class GitHubIssueTool {},
  createGitHubIssueTool: jest.fn(() => createMockTool('create_github_issue')),
}));

jest.mock('../growthbook', () => {
  class MockGrowthbookTool {
    name = 'growthbook_get_projects';
    description = 'mock growthbook tool';
    parameters = {
      type: 'object',
      properties: {},
      required: [],
    };

    async execute() {
      return {
        success: true,
        displayText: 'ok',
      };
    }
  }

  return {
    createGrowthbookTools: jest.fn(() => [new MockGrowthbookTool()]),
    GROWTHBOOK_TOOL_NAMES: ['growthbook_get_projects'],
  };
});

import { createAllTools, getAvailableToolNames } from '../index';
import { createGrowthbookTools } from '../growthbook';

describe('agent tools index integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers growthbook tools in createAllTools', () => {
    const tools = createAllTools();

    expect(createGrowthbookTools).toHaveBeenCalledTimes(1);
    expect(tools.some((tool) => tool.name === 'growthbook_get_projects')).toBe(true);
  });

  it('exposes growthbook tool names in available list', () => {
    const names = getAvailableToolNames();
    expect(names).toContain('growthbook_get_projects');
    expect(names).not.toContain('search_growthbook_docs');
  });
});
