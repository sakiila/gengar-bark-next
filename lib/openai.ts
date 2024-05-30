import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';

const openai = new OpenAI({
  baseURL: process.env.OPENAI_API_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getGPTResponse(messages: ChatCompletionMessageParam[]) {
  return openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
  });
}

export async function generatePromptFromThread({ messages }: any) {
  if (!messages) throw new Error('No messages found in thread');
  const botID = messages[0].reply_users?.[0];

  const result = messages
    .map((message: any) => {
      const isBot = !!message.bot_id && !message.client_msg_id;
      const isNotMentioned = !isBot && !message.text.startsWith(`<@`);
      if (isNotMentioned) return null;

      return {
        role: isBot ? 'assistant' : 'user',
        content: isBot
          ? message.text
          : message.text.replace(`<@${botID}> `, ''),
      };
    })
    .filter(Boolean);

  return result as ChatCompletionMessageParam[];
}
