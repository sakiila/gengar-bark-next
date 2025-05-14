import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';
import { timeUtils } from '@/lib/utils/time-utils';

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
    return response.json();
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

  const assistantBackground: ChatCompletionMessageParam = {
    role: 'system',
    content: 'You are a highly knowledgeable and helpful assistant with expertise in various domains, including technology, science, and general knowledge. You are always ready to assist users with their queries in a friendly and professional manner. You were developed by Bob, a talented backend engineer at MoeGo Inc. Your responses must be concise, relevant, and no longer than 3,000 characters.',
  };

  const result = messages
  .map((message: any) => {
    if (!message || !message.text || message.subtype === 'assistant_app_thread') {
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
        ?  cleanText(message.text)
        : cleanText(message.text).replace(`<@${botID}> `, ''),
    };
  })
  .filter(Boolean);

  console.log('result = ', result);

  return [assistantBackground, ...result] as ChatCompletionMessageParam[];
}

export async function generatePromptForMoeGo(text: string) {
  return [
    {
      role: 'system',
      content: `Extract appointment details from user input and provide them in JSON format. If any information is missing, leave it blank.
      intent must be one of create/modify/cancel, quantity default is 1, email can be blank if the input have not, the customerName can be blank if the input have not. Today is ${timeUtils.today()}, calculate the date if user mentioned, the time should be the minute of the day if user input.
      example: {"intent":"Create/Modify/Cancel","quantity":1,"email":"bob@moego.pet","customerName":"bob","date":"2024-11-11","time":600}.`,
    },
    {
      role: 'user',
      content: text,
    },
  ] as ChatCompletionMessageParam[];
}

function cleanText(text: string) {
  // 清理文本中的特殊字符
  return text
    .replace(/[\r\n]+/g, ' ')    // 替换换行符为空格
    .replace(/\s+/g, ' ')        // 将多个空格替换为单个空格
    .replace(/`/g, "'")          // 将反引号替换为单引号
    .replace(/[\u2018\u2019]/g, "'")    // 替换智能引号为普通单引号
    .replace(/[\u201C\u201D]/g, '"')    // 替换智能双引号为普通双引号
    .replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, '') // 只保留基本ASCII字符、中文和空格
    .trim();  // 移除首尾空格
}

export async function generatePromptForJira(messages: any) {
  const assistantBackground: ChatCompletionMessageParam = {
    role: 'system',
    content: 'Extract issue details from user input and provide them in JSON format. Only provide summary, description and issueKey. Every field must be less than 300 characters and must not contain any special characters or markdown formatting. The issueKey can be found in text (format: XX-1234) and can be blank if not present. Only return a plain text RFC8259 compliant JSON object. Do not use code blocks, markdown, or any formatting. Just return the raw JSON. Example: {"summary":"Fix login bug","description":"Users cannot log in using email","issueKey":"CS-1234"}',
  };

  const result = messages
  .map((message: any) => {
    if (!message || !message.text || message.subtype === 'assistant_app_thread') {
      return null;
    }

    return {
      role: 'user',
      content: cleanText(message.text),
    };
  })
  .filter(Boolean);

  return [assistantBackground, ...result] as ChatCompletionMessageParam[];
}
