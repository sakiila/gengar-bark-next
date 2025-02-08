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

    let response = `${gptResponse.choices[0].message.content}`;
    await postMessage(this.channel, this.ts, response);
  }
}
