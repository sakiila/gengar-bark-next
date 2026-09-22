import { WebClient } from '@slack/web-api';
import { getCache, setCache } from '../upstash/upstash';

export const CODEX_TIMELINE_API = 'https://codex-reset.com/api/timeline';
export const CODEX_TIMELINE_LAST_EVENT_ID_KEY = 'codex:timeline:last_event_id';
export const DEFAULT_SLACK_CHANNEL = 'C08JV0RLR6J';
export const TIBO_USERNAME = 'Tibo';
export const TIBO_ICON_URL =
  'https://pbs.twimg.com/profile_images/2093807917833281537/2yBgpwVV_400x400.jpg';
export const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const INITIAL_CATCHUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface TimelineEvent {
  id: string;
  date: string;
  type: string;
  group: string;
  summary: string;
  url: string;
  announced_at: string;
  effective_at?: string | null;
  official_window?: string | null;
  preview?: boolean;
  scope?: string;
  confidence?: string;
  source?: string;
  source_label?: string;
  reset_kind?: string | null;
  audience?: string[];
  incident_links?: string[];
  reason_tags?: string[];
  is_reply?: boolean;
  replying_to?: string | null;
  announcement_state?: string;
  observation_result?: string;
  observation_sources?: string[];
  reset_verification_status?: string;
  time_kind?: string;
}

export interface TimelineApiResponse {
  updated_at: string;
  events: TimelineEvent[];
}

let memoryLastEventId: string | null = null;

export function getMemoryLastEventId(): string | null {
  return memoryLastEventId;
}

export function setMemoryLastEventId(id: string | null): void {
  memoryLastEventId = id;
}

export async function getLastEventId(): Promise<string | null> {
  try {
    const cached = await getCache(CODEX_TIMELINE_LAST_EVENT_ID_KEY);
    if (typeof cached === 'string' && cached.trim().length > 0) {
      return cached.trim();
    }
  } catch (err) {
    console.warn(
      '[CodexTimeline] Failed to read last event ID from Redis, using memory fallback:',
      err,
    );
  }
  return memoryLastEventId;
}

export async function setLastEventId(eventId: string): Promise<void> {
  memoryLastEventId = eventId || null;
  try {
    await setCache(CODEX_TIMELINE_LAST_EVENT_ID_KEY, eventId || '');
  } catch (err) {
    console.warn(
      '[CodexTimeline] Failed to save last event ID to Redis, saved in memory only:',
      err,
    );
  }
}

/**
 * 根据上一次处理的事件 ID 游标，计算出待推送的新事件（按时间正序排列，最旧的先推）
 */
export function filterNewEvents(
  events: TimelineEvent[],
  lastEventId: string | null,
  options?: { nowMs?: number; catchupWindowMs?: number },
): { newEvents: TimelineEvent[]; initialCursorToSet?: string } {
  if (!events || events.length === 0) {
    return { newEvents: [] };
  }

  // 1. 若已有游标记录
  if (lastEventId) {
    const lastIndex = events.findIndex((e) => e.id === lastEventId);
    if (lastIndex === 0) {
      // 当前最新一条就是上次处理过的，无新事件
      return { newEvents: [] };
    }
    if (lastIndex > 0) {
      // 截取所有比游标更新的事件，并反转为正序（先发生的先推）
      const newEvents = events.slice(0, lastIndex).reverse();
      return { newEvents };
    }

    // 若游标不在当前的 events 列表中（如超过列表容量 55 条或历史 ID 丢失）
    // 仅回退最近 24 小时内的事件，避免全量刷屏
    const nowMs = options?.nowMs ?? Date.now();
    const windowMs = options?.catchupWindowMs ?? INITIAL_CATCHUP_WINDOW_MS;
    const fallbackEvents = events
      .filter((e) => {
        const t = new Date(e.announced_at).getTime();
        return !isNaN(t) && nowMs - t <= windowMs && nowMs - t >= 0;
      })
      .reverse();
    return { newEvents: fallbackEvents };
  }

  // 2. 若无游标记录（首次部署冷启动）
  // 检查是否有 24 小时内刚发布的事件需要补发（例如当天漏发的最新事件）
  const nowMs = options?.nowMs ?? Date.now();
  const windowMs = options?.catchupWindowMs ?? INITIAL_CATCHUP_WINDOW_MS;
  const recentEvents = events
    .filter((e) => {
      const t = new Date(e.announced_at).getTime();
      return !isNaN(t) && nowMs - t <= windowMs && nowMs - t >= 0;
    })
    .reverse();

  if (recentEvents.length > 0) {
    return { newEvents: recentEvents };
  }

  // 若无 24 小时内的事件，直接以当前最新一条作为起始游标，不推送历史事件
  return { newEvents: [], initialCursorToSet: events[0].id };
}

/**
 * 获取或懒加载 Slack WebClient 实例
 */
export function getSlackClient(): WebClient {
  return new WebClient(process.env.SLACK_BOT_TOKEN);
}

/**
 * @deprecated 推荐使用基于游标的 filterNewEvents，保留此函数以兼容旧有单元测试与引用
 */
export function isWithinFiveMinutes(
  announcedAt: string,
  nowMs: number = Date.now(),
): boolean {
  if (!announcedAt) return false;
  const announcedMs = new Date(announcedAt).getTime();
  if (isNaN(announcedMs)) return false;

  const diffMs = nowMs - announcedMs;
  return diffMs >= 0 && diffMs <= CHECK_INTERVAL_MS;
}

/**
 * 将 UTC ISO 时间转换为太平洋时区（America/Los_Angeles，带时区缩写 PDT/PST）
 */
export function formatToPacificTime(isoString: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')} ${get('timeZoneName')}`;
}

/**
 * 构建高美感、极简克制的 Slack Block Kit 消息
 */
export function buildTimelineEventBlocks(event: TimelineEvent): any[] {
  const formattedTime = formatToPacificTime(event.announced_at);

  let mainText = '';
  if (event.is_reply && event.replying_to) {
    mainText = `_Replying to @${event.replying_to}_\n\n${event.summary}`;
  } else {
    mainText = event.summary;
  }

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: mainText,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${formattedTime}  ·  <${event.url}|View on X>`,
        },
      ],
    },
  ];
}

/**
 * 发送单条事件到 Slack 频道
 */
export async function postTimelineEventToSlack(
  event: TimelineEvent,
  channel: string = DEFAULT_SLACK_CHANNEL,
) {
  const blocks = buildTimelineEventBlocks(event);
  const fallbackText = `Tibo: ${event.summary}`;
  const client = getSlackClient();

  return await client.chat.postMessage({
    channel,
    text: fallbackText,
    blocks,
    username: TIBO_USERNAME,
    icon_url: TIBO_ICON_URL,
  });
}

/**
 * 拉取并检查 Timeline 接口
 */
export async function checkCodexTimeline(options?: {
  forceSendLatest?: boolean;
  channel?: string;
  nowMs?: number;
  resetCursor?: boolean;
}) {
  const nowMs = options?.nowMs ?? Date.now();
  const targetChannel = options?.channel || DEFAULT_SLACK_CHANNEL;

  if (options?.resetCursor) {
    console.log('[CodexTimeline] Resetting timeline cursor...');
    await setLastEventId('');
  }

  console.log(`[CodexTimeline] Fetching timeline from ${CODEX_TIMELINE_API}...`);

  const response = await fetch(CODEX_TIMELINE_API, {
    headers: {
      'User-Agent': 'GengarBarkTimelineMonitor/1.0',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch timeline: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as TimelineApiResponse;
  const events = data?.events || [];

  console.log(`[CodexTimeline] Retrieved ${events.length} events.`);

  // 调试模拟模式：强行推送最新一条事件
  if (options?.forceSendLatest && events.length > 0) {
    const latestEvent = events[0];
    console.log(
      `[CodexTimeline] Force sending latest event ${latestEvent.id} to Slack channel ${targetChannel}...`,
    );
    await postTimelineEventToSlack(latestEvent, targetChannel);
    return {
      success: true,
      mode: 'simulate_latest',
      matchedEvents: [latestEvent],
      sentCount: 1,
      totalEvents: events.length,
    };
  }

  // 游标模式：增量处理新事件
  const lastEventId = await getLastEventId();
  const { newEvents, initialCursorToSet } = filterNewEvents(
    events,
    lastEventId,
    { nowMs },
  );

  // 如果没有需要补发的事件且需要初始化游标
  if (initialCursorToSet) {
    await setLastEventId(initialCursorToSet);
    console.log(
      `[CodexTimeline] Initialized cursor to latest event ${initialCursorToSet}`,
    );
  }

  console.log(
    `[CodexTimeline] Found ${newEvents.length} new events (lastEventId=${lastEventId || 'none'}).`,
  );

  let sentCount = 0;
  for (const event of newEvents) {
    try {
      console.log(`[CodexTimeline] Sending event ${event.id} to Slack...`);
      await postTimelineEventToSlack(event, targetChannel);
      sentCount++;
      // 每成功发送一条即推进游标，保证断点续传与幂等
      await setLastEventId(event.id);
    } catch (err) {
      console.error(`[CodexTimeline] Failed to send event ${event.id}:`, err);
      // 中断后续推送，保留未消费的游标以供下次轮询重试
      break;
    }
  }

  return {
    success: true,
    mode: 'cursor',
    matchedEvents: newEvents,
    sentCount,
    totalEvents: events.length,
    lastEventId: await getLastEventId(),
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __codexTimelineInterval: NodeJS.Timeout | undefined;
}

/**
 * 启动后台轮询任务（单例守护）
 */
export function startTimelineMonitor() {
  if (globalThis.__codexTimelineInterval) {
    console.log('[CodexTimeline] Monitor interval already running, skipping start.');
    return;
  }

  console.log(
    `[CodexTimeline] Initializing timeline monitor, polling every ${CHECK_INTERVAL_MS / 1000}s...`,
  );

  // 启动后首次延迟 10 秒执行一次检测，避免与启动并发争抢网络
  setTimeout(() => {
    checkCodexTimeline().catch((err) => {
      console.error('[CodexTimeline] Initial check error:', err);
    });
  }, 10000);

  // 设置每 5 分钟定时轮询
  globalThis.__codexTimelineInterval = setInterval(async () => {
    try {
      await checkCodexTimeline();
    } catch (err) {
      console.error('[CodexTimeline] Scheduled check error:', err);
    }
  }, CHECK_INTERVAL_MS);

  // 允许 Node.js 进程在无其他任务时平稳退出
  if (globalThis.__codexTimelineInterval.unref) {
    globalThis.__codexTimelineInterval.unref();
  }
}
