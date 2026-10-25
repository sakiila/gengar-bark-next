import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

/** Forward the original Slack bytes so the game can verify the same signature. */
export async function forwardPetMatchLinkShared(rawBody: string, headers: IncomingHttpHeaders): Promise<number> {
  const secret = process.env.SLACK_SIGNING_SECRET;
  const timestamp = headers['x-slack-request-timestamp'];
  const signature = headers['x-slack-signature'];
  if (!secret || typeof timestamp !== 'string' || !/^\d+$/.test(timestamp) || typeof signature !== 'string') return 403;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return 403;
  const expected = Buffer.from(`v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`);
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return 403;

  const payload = JSON.parse(rawBody);
  const links: { url?: string }[] = Array.isArray(payload.event?.links) ? payload.event.links : [];
  const hasGameLink = links.some((link) => {
    try {
      const url = new URL(link.url ?? '');
      return url.origin === 'https://star.baobo.me';
    } catch {
      return false;
    }
  });
  if (!hasGameLink) return 200;

  const response = await fetch('https://star.baobo.me/api/slack/events', {
    method: 'POST',
    redirect: 'error',
    headers: { 'content-type': 'application/json', 'x-slack-request-timestamp': timestamp, 'x-slack-signature': signature },
    body: rawBody,
    signal: AbortSignal.timeout(2000),
  });
  // A failed relay must remain retryable; Slack's retry header does not mean the game received it.
  return response.ok ? 200 : 502;
}
