import { postToChannelId } from '@/lib/slack/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import { queryMultiPet } from '@/lib/growthbook/multi-pet';
import { formatDateToCustomString } from '@/lib/utils/time-utils';

/**
 * 计算百分比
 * @param count 当前数量
 * @param total 总数
 * @returns 百分比字符串，保留2位小数
 */
function calculatePercentage(count: number, total: number): string {
  return ((count / total) * 100).toFixed(2);
}

/**
 * 生成报告文本
 * @param result 查询结果
 * @returns 格式化的报告文本
 */
function generateReportText(result: {
  shiftManagement: { count: number };
  calendar: { count: number };
  allCount: number;
}): string {
  const currentTime = formatDateToCustomString(new Date());
  const timezoneOffset = new Date().getTimezoneOffset();
  const timezoneString = timezoneOffset === 0 ? 'UTC' : `UTC${timezoneOffset > 0 ? '-' : '+'}${Math.abs(timezoneOffset / 60)}`;
  
  const shiftManagementPercentage = calculatePercentage(Number(result.shiftManagement.count), result.allCount);
  const calendarPercentage = calculatePercentage(Number(result.calendar.count), result.allCount);

  return `
:tada: *<https://growthbook.moego.pet/features/enable_multi_pet_by_slot|By Slot 白名单>监控报告*\n 
截止 ${currentTime} (${timezoneString})，在白名单的 ${result.allCount} 家 Business 中，\n
启用了 Shift Management by Slot 功能的有 ${result.shiftManagement.count} 家，占比 ${shiftManagementPercentage}%，\n
启用了 Calendar Indicator 功能的有 ${result.calendar.count} 家，占比 ${calendarPercentage}%。
  `.trim();
}

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

  try {
    const result = await queryMultiPet();
    const reportText = generateReportText(result);

    // console.log("reportText:", reportText);

    // #gr-usages-monitor
    await postToChannelId('C091YDUP3GU', res, reportText);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('处理请求失败:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
