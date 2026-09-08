import { WebClient } from '@slack/web-api';

export const CODEX_TIMELINE_API = 'https://codex-reset.com/api/timeline';
export const DEFAULT_SLACK_CHANNEL = 'C08JV0RLR6J';
export const TIBO_USERNAME = 'Tibo';
export const TIBO_ICON_URL =
  'https://pbs.twimg.com/profile_images/2093807917833281537/2yBgpwVV_400x400.jpg';
export const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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

/**
 * 获取或懒加载 Slack WebClient 实例
 */
export function getSlackClient(): WebClient {
  return new WebClient(process.env.SLACK_BOT_TOKEN);
}

/**
 * 判断事件是否在指定时间的前 5 分钟以内
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
 * 构建高美感、极简克制的 Slack Block Kit 消息
 */
export function buildTimelineEventBlocks(event: TimelineEvent): any[] {
  const announcedDate = new Date(event.announced_at);
  const unixTimestamp = Math.floor(announcedDate.getTime() / 1000);

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
          text: `<!date^${unixTimestamp}^{date_num} {time_secs}|${event.announced_at}>  ·  <${event.url}|View on X>`,
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
}) {
  const nowMs = options?.nowMs ?? Date.now();
  const targetChannel = options?.channel || DEFAULT_SLACK_CHANNEL;

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

  // 正常模式：严格检测 5 分钟以内的事件
  const matchedEvents = events.filter((event) =>
    isWithinFiveMinutes(event.announced_at, nowMs),
  );

  console.log(
    `[CodexTimeline] Found ${matchedEvents.length} events announced within the last 5 minutes.`,
  );

  let sentCount = 0;
  for (const event of matchedEvents) {
    try {
      console.log(`[CodexTimeline] Sending event ${event.id} to Slack...`);
      await postTimelineEventToSlack(event, targetChannel);
      sentCount++;
    } catch (err) {
      console.error(`[CodexTimeline] Failed to send event ${event.id}:`, err);
    }
  }

  return {
    success: true,
    mode: 'normal',
    matchedEvents,
    sentCount,
    totalEvents: events.length,
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
