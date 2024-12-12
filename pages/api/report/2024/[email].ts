import { NextApiRequest, NextApiResponse } from 'next';
import { ReportService } from '@/services/report.service';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.query;
    console.log('Fetching report for email:', email);

    // 获取报告数据
    const reportService = ReportService.getInstance();
    const report = await reportService.getReport2024(email as string);

    if (!report) {
      return res.status(404).json({
        error: 'Report not found',
        message: `No report found for ${email}`
      });
    }

    return res.status(200).json(report);
  } catch (error) {
    console.error('Detailed API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
