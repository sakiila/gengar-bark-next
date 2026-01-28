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

export async function getGPT(messages: ChatCompletionMessageParam[]) {
  return openai.chat.completions.create({
    model: 'gpt-5-chat-latest',
    messages,
  });
}

export async function getGPTmini(messages: ChatCompletionMessageParam[]) {
  return openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages,
  });
}

export async function translateToChinese(text: string) {
  return openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a translator. Your job is to translate text to Chinese.',
      },
      {
        role: 'user',
        content: text,
      },
    ],
  }).then(res => res.choices[0].message.content);
}

export async function getThird(messages: ChatCompletionMessageParam[]) {
  const params = {
    messages: messages,
    model: 'gpt-5-mini',
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

export function cleanText(text: string) {
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

export async function generateJiraDescriptionFromThread(messages: any): Promise<string> {
  const assistantBackground: ChatCompletionMessageParam = {
    role: 'system',
    content: `You are a technical writer. Analyze the conversation and generate a Jira ticket description using the following template. Fill in each section based on the conversation content. Keep descriptions simple and clear. Use English only. If information for a section is not mentioned in the conversation, leave that section empty (just the bold title with no content).

Template:
**Root Cause**
Explain what caused the issue, in simple terms. If cannot find the root cause, explain what we have tried.

**Issue Status**
Confirm that the issue/incorrect data has been fixed. If not, provide alternative methods to resolve the issue.

**Root Cause Status**
Confirm whether we fully fixed the root cause. If not, explain our plan to fix the root cause.

**Scope of The Fix**
Explain whether the issue/data has been fixed on all accounts or only certain accounts.

**User Action Required**
What does the user need to do to resolve the issue (e.g., refreshing the page, changing the setting, manually editing the appt). If the issue is not reproducible, ask the user to collect evidence.

**Solution**
What we did to fix the issue.

**Activity log**
Post the activity log, if required.

Return ONLY the filled template as plain text. Do not add any extra text or formatting outside the template.`,
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

  const prompts = [assistantBackground, ...result] as ChatCompletionMessageParam[];
  const gptResponse = await getGPT(prompts);
  return gptResponse.choices[0].message.content || '';
}

export async function generateJiraDescriptionFromText(text: string): Promise<string> {
  const prompts: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are a technical writer. Analyze the input and generate a Jira ticket description using the following template. Fill in each section based on the content. Keep descriptions simple and clear. Use English only. If information for a section is not available, leave that section empty (just the bold title with no content).

Template:
**Root Cause**
Explain what caused the issue, in simple terms. If cannot find the root cause, explain what we have tried.

**Issue Status**
Confirm that the issue/incorrect data has been fixed. If not, provide alternative methods to resolve the issue.

**Root Cause Status**
Confirm whether we fully fixed the root cause. If not, explain our plan to fix the root cause.

**Scope of The Fix**
Explain whether the issue/data has been fixed on all accounts or only certain accounts.

**User Action Required**
What does the user need to do to resolve the issue (e.g., refreshing the page, changing the setting, manually editing the appt). If the issue is not reproducible, ask the user to collect evidence.

**Solution**
What we did to fix the issue.

**Activity log**
Post the activity log, if required.

Return ONLY the filled template as plain text. Do not add any extra text or formatting outside the template.`,
    },
    {
      role: 'user',
      content: cleanText(text),
    },
  ];

  const gptResponse = await getGPT(prompts);
  return gptResponse.choices[0].message.content || '';
}
