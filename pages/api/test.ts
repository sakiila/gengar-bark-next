import { NextApiRequest, NextApiResponse } from 'next';

export default async function personHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  return res.status(200).json({ message: 'Test ok' });
}
