import { getThreadReply } from '@/lib/slack/slack';
import { generatePromptForJira, getGPT4 } from '@/lib/ai/openai';
import { postMessage } from '@/lib/slack/gengar-bolt';
import { capitalizeWords } from '@/lib/utils/string-utils';

async function aiSummary(channel: string, ts: string) {
  const thread = await getThreadReply(channel, ts);
  const prompts = await generatePromptForJira(thread);
  const gptResponse = await getGPT4(prompts);
  return JSON.parse(gptResponse.choices[0].message.content as string);
}

export async function createIssue(text: string, channel: string, ts: string, userName: string) {
  const pattern = new RegExp('^jira\\s+(\\S+)\\s+(\\S+)(?:\\s+(.+))?$', 'i');
  const match = text.match(pattern);

  if (!match) {
    throw new Error('命令格式错误，请使用: jira <projectKey> <issueType> [summary]');
  }

  // use ai to generate summary and description
  const result = await aiSummary(channel, ts);

  let [_, projectKey, issueType, summary = result.summary as string] = match;

  // 较正
  projectKey = projectKey.toUpperCase();
  issueType = capitalizeWords(issueType);
  if (('MER' == projectKey || 'FIN' == projectKey) && 'Bug' == issueType) {
    issueType = 'Bug Online';
  }

  const requestBody: any = {
    fields: {
      project: {
        key: projectKey,
      },
      summary: summary,
      description: `Issue created via Slack by Jira Command\n\nReporter: ${userName}\n\nAI generated summary:\n${result.description as string}`,
      issuetype: {
        name: issueType,
      },
    },
  };

  // 只有当 issueKey 存在时才添加关联
  if (result.issueKey) {
    requestBody.update = {
      issuelinks: [
        {
          add: {
            type: {
              name: 'Relates',
              inward: 'relates to',
            },
            inwardIssue: {
              key: result.issueKey.toUpperCase(),
            },
          },
        },
      ],
    };
  }

  // api docs: https://developer.atlassian.com/server/jira/platform/rest/v10004/api-group-issue/#api-api-2-issue-post
  const response = await fetch('https://moego.atlassian.net/rest/api/2/issue', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64')}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`创建 Jira issue 失败: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.key;
}

