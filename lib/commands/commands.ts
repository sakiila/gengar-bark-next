import { Command } from './command';
import { IdType, extractId } from '@/lib/utils/id-utils';
import { sendAppointmentToSlack, sendOrderToSlack } from '@/lib/database/services/appointment-slack';
import { execute_moego } from '@/lib/moego/moego';
import { getThreadReply, threadReply } from '@/lib/slack/slack';
import { generatePromptFromThread, getGPT4 } from '@/lib/ai/openai';
import { postMessage } from '@/lib/slack/gengar-bolt';

export class IdCommand implements Command {
  constructor(
    private channel: string,
    private ts: string,
    private userId: string,
  ) {}

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
  ) {}

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
  ) {}

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
  ) {}

  matches(text: string): boolean {
    return text.trim().toLowerCase() === 'help' || text.trim().toLowerCase() === '帮助';
  }

  async execute(text: string): Promise<void> {
    const helpText = `以下是可用的命令：

1. *帮助命令*
   • 输入 \`help\` 或 \`帮助\` 显示此帮助信息

2. *预约相关*
   • 输入预约号码（如 \`a123456\`）查看预约详情
   • 输入订单号码（如 \`o123456\`）查看订单详情
   • 输入 \`create appointment\` 或 \`create 预约\` 创建新预约

3. *AI 对话*
   • 直接输入任何问题，AI 助手会为您解答`;

    await postMessage(this.channel, this.ts, helpText);
  }
}
