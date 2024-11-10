import { NextApiRequest, NextApiResponse } from "next";
import AppointmentService from "@/lib/moego/AppointmentService";
import { BusinessAccountResponse, Customer, Service } from "@/lib/moego/types";
import { dateUtils } from "@/lib/dateUtils";

export default async function personHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const email = req.body.email;
  const slackName = req.body.slackName;
  var customerKeyword = req.body.customerKeyword;

  const appointmentService = new AppointmentService("bob@moego.pet");

  await appointmentService.getLoginToken();

  const currentCookies = appointmentService.getCurrentCookies();
  console.log("currentCookies:", currentCookies);

  if (!customerKeyword) {
    customerKeyword = getRandomHighFrequencyLetter();
  }
  const customer = await fetchCustomer(appointmentService, customerKeyword);
  if (!customer) {
    return res.status(500).json({ message: "Failed to fetch customer" });
  }

  const pet = customer.petList[0];
  if (!pet) {
    return res.status(500).json({ message: "Failed to fetch pet" });
  }

  const accountInfo = await fetchAccount(appointmentService);
  if (!accountInfo) {
    return res.status(500).json({ message: "Failed to fetch account" });
  }

  const service = await fetchService(
    appointmentService,
    String(accountInfo?.business.id),
    String(pet.petId),
  );

  if (!service) {
    return res.status(500).json({ message: "Failed to fetch service" });
  }

  const result = await create(
    appointmentService,
    String(accountInfo?.business.id),
    String(customer.customerId),
    String(pet.petId),
    String(accountInfo?.staff.staffId),
    service,
    slackName,
  );

  return res.status(200).json({ message: result });
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
  await appointmentService.getLoginToken();

  var currentCookies = appointmentService.getCurrentCookies();
  console.log("currentCookies:", currentCookies);

  const param = {
    businessId: businessId,
    appointment: {
      customerId: customerId,
      source: 22018,
      colorCode: "#bf81fe",
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
            startDate: dateUtils.today(),
            startTime: dateUtils.minutesSinceMidnight(),
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
            endDate: dateUtils.today(),
            serviceTime: service.duration,
            endTime: dateUtils.minutesSinceMidnight() + service.duration,
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
      paymentMethodId: "",
      cardBrandLast4: "",
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
      console.log("创建预约成功:", result.data);
      return result.data;
    } else {
      console.error("创建预约失败:", result.error);
    }
  } catch (error) {
    console.error("创建预约过程出错:", error);
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
      console.log("创建预约成功:", result.data);
      return result.data;
    } else {
      console.error("创建预约失败:", result.error);
    }
  } catch (error) {
    console.error("创建预约过程出错:", error);
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
      console.log("创建预约成功:", result.data);
      return result.data;
    } else {
      console.error("创建预约失败:", result.error);
    }
  } catch (error) {
    console.error("创建预约过程出错:", error);
  }
  return undefined;
}

async function fetchAccount(
  appointmentService: AppointmentService,
): Promise<BusinessAccountResponse | undefined> {
  try {
    const result = await appointmentService.fetchAccountInfo();

    if (result.success) {
      console.log("创建预约成功:", result.data);
      return result.data;
    } else {
      console.error("创建预约失败:", result.error);
    }
  } catch (error) {
    console.error("创建预约过程出错:", error);
  }
  return undefined;
}

function getRandomHighFrequencyLetter() {
  const highFrequencyLetters = [
    "e",
    "t",
    "a",
    "o",
    "i",
    "n",
    "s",
    "h",
    "r",
    "d",
    "l",
  ];
  const randomIndex = Math.floor(Math.random() * highFrequencyLetters.length);
  return highFrequencyLetters[randomIndex];
}
