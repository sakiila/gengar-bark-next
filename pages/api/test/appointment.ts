import { NextApiRequest, NextApiResponse } from 'next';
import { sendAppointmentToSlack } from '@/lib/database/services/appointment-slack';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        // 从查询参数中获取 appointmentId，默认使用 61809655
        const appointmentId = parseInt(req.query.id as string) || 61809655;

        // const result = await queryByAppointmentId(appointmentId);

        await sendAppointmentToSlack(appointmentId, 'U03FPQWGTN2', 'C067ENL1TLN', '1738765257.776969');

        res.status(200).json({
            success: true,
            // data: result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '未知错误',
            timestamp: new Date().toISOString()
        });
    }
}
