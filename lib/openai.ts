import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';

// https://github.com/vercel/examples/blob/main/solutions/slackbot/api/events.ts
const openai = new OpenAI({
  baseURL: process.env.OPENAI_API_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getDALLEResponse3(prompt: string) {
  return openai.images.generate({
    model: 'dall-e-3',
    prompt: prompt.trim(),
    n: 1,
    size: '1024x1024',
  });
}

export async function getGPTResponse4(messages: ChatCompletionMessageParam[]) {
  return openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
  });
}

export async function getGPTResponse3(messages: ChatCompletionMessageParam[]) {
  return openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages,
  });
}

export async function generatePromptFromThread(messages: any) {
  console.log('messages = ', messages);
  if (!messages || messages.length === 0) {
    throw new Error('No messages found');
  }

  const botID = 'U0666R94C83';

  const result = messages
    .map((message: any) => {
      if (!message || !message.text) {
        return null;
      }
      const isBot = !!message.bot_id && !message.client_msg_id;
      const isNotMentioned = !isBot && !message.text.startsWith(`<@`);
      if (isNotMentioned) {
        return null;
      }

      return {
        role: isBot ? 'assistant' : 'user',
        content: isBot
          ? message.text
          : message.text.replace(`<@${botID}> `, ''),
      };
    })
    .filter(Boolean);

  console.log('result = ', result);

  return result as ChatCompletionMessageParam[];
}
