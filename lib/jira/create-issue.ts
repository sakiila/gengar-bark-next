import { generatePromptForJira, getGPT } from '@/lib/ai/openai';
import { capitalizeWords } from '@/lib/utils/string-utils';
import { getThreadReplies } from '@/lib/slack/gengar-bolt';

async function aiSummary(channel: string, ts: string) {
  const thread = await getThreadReplies(channel, ts);
  const prompts = await generatePromptForJira(thread);
  console.log('prompts: ', prompts);
  const gptResponse = await getGPT(prompts);
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

/**
 * 根据邮箱查询 Jira 用户的 account ID
 * @param email 用户邮箱
 * @returns account ID，如果未找到则返回 null
 */
async function getUserAccountIdByEmail(email: string): Promise<string | null> {
  try {
    // Jira API 文档: https://developer.atlassian.com/cloud/jira/platform/rest/v2/api-group-user-search/#api-rest-api-2-user-search-get
    const response = await fetch(`https://moego.atlassian.net/rest/api/2/user/search?query=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64')}`,
      },
    });

    if (!response.ok) {
      console.error(`查询 Jira 用户失败: ${response.status} ${response.statusText}`);
      return null;
    }

    const users = await response.json();

    // 查找完全匹配邮箱的用户
    const matchedUser = users.find((user: any) => user.emailAddress?.toLowerCase() === email.toLowerCase());

    if (matchedUser && matchedUser.accountId) {
      console.log(`找到用户 ${email} 的 account ID: ${matchedUser.accountId}`);
      return matchedUser.accountId;
    }

    console.warn(`未找到邮箱为 ${email} 的 Jira 用户`);
    return null;
  } catch (error) {
    console.error('查询 Jira 用户时发生错误:', error);
    return null;
  }
}

/**
 * 根据 issue key 获取 issue 的 Priority 字段
 * @param issueKey issue key (如 MER-123)
 * @returns Priority 对象，如果未找到或发生错误则返回 null
 */
async function getIssuePriority(issueKey: string): Promise<{ id: string; name: string } | null> {
  try {
    // Jira API 文档: https://developer.atlassian.com/cloud/jira/platform/rest/v2/api-group-issues/#api-rest-api-2-issue-issueidorkey-get
    const response = await fetch(`https://moego.atlassian.net/rest/api/2/issue/${issueKey}?fields=priority`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64')}`,
      },
    });

    if (!response.ok) {
      console.error(`查询 Jira issue ${issueKey} 失败: ${response.status} ${response.statusText}`);
      return null;
    }

    const issue = await response.json();

    if (issue.fields?.priority) {
      console.log(`找到 issue ${issueKey} 的 Priority: ${issue.fields.priority.name} (ID: ${issue.fields.priority.id})`);
      return {
        id: issue.fields.priority.id,
        name: issue.fields.priority.name,
      };
    }

    console.warn(`Issue ${issueKey} 没有 Priority 字段`);
    return null;
  } catch (error) {
    console.error(`查询 issue ${issueKey} 的 Priority 时发生错误:`, error);
    return null;
  }
}

export async function createIssue(text: string, channel: string, ts: string, userName: string, email?: string) {
  // 如果提供了邮箱，查询对应的 Jira account ID
  let reporterAccountId: string | null = null;
  if (email) {
    reporterAccountId = await getUserAccountIdByEmail(email);
  }

  const pattern = new RegExp('^jira\\s+(\\S+)\\s+(\\S+)(?:\\s+(.+))?$', 'i');
  const match = text.match(pattern);

  if (!match) {
    throw new Error('命令格式错误，请使用: jira <projectKey> <issueType> [summary] 或 jira <issueType> <projectKey> [summary]');
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

  // 如果存在关联的 CS 单，获取其 Priority 字段
  let csIssuePriority: { id: string; name: string } | null = null;
  if (result.issueKey && /^[A-Z]+-\d+$/i.test(result.issueKey)) {
    csIssuePriority = await getIssuePriority(result.issueKey.toUpperCase());
  }

  let [_, param1, param2, summary = result.summary as string] = match;

  // 智能识别 projectKey 和 issueType
  // projectKey 通常是全大写的缩写（如 FIN、MER、ERP、CRM、GRM、ENT）
  const knownProjectKeys = ['MER', 'CRM', 'FIN', 'ERP', 'GRM', 'ENT'];

  let projectKey: string;
  let issueType: string;

  // 判断 projectKey 在哪个位置
  if (knownProjectKeys.includes(param2.toUpperCase())) {
    // param2 是 projectKey，交换顺序
    projectKey = param2;
    issueType = param1;
  } else {
    // 默认 param1 是 projectKey
    projectKey = param1;
    issueType = param2;
  }

  console.log(`解析结果: projectKey=${projectKey}, issueType=${issueType}`);

  // 较正
  // MER Bug -> Bug Online 10004 -> customfield_10052
  // CRM Bug -> Bug 10045 ->  description
  // FIN Bug -> Bug Online 10004 -> description
  // ERP Bug -> Bug Online 10004 -> customfield_10052
  // GRM Bug -> Bug Online 10004 -> description
  // ENT Bug -> Bug 10045 ->  description
  const nowProjectKey = projectKey.toUpperCase();
  let nowIssueType = capitalizeWords(issueType);
  if (('MER' == nowProjectKey || 'FIN' == nowProjectKey || 'ERP' == nowProjectKey || 'GRM' == nowProjectKey) && 'Bug' == nowIssueType) {
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

  // 如果查询到了 reporter 的 account ID，则设置 reporter 字段
  if (reporterAccountId) {
    requestBody.fields.reporter = {
      id: reporterAccountId,
    };
  }

  // 如果关联的 CS 单有 Priority 字段，则在新创建的单也使用这个字段的值
  if (csIssuePriority) {
    requestBody.fields.priority = {
      id: csIssuePriority.id,
    };
  }

  if ((('MER' == nowProjectKey || 'ERP' == nowProjectKey || 'GRM' == nowProjectKey) && 'Bug Online' == nowIssueType)) {
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

  // 只有当 issueKey 存在且格式正确时才添加关联
  if (result.issueKey && /^[A-Z]+-\d+$/i.test(result.issueKey)) {
    requestBody.update = {
      issuelinks: [
        {
          add: {
            type: {
              name: 'Relates',
            },
            outwardIssue: {
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
    throw new Error(`${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.key;
}

