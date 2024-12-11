import { NextApiRequest, NextApiResponse } from 'next';
import { postgres } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, feedback } = req.body;

    if (!username || !feedback) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: '用户名和反馈内容不能为空'
      });
    }

    const { data, error } = await postgres
      .from('report_2024_feedback')
      .insert([
        {
          username,
          feedback,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error inserting feedback:', error);
      return res.status(500).json({ 
        error: 'Internal Server Error',
        message: '提交反馈失败'
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: '服务器错误'
    });
  }
} 