import { getProfileStatus, setProfileStatus } from '@/lib/slack';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
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

  const result = getStatus();
  await setProfileStatus(res, result.emoji, result.text);
}

function getStatus() {
  // 创建一个新的 Date 对象
  const currentDate = new Date();
  // 获取当前时区的偏移量(以分钟为单位)
  const timezoneOffsetInMinutes = currentDate.getTimezoneOffset();
  // 将时区偏移量转换为小时
  const timezoneOffsetInHours = timezoneOffsetInMinutes / 60;
  // 获取当前时间的小时数(0-23)
  let currentHour24 = currentDate.getHours();
  // 如果是 +8 时区,则需要增加 8 小时
  let currentHour12 = (currentHour24 + 8 + timezoneOffsetInHours) % 12;
  if (currentHour12 === 0) {
    currentHour12 = 12;
  }
  // 获取当前时间的分钟数(0-59)
  const currentMinutes = currentDate.getMinutes();
  // Determine whether it's AM or PM
  const amPm = currentHour12 < 12 ? 'AM' : 'PM';

  const emoji = formatEmoji(currentHour12, currentMinutes);
  const text = `${currentHour24.toString().padStart(2, '0')}:${currentMinutes
    .toString()
    .padStart(2, '0')} ${amPm} UTC+8`;

  return {
    emoji,
    text,
  };
}

function formatEmoji(hour: number, minutes: number): string {
  if (minutes > 15 && minutes <= 45) {
    return `:clock${hour.toString() + 30}:`;
  }
  return `:clock${hour.toString()}:`;
}
