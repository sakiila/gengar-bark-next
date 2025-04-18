import { getProfileStatus, setProfileStatus } from '@/lib/slack/slack';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      response_type: 'ephemeral',
      text: 'Not allowed',
    });
  }

  const profileStatus = await getProfileStatus();
  if (
    profileStatus &&
    profileStatus.status_emoji.length > 0 &&
    !profileStatus.status_emoji.includes(':clock')
  ) {
    return res.status(200).json({ message: 'Other status is set' });
  }

  let result = getStatus();
  const { text } = req.query;
  if (text !== '' && text !== undefined) {
    result.text = result.text + ' ' + text;
  }
  console.log('emoji:', result.emoji, 'text:', result.text);
  await setProfileStatus(res, result.emoji, result.text);
}

function getStatus() {
  const currentDate = new Date();
  const utcHours = currentDate.getUTCHours();
  const utcMinutes = currentDate.getUTCMinutes();

  let currentHour24 = (utcHours + 8) % 24;
  let currentHour12 = (utcHours + 8) % 12;
  if (currentHour12 === 0) {
    currentHour12 = 12;
  }

  const amPm = currentHour24 < 12 ? 'AM' : 'PM';

  const emoji = formatEmoji(currentHour12, utcMinutes);
  const text = `${currentHour24.toString().padStart(2, '0')}:${utcMinutes
    .toString()
    // .padStart(2, '0')} ${amPm} UTC+8`;
    .padStart(2, '0')} ${amPm}`;

  return {
    emoji,
    text,
  };
}

function formatEmoji(hour: number, minutes: number): string {
  if (minutes > 15 && minutes <= 45) {
    return `:clock${hour.toString() + 30}:`;
  }
  if (minutes > 45) {
    if (hour === 12) {
      return `:clock1:`;
    }
    return `:clock${hour + 1}:`;
  }
  return `:clock${hour.toString()}:`;
}

function getTodayProgress(): string {
  return '';

  const currentDate = new Date();
  const utcHours = currentDate.getUTCHours();
  const utcMinutes = currentDate.getUTCMinutes();
  const currentMinute = (utcHours + 8) * 60 + utcMinutes;
  const totalMinute = 24 * 60;
  const progressPercentageMinute = (currentMinute / totalMinute) * 100;
  const progressBlocks = Math.floor(progressPercentageMinute / 10);
  console.log('progressBlocks:', progressBlocks);
  const emptyBlocks = 10 - progressBlocks;

  const progressBar = '[' + ''.repeat(progressBlocks) + '-'.repeat(emptyBlocks) + ']';

  return `Today ${progressPercentageMinute.toFixed(0)}% ${progressBar}`;
}
