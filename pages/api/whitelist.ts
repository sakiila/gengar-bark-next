import { postToChannelId } from '@/lib/slack/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import { queryMultiPet, queryMultiPetCount } from '@/lib/growthbook/multi-pet';

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
  let changeText = ':tada: *<https://growthbook.moego.pet/features/enable_multi_pet_by_slot|By Slot 白名单>监控报告*\n';
  for (const item of result) {
    // 优化下面的逻辑，使用字符串拼接，而不是 if else 语句
    const changes: string[] = [];
    if (Number(item.oldResult.staff_availability_type) !== Number(item.newResult.staff_availability_type) && Number(item.newResult.staff_availability_type) === 2) {
      changes.push('启用了 Shift Management by Slot 功能');
    }
    // show_slot_location 或 show_slot_time 只要有一个从0变为1就算启用
    if (
      (Number(item.oldResult.show_slot_location) !== Number(item.newResult.show_slot_location) && Number(item.newResult.show_slot_location) === 1) ||
      (Number(item.oldResult.show_slot_time) !== Number(item.newResult.show_slot_time) && Number(item.newResult.show_slot_time) === 1)
    ) {
      changes.push('启用了 Calendar Indicator 功能');
    }
    // 如果 changes 为空，则不添加
    if (changes.length <= 0) {
      continue;
    }
    changeText += `${item.newResult.owner_email} (${item.newResult.business_id})：`;
    if (changes.length > 1) {
      changeText += changes.join('和') + '。\n';
    } else {
      changeText += changes[0] + '。\n';
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
    if (!result || result.length === 0) {
      return res.status(200).send({
        text: `No data found.`,
      });
    }

    let reportText = generateReportText(result);

    const { totalCount, staffAvailabilityType2Count, staffAvailabilityType2Pct, showSlotLocation1Count, showSlotLocation1Pct } = await queryMultiPetCount();
    reportText += `\n
    商家总数：${totalCount}\n
    Shift Management by Slot 功能使用数：${staffAvailabilityType2Count}（${staffAvailabilityType2Pct}%）\n
    Calendar Indicator 功能使用数：${showSlotLocation1Count}（${showSlotLocation1Pct}%）
    `;

    // console.log("reportText:", reportText);

    // #gr-usages-monitor
    await postToChannelId('C091YDUP3GU', res, reportText);
    // await postToChannelId('C067ENL1TLN', res, reportText);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('处理请求失败:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
