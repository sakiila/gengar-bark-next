import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { timeUtils } from '@/lib/utils/time-utils';

// 初始化 Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// 获取不同的模型实例
function getModel(modelName: string = 'gemini-1.5-flash'): GenerativeModel {
  return genAI.getGenerativeModel({ model: modelName });
}

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: string;
}

export async function getGeminiResponse(prompt: string, modelName?: string) {
  const model = getModel(modelName);
  
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

export async function getGeminiChat(messages: GeminiMessage[], modelName?: string) {
  const model = getModel(modelName);
  
  try {
    // 转换消息格式为 Gemini 格式
    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role,
      parts: [{ text: msg.parts }],
    }));
    
    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1];
    
    const result = await chat.sendMessage(lastMessage.parts);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini Chat API error:', error);
    throw error;
  }
}

export async function translateToChineseWithGemini(text: string) {
  const prompt = `请将以下文本翻译成中文，只返回翻译结果，不要添加任何解释：\n\n${text}`;
  
  try {
    return await getGeminiResponse(prompt);
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}

export async function generatePromptFromThreadForGemini(messages: any): Promise<GeminiMessage[]> {
  console.log('messages = ', messages);
  if (!messages || messages.length === 0) {
    throw new Error('No messages found');
  }

  const botID = 'U0666R94C83';

  const systemMessage: GeminiMessage = {
    role: 'model',
    parts: 'You are a highly knowledgeable and helpful assistant with expertise in various domains, including technology, science, and general knowledge. You are always ready to assist users with their queries in a friendly and professional manner. You were developed by Bob, a talented backend engineer at MoeGo Inc. Your responses must be concise, relevant, and no longer than 3,000 characters.',
  };

  const result = messages
    .map((message: any) => {
      if (!message || !message.text || message.subtype === 'assistant_app_thread') {
        return null;
      }
      const isBot = !!message.bot_id && !message.client_msg_id;

      return {
        role: isBot ? 'model' : 'user',
        parts: isBot
          ? cleanText(message.text)
          : cleanText(message.text).replace(`<@${botID}> `, ''),
      } as GeminiMessage;
    })
    .filter(Boolean);

  console.log('result = ', result);

  return [systemMessage, ...result];
}

export async function generatePromptForMoeGoWithGemini(text: string): Promise<GeminiMessage[]> {
  return [
    {
      role: 'model',
      parts: `Extract appointment details from user input and provide them in JSON format. If any information is missing, leave it blank.
      intent must be one of create/modify/cancel, quantity default is 1, email can be blank if the input have not, the customerName can be blank if the input have not. Today is ${timeUtils.today()}, calculate the date if user mentioned, the time should be the minute of the day if user input.
      example: {"intent":"Create/Modify/Cancel","quantity":1,"email":"bob@moego.pet","customerName":"bob","date":"2024-11-11","time":600}.`,
    },
    {
      role: 'user',
      parts: text,
    },
  ];
}

export async function generatePromptForJiraWithGemini(messages: any): Promise<GeminiMessage[]> {
  const systemMessage: GeminiMessage = {
    role: 'model',
    parts: 'Extract issue details from user input and provide them in JSON format. Only provide summary, description and issueKey. Every field must be less than 300 characters and must not contain any special characters or markdown formatting. The issueKey can be found in text (format: XX-1234) and can be blank if not present. Only return a plain text RFC8259 compliant JSON object. Do not use code blocks, markdown, or any formatting. Just return the raw JSON. Example: {"summary":"Fix login bug","description":"Users cannot log in using email","issueKey":"CS-1234"}',
  };

  const result = messages
    .map((message: any) => {
      if (!message || !message.text || message.subtype === 'assistant_app_thread') {
        return null;
      }

      return {
        role: 'user',
        parts: cleanText(message.text),
      } as GeminiMessage;
    })
    .filter(Boolean);

  return [systemMessage, ...result];
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

// 流式响应支持
export async function getGeminiStreamResponse(prompt: string, modelName?: string) {
  const model = getModel(modelName);
  
  try {
    const result = await model.generateContentStream(prompt);
    return result.stream;
  } catch (error) {
    console.error('Gemini Stream API error:', error);
    throw error;
  }
}

// 多模态支持（文本+图片）
export async function getGeminiMultimodalResponse(
  textPrompt: string, 
  imageData: string, 
  mimeType: string = 'image/jpeg',
  modelName: string = 'gemini-1.5-flash'
) {
  const model = getModel(modelName);
  
  try {
    const result = await model.generateContent([
      textPrompt,
      {
        inlineData: {
          data: imageData,
          mimeType: mimeType,
        },
      },
    ]);
    
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini Multimodal API error:', error);
    throw error;
  }
}