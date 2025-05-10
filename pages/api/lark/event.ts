import { NextApiRequest, NextApiResponse } from 'next';
import { teamLeftFeiShu } from '@/lib/events-handlers/user-change';
import crypto from 'crypto';
import { teamJoinFeiShu } from '@/lib/events-handlers/team-join';

const larkToken = process.env.LARK_TOKEN as string;

class AESCipher {
  key: Buffer;

  constructor(key: string) {
    const hash = crypto.createHash('sha256');
    hash.update(key);
    this.key = hash.digest();
  }

  decrypt(encrypt: string) {
    const encryptBuffer = Buffer.from(encrypt, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, encryptBuffer.slice(0, 16));
    let decrypted = decipher.update(encryptBuffer.slice(16).toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {

  const cipher = new AESCipher(larkToken);
  const decrypt = cipher.decrypt(req.body.encrypt);
  console.log('message: ' + decrypt);

  const body = JSON.parse(decrypt);

  if (body.type === 'url_verification') {
    return res.status(200).json({ challenge: body.challenge });
  }

  const eventType = body.header.event_type;

  const name = body.event.object.name;
  const email = body.event.object.email;
  switch (eventType) {
    case 'contact.user.created_v3':
      await teamJoinFeiShu(name, email);
      break;
    case 'contact.user.deleted_v3':
      await teamLeftFeiShu(name, email);
      break;
  }

}
