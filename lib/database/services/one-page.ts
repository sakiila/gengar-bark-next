import { initAppointmentConnection, initOrderConnection } from '../redshift';

// 完整的预约信息接口
interface Appointment {
  id: number;                               // bigint
  order_id: string;                         // varchar(120)
  business_id: number;                      // integer
  customer_id: number;                      // integer
  appointment_date: string;                 // varchar(60)
  appointment_start_time: number;           // integer
  appointment_end_time: number;             // integer
  is_waiting_list: number;                  // smallint
  move_waiting_by: number;                  // integer
  confirmed_time: number;                   // bigint
  check_in_time: number;                    // bigint
  check_out_time: number;                   // bigint
  canceled_time: number;                    // bigint
  status: number;                           // smallint
  is_block: number;                         // smallint
  book_online_status: number;               // smallint
  customer_address_id: number;              // integer
  repeat_id: number;                        // integer
  is_paid: number;                          // smallint
  color_code: string;                       // varchar(60)
  no_show: number;                          // smallint
  no_show_fee: number;                      // numeric(10,4)
  is_pust_notification: number;             // smallint
  cancel_by_type: number;                   // smallint
  cancel_by: number;                        // integer
  confirm_by_type: number;                  // smallint
  confirm_by: number;                       // integer
  created_by_id: number;                    // integer
  out_of_area: number;                      // smallint
  is_deprecate: number;                     // smallint
  create_time: number;                      // bigint
  update_time: number;                      // bigint
  source: number;                           // integer
  old_appointment_date: string;             // varchar(60)
  old_appointment_start_time: number;       // integer
  old_appointment_end_time: number;         // integer
  old_appt_id: number;                      // integer
  schedule_type: number;                    // smallint
  source_platform: string;                  // varchar(765)
  ready_time: number;                       // bigint
  pickup_notification_send_status: number;  // integer
  pickup_notification_failed_reason: string;// varchar(765)
  status_before_checkin: number;           // smallint
  status_before_ready?: number;            // smallint, nullable
  status_before_finish?: number;           // smallint, nullable
  no_start_time: number;                   // smallint
  updated_by_id: number;                   // bigint
  company_id: number;                      // bigint
  is_auto_accept: number;                  // smallint
  wait_list_status: number;                // smallint
  appointment_end_date: string;            // varchar(30)
  service_type_include: number;            // integer
}

// 简化版的预约信息接口，只包含需要的字段
interface SimpleAppointment {
  id: number;
  company_id: number;
  business_id: number;
  customer_id: number;
  appointment_date: string;
  appointment_end_date: string;
  appointment_start_time: number;
  appointment_end_time: number;
  status: number;
  create_time: number;
}

interface Order {
  id: number;                           // bigint
  business_id: number;                  // bigint
  status: number;                       // smallint
  payment_status: string;               // varchar(150)
  fulfillment_status?: string;         // varchar(150), nullable
  guid?: string;                       // varchar(300), nullable
  source_type?: string;                // varchar(60), nullable
  source_id?: number;                  // bigint, nullable
  line_item_types: number;             // integer
  version: number;                     // integer
  customer_id: number;                 // bigint
  tips_amount: number;                 // numeric(20,2)
  tax_amount: number;                  // numeric(20,2)
  discount_amount: number;             // numeric(20,2)
  extra_fee_amount: number;            // numeric(20,2)
  sub_total_amount: number;            // numeric(20,2)
  tips_based_amount: number;           // numeric(20,2)
  total_amount: number;                // numeric(20,2)
  paid_amount: number;                 // numeric(20,2)
  remain_amount: number;               // numeric(20,2)
  refunded_amount: number;             // numeric(20,2)
  title?: string;                      // varchar(32768), nullable
  description?: string;                // varchar(32768), nullable
  create_by?: number;                  // bigint, nullable
  update_by?: number;                  // bigint, nullable
  create_time: Date;                   // timestamp
  update_time: Date;                   // timestamp
  complete_time?: Date;                // timestamp, nullable
  order_type: string;                  // varchar(192)
  order_ref_id: number;                // bigint
  extra_charge_reason: string;         // varchar(192)
  order_version: number;               // smallint
  tax_round_mod?: number;              // smallint, nullable
  company_id?: number;                 // bigint, nullable
  currency_code?: string;              // varchar(32768), nullable
}

// Pet Detail 接口
interface PetDetail {
  id: number;                           // integer
  grooming_id: number;                  // integer
  pet_id: number;                       // integer
  staff_id: number;                     // integer
  service_id: number;                   // integer
  service_type: number;                 // smallint
  service_time: number;                 // integer
  service_price: number;                // numeric(10,2)
  start_time: number;                   // bigint
  end_time: number;                     // bigint
  status: number;                       // smallint
  update_time: number;                  // bigint
  scope_type_price: number;             // smallint
  scope_type_time: number;              // smallint
  star_staff_id: number;                // integer
  package_service_id: number;           // integer
  service_name: string;                 // varchar(450)
  service_description?: string;         // varchar(65535), nullable
  tax_id: number;                       // integer
  tax_rate: number;                     // numeric(10,4)
  enable_operation: number;             // smallint
  work_mode: number;                    // smallint
  service_color_code: string;           // varchar(60)
  start_date: string;                   // varchar(30)
  end_date: string;                     // varchar(30)
  service_item_type: number;            // smallint
  lodging_id: number;                   // bigint
  price_unit: number;                   // integer
  specific_dates?: string;              // varchar(3072), nullable
  associated_service_id: number;        // bigint
  created_at?: Date;                    // timestamp, nullable
  updated_at?: Date;                    // timestamp, nullable
  price_override_type: number;          // smallint
  duration_override_type: number;       // smallint
  quantity_per_day: number;             // integer
  date_type: number;                    // integer
}

// 简化版的 PetDetail 接口
interface SimplePetDetail {
  id: number;                           // integer
  pet_id: number;                       // integer
  staff_id: number;                     // integer
  service_id: number;                   // integer
  service_type: number;                 // smallint
  service_time: number;                 // integer
  service_price: number;                // numeric(10,2)
  start_time: number;                   // bigint
  end_time: number;                     // bigint
  enable_operation: number;             // smallint
  work_mode: number;                    // smallint
  start_date: string;                   // varchar(30)
  end_date: string;                     // varchar(30)
  service_item_type: number;            // smallint
  lodging_id: number;                   // bigint
  price_unit: number;                   // integer
  specific_dates?: string;              // varchar(3072), nullable
  associated_service_id: number;        // bigint
  date_type: number;                    // integer
}

// 简化版的 Order 接口
interface SimpleOrder {
  id: number;                           // bigint
  business_id: number;                  // bigint
  status: number;                       // smallint
  payment_status: string;               // varchar(150)
  customer_id: number;                  // bigint
  tips_amount: number;                  // numeric(20,2)
  tax_amount: number;                   // numeric(20,2)
  discount_amount: number;              // numeric(20,2)
  sub_total_amount: number;             // numeric(20,2)
  total_amount: number;                 // numeric(20,2)
  paid_amount: number;                  // numeric(20,2)
  remain_amount: number;                // numeric(20,2)
  create_time: Date;                    // timestamp
  order_type: string;                   // varchar(192)
  company_id?: number;                  // bigint, nullable
}

// 修改组合查询结果接口
interface AppointmentWithDetails {
  appointment: Appointment;
  petDetails: PetDetail[];
  order?: Order;
}

// 查询 Appointment、PetDetail 和 Order
export async function queryByAppointmentId(appointmentId: number): Promise<AppointmentWithDetails> {
  try {
    const appointmentDB = await initAppointmentConnection();
    const orderDB = await initOrderConnection();

    // 并行执行所有查询
    const [appointmentResult, petDetailResult, orderResult] = await Promise.all([
      // 查询预约信息
      appointmentDB.query<Appointment[]>(
        `select *
         from moe_grooming.moe_grooming_appointment
         where id = $1`,
        [appointmentId],
      ),

      // 查询宠物详情
      appointmentDB.query<PetDetail[]>(
        `select *
         from moe_grooming.moe_grooming_pet_detail
         where status = 1
           and grooming_id = $1`,
        [appointmentId],
      ),

      // 查询订单信息
      orderDB.query<Order[]>(
        `select *
         from "order"
         where source_type = 'appointment'
           and source_id = $1`,
        [appointmentId],
      ),
    ]);

    console.log('查询结果:', {
      appointment: appointmentResult[0],
      petDetails: petDetailResult,
      order: orderResult[0],
    });

    return {
      appointment: appointmentResult[0],
      petDetails: petDetailResult,
      order: orderResult[0],
    };
  } catch (error) {
    console.error('查询失败:', error);
    throw error;
  }
}
