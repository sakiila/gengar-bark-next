import type { NextApiRequest, NextApiResponse } from 'next';
import { postgres } from '@/lib/database/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, error } = await postgres
      .from('user')
      .select('real_name_normalized')
      .eq('deleted', false)
      .eq('is_bot', false)
      .eq('team_id', 'T011CF3CMJN')
     .ilike('email', '%@moego.pet%');

    if (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    const names = data
      ?.map((user) => user.real_name_normalized)
      .filter((name) => name && name.trim() !== '');

    return res.status(200).json({ names });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
