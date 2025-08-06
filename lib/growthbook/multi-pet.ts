import { initAppointmentConnection } from '@/lib/database/redshift';
import { postgres } from '@/lib/database/supabase';

const GB_TOKEN = process.env.GB_TOKEN;

export async function queryMultiPet(): Promise<any[]> {

  // const businessIds = await getBusinessIdsFromMultiPet();

  const allResults = [];
  const limit = 200;
  let offset = 0;

  const appointmentDB = await initAppointmentConnection();

  // 将 oldResults 的数据类型改成和 newResults 一致
  const { data: oldResults } = await postgres.from('book_by_slot_watch')
  .select(`business_id, company_id, owner_email, staff_availability_type, show_slot_location, show_slot_time`);

  // 在每一个分页中执行下面所有的操作，将结果合并
  while (true) {
    try {
      const newResults = await appointmentDB.query<{
        business_id: number,
        company_id: number,
        owner_email: string,
        staff_availability_type: number,
        show_slot_location: number,
        show_slot_time: number
      }[]>(
        `select b.id    as business_id,
                c.id    as company_id,
                a.email as owner_email,
                b.staff_availability_type,
                cal.show_slot_location,
                cal.show_slot_time
         from mysql_prod.moe_business.moe_business b
                  left join mysql_prod.moe_business.moe_company c on b.company_id = c.id
                  left join pg_moego_account_prod.public.account a on c.account_id = a.id
                  left join moe_business.moe_calendar cal on cal.business_id = b.id
         where b.company_id > 0
           and c.level > 0
           and b.app_type in (1, 2)
           and a.email not ilike '%moego.pet%'
           and a.email not ilike '%mymoement.com%'
         order by b.id
             limit ${limit}
         offset ${offset}`,
      );

      if (newResults.length === 0) {
        console.log('No more data');
        break;
      }

      // 遍历 newResults 和 oldResults，如果 newResults 中的 business_id 在 oldResults 中不存在，则将 newResults 中的数据插入到 book_by_slot_watch 表中
      // 由于 oldResults 可能为 null，需要先判断
      const results = [];

      if (!oldResults) {
        console.log('No old results');
        break;
      }

      for (const newResult of newResults) {
        const oldResult = oldResults.find((result: any) => Number(result.business_id) === Number(newResult.business_id));
        if (!oldResult) {
          await postgres.from('book_by_slot_watch').insert({
            business_id: Number(newResult.business_id),
            company_id: Number(newResult.company_id),
            owner_email: newResult.owner_email,
            staff_availability_type: Number(newResult.staff_availability_type),
            show_slot_location: Number(newResult.show_slot_location),
            show_slot_time: Number(newResult.show_slot_time),
          });
        }
      }

      // 遍历 oldResults 和 newResults，如果 staff_availability_type 或 show_slot_location 或 show_slot_time 有变化，则查询出来，记录变化前后的数据，并返回
      for (const oldResult of oldResults) {
        const newResult = newResults.find((result: any) => Number(result.business_id) === Number(oldResult.business_id));
        if (
          (newResult && Number(newResult.staff_availability_type) !== Number(oldResult.staff_availability_type) && Number(newResult.staff_availability_type) === 2) ||
          (newResult && Number(newResult.show_slot_location) !== Number(oldResult.show_slot_location) && Number(newResult.show_slot_location) === 1) ||
          (newResult && Number(newResult.show_slot_time) !== Number(oldResult.show_slot_time) && Number(newResult.show_slot_time) === 1)
        ) {
          results.push({
            oldResult,
            newResult,
          });
        }
      }

      if (results.length > 0) {
        console.log('results:', results);
      }

      // 遍历 oldResults 和 newResults，如果 staff_availability_type 或 show_slot_location 或 show_slot_time 有变化，更新 book_by_slot_watch 表中的数据
      for (const oldResult of oldResults) {
        const newResult = newResults.find((result: any) => Number(result.business_id) === Number(oldResult.business_id));
        if (newResult && (Number(newResult.staff_availability_type) !== Number(oldResult.staff_availability_type) || Number(newResult.show_slot_location) !== Number(oldResult.show_slot_location) || Number(newResult.show_slot_time) !== Number(oldResult.show_slot_time))) {
          await postgres.from('book_by_slot_watch').update({
            staff_availability_type: Number(newResult.staff_availability_type),
            show_slot_location: Number(newResult.show_slot_location),
            show_slot_time: Number(newResult.show_slot_time),
            update_time: new Date().toISOString(),
          }).eq('business_id', Number(oldResult.business_id));
        }
      }

      allResults.push(...results);
      offset += limit;

    } catch (error) {
      console.error('查询失败:', error);
      break;
    }

  }

  // 查询已删除的 business，并删除
  const updateTime = new Date(
    new Date().setMonth(
      new Date().getMonth() - 1,
    ),
  ).getTime() / 1000;
  const needDeleteResults = await appointmentDB.query<{
    business_id: number,
  }[]>(
    `select b.id as business_id
     from mysql_prod.moe_business.moe_business b
              left join mysql_prod.moe_business.moe_company c on b.company_id = c.id
              left join pg_moego_account_prod.public.account a on c.account_id = a.id
     where (b.company_id <= 0 or c.level <= 0)
       and b.app_type in (1, 2)
       and a.email not ilike '%moego.pet%'
           and a.email not ilike '%mymoement.com%'
           and b.update_time > ${updateTime}
    `,
  );
  let needDeleteBusinessIds = needDeleteResults.map((result: any) => Number(result.business_id));
  console.log('needDeleteBusinessIds:', needDeleteBusinessIds);
  await postgres.from('book_by_slot_watch').delete().in('business_id', needDeleteBusinessIds);

  return allResults;
}

export async function queryMultiPetCount(): Promise<{
  totalCount: number;
  staffAvailabilityType2Count: number;
  staffAvailabilityType2Pct: number;
  showSlotLocation1Count: number;
  showSlotLocation1Pct: number;
}> {
  const { data: results } = await postgres.from('book_by_slot_watch')
  .select(`business_id, company_id, owner_email, staff_availability_type, show_slot_location, show_slot_time`);

  if (!results) {
    console.log('No old results');
    return {
      totalCount: 0,
      staffAvailabilityType2Count: 0,
      staffAvailabilityType2Pct: 0,
      showSlotLocation1Count: 0,
      showSlotLocation1Pct: 0,
    };
  }

  const totalCount = results.length;

  // 计算 staff_availability_type 为 2 的百分比
  const staffAvailabilityType2Count = results.filter((result: any) => Number(result.staff_availability_type) === 2).length;
  const staffAvailabilityType2Pct = Number(((staffAvailabilityType2Count / totalCount) * 100).toFixed(2)) || 0;

  // 计算 show_slot_location 为 1 的百分比，保留两位小数
  const showSlotLocation1Count = results.filter((result: any) => Number(result.show_slot_location) === 1).length;
  const showSlotLocation1Pct = Number(((showSlotLocation1Count / totalCount) * 100).toFixed(2)) || 0;

  return {
    totalCount,
    staffAvailabilityType2Count,
    staffAvailabilityType2Pct,
    showSlotLocation1Count,
    showSlotLocation1Pct,
  };
}

async function getBusinessIdsFromMultiPet(): Promise<number[]> {
  const myHeaders = new Headers();
  myHeaders.append('Authorization', `Bearer ${GB_TOKEN}`);

  const requestOptions: RequestInit = {
    method: 'GET',
    headers: myHeaders,
    redirect: 'follow' as RequestRedirect,
  };

  try {
    const response = await fetch('https://growthbook.moego.pet/growthbook-api/api/v1/features/enable_multi_pet_by_slot', requestOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // 提取 production 环境下 rules 的 condition 列表
    const productionRules = data.feature?.environments?.production?.rules || [];

    //  [ { business: { '$in': [Array] } } ]
    const conditions = productionRules.map((rule: any) => rule.condition || '{}').map((condition: string) => JSON.parse(condition));
    console.log('Production rules conditions:', conditions);

    const businessIds = conditions.map((condition: any) => condition.business?.['$in'] || []).flat().map(Number);
    console.log('Business IDs:', businessIds);

    return businessIds;

  } catch (err) {
    console.error('获取 GB 数据失败:', err);
    return [];
  }
}