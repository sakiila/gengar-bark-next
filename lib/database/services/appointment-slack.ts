import { queryByAppointmentId, queryByOrderId } from './one-page';
import { postBlockMessage } from '@/lib/slack/gengar-bolt';
import { formatDateToCustomString } from '@/lib/utils/time-utils';
import { getGPTmini } from '@/lib/ai/openai';
import { ChatCompletionMessageParam } from 'openai/resources';

/**
 * Format minutes to time string (HH:mm)
 */
function formatMinutesToTime(minutes: number): string {
  if (!minutes && minutes !== 0) return 'N/A';
  if (minutes < 0 || minutes >= 1440) return 'Invalid Time';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Format timestamp to UTC string
 */
function formatTimestamp(timestamp: number | string | Date | undefined | null): string {
  if (!timestamp || timestamp == 0) return 'N/A';

  try {
    let date: Date;

    if (typeof timestamp === 'string') {
      // 尝试解析 ISO 格式的时间字符串
      if (timestamp.includes('T') && timestamp.includes('Z')) {
        date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return formatDateToCustomString(date);
        }
      }
      timestamp = parseInt(timestamp);
    }

    if (typeof timestamp === 'number') {
      // Check if timestamp is minutes in a day (0-1439)
      if (timestamp < 1440) {
        return formatMinutesToTime(timestamp);
      }

      // Check if timestamp is in seconds (Unix timestamp)
      if (timestamp > 1000000000000) {
        // Already in milliseconds
        date = new Date(timestamp);
      } else {
        // Convert seconds to milliseconds
        date = new Date(timestamp * 1000);
      }
    } else {
      date = new Date(timestamp);
    }

    // Validate if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return formatDateToCustomString(date);
  } catch (error) {
    console.error('Error formatting timestamp:', timestamp, error);
    return 'Invalid Date';
  }
}


function getServiceTypes(serviceTypeInclude: number) {
  const services = [];
  if (serviceTypeInclude & 1) services.push('grooming');
  if (serviceTypeInclude & 2) services.push('boarding');
  if (serviceTypeInclude & 4) services.push('daycare');
  if (serviceTypeInclude & 8) services.push('evaluation');
  if (serviceTypeInclude & 16) services.push('dog walking');
  return services.join(', ');
}

function getBookOnlineStatus(status: number): string {
  const statusMap: { [key: number]: string } = {
    0: 'unknown',
    1: 'unconfirmed',
    2: 'confirm',
    3: 'waitinglist',
    4: 'cancle',
  };
  return statusMap[status] || 'unknown';
}

function getSource(source: number): string {
  const sourceMap: { [key: number]: string } = {
    22168: 'book-online',
    22018: 'web',
    17216: 'android',
    17802: 'ios',
  };
  return sourceMap[source] || 'unknown';
}

function getCancelByType(type: number): string {
  const typeMap: { [key: number]: string } = {
    0: 'by business',
    1: 'by customer reply msg',
    2: 'by delete pet',
  };
  return typeMap[type] || 'unknown';
}

function getConfirmByType(type: number): string {
  const typeMap: { [key: number]: string } = {
    0: 'by business',
    1: 'by customer reply msg',
  };
  return typeMap[type] || 'unknown';
}

function getWaitListStatus(status: number): string {
  const statusMap: { [key: number]: string } = {
    0: 'has appt no waitlist',
    1: 'no appt has waitlist',
    2: 'has appt has waitlist',
  };
  return statusMap[status] || 'unknown';
}

function getPickupNotificationStatus(status: number): string {
  const statusMap: { [key: number]: string } = {
    0: 'not sent',
    1: 'sent',
    2: 'failed',
  };
  return statusMap[status] || 'unknown';
}

/**
 * Get status description
 */
function getStatusDescription(status: number): string {
  const statusMap: { [key: number]: string } = {
    0: 'unknown',
    1: 'unconfirmed',
    2: 'confirmed',
    3: 'finished',
    4: 'cancelled',
    5: 'ready',
    6: 'checkin',
  };
  return statusMap[status] || 'unknown';
}

function getServiceType(type: number): string {
  const typeMap: { [key: number]: string } = {
    0: 'unknown',
    1: 'main service',
    2: 'add-on service',
  };
  return typeMap[type] || 'unknown';
}

function getPetDetailStatus(status: number): string {
  const statusMap: { [key: number]: string } = {
    1: 'normal',
    2: 'deleted',
    3: 'deleted due to modification',
  };
  return statusMap[status] || 'unknown';
}

function getScopeType(type: number): string {
  const typeMap: { [key: number]: string } = {
    1: 'this appt',
    2: 'this and future',
  };
  return typeMap[type] || 'unknown';
}

function getServiceItemType(type: number): string {
  const typeMap: { [key: number]: string } = {
    1: 'grooming',
    2: 'boarding',
    3: 'daycare',
  };
  return typeMap[type] || 'unknown';
}

function getPriceUnit(unit: number): string {
  const unitMap: { [key: number]: string } = {
    1: 'per session',
    2: 'per night',
    3: 'per hour',
    4: 'per day',
  };
  return unitMap[unit] || 'unknown';
}

function getOverrideType(type: number): string {
  const typeMap: { [key: number]: string } = {
    0: 'no override',
    1: 'override by location (business)',
    2: 'override by pet (client)',
    3: 'override by staff',
  };
  return typeMap[type] || 'unknown';
}

function getDateType(type: number): string {
  const typeMap: { [key: number]: string } = {
    1: 'every day except checkout day',
    2: 'specific date',
    3: 'date point',
    4: 'everyday',
  };
  return typeMap[type] || 'unknown';
}

function addAdditionalInfo(blocks: any[], userId: string) {
  blocks.push(
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Query by <@${userId}> on ${formatTimestamp(new Date())} (UTC)`,
      },
    });
}

function addOrderInfo(order: any): any[] {
  const blocks: any[] = [];
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `Order #${order.id}`,
    },
  });

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Order Information*',
    },
  });

  const orderFields = [
    `*id:* ${order.id}`,
    `*business_id:* ${order.business_id}`,
    `*status:* ${order.status}`,
    `*payment_status:* ${order.payment_status}`,
    `*fulfillment_status:* ${order.fulfillment_status}`,
    `*guid:* ${order.guid}`,
    `*source_type:* ${order.source_type}`,
    `*source_id:* ${order.source_id}`,
    `*line_item_types:* ${order.line_item_types}`,
    `*version:* ${order.version}`,
    `*customer_id:* ${order.customer_id}`,
    `*tips_amount:* $${order.tips_amount}`,
    `*tax_amount:* $${order.tax_amount}`,
    `*discount_amount:* $${order.discount_amount}`,
    `*extra_fee_amount:* $${order.extra_fee_amount}`,
    `*sub_total_amount:* $${order.sub_total_amount}`,
    `*tips_based_amount:* $${order.tips_based_amount}`,
    `*total_amount:* $${order.total_amount}`,
    `*paid_amount:* $${order.paid_amount}`,
    `*remain_amount:* $${order.remain_amount}`,
    `*refunded_amount:* $${order.refunded_amount}`,
    `*title:* ${order.title}`,
    `*description:* ${order.description}`,
    `*create_by:* ${order.create_by}`,
    `*update_by:* ${order.update_by}`,
    `*create_time:* ${formatTimestamp(order.create_time)}`,
    `*update_time:* ${formatTimestamp(order.update_time)}`,
    `*complete_time:* ${formatTimestamp(order.complete_time)}`,
    `*order_type:* ${order.order_type}`,
    `*order_ref_id:* ${order.order_ref_id}`,
    `*extra_charge_reason:* ${order.extra_charge_reason}`,
    `*order_version:* ${order.order_version}`,
    `*tax_round_mod:* ${order.tax_round_mod}`,
    `*company_id:* ${order.company_id}`,
    `*currency_code:* ${order.currency_code}`,
  ];

  // Split fields into chunks of 10
  for (let i = 0; i < orderFields.length; i += 10) {
    blocks.push({
      type: 'section',
      fields: orderFields.slice(i, i + 10).map(field => ({
        type: 'mrkdwn',
        text: field,
      })),
    });
  }

  return blocks;
}

function addPetDetailInfo(petDetails: any[]): any[] {
  const blocks: any[] = [];
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: 'Pet Service Details',
    },
  });

  petDetails.forEach((detail: any, index: number) => {
    const petFields = [
      `*id:* ${detail.id}`,
      `*grooming_id:* ${detail.grooming_id}`,
      `*pet_id:* ${detail.pet_id}`,
      `*staff_id:* ${detail.staff_id}`,
      `*service_id:* ${detail.service_id}`,
      `*service_type:* ${detail.service_type} (${getServiceType(detail.service_type)})`,
      `*service_time:* ${detail.service_time}`,
      `*service_price:* $${detail.service_price}`,
      `*start_time:* ${formatTimestamp(detail.start_time)}`,
      `*end_time:* ${formatTimestamp(detail.end_time)}`,
      `*status:* ${detail.status} (${getPetDetailStatus(detail.status)})`,
      `*update_time:* ${formatTimestamp(detail.update_time)}`,
      `*scope_type_price:* ${detail.scope_type_price} (${getScopeType(detail.scope_type_price)})`,
      `*scope_type_time:* ${detail.scope_type_time} (${getScopeType(detail.scope_type_time)})`,
      `*star_staff_id:* ${detail.star_staff_id}`,
      `*package_service_id:* ${detail.package_service_id}`,
      `*service_name:* ${detail.service_name}`,
      `*service_description:* ${detail.service_description || 'N/A'}`,
      `*tax_id:* ${detail.tax_id}`,
      `*tax_rate:* ${detail.tax_rate}%`,
      `*enable_operation:* ${detail.enable_operation} (${detail.enable_operation === 1 ? 'Yes' : 'No'})`,
      `*work_mode:* ${detail.work_mode} (${detail.work_mode === 0 ? 'parallel' : 'sequence'})`,
      `*service_color_code:* ${detail.service_color_code}`,
      `*start_date:* ${detail.start_date}`,
      `*end_date:* ${detail.end_date}`,
      `*service_item_type:* ${detail.service_item_type} (${getServiceItemType(detail.service_item_type)})`,
      `*lodging_id:* ${detail.lodging_id}`,
      `*price_unit:* ${detail.price_unit} (${getPriceUnit(detail.price_unit)})`,
      `*specific_dates:* ${detail.specific_dates}`,
      `*associated_service_id:* ${detail.associated_service_id}`,
      `*price_override_type:* ${detail.price_override_type} (${getOverrideType(detail.price_override_type)})`,
      `*duration_override_type:* ${detail.duration_override_type} (${getOverrideType(detail.duration_override_type)})`,
      `*created_at:* ${formatTimestamp(detail.created_at)}`,
      `*updated_at:* ${formatTimestamp(detail.updated_at)}`,
      `*quantity_per_day:* ${detail.quantity_per_day}`,
      `*date_type:* ${detail.date_type} (${getDateType(detail.date_type)})`,
    ];

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Pet Service #${index + 1}*`,
      },
    });

    // Split fields into chunks of 10
    for (let i = 0; i < petFields.length; i += 10) {
      blocks.push({
        type: 'section',
        fields: petFields.slice(i, i + 10).map(field => ({
          type: 'mrkdwn',
          text: field,
        })),
      });
    }
  });

  return blocks;
}

function addAppointmentInfo(appointment: any): any[] {
  const blocks: any[] = [];
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `Appointment #${appointment.id}`,
    },
  });

  // Appointment Details Section
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Appointment Details*',
    },
  });

  const appointmentFields = [
    `*order_id:* ${appointment.order_id}`,
    `*business_id:* ${appointment.business_id}`,
    `*customer_id:* ${appointment.customer_id}`,
    `*appointment_date:* ${appointment.appointment_date}`,
    `*appointment_end_date:* ${appointment.appointment_end_date}`,
    `*appointment_start_time:* ${appointment.appointment_start_time} (${formatTimestamp(appointment.appointment_start_time)})`,
    `*appointment_end_time:* ${appointment.appointment_end_time} (${formatTimestamp(appointment.appointment_end_time)})`,
    `*is_waiting_list:* ${appointment.is_waiting_list} (${appointment.is_waiting_list === 1 ? 'Yes' : 'No'})`,
    `*move_waiting_by:* ${appointment.move_waiting_by}`,
    `*confirmed_time:* ${formatTimestamp(appointment.confirmed_time)}`,
    `*check_in_time:* ${formatTimestamp(appointment.check_in_time)}`,
    `*check_out_time:* ${formatTimestamp(appointment.check_out_time)}`,
    `*canceled_time:* ${formatTimestamp(appointment.canceled_time)}`,
    `*status:* ${appointment.status} (${getStatusDescription(appointment.status)})`,
    `*is_block:* ${appointment.is_block} (${appointment.is_block === 1 ? 'Yes' : 'No'})`,
    `*book_online_status:* ${appointment.book_online_status} (${getBookOnlineStatus(appointment.book_online_status)})`,
    `*customer_address_id:* ${appointment.customer_address_id}`,
    `*repeat_id:* ${appointment.repeat_id} (${appointment.repeat_id === 0 ? 'Normal Order' : 'Repeat Order'})`,
    `*is_paid:* ${appointment.is_paid} (${appointment.is_paid === 1 ? 'Yes' : 'Partially/Not Paid'})`,
    `*color_code:* ${appointment.color_code}`,
    `*no_show:* ${appointment.no_show} (${appointment.no_show === 1 ? 'Yes' : 'No'})`,
    `*no_show_fee:* ${appointment.no_show_fee}`,
    `*is_pust_notification:* ${appointment.is_pust_notification} (${appointment.is_pust_notification === 1 ? 'Yes' : 'No'})`,
    `*cancel_by_type:* ${appointment.cancel_by_type} (${getCancelByType(appointment.cancel_by_type)})`,
    `*cancel_by:* ${appointment.cancel_by}`,
    `*confirm_by_type:* ${appointment.confirm_by_type} (${getConfirmByType(appointment.confirm_by_type)})`,
    `*confirm_by:* ${appointment.confirm_by}`,
    `*created_by_id:* ${appointment.created_by_id}`,
    `*out_of_area:* ${appointment.out_of_area} (${appointment.out_of_area === 1 ? 'Yes' : 'No'})`,
    `*is_deprecate:* ${appointment.is_deprecate} (${appointment.is_deprecate === 1 ? 'Yes' : 'No'})`,
    `*create_time:* ${formatTimestamp(appointment.create_time)}`,
    `*update_time:* ${formatTimestamp(appointment.update_time)}`,
    `*source:* ${appointment.source} (${getSource(appointment.source)})`,
    `*old_appointment_date:* ${appointment.old_appointment_date}`,
    `*old_appointment_start_time:* ${formatTimestamp(appointment.old_appointment_start_time)}`,
    `*old_appointment_end_time:* ${formatTimestamp(appointment.old_appointment_end_time)}`,
    `*old_appt_id:* ${appointment.old_appt_id}`,
    `*schedule_type:* ${appointment.schedule_type} (${appointment.schedule_type === 1 ? 'Normal repeat' : 'Smart schedule repeat'})`,
    `*source_platform:* ${appointment.source_platform}`,
    `*ready_time:* ${formatTimestamp(appointment.ready_time)}`,
    `*pickup_notification_send_status:* ${appointment.pickup_notification_send_status} (${getPickupNotificationStatus(appointment.pickup_notification_send_status)})`,
    `*pickup_notification_failed_reason:* ${appointment.pickup_notification_failed_reason}`,
    `*status_before_checkin:* ${appointment.status_before_checkin} (${getStatusDescription(appointment.status_before_checkin)})`,
    `*status_before_ready:* ${appointment.status_before_ready} (${getStatusDescription(appointment.status_before_ready)})`,
    `*status_before_finish:* ${appointment.status_before_finish} (${getStatusDescription(appointment.status_before_finish)})`,
    `*no_start_time:* ${appointment.no_start_time} (${appointment.no_start_time === 1 ? 'No time included' : 'Has time'})`,
    `*updated_by_id:* ${appointment.updated_by_id}`,
    `*company_id:* ${appointment.company_id}`,
    `*is_auto_accept:* ${appointment.is_auto_accept} (${appointment.is_auto_accept === 1 ? 'Yes' : 'No'})`,
    `*wait_list_status:* ${appointment.wait_list_status} (${getWaitListStatus(appointment.wait_list_status)})`,
    `*service_type_include:* ${appointment.service_type_include} (${getServiceTypes(appointment.service_type_include)})`,
  ];

  // Split fields into chunks of 10 for Slack's field limit
  for (let i = 0; i < appointmentFields.length; i += 10) {
    blocks.push({
      type: 'section',
      fields: appointmentFields.slice(i, i + 10).map(field => ({
        type: 'mrkdwn',
        text: field,
      })),
    });
  }

  return blocks;
}

/**
 * Format appointment data to Slack Block Kit format
 */
function formatAppointmentBlocks(appointmentData: any, userId: string): any[] {
  const { appointment, petDetails, order } = appointmentData;
  const blocks: any[] = [];

  // Appointment Information
  if (appointment) {
    blocks.push(...addAppointmentInfo(appointment));
    blocks.push({ type: 'divider' });
  }

  // Pet Service Details
  if (petDetails && petDetails.length > 0) {
    blocks.push(...addPetDetailInfo(petDetails));
    blocks.push({ type: 'divider' });
  }

  // Order Information
  if (order) {
    blocks.push(...addOrderInfo(order));
    blocks.push({ type: 'divider' });
  }

  addAdditionalInfo(blocks, userId);

  return blocks;
}

async function getAiMessage(appointmentData: any) {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: '你是一个专业的宠物预约数据分析助手。请分析以下预约和订单数据，找出任何潜在的问题或异常情况。关注以下几点：1.时间安排是否合理 2.服务类型是否匹配 3.状态流转是否正常 4.支付状态是否正常。如果没有问题，请返回“暂无问题”。不超过200字。',
    },
    {
      role: 'user',
      content: JSON.stringify(appointmentData, null, 2),
    },
  ];

  const gptResponse = await getGPTmini(messages);
  const analysis = gptResponse.choices[0].message.content;

  // 添加 GPT 分析结果
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `AI Analysis`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${analysis}（AI-generated, for reference only）`,
      },
    },
  ];
}

/**
 * Send appointment information to Slack channel
 * @param appointmentId - Appointment ID
 * @param userId - User ID
 * @param channelId - Slack channel ID
 * @param thread_ts - Thread timestamp to reply in thread
 */
export async function sendAppointmentToSlack(appointmentId: number, userId: string, channelId: string, thread_ts?: string) {
  try {
    // Query appointment data
    const appointmentData = await queryByAppointmentId(appointmentId);

    // Format blocks
    const blocks = formatAppointmentBlocks(appointmentData, userId);

    // Send to Slack
    await postBlockMessage(channelId, thread_ts || '', blocks);

    // 分析数据
    const gptBlocks = await getAiMessage(appointmentData);

    // Send to Slack
    await postBlockMessage(channelId, thread_ts || '', gptBlocks);

    return true;
  } catch (error) {
    console.error('Failed to send appointment to Slack:', error);
    throw error;
  }
}

/**
 * Send appointment information to Slack channel
 * @param orderId - Order ID
 * @param userId - User ID
 * @param channelId - Slack channel ID
 * @param thread_ts - Thread timestamp to reply in thread
 */
export async function sendOrderToSlack(orderId: number, userId: string, channelId: string, thread_ts?: string) {
  try {
    // Query appointment data
    const appointmentData = await queryByOrderId(orderId);

    // Format blocks
    const blocks = formatAppointmentBlocks(appointmentData, userId);

    // Send to Slack
    await postBlockMessage(channelId, thread_ts || '', blocks);

    // 分析数据
    const gptBlocks = await getAiMessage(appointmentData);

    // Send to Slack
    await postBlockMessage(channelId, thread_ts || '', gptBlocks);

    return true;
  } catch (error) {
    console.error('Failed to send appointment to Slack:', error);
    throw error;
  }
}
