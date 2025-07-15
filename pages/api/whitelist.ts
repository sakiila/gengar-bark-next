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
function generateReportText(result: any[]): string {

  // 遍历 result，如果 staff_availability_type 或 show_slot_location 或 show_slot_time 有变化，则拼装变化前后的数据文本
  // 例如 staff_availability_type 从 1 变为 2，则拼装出：启用了 Shift Management by Slot 功能
  // 例如 show_slot_location 从 0 变为 1，则拼装出：启用了 Calendar Indicator 功能
  // 例如 show_slot_time 从 0 变为 1，则拼装出：启用了 Calendar Indicator 功能
  let changeText = '';
  for (const item of result) {
    changeText += `\n${item.newResult.owner_email}(${item.newResult.business_id})：`;
    if (Number(item.newResult.staff_availability_type) == 2) {
      changeText += `启用了 Shift Management by Slot 功能`;
    }
    if (Number(item.newResult.show_slot_location) == 1 || Number(item.newResult.show_slot_time) == 1) {
      changeText += `启用了 Calendar Indicator 功能`;
    }

  }

  return changeText;
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
    // await postToChannelId('C091YDUP3GU', res, reportText);
    await postToChannelId('C067ENL1TLN', res, reportText);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('处理请求失败:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
