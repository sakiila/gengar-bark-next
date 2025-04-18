import { NextApiRequest, NextApiResponse } from 'next';
import { run_mcp } from '@/lib/mcp';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {

    await run_mcp();

    res.status(200).json({
      success: true,
      // data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      timestamp: new Date().toISOString(),
    });
  }
}
