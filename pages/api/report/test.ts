import { NextApiRequest, NextApiResponse } from 'next';
import { postBlockMessage } from '@/lib/slack/gengar-bolt';
import { ChannelService } from '@/lib/database/services/channel.service';
import { postgres } from '@/lib/database/supabase';

function getBlocks(username: string) {
  return [
    {
      'type': 'section',
      'text': {
        'type': 'mrkdwn',
        'text': '嗨，亲爱的 MoeGo 小伙伴。',
      },
    },
    {
      'type': 'section',
      'text': {
        'type': 'mrkdwn',
        'text': '这一年，我们共同经历了无数激动人心的时刻。从每一个灵感的闪现，到每一次挑战的跨越，你们的热情与坚持让这个旅程充满了无限可能。我们见证了 MoeGo 的成长、创意的碰撞和成果的累累，每一个成就都凝聚着你们的智慧与努力。',
      },
    },
    {
      'type': 'section',
      'text': {
        'type': 'mrkdwn',
        'text': '新的篇章即将开启。我们将继续携手并进，探索更多未知的领域，实现更大胆的想法。在即将到来的 2025 年，让我们满怀激情与信心，一起书写更加辉煌的故事！',
      },
    },
    {
      'type': 'section',
      'text': {
        'type': 'mrkdwn',
        'text': '“在平庸之海中漂泊，不要畏惧成为钻石或尘埃！”',
      },
    },
    {
      'type': 'actions',
      'elements': [
        {
          'type': 'button',
          'text': {
            'type': 'plain_text',
            'text': '点击开启 2024 年度回忆',
            'emoji': true,
          },
          'url': `https://pearl.baobo.me/report/${username}`,
        },
      ],
    },
  ];
}

/**
 * send report message to users
 * @param req
 * @param res
 */
async function sendMessage() {
  const { data, error } = await postgres
  .from('report_2024')
  .select('email');
  if (error || !data) {
    console.error('Database error:', error);
    return;
  }

  const channelService = await ChannelService.getInstance();
  const channels = await channelService.findAll();

  const emails = data;
  for (let i = 0; i < emails.length; i++) {
    if (emails[i].email == 'bob@moego.pet') {
      const username = emails[i].email.split('@')[0].toLowerCase();
      console.log('username:', username);
      const user_id = channels.find((channel) => channel.email === emails[i].email)?.user_id;
      if (!user_id) {
        console.error('Failed to find user_id for:', emails[i].email);
        continue;
      }
      console.log('user_id:', user_id);
      await postBlockMessage(user_id, getBlocks(username));
    }
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {

  // await conversationsListForIm();

  // await dataImport();

  await sendMessage();

  return res.status(200).json({ message: 'Success' });
}
