import { initAppointmentConnection } from '@/lib/database/redshift';

const GB_TOKEN = process.env.GB_TOKEN;

export async function queryMultiPet(): Promise<{
  shiftManagement: { count: number };
  calendar: { count: number };
  allCount: number;
}> {

  const businessIds = await getBusinessIdsFromMultiPet();

  try {
    const appointmentDB = await initAppointmentConnection();

    const newBusinessIdsResult = await appointmentDB.query<{ business_id: string }[]>(
      `select distinct b.id as business_id
       from mysql_prod.moe_business.moe_business b
                left join mysql_prod.moe_business.moe_company c on b.company_id = c.id
                left join pg_moego_account_prod.public.account a on c.account_id = a.id
       where b.id = ANY ($1)
         and a.email not ilike '%moego.pet%' and a.email not ilike '%mymoement.com%'`,
      [businessIds],
    );

    // 提取 business_id 并转换为数字数组
    const newBusinessIds = newBusinessIdsResult.map(row => Number(row.business_id));

    console.log("newBusinessIds:", newBusinessIds);
    console.log("newBusinessIds length:", newBusinessIds.length);

    // 并行执行所有查询
    const [shiftManagementResult, calendarResult, allCount] = await Promise.all([
      // 查询开了 Shift management 的 by slot
      appointmentDB.query<{ count: number }[]>(
        `select distinct count(id)
         from moe_business.moe_business
         where staff_availability_type = 2
           and id = ANY($1)`,
        [newBusinessIds],
      ),

      // 查询开了 Calendar indicator
      appointmentDB.query<{ count: number }[]>(
        `select  distinct count(business_id)
         from moe_business.moe_calendar
         where show_slot_location = 1
           and business_id = ANY($1)`,
        [newBusinessIds],
      ),

      // 查询 newBusinessIds 数量
      newBusinessIds.length
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

async function getBusinessIdsFromMultiPet(): Promise<number[]> {
  const myHeaders = new Headers();
  myHeaders.append("Authorization", `Bearer ${GB_TOKEN}`);

  const requestOptions: RequestInit = {
    method: "GET",
    headers: myHeaders,
    redirect: "follow" as RequestRedirect
  };

  try {
    const response = await fetch("https://growthbook.moego.pet/growthbook-api/api/v1/features/enable_multi_pet_by_slot", requestOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // 提取 production 环境下 rules 的 condition 列表
    const productionRules = data.feature?.environments?.production?.rules || [];

    //  [ { business: { '$in': [Array] } } ]
    const conditions = productionRules.map((rule: any) => rule.condition || "{}").map((condition: string) => JSON.parse(condition));
    console.log("Production rules conditions:", conditions);

    const businessIds = conditions.map((condition: any) => condition.business?.['$in'] || []).flat().map(Number);
    console.log("Business IDs:", businessIds);

    return businessIds;

  } catch (err) {
    console.error("获取 GB 数据失败:", err);
    return [];
  }
}