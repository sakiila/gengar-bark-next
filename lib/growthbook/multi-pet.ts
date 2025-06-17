import { initAppointmentConnection } from '@/lib/database/redshift';

const businessIds = [123568, 123569, 122818, 123292, 122106, 122285, 122617, 104562, 104585, 121423, 118830, 118114, 121823, 112365, 119088, 116501, 116617, 117241, 117243, 117244, 117253, 117254, 494, 101653, 105377, 108340, 108341, 113202, 122365, 122366, 114462, 114517, 122106, 122285, 122287, 122365, 122366, 122696, 122708, 122286, 122118, 118305, 118714, 118715, 119088, 118313, 118478, 118783, 116085, 121986, 118783, 123430, 113369, 123603, 105952, 105953, 104562, 118114, 118199, 119934, 123700, 116497, 122094];

export async function queryMultiPet(): Promise<{
  shiftManagement: { count: number };
  calendar: { count: number };
  allCount: number;
}> {
  try {
    const appointmentDB = await initAppointmentConnection();

    // 并行执行所有查询
    const [shiftManagementResult, calendarResult, allCount] = await Promise.all([
      // 查询开了 Shift management 的 by slot
      appointmentDB.query<{ count: number }[]>(
        `select distinct count(id)
         from moe_business.moe_business
         where staff_availability_type = 2
           and id = ANY($1)`,
        [businessIds],
      ),

      // 查询开了 Calendar indicator
      appointmentDB.query<{ count: number }[]>(
        `select  distinct count(business_id)
         from moe_business.moe_calendar
         where show_slot_location = 1
           and business_id = ANY($1)`,
        [businessIds],
      ),

      // 查询 businessIds 数量
      businessIds.length
    ]);

    console.log('查询结果:', {
      shiftManagement: shiftManagementResult[0],
      calendar: calendarResult[0],
      allCount: allCount,
    });

    return {
      shiftManagement: shiftManagementResult[0],
      calendar: calendarResult[0],
      allCount: allCount,
    };
  } catch (error) {
    console.error('查询失败:', error);
    throw error;
  }
}