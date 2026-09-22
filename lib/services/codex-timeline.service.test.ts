import {
  isWithinFiveMinutes,
  buildTimelineEventBlocks,
  filterNewEvents,
  getLastEventId,
  setLastEventId,
  setMemoryLastEventId,
  CODEX_TIMELINE_LAST_EVENT_ID_KEY,
  TimelineEvent,
  TIBO_USERNAME,
  TIBO_ICON_URL,
  DEFAULT_SLACK_CHANNEL,
} from './codex-timeline.service';
import * as upstashModule from '@/lib/upstash/upstash';

jest.mock('@/lib/upstash/upstash', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
}));

describe('Codex Timeline Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMemoryLastEventId(null);
  });

  describe('filterNewEvents', () => {
    const baseTime = new Date('2026-09-22T05:00:00.000Z').getTime();

    const mockEvents: TimelineEvent[] = [
      {
        id: 'event-3',
        date: '2026-09-22',
        type: 'reset',
        group: 'reset',
        summary: 'Latest reset announced just now',
        url: 'https://x.com/thsottiaux/status/3',
        announced_at: '2026-09-22T04:30:00.000Z', // 30 mins ago
      },
      {
        id: 'event-2',
        date: '2026-09-22',
        type: 'reset',
        group: 'reset',
        summary: 'Reset announced 2 hours ago',
        url: 'https://x.com/thsottiaux/status/2',
        announced_at: '2026-09-22T03:00:00.000Z', // 2 hours ago
      },
      {
        id: 'event-1',
        date: '2026-09-10',
        type: 'reset',
        group: 'reset',
        summary: 'Old reset from 12 days ago',
        url: 'https://x.com/thsottiaux/status/1',
        announced_at: '2026-09-10T00:00:00.000Z', // 12 days ago
      },
    ];

    it('should return empty list when events is empty', () => {
      const result = filterNewEvents([], 'event-1');
      expect(result.newEvents).toEqual([]);
    });

    it('should return empty when lastEventId is the latest event (no new events)', () => {
      const result = filterNewEvents(mockEvents, 'event-3');
      expect(result.newEvents).toEqual([]);
    });

    it('should return new events in chronological order when lastEventId is an earlier event', () => {
      // event-1 is already processed, new events are event-2 and event-3 (oldest first: 2 -> 3)
      const result = filterNewEvents(mockEvents, 'event-1');
      expect(result.newEvents.map((e) => e.id)).toEqual(['event-2', 'event-3']);
    });

    it('should return only event-3 when event-2 is last processed', () => {
      const result = filterNewEvents(mockEvents, 'event-2');
      expect(result.newEvents.map((e) => e.id)).toEqual(['event-3']);
    });

    it('should catch up recent events within 24 hours on initial run without cursor', () => {
      const result = filterNewEvents(mockEvents, null, { nowMs: baseTime });
      // event-2 and event-3 are within 24h, event-1 is 12 days ago
      expect(result.newEvents.map((e) => e.id)).toEqual(['event-2', 'event-3']);
      expect(result.initialCursorToSet).toBeUndefined();
    });

    it('should initialize cursor without sending old events on cold start if all events are older than 24h', () => {
      const oldEvents: TimelineEvent[] = [
        {
          id: 'old-1',
          date: '2026-09-10',
          type: 'reset',
          group: 'reset',
          summary: 'Ancient event',
          url: 'https://x.com/thsottiaux/status/old',
          announced_at: '2026-09-10T00:00:00.000Z',
        },
      ];

      const result = filterNewEvents(oldEvents, null, { nowMs: baseTime });
      expect(result.newEvents).toEqual([]);
      expect(result.initialCursorToSet).toBe('old-1');
    });

    it('should fallback to recent events within 24h if lastEventId is not found in history', () => {
      const result = filterNewEvents(mockEvents, 'unknown-stale-id', {
        nowMs: baseTime,
      });
      expect(result.newEvents.map((e) => e.id)).toEqual(['event-2', 'event-3']);
    });
  });

  describe('cursor management (getLastEventId / setLastEventId)', () => {
    it('should read from Redis cache when available', async () => {
      (upstashModule.getCache as jest.Mock).mockResolvedValue('event-999');
      const id = await getLastEventId();
      expect(upstashModule.getCache).toHaveBeenCalledWith(
        CODEX_TIMELINE_LAST_EVENT_ID_KEY,
      );
      expect(id).toBe('event-999');
    });

    it('should fallback to memory when Redis read fails', async () => {
      (upstashModule.getCache as jest.Mock).mockRejectedValue(
        new Error('Redis connection down'),
      );
      setMemoryLastEventId('fallback-id');
      const id = await getLastEventId();
      expect(id).toBe('fallback-id');
    });

    it('should write to both memory and Redis when setLastEventId is called', async () => {
      (upstashModule.setCache as jest.Mock).mockResolvedValue('OK');
      await setLastEventId('new-cursor-123');

      expect(upstashModule.setCache).toHaveBeenCalledWith(
        CODEX_TIMELINE_LAST_EVENT_ID_KEY,
        'new-cursor-123',
      );

      // Verify memory is also updated
      (upstashModule.getCache as jest.Mock).mockResolvedValue(null);
      const id = await getLastEventId();
      expect(id).toBe('new-cursor-123');
    });
  });

  describe('isWithinFiveMinutes', () => {
    const fixedNow = new Date('2026-09-08T12:00:00.000Z').getTime();

    it('should return true for events announced 2 minutes ago', () => {
      const twoMinutesAgo = new Date(fixedNow - 2 * 60 * 1000).toISOString();
      expect(isWithinFiveMinutes(twoMinutesAgo, fixedNow)).toBe(true);
    });

    it('should return true for events announced exactly 5 minutes ago', () => {
      const fiveMinutesAgo = new Date(fixedNow - 5 * 60 * 1000).toISOString();
      expect(isWithinFiveMinutes(fiveMinutesAgo, fixedNow)).toBe(true);
    });

    it('should return false for events announced 5 minutes and 1 second ago', () => {
      const pastThreshold = new Date(
        fixedNow - (5 * 60 * 1000 + 1000),
      ).toISOString();
      expect(isWithinFiveMinutes(pastThreshold, fixedNow)).toBe(false);
    });

    it('should return false for events announced in the future', () => {
      const future = new Date(fixedNow + 10000).toISOString();
      expect(isWithinFiveMinutes(future, fixedNow)).toBe(false);
    });

    it('should return false for invalid or empty dates', () => {
      expect(isWithinFiveMinutes('', fixedNow)).toBe(false);
      expect(isWithinFiveMinutes('not-a-date', fixedNow)).toBe(false);
    });
  });

  describe('buildTimelineEventBlocks', () => {
    const mockEvent: TimelineEvent = {
      id: '2097183639356489952',
      date: '2026-09-08',
      type: 'reset',
      group: 'reset',
      summary:
        'You forgot the part where I reset usage twice in the middle\nEnjoy coding!',
      url: 'https://x.com/thsottiaux/status/2097183639356489952',
      announced_at: '2026-09-08T04:41:58.000Z',
      scope: 'global',
      confidence: 'medium',
      source: 'live',
      source_label: 'Live radar feed',
      is_reply: true,
      replying_to: '0x0SojalSec',
    };

    it('should build clean and minimal Block Kit structure without emoji clutter', () => {
      const blocks = buildTimelineEventBlocks(mockEvent);

      expect(blocks).toBeDefined();
      expect(Array.isArray(blocks)).toBe(true);
      expect(blocks.length).toBe(2);

      // 1. Section with clean text and reply indication
      const textSection = blocks[0];
      expect(textSection.type).toBe('section');
      expect(textSection.text.text).toContain('_Replying to @0x0SojalSec_');
      expect(textSection.text.text).toContain(
        'You forgot the part where I reset usage twice in the middle',
      );

      // 2. Clean context row with Pacific timestamp (PDT/PST) and View on X link
      const contextBlock = blocks[1];
      expect(contextBlock.type).toBe('context');
      expect(contextBlock.elements[0].text).toContain(
        '2026-09-07 21:41:58 PDT',
      );
      expect(contextBlock.elements[0].text).toContain(
        `<${mockEvent.url}|View on X>`,
      );
      expect(contextBlock.elements[0].text).not.toContain('Quota Reset');
    });

    it('should format UTC announced_at to Pacific time with timezone suffix', () => {
      const { formatToPacificTime } = require('./codex-timeline.service');
      const formatted = formatToPacificTime('2026-09-08T04:41:58.000Z');
      expect(formatted).toBe('2026-09-07 21:41:58 PDT');
    });

    it('should verify Tibo configuration constants', () => {
      expect(TIBO_USERNAME).toBe('Tibo');
      expect(TIBO_ICON_URL).toBe(
        'https://pbs.twimg.com/profile_images/2093807917833281537/2yBgpwVV_400x400.jpg',
      );
      expect(DEFAULT_SLACK_CHANNEL).toBe('C08JV0RLR6J');
    });
  });
});

