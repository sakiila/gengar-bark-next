import { Command } from './command';
import { extractId, IdType } from '@/lib/utils/id-utils';
import { sendAppointmentToSlack, sendOrderToSlack } from '@/lib/database/services/appointment-slack';
import { execute_moego } from '@/lib/moego/moego';
import { getThreadReply } from '@/lib/slack/slack';
import { generatePromptFromThread, getGPT4 } from '@/lib/ai/openai';
import { postMessage } from '@/lib/slack/gengar-bolt';
import { postgres } from '@/lib/database/supabase';
import { createIssue } from '@/lib/jira/create-issue';

export class IdCommand implements Command {
  constructor(
    private channel: string,
    private ts: string,
    private userId: string,
  ) {
  }

  matches(text: string): boolean {
    const id = extractId(text);
    return id.type === IdType.APPOINTMENT || id.type === IdType.ORDER;
  }

  async execute(text: string): Promise<void> {
    const id = extractId(text);
    if (id.type === IdType.APPOINTMENT) {
      await sendAppointmentToSlack(parseInt(id.value), this.userId, this.channel, this.ts);
    } else if (id.type === IdType.ORDER) {
      await sendOrderToSlack(parseInt(id.value), this.userId, this.channel, this.ts);
    }
  }
}

export class CreateAppointmentCommand implements Command {
  constructor(
    private channel: string,
    private ts: string,
    private userId: string,
  ) {
  }

  matches(text: string): boolean {
    const regex = /预约|appointment|appt/i;
    return text.trim().toLowerCase().startsWith('create') && regex.test(text);
  }

  async execute(text: string): Promise<void> {
    await execute_moego(this.channel, this.ts, text, this.userId);
  }
}

export class GptCommand implements Command {
  constructor(
    private channel: string,
    private ts: string,
  ) {
  }

  matches(text: string): boolean {
    return true; // 默认命令，总是匹配
  }

  async execute(text: string): Promise<void> {
    const thread = await getThreadReply(this.channel, this.ts);
    const prompts = await generatePromptFromThread(thread);
    const gptResponse = await getGPT4(prompts);

    await postMessage(this.channel, this.ts, `${gptResponse.choices[0].message.content}`);
  }
}

export class HelpCommand implements Command {
  constructor(
    private channel: string,
    private ts: string,
  ) {
  }

  matches(text: string): boolean {
    return text.trim().toLowerCase() === 'help' || text.trim().toLowerCase() === '帮助';
  }

  async execute(text: string): Promise<void> {
    const helpText = `以下是可用的命令：

1. *帮助命令*
   • 输入 \`help\` 或 \`帮助\` 显示此帮助信息
   
2. *AI 对话*
   • 直接输入任何问题，AI 助手会为您解答

3. *预约相关*
   • 输入 \`a<appointment id>\` 查看预约详情（如 \`a123456\`）
   • 输入 \`o<order id>\` 查看订单详情（如 \`o123456\`）
   • 输入 \`create <语义化文本>\` 创建新预约（如 \`create an appointment today at 10am\`）
   
4. *CI 相关*
   • 输入 \`ci <repository> <branch>\` 订阅 CI 状态

5. *Jira 相关*
   • 输入 \`jira <projectKey> <issueType> [summary]\` 创建 Jira issue（如 \`jira MER Task 修复登录问题\`）
   * 注意：projectKey 可用 MER\ERP\CRM\FIN，issueType 可用 Task\Story\Bug，summary 选填。

更多信息请查看网站文档：https://pearl.baobo.me/guide
`;

    await postMessage(this.channel, this.ts, helpText);
  }
}

export class CiCommand implements Command {
  constructor(
    private ts: string,
    private userId: string,
    private userName: string,
    private channel: string,
    private channelName: string,
  ) {
  }

  matches(text: string): boolean {
    const pattern = new RegExp('^ci\\s+\\S+\\s+\\S+$', 'i');
    return pattern.test(text);
  }

  async execute(text: string): Promise<void> {
    const pattern = new RegExp('^ci\\s+(\\S+)\\s+(\\S+)$', 'i');
    const match = text.match(pattern);

    if (!match) {
      throw new Error('Invalid command format');
    }

    const [_, repository, branch] = match;

    const newArr = [
      {
        repository: repository,
        branch: branch,
        channel: this.channel,
        channel_name: this.channelName,
        user_id: this.userId,
        user_name: this.userName,
        timestamp: this.ts,
      },
    ];

    try {
      await postgres.from('build_watch').insert(newArr).select();
      await postMessage(this.channel, this.ts, `:white_check_mark: 订阅成功`);
    } catch (err) {
      console.log('fetch Error:', err);
      await postMessage(this.channel, this.ts, `:x: 订阅失败`);
    }
  }
}

export class JiraCommand implements Command {
  constructor(
    private channel: string,
    private ts: string,
    private userId: string,
    private userName: string,
  ) {
  }

  matches(text: string): boolean {
    const pattern = new RegExp('^jira\\s+\\S+\\s+\\S+.*$', 'i');
    return pattern.test(text);
  }

  async execute(text: string): Promise<void> {
    try {
      const issueKey = await createIssue(text, this.channel, this.ts, this.userName);
      await postMessage(
        this.channel,
        this.ts,
        `:white_check_mark: Jira issue 创建成功！\n链接：https://moego.atlassian.net/browse/${issueKey}`,
      );
    } catch (err) {
      console.error('Jira API Error:', err);
      await postMessage(
        this.channel,
        this.ts,
        `:x: 创建 Jira issue 失败：${err instanceof Error ? err.message : '未知错误'}`,
      );
    }
  }
}
