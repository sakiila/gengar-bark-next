import axios from 'axios';

interface Message {
  role: string;
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: Message[];
}

interface ChatCompletionResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export class MaxKBClient {
  private static instance: MaxKBClient;
  private baseURL: string;
  private apiKey: string;

  private constructor() {
    this.baseURL = process.env.MAXKB_BASE_URL || '';
    this.apiKey = process.env.MAXKB_API_KEY || '';

    if (!this.baseURL || !this.apiKey) {
      throw new Error('MaxKB 配置缺失，请检查环境变量设置');
    }
  }

  public static getInstance(): MaxKBClient {
    if (!MaxKBClient.instance) {
      MaxKBClient.instance = new MaxKBClient();
    }
    return MaxKBClient.instance;
  }

  async createChatCompletion(messages: Message[]): Promise<string> {
    try {
      const url = `${this.baseURL}/chat/completions`;

      const requestData: ChatCompletionRequest = {
        model: 'gpt-4o-mini',
        messages: messages,
      };

      const response = await axios.post<ChatCompletionResponse>(url, requestData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`MaxKB API 调用失败: ${error.message}`);
      }
      throw error;
    }
  }

  static createSystemMessage(): Message {
    return {
      role: 'system',
      content: '你是 MoeGo 萌时公司旗下知识库问答系统的智能小助手，你的工作是帮助用户解答使用中遇到的问题，用户找你回答问题时，你要把主题放在知识库问答系统身上。使用提问者的语言回答问题。回答字数不可以超过 500 字。',
    };
  }
}

// 导出一个便捷的问答函数
export async function askQuestion(question: string): Promise<string> {
  try {
    const maxkb = MaxKBClient.getInstance();
    const messages = [
      MaxKBClient.createSystemMessage(),
      { role: 'user', content: question }
    ];
    
    return await maxkb.createChatCompletion(messages);
  } catch (error) {
    console.error('MaxKB 调用出错:', error);
    throw error;
  }
}

// 使用示例：
/*
import { askQuestion } from './maxkb';

// 方式一：使用 async/await
async function example1() {
  try {
    const answer = await askQuestion('知识库系统是什么？');
    console.log('回答:', answer);
  } catch (error) {
    console.error('错误:', error);
  }
}

// 方式二：使用 Promise
askQuestion('知识库系统是什么？')
  .then(answer => console.log('回答:', answer))
  .catch(error => console.error('错误:', error));
*/
