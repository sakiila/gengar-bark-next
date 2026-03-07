/**
 * GitHub Issue 创建核心模块
 *
 * 支持从 Slack 命令或 AI Agent 触发，通过 GitHub REST API 创建 issue。
 * 复用 Upstash Redis 缓存仓库列表，使用 GPT 从 Slack 线程生成 issue 摘要。
 */

import axios, { AxiosError } from 'axios';
import { ChatCompletionMessageParam } from 'openai/resources';
import { getGPT, cleanText } from '@/lib/ai/openai';
import { getThreadReplies } from '@/lib/slack/gengar-bolt';
import { getCache, setCacheEx } from '@/lib/upstash/upstash';

const GITHUB_API_BASE = 'https://api.github.com';
const JIRA_BASE_URL = 'https://moego.atlassian.net/browse';
const REDIS_REPOS_KEY = 'github:repos';
const REDIS_REPOS_TTL = 600; // 10 分钟
const REDIS_TEMPLATES_TTL = 600; // 模板缓存 10 分钟

/** 推荐的 Angular commit 风格 label 列表（仅供参考，不作为严格校验） */
export const SUGGESTED_LABELS = ['bug', 'feat', 'fix', 'ci', 'perf', 'docs', 'style', 'refactor', 'test', 'chore'] as const;

/** 仓库解析结果 */
export interface ResolvedRepo {
  owner: string;
  repo: string;
}

/** GitHub Issue 创建参数 */
export interface CreateGitHubIssueParams {
  repoName: string;
  label?: string;
  title?: string;
  description?: string;
  channel: string;
  threadTs: string;
  userName: string;
  jiraTickets?: string[];
}

/** GitHub Issue 创建结果 */
export interface GitHubIssueResult {
  success: boolean;
  issueUrl?: string;
  issueNumber?: number;
  error?: string;
}

/** 缓存的仓库列表条目 */
interface CachedRepo {
  owner: string;
  repo: string;
  fullName: string;
}

/**
 * 判断一个 token 是否应被视为 label。
 * 启发式规则：仅包含 ASCII 字母、数字和连字符的单词视为 label。
 * 含有中文或其他非 ASCII 字符的 token 视为 title 的开始。
 */
function isLabelToken(token: string): boolean {
  return /^[a-zA-Z0-9\-]+$/.test(token);
}

/**
 * 解析命令文本，提取 repo、label、title 和 jiraTickets。
 * 格式：gh/github <repo> [label] [title] [JIRA-123 ...]
 * 启发式规则：repo 之后的第一个参数如果仅含 ASCII 字母/数字/连字符，则视为 label；
 * 否则整体视为 title。label 不限于推荐列表，任何符合规则的单词都可作为 label。
 * 同时从整个命令文本中提取所有匹配 /[A-Z]+-\d+/g 格式的 Jira ticket 号。
 */
export function parseGitHubCommand(text: string): { repo: string; label?: string; title?: string; jiraTickets?: string[] } | null {
  const match = text.match(/^(?:gh|github)\s+(.+)$/i);
  if (!match) return null;

  const rest = match[1].trim();
  if (!rest) return null;

  // 提取所有 Jira ticket 号（格式：大写字母+短横线+数字）
  const jiraRegex = /[A-Z]+-\d+/g;
  const jiraTickets = rest.match(jiraRegex) || [];

  // 移除 Jira ticket 号后的剩余文本（用于解析 repo/label/title）
  const restWithoutTickets = rest.replace(jiraRegex, '').replace(/\s+/g, ' ').trim();

  const tokens = restWithoutTickets.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const repo = tokens[0];
  const result: { repo: string; label?: string; title?: string; jiraTickets?: string[] } = { repo };

  if (jiraTickets.length > 0) {
    result.jiraTickets = jiraTickets;
  }

  if (tokens.length === 1) {
    return result;
  }

  // 第二个 token：如果是纯 ASCII 单词，视为 label
  if (isLabelToken(tokens[1])) {
    result.label = tokens[1];
    if (tokens.length > 2) {
      result.title = tokens.slice(2).join(' ');
    }
  } else {
    // 非 ASCII token，整体视为 title
    result.title = tokens.slice(1).join(' ');
  }

  return result;
}

/**
 * 解析仓库名为 owner/repo。
 * 使用 GITHUB_PAT 调用 GET /user/repos 获取可访问仓库列表，
 * 结果缓存到 Redis（key: "github:repos"，TTL: 600s）。
 * 精确匹配优先，否则模糊匹配（包含关系）。
 */
export async function resolveRepo(repoName: string): Promise<ResolvedRepo> {
  const pat = process.env.GITHUB_PAT;
  if (!pat) {
    throw new Error('GITHUB_PAT 环境变量未配置');
  }

  let repos: CachedRepo[] = [];

  // 尝试从 Redis 缓存读取
  try {
    const cached = await getCache(REDIS_REPOS_KEY);
    if (cached) {
      repos = JSON.parse(cached) as CachedRepo[];
    }
  } catch (err) {
    console.warn('Redis 缓存读取失败，降级为直接调用 API:', err);
  }

  // 缓存未命中，调用 GitHub API
  if (repos.length === 0) {
    const response = await axios.get(`${GITHUB_API_BASE}/user/repos`, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'GengarBark-Bot',
      },
      params: { per_page: 100, sort: 'updated' },
    });

    repos = (response.data as Array<{ full_name: string; name: string; owner: { login: string } }>).map(r => ({
      owner: r.owner.login,
      repo: r.name,
      fullName: r.full_name,
    }));

    // 写入缓存（失败时静默降级）
    try {
      await setCacheEx(REDIS_REPOS_KEY, JSON.stringify(repos), REDIS_REPOS_TTL);
    } catch (err) {
      console.warn('Redis 缓存写入失败:', err);
    }
  }

  // 精确匹配
  const exact = repos.find(r => r.repo.toLowerCase() === repoName.toLowerCase());
  if (exact) {
    return { owner: exact.owner, repo: exact.repo };
  }

  // 模糊匹配（包含关系）
  const fuzzy = repos.find(r =>
    r.repo.toLowerCase().includes(repoName.toLowerCase()) ||
    repoName.toLowerCase().includes(r.repo.toLowerCase())
  );
  if (fuzzy) {
    return { owner: fuzzy.owner, repo: fuzzy.repo };
  }

  throw new Error(`未找到匹配的仓库: ${repoName}`);
}

/**
 * 从 Slack 线程生成 issue 的 title、description，并自动识别 Jira ticket 号。
 * 调用 GPT 模型，超时 6 秒后返回空值。
 */
export async function aiSummaryForGitHub(channel: string, ts: string): Promise<{ summary: string; description: string; jiraTickets: string[] }> {
  const empty = { summary: '', description: '', jiraTickets: [] as string[] };

  try {
    const timeoutPromise = new Promise<typeof empty>((resolve) => {
      setTimeout(() => resolve(empty), 6000);
    });

    const summaryPromise = (async () => {
      const thread = await getThreadReplies(channel, ts);

      const systemPrompt: ChatCompletionMessageParam = {
        role: 'system',
        content: 'Extract issue details from the Slack thread and provide them in JSON format. Return summary (issue title), description (issue body), and jiraTickets (array of Jira ticket numbers found in the thread, format: XX-1234, e.g. ["MER-123", "CRM-456"]). Every field must be less than 500 characters. Only return a plain text RFC8259 compliant JSON object. Do not use code blocks, markdown, or any formatting. Example: {"summary":"Fix login bug","description":"Users cannot log in using email","jiraTickets":["MER-123"]}',
      };

      const messages = Array.isArray(thread) ? thread : [];
      const userMessages: ChatCompletionMessageParam[] = messages
        .filter((m: any) => m && m.text && m.subtype !== 'assistant_app_thread')
        .map((m: any) => ({ role: 'user' as const, content: cleanText(m.text) }));

      const prompts: ChatCompletionMessageParam[] = [systemPrompt, ...userMessages];
      const gptResponse = await getGPT(prompts);
      const content = gptResponse.choices[0].message.content as string;

      try {
        const parsed = JSON.parse(content);
        return {
          summary: parsed.summary || '',
          description: parsed.description || '',
          jiraTickets: Array.isArray(parsed.jiraTickets) ? parsed.jiraTickets : [],
        };
      } catch {
        return empty;
      }
    })();

    return await Promise.race([summaryPromise, timeoutPromise]);
  } catch (err) {
    console.error('aiSummaryForGitHub 失败:', err);
    return empty;
  }
}

// ─── Issue Template 支持 ──────────────────────────────────────────────────────

/** 解析后的 issue 模板 */
export interface IssueTemplate {
  /** 模板文件名 */
  fileName: string;
  /** 模板名称（YAML front matter 中的 name） */
  name: string;
  /** 模板简介（YAML front matter 中的 about） */
  about: string;
  /** 模板关联的 labels */
  labels: string[];
  /** 模板默认 title */
  defaultTitle: string;
  /** 模板 markdown body（YAML front matter 之后的内容） */
  body: string;
}

/** 构建 body 所需的上下文数据 */
interface BodyContext {
  userName: string;
  threadLink: string;
  description: string;
  jiraTickets: string[];
}

/**
 * 解析 issue 模板文件内容，提取 YAML front matter 和 markdown body。
 */
function parseTemplateContent(raw: string): Omit<IssueTemplate, 'fileName'> | null {
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!fmMatch) return null;

  const frontMatter = fmMatch[1];
  const body = fmMatch[2].trim();

  // 简易 YAML 解析（模板 front matter 结构简单，无需引入完整 YAML 库）
  const getField = (key: string): string => {
    const m = frontMatter.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
    return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : '';
  };

  const labelsRaw = getField('labels');
  let labels: string[] = [];
  if (labelsRaw.startsWith('[')) {
    // 数组格式: [bug, needs-triage]
    labels = labelsRaw.replace(/[\[\]]/g, '').split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  } else if (labelsRaw) {
    labels = [labelsRaw];
  }

  return {
    name: getField('name'),
    about: getField('about'),
    labels,
    defaultTitle: getField('title'),
    body,
  };
}

/**
 * 获取仓库的 issue 模板列表。
 * 通过 GitHub Contents API 读取 .github/ISSUE_TEMPLATE/ 目录，
 * 结果缓存到 Redis（key: github:templates:{owner}/{repo}，TTL: 600s）。
 * 失败时静默降级返回空数组。
 */
export async function fetchIssueTemplates(owner: string, repo: string): Promise<IssueTemplate[]> {
  const pat = process.env.GITHUB_PAT;
  if (!pat) return [];

  const cacheKey = `github:templates:${owner}/${repo}`;

  // 尝试从 Redis 缓存读取
  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      return JSON.parse(cached) as IssueTemplate[];
    }
  } catch {
    // 静默降级
  }

  try {
    // 获取模板目录列表
    const dirResponse = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/.github/ISSUE_TEMPLATE`,
      {
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'GengarBark-Bot',
        },
      }
    );

    const files = (dirResponse.data as Array<{ name: string; download_url: string }>)
      .filter(f => f.name.endsWith('.md'));

    const templates: IssueTemplate[] = [];

    for (const file of files) {
      try {
        const contentResp = await axios.get(file.download_url, { responseType: 'text' });
        const parsed = parseTemplateContent(contentResp.data as string);
        if (parsed) {
          templates.push({ fileName: file.name, ...parsed });
        }
      } catch {
        // 单个模板获取失败，跳过
      }
    }

    // 写入缓存
    try {
      await setCacheEx(cacheKey, JSON.stringify(templates), REDIS_TEMPLATES_TTL);
    } catch {
      // 静默降级
    }

    return templates;
  } catch {
    // 目录不存在或 API 失败，返回空数组
    return [];
  }
}

/**
 * 使用 AI 从模板列表中智能选择最匹配的模板。
 * 根据 label、title、description 等上下文综合判断，而非简单的 label 等值匹配。
 * 超时 4 秒返回 null，AI 判断无合适模板时也返回 null。
 */
export async function selectTemplateWithAI(
  templates: IssueTemplate[],
  context: { label?: string; title?: string; description?: string }
): Promise<IssueTemplate | null> {
  if (templates.length === 0) return null;

  try {
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 4000);
    });

    const selectPromise = (async (): Promise<IssueTemplate | null> => {
      const templateSummaries = templates.map((t, i) => (
        `[${i}] name: "${t.name}", about: "${t.about}", labels: [${t.labels.join(', ')}]`
      )).join('\n');

      const prompt: ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `You are a template matcher. Given a list of GitHub issue templates and the context of an issue being created, select the BEST matching template index. Consider the label, title, and description holistically — do NOT require exact label matches. If no template is a reasonable fit, return -1. Only return a plain integer number, nothing else.`,
        },
        {
          role: 'user',
          content: `Templates:\n${templateSummaries}\n\nIssue context:\n- label: ${context.label || '(none)'}\n- title: ${context.title || '(none)'}\n- description: ${context.description || '(none)'}\n\nReturn the best template index (0-based), or -1 if none fits:`,
        },
      ];

      const response = await getGPT(prompt);
      const content = (response.choices[0].message.content || '').trim();
      const index = parseInt(content, 10);

      if (isNaN(index) || index < 0 || index >= templates.length) {
        return null;
      }
      return templates[index];
    })();

    return await Promise.race([selectPromise, timeoutPromise]);
  } catch {
    return null;
  }
}

/**
 * 基于模板 body 构建 issue body，模板中未涵盖的信息在底部作为补充上下文追加。
 */
export function buildBodyFromTemplate(templateBody: string, ctx: BodyContext): string {
  const parts = [templateBody];

  // 底部追加补充上下文
  parts.push('', '---', '');
  parts.push('### Additional Context');
  parts.push(`- **Reporter**: ${ctx.userName}`);
  parts.push(`- **Slack Thread**: ${ctx.threadLink}`);

  if (ctx.description) {
    parts.push('', ctx.description);
  }

  if (ctx.jiraTickets.length > 0) {
    parts.push('', '### Related Jira Tickets');
    for (const ticket of ctx.jiraTickets) {
      parts.push(`- [${ticket}](${JIRA_BASE_URL}/${ticket})`);
    }
  }

  return parts.join('\n');
}

/**
 * 构建默认 issue body（无模板时的回退格式）。
 */
export function buildDefaultBody(ctx: BodyContext): string {
  const parts = [
    `Reporter: ${ctx.userName}`,
    `Slack Thread: ${ctx.threadLink}`,
  ];

  if (ctx.description) {
    parts.push('', ctx.description);
  }

  if (ctx.jiraTickets.length > 0) {
    parts.push('', '## Related Jira Tickets');
    for (const ticket of ctx.jiraTickets) {
      parts.push(`- [${ticket}](${JIRA_BASE_URL}/${ticket})`);
    }
  }

  return parts.join('\n');
}

/**
 * 创建 GitHub Issue 的核心函数。
 * 1. 检查 GITHUB_PAT 环境变量
 * 2. 调用 resolveRepo() 解析仓库
 * 3. title 为空时调用 aiSummaryForGitHub()
 * 4. 合并 jiraTickets（命令中显式指定 + AI 识别，去重）
 * 5. 如果有 jiraTickets，在 title 末尾追加 ticket 号
 * 6. 尝试获取 issue 模板并智能匹配，有模板用模板渲染 body，无模板回退固定格式
 * 7. POST /repos/{owner}/{repo}/issues
 * 8. 返回 GitHubIssueResult，不抛出异常
 */
export async function createGitHubIssue(params: CreateGitHubIssueParams): Promise<GitHubIssueResult> {
  const { repoName, label, channel, threadTs, userName, description } = params;
  let { title, jiraTickets = [] } = params;

  const pat = process.env.GITHUB_PAT;
  if (!pat) {
    return { success: false, error: '❌ GitHub token 未配置，请设置 GITHUB_PAT 环境变量' };
  }

  // 解析仓库
  let resolved: ResolvedRepo;
  try {
    resolved = await resolveRepo(repoName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: `❌ ${msg}` };
  }

  // title 为空时调用 AI 摘要
  let aiDescription = description || '';
  if (!title) {
    const aiResult = await aiSummaryForGitHub(channel, threadTs);
    title = aiResult.summary;
    aiDescription = aiResult.description || aiDescription;
    // 合并 AI 识别的 jiraTickets（去重）
    const aiTickets = aiResult.jiraTickets || [];
    jiraTickets = Array.from(new Set(jiraTickets.concat(aiTickets)));
  }

  // 如果有 jiraTickets，在 title 末尾追加 ticket 号
  if (jiraTickets.length > 0 && title) {
    title = `${title} ${jiraTickets.join(' ')}`;
  }

  // 构建 Slack 线程链接（移除小数点）
  const formattedTs = threadTs.replace('.', '');
  const threadLink = `https://moegoworkspace.slack.com/archives/${channel}/p${formattedTs}`;

  const bodyCtx: BodyContext = { userName, threadLink, description: aiDescription, jiraTickets };

  // 尝试获取 issue 模板并智能匹配
  let body: string;
  const templates = await fetchIssueTemplates(resolved.owner, resolved.repo);
  const matched = await selectTemplateWithAI(templates, { label, title, description: aiDescription });

  if (matched) {
    body = buildBodyFromTemplate(matched.body, bodyCtx);
  } else {
    body = buildDefaultBody(bodyCtx);
  }

  // 构建请求体
  const requestBody: { title: string; body: string; labels?: string[] } = {
    title: title || '(no title)',
    body,
  };

  if (label) {
    requestBody.labels = [label];
  }

  // 调用 GitHub API
  try {
    const response = await axios.post(
      `${GITHUB_API_BASE}/repos/${resolved.owner}/${resolved.repo}/issues`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'GengarBark-Bot',
        },
      }
    );

    return {
      success: true,
      issueUrl: response.data.html_url,
      issueNumber: response.data.number,
    };
  } catch (err) {
    const axiosError = err as AxiosError<{ message?: string }>;
    const status = axiosError.response?.status;
    const message = axiosError.response?.data?.message || axiosError.message;

    let errorMessage: string;
    switch (status) {
      case 401:
        errorMessage = '❌ GitHub token 无效或已过期，请更新 GITHUB_PAT';
        break;
      case 403:
        errorMessage = `❌ 没有权限在 ${resolved.owner}/${resolved.repo} 创建 issue`;
        break;
      case 404:
        errorMessage = `❌ 仓库 ${resolved.owner}/${resolved.repo} 不存在或无权访问`;
        break;
      default:
        errorMessage = `❌ GitHub API 错误: ${status ? `HTTP ${status} - ` : ''}${message}`;
    }

    return { success: false, error: errorMessage };
  }
}
