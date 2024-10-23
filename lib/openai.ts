import 'dotenv/config';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';

// https://github.com/vercel/examples/blob/main/solutions/slackbot/api/events.ts
const openai = new OpenAI({
  baseURL: process.env.OPENAI_API_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getDALLE3(prompt: string) {
  return openai.images.generate({
    model: 'dall-e-3',
    prompt: prompt.trim(),
    n: 1,
    size: '1024x1024',
  });
}

export async function getGPT4(messages: ChatCompletionMessageParam[]) {
  return openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
  });
}

export async function getGPT4mini(messages: ChatCompletionMessageParam[]) {
  return openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
  });
}

export async function getThird(messages: ChatCompletionMessageParam[]) {
  const params = {
    messages: messages,
    model: 'gpt-4o-mini',
  };

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  };

  try {
    const response = await fetch(`${process.env.OPENAI_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(params),
    });
    return response.json()
    // return res['choices'][0]['message']['content']
  } catch (err) {
    console.log(err);
  }
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
      // const isNotMentioned = !isBot && !message.text.startsWith(`<@`);
      // if (isNotMentioned) {
      //   return null;
      // }

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
