import { createIssue } from '../create-issue';
import { getGPT, generatePromptForJira } from '@/lib/ai/openai';
import { getThreadReplies } from '@/lib/slack/gengar-bolt';

jest.mock('@/lib/ai/openai', () => ({
  generatePromptForJira: jest.fn(),
  getGPT: jest.fn(),
}));

jest.mock('@/lib/slack/gengar-bolt', () => ({
  getThreadReplies: jest.fn(),
}));

describe('createIssue', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JIRA_EMAIL = 'jira@example.com';
    process.env.JIRA_API_TOKEN = 'token';
    global.fetch = jest.fn();

    (getThreadReplies as jest.Mock).mockResolvedValue([]);
    (generatePromptForJira as jest.Mock).mockResolvedValue([]);
    (getGPT as jest.Mock).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: 'AI summary',
              description: 'AI description',
              issueKey: 'MER-900',
            }),
          },
        },
      ],
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('sets default priority for Bug Online issues when related CS issue has no issue priority', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ fields: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ key: 'MER-123' }),
      });

    const issueKey = await createIssue('jira MER Bug fix login issue', 'C123', '1234.5678', 'Alice');

    expect(issueKey).toBe('MER-123');
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const [, requestInit] = (global.fetch as jest.Mock).mock.calls[1];
    const requestBody = JSON.parse(requestInit.body as string);

    expect(requestBody.fields.issuetype).toEqual({ name: 'Bug Online' });
    expect(requestBody.fields.priority).toEqual({ id: '10004' });
  });

  it('maps related CS issue priority onto Bug Online issues', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          fields: {
            customfield_10049: { id: '10059', name: 'P1' },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ key: 'MER-124' }),
      });

    const issueKey = await createIssue('jira MER Bug fix login issue', 'C123', '1234.5678', 'Alice');

    expect(issueKey).toBe('MER-124');
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const [, requestInit] = (global.fetch as jest.Mock).mock.calls[1];
    const requestBody = JSON.parse(requestInit.body as string);

    expect(requestBody.fields.priority).toEqual({ id: '2' });
    expect(requestBody.update.issuelinks[0].add.outwardIssue).toEqual({ key: 'MER-900' });
  });

  it('logs request body and priority diagnostics when Jira returns required field errors', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ fields: {} }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({
          errorMessages: [],
          errors: {
            customfield_10049: 'Issue Priority is required.',
          },
        }),
      });

    await expect(createIssue('jira MER Bug fix login issue', 'C123', '1234.5678', 'Alice'))
      .rejects
      .toThrow('Issue Priority is required.');

    expect(errorSpy).toHaveBeenCalledWith(
      'Jira create issue failed:',
      expect.objectContaining({
        status: 400,
        statusText: 'Bad Request',
        projectKey: 'MER',
        issueType: 'Bug Online',
        normalizedIssueKey: 'MER-900',
        priorityDiagnostics: expect.objectContaining({
          issueType: 'Bug Online',
          requiredForBugOnline: true,
          selectedPriorityId: '10004',
          fallbackPriorityId: '10004',
          source: 'default',
          relatedIssueKey: 'MER-900',
          relatedIssueCustomField10049Present: false,
          relatedIssueCustomField10049Value: null,
        }),
        requestBody: expect.objectContaining({
          fields: expect.objectContaining({
            issuetype: { name: 'Bug Online' },
            priority: { id: '10004' },
          }),
        }),
        errorData: {
          errorMessages: [],
          errors: {
            customfield_10049: 'Issue Priority is required.',
          },
        },
      })
    );

    errorSpy.mockRestore();
  });
});
