import { Command } from './command';
import { extractId, IdType } from '@/lib/utils/id-utils';
import { sendAppointmentToSlack, sendOrderToSlack } from '@/lib/database/services/appointment-slack';
import { execute_moego } from '@/lib/moego/moego';
import { generatePromptFromThread, getGPT4 } from '@/lib/ai/openai';
import { getThreadReplies, postMessage } from '@/lib/slack/gengar-bolt';
import { getUser, postgres } from '@/lib/database/supabase';
import { createIssue } from '@/lib/jira/create-issue';
import { detectFileTypeFromUrl, formatFileSize } from '@/lib/utils/file-utils';


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
    const thread = await getThreadReplies(this.channel, this.ts);
    const prompts = await generatePromptFromThread(thread);
    const gptResponse = await getGPT4(prompts);

    await postMessage(this.channel, this.ts, `${gptResponse.choices[0].message.content}`);
  }
}

export class HelpCommand implements Command {
  constructor(
    private channel: string,
    private ts: string,
  ) {
  }

  matches(text: string): boolean {
    return text.trim().toLowerCase() === 'help' || text.trim().toLowerCase() === '帮助';
  }

  async execute(text: string): Promise<void> {
    const helpText = `以下是可用的命令：

1. *帮助命令*
   • 输入 \`help\` 或 \`帮助\` 显示此帮助信息
   
2. *AI 对话*
   • 直接输入任何问题，AI 助手会为您解答

3. *预约相关*
   • 输入 \`a<appointment id>\` 查看预约详情（如 \`a123456\`）
   • 输入 \`o<order id>\` 查看订单详情（如 \`o123456\`）
   • 输入 \`create <语义化文本>\` 创建新预约（如 \`create an appointment today at 10am\`）
   
4. *CI 相关*
   • 输入 \`ci <repository> <branch>\` 订阅 CI 状态

5. *Jira 相关*
   • 输入 \`jira <projectKey> <issueType> [summary]\` 创建 Jira issue（如 \`jira MER Task 修复登录问题\`）
   * 注意：projectKey 可用 MER|ERP|CRM|FIN，issueType 可用 Task|Bug，summary 选填。

6. *文件分析*
   • 输入 \`file "链接地址"\` 分析文件格式（如 \`file "https://example.com/document.pdf"\`）
   * 功能：Detect file type and suggest possible file extensions

更新时间：2025-10-30。反馈建议：<#C08EXLMF5SQ|bot-feedback-fuel>。
`;

    await postMessage(this.channel, this.ts, helpText);
  }
}

export class CiCommand implements Command {
  constructor(
    private ts: string,
    private userId: string,
    private userName: string,
    private channel: string,
    private channelName: string,
  ) {
  }

  matches(text: string): boolean {
    const pattern = new RegExp('^ci\\s+\\S+\\s+\\S+$', 'i');
    return pattern.test(text);
  }

  async execute(text: string): Promise<void> {
    const pattern = new RegExp('^ci\\s+(\\S+)\\s+(\\S+)$', 'i');
    const match = text.match(pattern);

    if (!match) {
      throw new Error('Invalid command format');
    }

    const [_, repository, branch] = match;

    const newArr = [
      {
        repository: repository,
        branch: branch,
        channel: this.channel,
        channel_name: this.channelName,
        user_id: this.userId,
        user_name: this.userName,
        timestamp: this.ts,
      },
    ];

    try {
      await postgres.from('build_watch').insert(newArr).select();
      await postMessage(this.channel, this.ts, `:white_check_mark: 订阅成功`);
    } catch (err) {
      console.log('fetch Error:', err);
      await postMessage(this.channel, this.ts, `:x: 订阅失败`);
    }
  }
}

export class JiraCommand implements Command {
  constructor(
    private channel: string,
    private ts: string,
    private userId: string,
  ) {
  }

  matches(text: string): boolean {
    const pattern = new RegExp('^jira\\s+\\S+\\s+\\S+.*$', 'i');
    return pattern.test(text);
  }

  async execute(text: string): Promise<void> {
    let name = this.userId;
    const user = await getUser(this.userId);
    if (user) {
      name = user[0].real_name_normalized;
    }

    try {
      const issueKey = await createIssue(text, this.channel, this.ts, name);
      await postMessage(
        this.channel,
        this.ts,
        `:white_check_mark: Jira issue 创建成功！<https://moego.atlassian.net/browse/${issueKey}|${issueKey}>`,
      );
    } catch (err) {
      console.error('Jira API Error:', err);
      await postMessage(
        this.channel,
        this.ts,
        `:x: Jira issue 创建失败：${err instanceof Error ? err.message : '未知错误'}`,
      );
    }
  }
}

export class FileCommand implements Command {
  constructor(
    private channel: string,
    private ts: string,
  ) {
  }

  matches(text: string): boolean {
    const pattern = new RegExp('^file\\s+"([^"]+)"\\s*$', 'i');
    return pattern.test(text);
  }

  async execute(text: string): Promise<void> {
    const pattern = new RegExp('^file\\s+"([^"]+)"\\s*$', 'i');
    const match = text.match(pattern);
    if (!match) {
      await postMessage(this.channel, this.ts, ':x: Invalid command format. Use: `file "http://example.com/file.pdf"`');
      return;
    }

    let url = match[1];
    
    // 清理 URL：去除前后的引号和 Slack 添加的 <> 包装
    url = this.cleanUrl(url);
    console.log('Original URL from Slack:', JSON.stringify(match[1]));
    console.log('Cleaned URL:', JSON.stringify(url));
    
    // Slack 会对 URL 进行编码，需要先解码
    try {
      // 处理 Slack 的 URL 编码
      url = decodeURIComponent(url);
      console.log('Decoded URL:', JSON.stringify(url));
    } catch (decodeError) {
      console.log('URL decode failed, using cleaned URL:', decodeError);
      // 如果解码失败，使用清理后的 URL
    }

    // 验证解码后的 URL
    try {
      const urlObj = new URL(url);
      // 检查协议是否为 http 或 https
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Only HTTP and HTTPS URLs are supported');
      }
    } catch (error) {
      console.log('FileCommand execute called with text:', JSON.stringify(text));
      console.log('Pattern match result:', match);
      console.log('Final URL used:', JSON.stringify(url));
      console.error('URL validation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown URL error';
      await postMessage(this.channel, this.ts, `:x: Invalid URL format: ${errorMessage}`);
      return;
    }

    try {
      const result = await detectFileTypeFromUrl(url);
      
      let responseText = '';
      
      if (result.fileType) {
        // 如果检测到具体格式，显示扩展名
        const extensions = this.getExtensionsFromFileType(result.fileType);
        responseText = `🎯 Detected file format: **${extensions.join(', ')}**`;
      } else {
        // 基于Content-Type和URL扩展名推测格式
        const suggestions = this.getSuggestionsFromContentType(result.contentType || '');
        const urlExtension = result.urlExtension;
        
        const allSuggestions = [];
        if (suggestions.length > 0) {
          allSuggestions.push(...suggestions);
        }
        if (urlExtension && !allSuggestions.includes(urlExtension)) {
          allSuggestions.push(urlExtension);
        }
        
        if (allSuggestions.length > 0) {
          responseText = `💡 Possible file formats: **${allSuggestions.join(', ')}**`;
        } else {
          responseText = '❓ Unable to determine file format';
        }
      }

      await postMessage(this.channel, this.ts, responseText);

    } catch (error) {
      console.error('File analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await postMessage(this.channel, this.ts, `:x: File analysis failed: ${errorMessage}`);
    }
  }

  private getSuggestionsFromContentType(contentType: string): string[] {
    const suggestions: string[] = [];
    
    // 转换为小写便于匹配
    const lowerContentType = contentType.toLowerCase();
    
    // 文本类型
    if (lowerContentType.startsWith('text/')) {
      if (lowerContentType.includes('html')) suggestions.push('.html');
      else if (lowerContentType.includes('css')) suggestions.push('.css');
      else if (lowerContentType.includes('javascript')) suggestions.push('.js');
      else if (lowerContentType.includes('json')) suggestions.push('.json');
      else if (lowerContentType.includes('xml')) suggestions.push('.xml');
      else if (lowerContentType.includes('csv')) suggestions.push('.csv');
      else if (lowerContentType.includes('markdown')) suggestions.push('.md');
      else suggestions.push('.txt');
    } 
    // 图片类型
    else if (lowerContentType.startsWith('image/')) {
      if (lowerContentType.includes('jpeg') || lowerContentType.includes('jpg')) suggestions.push('.jpg');
      else if (lowerContentType.includes('png')) suggestions.push('.png');
      else if (lowerContentType.includes('gif')) suggestions.push('.gif');
      else if (lowerContentType.includes('webp')) suggestions.push('.webp');
      else if (lowerContentType.includes('svg')) suggestions.push('.svg');
      else if (lowerContentType.includes('bmp')) suggestions.push('.bmp');
      else if (lowerContentType.includes('tiff')) suggestions.push('.tiff');
      else if (lowerContentType.includes('ico')) suggestions.push('.ico');
    } 
    // 应用程序类型
    else if (lowerContentType.startsWith('application/')) {
      if (lowerContentType.includes('pdf')) suggestions.push('.pdf');
      else if (lowerContentType.includes('zip')) suggestions.push('.zip');
      else if (lowerContentType.includes('json')) suggestions.push('.json');
      else if (lowerContentType.includes('xml')) suggestions.push('.xml');
      else if (lowerContentType.includes('octet-stream')) suggestions.push('.bin');
      
      // Microsoft Office 传统格式
      else if (lowerContentType.includes('msword')) suggestions.push('.doc');
      else if (lowerContentType.includes('vnd.ms-excel')) suggestions.push('.xls');
      else if (lowerContentType.includes('vnd.ms-powerpoint')) suggestions.push('.ppt');
      
      // Microsoft Office 新格式 (OpenXML)
      else if (lowerContentType.includes('vnd.openxmlformats-officedocument.wordprocessingml.document')) suggestions.push('.docx');
      else if (lowerContentType.includes('vnd.openxmlformats-officedocument.spreadsheetml.sheet')) suggestions.push('.xlsx');
      else if (lowerContentType.includes('vnd.openxmlformats-officedocument.presentationml.presentation')) suggestions.push('.pptx');
      else if (lowerContentType.includes('vnd.openxmlformats')) suggestions.push('.docx', '.xlsx', '.pptx');
      
      // 压缩格式
      else if (lowerContentType.includes('x-rar')) suggestions.push('.rar');
      else if (lowerContentType.includes('gzip')) suggestions.push('.gz');
      else if (lowerContentType.includes('x-7z')) suggestions.push('.7z');
      else if (lowerContentType.includes('x-tar')) suggestions.push('.tar');
      
      // 其他常见格式
      else if (lowerContentType.includes('javascript')) suggestions.push('.js');
      else if (lowerContentType.includes('rtf')) suggestions.push('.rtf');
      else if (lowerContentType.includes('postscript')) suggestions.push('.ps');
    } 
    // 视频类型
    else if (lowerContentType.startsWith('video/')) {
      if (lowerContentType.includes('mp4')) suggestions.push('.mp4');
      else if (lowerContentType.includes('webm')) suggestions.push('.webm');
      else if (lowerContentType.includes('avi')) suggestions.push('.avi');
      else if (lowerContentType.includes('quicktime')) suggestions.push('.mov');
      else if (lowerContentType.includes('x-msvideo')) suggestions.push('.avi');
      else if (lowerContentType.includes('mpeg')) suggestions.push('.mpg');
      else if (lowerContentType.includes('x-flv')) suggestions.push('.flv');
      else if (lowerContentType.includes('3gpp')) suggestions.push('.3gp');
    } 
    // 音频类型
    else if (lowerContentType.startsWith('audio/')) {
      if (lowerContentType.includes('mpeg') || lowerContentType.includes('mp3')) suggestions.push('.mp3');
      else if (lowerContentType.includes('wav')) suggestions.push('.wav');
      else if (lowerContentType.includes('ogg')) suggestions.push('.ogg');
      else if (lowerContentType.includes('aac')) suggestions.push('.aac');
      else if (lowerContentType.includes('flac')) suggestions.push('.flac');
      else if (lowerContentType.includes('x-ms-wma')) suggestions.push('.wma');
    }
    
    return suggestions;
  }

  private getExtensionsFromFileType(fileType: any): string[] {
    // 基于 Go 语言映射中的多扩展名处理
    const description = fileType.description.toLowerCase();
    const extension = fileType.extension;
    
    // 根据描述和检测到的格式返回可能的扩展名
    if (description.includes('zip') && description.includes('office')) {
      return ['.zip', '.docx', '.xlsx', '.pptx', '.epub'];
    }
    if (description.includes('tiff')) {
      return ['.tif', '.tiff'];
    }
    if (description.includes('jpeg')) {
      return ['.jpg', '.jpeg'];
    }
    if (description.includes('mp4') && description.includes('mov')) {
      return ['.mp4', '.mov', '.m4v'];
    }
    if (description.includes('riff')) {
      return ['.wav', '.avi', '.webp'];
    }
    if (description.includes('xml')) {
      return ['.xml', '.svg'];
    }
    if (description.includes('html')) {
      return ['.html', '.htm'];
    }
    if (description.includes('windows pe')) {
      return ['.exe', '.dll'];
    }
    
    // 默认返回单一扩展名
    return [extension];
  }

  private cleanUrl(url: string): string {
    // 去除前后的空白字符
    url = url.trim();
    
    // 去除前后的引号 " "
    if ((url.startsWith('"') && url.endsWith('"')) || 
        (url.startsWith("'") && url.endsWith("'"))) {
      url = url.slice(1, -1);
    }
    
    // 去除前后的尖括号 < > (Slack 经常会添加这些)
    if (url.startsWith('<') && url.endsWith('>')) {
      url = url.slice(1, -1);
    }
    
    // 再次去除空白字符
    return url.trim();
  }
}
