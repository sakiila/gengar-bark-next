import { BusinessAccountResponse, Customer, Service } from "@/lib/moego/types";
import { timeUtils } from "@/lib/utils/time-utils";
import AppointmentService from "./AppointmentService";

export default async function compositeCreateAppointment(
  slackName: string,
  email: string,
  quantity: number,
  customerKeyword?: string,
  date?: string,
  time?: number,
): Promise<string> {
  const appointmentService = new AppointmentService(email);

  await appointmentService.getLoginToken();

  const currentCookies = appointmentService.getCurrentCookies();
  console.log("currentCookies:", currentCookies);

  const message = "Created appointment(s) success: ";

  // Create an array of promises for all appointments
  const appointmentPromises = Array.from({ length: quantity }, () =>
    compositeCreateOneAppointment(
      appointmentService,
      slackName,
      email,
      customerKeyword,
      date,
      time,
    ),
  );

  // Wait for all promises to resolve in parallel
  const ids = await Promise.all(appointmentPromises);

  // Check if any appointments failed to create (returned null/undefined)
  if (ids.some((id) => !id)) {
    appointmentService.logout();
    throw new Error("Failed to create one or more appointments");
  }
  appointmentService.logout();

  return message + ids.join(", ");
}

async function compositeCreateOneAppointment(
  appointmentService: AppointmentService,
  slackName: string,
  email: string,
  customerKeyword?: string,
  date?: string,
  time?: number,
): Promise<string> {
  if (!customerKeyword?.trim()) {
    customerKeyword = "";
  }
  const customer = await fetchCustomer(appointmentService, customerKeyword);
  if (!customer) {
    throw new Error("Failed to fetch customer");
  }

  const pet = customer.petList[0];
  if (!pet) {
    throw new Error("Failed to fetch pet");
  }

  const accountInfo = await fetchAccount(appointmentService);
  if (!accountInfo) {
    throw new Error("Failed to fetch account");
  }

  const service = await fetchService(
    appointmentService,
    String(accountInfo?.business.id),
    String(pet.petId),
  );

  if (!service) {
    throw new Error("Failed to fetch service");
  }

  const result = await create(
    appointmentService,
    String(accountInfo?.business.id),
    String(customer.customerId),
    String(pet.petId),
    String(accountInfo?.staff.staffId),
    service,
    slackName,
    date,
    time,
  );

  return result?.appointmentId;
}

async function create(
  appointmentService: AppointmentService,
  businessId: string,
  customerId: string,
  petId: string,
  staffId: string,
  service: Service,
  slackName: string,
  date?: string,
  time?: number,
) {
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
            startDate:
              date == undefined || date.length == 0 ? timeUtils.today() : date,
            startTime:
              time == undefined || time == 0
                ? timeUtils.minutesSinceMidnight()
                : time,
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
            endTime:
              time == undefined || time == 0
                ? timeUtils.minutesSinceMidnight() + service.duration
                : time + service.duration,
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
      // console.log("create success:", result.data);
      return result.data;
    } else {
      console.error("create fail:", result.error);
    }
  } catch (error) {
    console.error("create error:", error);
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
      // console.log("fetchCustomer success:", result.data);
      return result.data;
    } else {
      console.error("fetchCustomer fail:", result.error);
    }
  } catch (error) {
    console.error("fetchCustomer error:", error);
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
      // console.log("fetchService success:", result.data);
      return result.data;
    } else {
      console.error("fetchService fail:", result.error);
    }
  } catch (error) {
    console.error("fetchService error:", error);
  }
  return undefined;
}

async function fetchAccount(
  appointmentService: AppointmentService,
): Promise<BusinessAccountResponse | undefined> {
  try {
    const result = await appointmentService.fetchAccountInfo();

    if (result.success) {
      // console.log("fetchAccount success:", result.data);
      return result.data;
    } else {
      console.error("fetchAccount fail:", result.error);
    }
  } catch (error) {
    console.error("fetchAccount error:", error);
  }
  return undefined;
}
