import { Command } from './command';
import { getThreadReplies, setSuggestedPrompts, threadReply, threadReplyWithHumanMetaData } from '@/lib/slack/hr-bolt';
import { getUser, postgres } from '@/lib/database/supabase';
import { askCNQuestion } from '@/lib/ai/maxkb-cn';
import { askUSQuestion } from '@/lib/ai/maxkb-us';
import { logger } from '@/lib/utils/logger';

// const humanServiceChannel = process.env.TEST_CHANNEL as string;
const humanServiceChannel = process.env.HUMAN_SERVICE_CHANNEL as string;

export class HumanCommand implements Command {
  constructor(
    private channel: string,
    private ts: string,
    private userId: string,
  ) {
  }

  matches(text: string): boolean {
    return text.trim().toLowerCase() === '人工' || text.trim().toLowerCase() === 'human';
  }

  async execute(text: string): Promise<void> {
    let country = 'CN';
    const dbUser = await getUser(this.userId);
    if (dbUser && Array.isArray(dbUser) && dbUser.length > 0 && dbUser[0].country) {
      country = dbUser[0].country;
    }

    const isCN = country.toUpperCase().trim() == 'CN';

    try {
      if (isCN) {
        await threadReply(this.channel, this.ts, `请描述你的问题。人工客服通常会在工作时间回复。`);
      } else {
        await threadReply(this.channel, this.ts, `Please describe your question. Human service usually replies during working hours.`);
      }

    } catch (err) {
      console.log('fetch Error:', err);
      await threadReply(this.channel, this.ts, `Sending failed. Please try again.`);
    }
  }
}

function processString(answer: string): string {
  // Step 1: Replace image patterns like ![](/api/image/abc) with https://amber.baobo.me/api/image/abc
  let processed = answer.replace(/!\[]\(\/api\/image\/([^)]+)\)/g, '<https://amber.baobo.me/api/image/$1|点击查看图片>');

  // Step 2: Replace link patterns like [123](https://mengshikeji.feishu.cn/wiki/abc) with <123|https://mengshikeji.feishu.cn/wiki/abc>
  processed = processed.replace(/\[([^\]]+)]\(([^)]+)\)/g, '<$2|$1>');

  return processed;
}

function extractQuickQuestions(input: string): string[] {
  // 使用正则表达式匹配所有<quick_question>标签内的内容
  const regex = /<quick_question>(.*?)<\/quick_question>/g;
  const matches = [];
  let match;

  while ((match = regex.exec(input)) !== null) {
    // 获取匹配到的内容（即标签内的文本）
    let questionText = match[1];

    // 去除前缀数字和点以及可能的空格
    questionText = questionText.replace(/^\d+\.\s*/, '');
    matches.push(questionText);
  }

  return matches;
}

export class MaxKbCommand implements Command {
  constructor(
    private channel: string,
    private ts: string,
    private userId: string,
  ) {
  }

  matches(text: string): boolean {
    return true; // 默认命令，总是匹配
  }

  async execute(text: string): Promise<void> {
    const messages = await getThreadReplies(this.channel, this.ts);
    if (!messages || messages.length === 0) {
      throw new Error('No messages found');
    }
    const isHumanService = messages
    .map((message: any) => {
      return message.text;
    })
    .filter(text => text?.trim().toLowerCase() === '人工' || text?.trim().toLowerCase() === 'human')
      .length > 0; // Check if any messages match the criteria

    if (isHumanService) {
      const { data: record } = await postgres.from('hr_human_service')
      .select('*')
      .eq('bot_timestamp', this.ts);

      if (!record || record.length === 0) {
        const result = await threadReplyWithHumanMetaData(humanServiceChannel, '', `<!channel> <@${this.userId}> 说 ${text}`, this.ts);
        if (!result.ok) {
          throw new Error('Failed to send message');
        }

        const dbUser = await getUser(this.userId);
        if (!dbUser || dbUser.length === 0) {
          throw new Error('Failed to get user');
        }

        const ts = result.message?.ts;
        await postgres
        .from('hr_human_service')
        .insert([
          {
            user_id: this.userId as string,
            user_name: dbUser[0].real_name_normalized as string,
            bot_timestamp: this.ts as string,
            channel_timestamp: ts as string,
          },
        ]);

        return;
      }

      await threadReplyWithHumanMetaData(humanServiceChannel, record[0].channel_timestamp as string, `<!channel> <@${this.userId}> 说 ${text}`, record[0].bot_timestamp);

      return;
    }

    let country = 'CN';
    const dbUser = await getUser(this.userId);
    if (dbUser && Array.isArray(dbUser) && dbUser.length > 0 && dbUser[0].country) {
      country = dbUser[0].country;
    }

    const isCN = country.toUpperCase().trim() == 'CN';
    const answer = isCN ? await askCNQuestion(text) : await askUSQuestion(text);

    if (answer.includes('<quick_question>')) {
      try {
        await threadReply(
          this.channel,
          this.ts,
          isCN ? '没有找到相关信息，请您重新描述问题。' : 'Sorry, I cannot find the relevant information. Please describe your question again.',
        );
        await setSuggestedPrompts(
          this.channel,
          this.ts,
          extractQuickQuestions(answer),
          isCN,
        );
      } catch (error) {
        logger.error('send_gpt_response_in_channel', error instanceof Error ? error : new Error('Unknown error'));
      }
      return;
    }

    const realAnswer = processString(answer);

    // console.log('answer:', JSON.stringify(answer));
    // console.log('realAnswer:', JSON.stringify(realAnswer));

    try {
      await threadReply(
        this.channel,
        this.ts,
        `${realAnswer}`,
      );
    } catch (error) {
      logger.error('send_gpt_response_in_channel', error instanceof Error ? error : new Error('Unknown error'));
    }
  }

}
