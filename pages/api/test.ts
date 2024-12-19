import { NextApiRequest, NextApiResponse } from 'next';
import AppointmentService from '@/lib/moego/AppointmentService';
import { BusinessAccountResponse, Customer, Service } from '@/lib/moego/types';
import { timeUtils } from '@/lib/utils/time-utils';
import { dataImport, postBlockMessage } from '@/lib/slack/gengar-bolt';
import { ChannelService } from '@/lib/database/services/channel.service';
import { postgres } from '@/lib/database/supabase';

function getBlocks(username: string) {
  return [
    {
      'type': 'section',
      'text': {
        'type': 'mrkdwn',
        'text': '嗨，亲爱的 MoeGo 小伙伴。',
      },
    },
    {
      'type': 'section',
      'text': {
        'type': 'mrkdwn',
        'text': '这一年，我们共同经历了无数激动人心的时刻。从每一个灵感的闪现，到每一次挑战的跨越，你们的热情与坚持让这个旅程充满了无限可能。我们见证了 MoeGo 的成长、创意的碰撞和成果的累累，每一个成就都凝聚着你们的智慧与努力。',
      },
    },
    {
      'type': 'section',
      'text': {
        'type': 'mrkdwn',
        'text': '新的篇章即将开启。我们将继续携手并进，探索更多未知的领域，实现更大胆的想法。在即将到来的 2025 年，让我们满怀激情与信心，一起书写更加辉煌的故事！',
      },
    },
    {
      'type': 'section',
      'text': {
        'type': 'mrkdwn',
        'text': '“在平庸之海中漂泊，不要畏惧成为钻石或尘埃！”',
      },
    },
    {
      'type': 'actions',
      'elements': [
        {
          'type': 'button',
          'text': {
            'type': 'plain_text',
            'text': '点击开启 2024 年度回忆',
            'emoji': true,
          },
          'url': `https://pearl.baobo.me/report/${username}`,
        },
      ],
    },
  ];
}

export default async function personHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {

  const { data, error } = await postgres
  .from('report_2024')
  .select('email');
  if (error || !data) {
    console.error('Database error:', error);
    return res.status(500).json({ message: 'Failed to fetch email' });
  }

  const channelService = await ChannelService.getInstance();
  const channels = await channelService.findAll();

  const emails = data;
  for (let i = 0; i < emails.length; i++) {
    if (emails[i].email == 'bob@moego.pet') {
      const username = emails[i].email.split('@')[0].toLowerCase();
      console.log('username:', username);
      const user_id = channels.find((channel) => channel.email === emails[i].email)?.user_id;
      if (!user_id) {
        console.error('Failed to find user_id for:', emails[i].email);
        continue;
      }
      console.log('user_id:', user_id);
      await postBlockMessage(user_id, getBlocks(username));
    }
  }

  // await conversationsListForIm();

  // const email = req.body.email;
  // const slackName = req.body.slackName;
  // var customerKeyword = req.body.customerKeyword;
  //
  // const appointmentService = new AppointmentService("bob@moego.pet");
  //
  // await appointmentService.getLoginToken();
  //
  // const currentCookies = appointmentService.getCurrentCookies();
  // console.log("currentCookies:", currentCookies);
  //
  // if (!customerKeyword?.trim()) {
  //   customerKeyword = "";
  // }
  // const customer = await fetchCustomer(appointmentService, customerKeyword);
  // if (!customer) {
  //   return res.status(500).json({ message: "Failed to fetch customer" });
  // }
  //
  // const name = customer.firstName + " " + customer.lastName;

  // const pet = customer.petList[0];
  // if (!pet) {
  //   return res.status(500).json({ message: "Failed to fetch pet" });
  // }
  //
  // const accountInfo = await fetchAccount(appointmentService);
  // if (!accountInfo) {
  //   return res.status(500).json({ message: "Failed to fetch account" });
  // }
  //
  // const service = await fetchService(
  //   appointmentService,
  //   String(accountInfo?.business.id),
  //   String(pet.petId),
  // );
  //
  // if (!service) {
  //   return res.status(500).json({ message: "Failed to fetch service" });
  // }
  //
  // const result = await create(
  //   appointmentService,
  //   String(accountInfo?.business.id),
  //   String(customer.customerId),
  //   String(pet.petId),
  //   String(accountInfo?.staff.staffId),
  //   service,
  //   slackName,
  // );

  return res.status(200).json({ message: 'Success' });
}

async function create(
  appointmentService: AppointmentService,
  businessId: string,
  customerId: string,
  petId: string,
  staffId: string,
  service: Service,
  slackName: string,
) {
  const param = {
    businessId: businessId,
    appointment: {
      customerId: customerId,
      source: 22018,
      colorCode: '#bf81fe',
      allPetsStartAtSameTime: false,
    },
    petDetails: [
      {
        petId: petId,
        services: [
          {
            serviceId: service.id,
            petId: petId,
            serviceName: service.name,
            startDate: timeUtils.today(),
            startTime: timeUtils.minutesSinceMidnight(),
            feedings: [],
            medications: [],
            servicePrice: service.price,
            scopeTypePrice: 2,
            scopeTypeTime: 2,
            priceOverrideType: 0,
            durationOverrideType: 0,
            workMode: 0,
            enableOperation: false,
            operations: [],
            specificDates: [],
            quantityPerDay: 1,
            endDate: timeUtils.today(),
            serviceTime: service.duration,
            endTime: timeUtils.minutesSinceMidnight() + service.duration,
            staffId: service.availableStaffs?.ids[0] ?? staffId,
            serviceItemType: 1,
            serviceType: 1,
            dateType: 3,
          },
        ],
        addOns: [],
        evaluations: [],
      },
    ],
    preAuth: {
      enable: false,
      paymentMethodId: '',
      cardBrandLast4: '',
    },
    notes: [
      {
        note: `Created with Gengar AI by ${slackName}`,
        type: 1,
      },
    ],
    petBelongings: [],
  };

  try {
    const result = await appointmentService.createAppointment(param);

    if (result.success) {
      console.log('创建预约成功:', result.data);
      return result.data;
    } else {
      console.error('创建预约失败:', result.error);
    }
  } catch (error) {
    console.error('创建预约过程出错:', error);
  }
  return undefined;
}

async function fetchCustomer(
  appointmentService: AppointmentService,
  keyword: string,
): Promise<Customer | undefined> {
  try {
    const result = await appointmentService.fetchCustomers(keyword);

    if (result.success) {
      console.log('fetch customer success:', result.data);
      return result.data;
    } else {
      console.error('fetch customer fail:', result.error);
    }
  } catch (error) {
    console.error('fetch customer error:', error);
  }
  return undefined;
}

async function fetchService(
  appointmentService: AppointmentService,
  businessId: string,
  petId: string,
): Promise<Service | undefined> {
  try {
    const result = await appointmentService.fetchRandomService(
      businessId,
      petId,
    );

    if (result.success) {
      console.log('创建预约成功:', result.data);
      return result.data;
    } else {
      console.error('创建预约失败:', result.error);
    }
  } catch (error) {
    console.error('创建预约过程出错:', error);
  }
  return undefined;
}

async function fetchAccount(
  appointmentService: AppointmentService,
): Promise<BusinessAccountResponse | undefined> {
  try {
    const result = await appointmentService.fetchAccountInfo();

    if (result.success) {
      console.log('创建预约成功:', result.data);
      return result.data;
    } else {
      console.error('创建预约失败:', result.error);
    }
  } catch (error) {
    console.error('创建预约过程出错:', error);
  }
  return undefined;
}
