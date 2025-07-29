import { generatePromptForJira, getGPT4 } from '@/lib/ai/openai';
import { capitalizeWords } from '@/lib/utils/string-utils';
import { getThreadReplies } from '@/lib/slack/gengar-bolt';

async function aiSummary(channel: string, ts: string) {
  const thread = await getThreadReplies(channel, ts);
  const prompts = await generatePromptForJira(thread);
  console.log('prompts: ', prompts);
  const gptResponse = await getGPT4(prompts);
  console.log('gptResponse.choices[0].message.content: ', gptResponse.choices[0].message.content);
  const result = JSON.parse(gptResponse.choices[0].message.content as string);
  console.info('aiSummary result:', result);
  return result;
}

async function getThreadLink(channelId: string, threadTs: string): Promise<string> {
  // 统一处理 threadTs 格式
  let formattedTs = threadTs;

  // 如果包含小数点，说明是 1740041242.568629 格式
  if (threadTs.includes('.')) {
    formattedTs = threadTs.replace('.', '');
  }

  return `https://moegoworkspace.slack.com/archives/${channelId}/p${formattedTs}`;
}

export async function createIssue(text: string, channel: string, ts: string, userName: string) {
  const pattern = new RegExp('^jira\\s+(\\S+)\\s+(\\S+)(?:\\s+(.+))?$', 'i');
  const match = text.match(pattern);

  if (!match) {
    throw new Error('命令格式错误，请使用: jira <projectKey> <issueType> [summary]');
  }

  const threadLink = await getThreadLink(channel, ts);

  // use ai to generate summary and description
  let result;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI 总结超时')), 6000);
    });
    result = await Promise.race([aiSummary(channel, ts), timeoutPromise]);
  } catch (error) {
    console.error('获取 AI 总结失败:', error);
    result = {
      summary: '',
      description: '',
      issueKey: null
    };
  }

  const [_, projectKey, issueType, summary = result.summary as string] = match;

  // 较正
  // MER Bug -> Bug Online 10004 -> customfield_10052
  // CRM Bug -> Bug 10045 ->  description
  // FIN Bug -> Bug Online 10004 -> description
  // ERP Bug -> Bug Online 10004 -> customfield_10052
  const nowProjectKey = projectKey.toUpperCase();
  let nowIssueType = capitalizeWords(issueType);
  if (('MER' == nowProjectKey || 'FIN' == nowProjectKey || 'ERP' == nowProjectKey || 'GRM' == nowIssueType) && 'Bug' == nowIssueType) {
    nowIssueType = 'Bug Online';
  }

  const requestBody: any = {
    fields: {
      project: {
        key: nowProjectKey,
      },
      summary: summary,
      issuetype: {
        name: nowIssueType,
      },
    },
  };

  if ((('MER' == nowProjectKey || 'ERP' == nowProjectKey || 'GRM' == nowIssueType) && 'Bug Online' == nowIssueType)) {
    requestBody.fields.description = `Reporter: ${userName}\n\nSlack Thread: ${threadLink}\n\nAI generated summary: ${result.description as string}\n\n
    *Reproduce Steps*\n\n*Actual Results*\n\n*Expected Results*\n\n*Causes & Reasons*\n\n*Solutions & Scopes*\n\n `;
  } else {
    requestBody.fields.description = `Reporter: ${userName}\n\nSlack Thread: ${threadLink}\n\nAI generated summary: ${result.description as string}\n\n
    *Reproduce Steps*\n\n*Actual Results*\n\n*Expected Results*\n\n*Causes & Reasons*\n\n*Solutions & Scopes*\n\n`;
  }

  // 只有当 projectKey 为 MER 时才添加父 issue
  if ('MER' == nowProjectKey) {
    requestBody.fields.parent = {
      key: 'MER-74',
    };
  }

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

  console.log('requestBody=', requestBody);

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

