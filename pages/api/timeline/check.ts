import type { NextApiRequest, NextApiResponse } from 'next';
import { checkCodexTimeline } from '@/lib/services/codex-timeline.service';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const simulate =
    req.query.simulate === 'true' ||
    req.body?.simulate === true ||
    req.query.simulate === '1';

  const targetChannel =
    (req.query.channel as string) ||
    req.body?.channel ||
    undefined;

  try {
    const result = await checkCodexTimeline({
      forceSendLatest: simulate,
      channel: targetChannel,
    });

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error('Error in /api/timeline/check:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
