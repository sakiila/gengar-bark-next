import {
  isWithinFiveMinutes,
  buildTimelineEventBlocks,
  TimelineEvent,
  TIBO_USERNAME,
  TIBO_ICON_URL,
  DEFAULT_SLACK_CHANNEL,
} from './codex-timeline.service';

describe('Codex Timeline Service', () => {
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
      const pastThreshold = new Date(fixedNow - (5 * 60 * 1000 + 1000)).toISOString();
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
      summary: 'You forgot the part where I reset usage twice in the middle\nEnjoy coding!',
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
      expect(textSection.text.text).toContain('You forgot the part where I reset usage twice in the middle');

      // 2. Clean context row with type label, native timestamp, and View on X link
      const contextBlock = blocks[1];
      expect(contextBlock.type).toBe('context');
      expect(contextBlock.elements[0].text).toContain('Quota Reset');
      expect(contextBlock.elements[0].text).toContain('<!date^');
      expect(contextBlock.elements[0].text).toContain(`<${mockEvent.url}|View on X>`);
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
