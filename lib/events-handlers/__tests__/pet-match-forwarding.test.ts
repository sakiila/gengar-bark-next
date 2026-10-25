import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/gengar/event';
import emojiChanged from '@/lib/events-handlers/emoji-changed';

jest.mock('@/lib/slack/slack', () => ({ verifyRequest: jest.fn(() => ({ status: true })) }));
jest.mock('@/lib/events-handlers/emoji-changed', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/lib/events-handlers/user-status-changed', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/lib/events-handlers/channel-created', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/lib/events-handlers/channel-archive', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/lib/events-handlers/chat', () => ({ response_container: jest.fn(), send_response: jest.fn(), set_suggested_prompts: jest.fn() }));
jest.mock('@/lib/events-handlers/team-join', () => ({ teamJoin: jest.fn() }));
jest.mock('@/lib/events-handlers/user-change', () => ({ userChange: jest.fn() }));
jest.mock('@/lib/events-handlers/message-monitor', () => ({ monitorUserMessages: jest.fn() }));
jest.mock('@/lib/events-handlers/mcp-app-home-opened', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({ logger: { scope: () => ({ info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }) } }));

const SECRET = 'test-pet-match-signing-secret';
const originalFetch = global.fetch;
const originalSecret = process.env.SLACK_SIGNING_SECRET;
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
const linkEvent = (url = 'https://star.baobo.me/?v=relay-test') => ({
  type: 'event_callback',
  event: { type: 'link_shared', channel: 'C_TEST', message_ts: '123.456', links: [{ url }] },
});

async function send(payload: object, extraHeaders: Record<string, string> = {}) {
  // Whitespace and escaped characters must survive the relay for Slack's signature.
  const rawBody = JSON.stringify(payload, null, 2) + '\n';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `v0=${createHmac('sha256', SECRET).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`;
  const req = Object.assign(Readable.from([Buffer.from(rawBody)]), {
    body: payload,
    method: 'POST',
    url: '/api/gengar/event',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'content-type': 'application/json', 'x-slack-request-timestamp': timestamp, 'x-slack-signature': signature, ...extraHeaders },
  }) as unknown as NextApiRequest;
  const response = {
    statusCode: 200,
    headersSent: false,
    status: jest.fn(function (this: { statusCode: number }, status: number) { this.statusCode = status; return this; }),
    end: jest.fn(function (this: { headersSent: boolean }) { this.headersSent = true; return this; }),
    json: jest.fn(function (this: { headersSent: boolean }) { this.headersSent = true; return this; }),
  };
  await handler(req, response as unknown as NextApiResponse);
  return { response, req, rawBody };
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock;
  process.env.SLACK_SIGNING_SECRET = SECRET;
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
});

afterAll(() => {
  global.fetch = originalFetch;
  if (originalSecret === undefined) delete process.env.SLACK_SIGNING_SECRET;
  else process.env.SLACK_SIGNING_SECRET = originalSecret;
});

test('relays a signed game link to the fixed game endpoint with the original bytes and signature', async () => {
  const { response, req, rawBody } = await send(linkEvent());
  expect(response.statusCode).toBe(200);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('https://star.baobo.me/api/slack/events', expect.objectContaining({
    method: 'POST',
    redirect: 'error',
    body: rawBody,
    headers: { 'content-type': 'application/json', 'x-slack-request-timestamp': req.headers['x-slack-request-timestamp'], 'x-slack-signature': req.headers['x-slack-signature'] },
    signal: expect.any(AbortSignal),
  }));
});

test.each([
  ['invalid signature', { 'x-slack-signature': 'v0=invalid' }],
  ['old timestamp', { 'x-slack-request-timestamp': '1' }],
  ['invalid timestamp', { 'x-slack-request-timestamp': 'nope' }],
])('rejects %s without relaying', async (_label, headers) => {
  const { response } = await send(linkEvent(), headers);
  expect(response.statusCode).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('does not relay when the signing secret is absent', async () => {
  delete process.env.SLACK_SIGNING_SECRET;
  const { response } = await send(linkEvent());
  expect(response.statusCode).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each(['https://example.com/', 'https://star.baobo.me.evil.example/', 'http://star.baobo.me/'])('does not relay other links: %s', async (url) => {
  const { response } = await send(linkEvent(url));
  expect(response.statusCode).toBe(200);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('does not mark a Slack retry as already processed by the game', async () => {
  const { response } = await send(linkEvent(), { 'x-slack-retry-num': '1', 'x-slack-retry-reason': 'http_error' });
  expect(response.statusCode).toBe(200);
  expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty('x-slack-retry-num');
});

test('returns a failure so Slack can retry when the game rejects the event', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
  const { response } = await send(linkEvent());
  expect(response.statusCode).toBe(502);
});

test('returns a failure so Slack can retry on a network error', async () => {
  fetchMock.mockRejectedValue(new Error('offline'));
  const { response } = await send(linkEvent());
  expect(response.statusCode).toBe(500);
});

test('keeps the original handler for other events', async () => {
  const payload = { type: 'event_callback', event: { type: 'emoji_changed', subtype: 'add', name: 'test' } };
  const { response, req } = await send(payload);
  expect(response.statusCode).toBe(200);
  expect(emojiChanged).toHaveBeenCalledWith(req);
  expect(req.body).toEqual(payload);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('keeps URL verification on the original callback', async () => {
  const { response } = await send({ type: 'url_verification', challenge: 'relay-check' });
  expect(response.json).toHaveBeenCalledWith({ challenge: 'relay-check' });
  expect(fetchMock).not.toHaveBeenCalled();
});
