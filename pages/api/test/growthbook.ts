import { NextApiRequest, NextApiResponse } from 'next';
import { getMessage, evaluateFeatureFlag } from '@/lib/growthbook/growthbook';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { featureKey, company } = req.query;

        let result;

        if (featureKey && typeof featureKey === 'string') {
            // 测试指定的特性标志
            const userAttributes = company ? { company: company as string } : {};
            result = await evaluateFeatureFlag(featureKey, userAttributes);
        } else {
            // 运行默认的测试
            result = await getMessage();
        }

        res.status(200).json({
            success: true,
            data: result,
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
