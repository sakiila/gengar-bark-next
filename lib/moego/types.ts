export interface GPTResponse {
  intent: string;
  quantity: number;
  email?: string;
  customerName?: string;
  date?: string;
  time?: number;
}

export interface LoginTokenRequest {
  email: string;
  source: "business";
  renewable: boolean;
  maxAge: string;
}

export interface LoginTokenResponse {
  token: string;
  cookie: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Pet {
  petId: number;
  customerId: number;
  petName: string;
  breed: string;
  lifeStatus: number;
  evaluationStatus: number;
}

export interface Customer {
  customerId: number;
  firstName: string;
  lastName: string;
  avatarPath: string;
  clientColor: string;
  phoneNumber: string;
  email: string;
  preferredFrequencyType: number;
  preferredFrequencyDay: number;
  petList: Pet[];
  totalPaid: number;
  totalApptCount: number;
  overdue: number | null;
  lastServiceTime: string;
  expectedServiceTime: string;
  upcomingBooking: null;
  isNewCustomer: boolean;
  isProspectCustomer: boolean;
  hasPetParentAppAccount: boolean;
  inactive: number;
  isUnsubscribed: number;
  membershipSubscriptions: any[];
  blockedServiceItemTypes: any[];
}

export interface QueryParams {
  queries?: {
    keyword: string;
  };
  sort?: {
    property: string;
    order: "asc" | "desc";
  };
  source?: number;
  viewId?: number;
  pageNum?: number;
  pageSize?: number;
}

export interface ServiceRequestPayload {
  serviceType: number;
  selectedServiceIds: string[];
  petId: string;
  businessId: string;
  onlyAvailable: boolean;
  selectedServiceItemType: number;
  inactive: boolean;
  serviceItemType: number;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  priceUnit: number;
  duration: number;
  type: number;
  categoryId: string;
  priceOverrideType: number;
  durationOverrideType: number;
  taxId: string;
  serviceItemType: number;
  description: string;
  requireDedicatedStaff: boolean;
  requireDedicatedLodging: boolean;
  inactive: boolean;
  maxDuration: number;
  images: string[];
  staffOverrideList: any[];
  availableStaffs: {
    isAllAvailable: boolean;
    ids: string[];
  };
  lodgingFilter: boolean;
  customizedLodgings: any[];
}

export interface Category {
  categoryId: string;
  name: string;
  services: Service[];
}

export interface ServiceResponse {
  categoryList: Category[];
  pagination: {
    total: number;
    pageSize: number;
    pageNum: number;
  };
}

export interface ServiceReq {
  serviceId: string;
  petId: string;
  serviceName: string;
  startDate: string;
  startTime: number;
  feedings: any[];
  medications: any[];
  servicePrice: number;
  scopeTypePrice: number;
  scopeTypeTime: number;
  priceOverrideType: number;
  durationOverrideType: number;
  workMode: number;
  enableOperation: boolean;
  operations: any[];
  specificDates: any[];
  quantityPerDay: number;
  endDate: string;
  serviceTime: number;
  endTime: number;
  staffId: string;
  serviceItemType: number;
  serviceType: number;
  dateType: number;
}

export interface PetDetail {
  petId: string;
  services: ServiceReq[];
  addOns: any[];
  evaluations: any[];
}

export interface PreAuth {
  enable: boolean;
  paymentMethodId: string;
  cardBrandLast4: string;
}

export interface CreateAppointmentRequest {
  businessId: string;
  appointment: {
    customerId: string;
    source: number;
    colorCode: string;
    allPetsStartAtSameTime: boolean;
  };
  petDetails: PetDetail[];
  preAuth: PreAuth;
  notes: any[];
  petBelongings: any[];
}

export interface BusinessAccountResponse {
  account: {
    accountId: number;
    email: string;
    avatarPath: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    token: string | null;
    lastBusinessId: number;
    status: string | null;
    createTime: number;
    updateTime: number;
    passwordUpdateTime: number;
  };
  business: {
    id: number;
    companyId: number;
    businessName: string;
    phoneNumber: string;
    avatarPath: string;
    website: string;
    address: string;
    address1: string;
    address2: string;
    addressCity: string;
    addressState: string;
    addressZipcode: string;
    addressCountry: string;
    addressLat: string;
    addressLng: string;
    country: string;
    countryAlpha2Code: string;
    countryCode: string;
    currencySymbol: string;
    currencyCode: string;
    timeFormatType: number;
    unitOfWeightType: number;
    unitOfDistanceType: number;
    timezoneName: string;
    timezoneSeconds: number;
    dateFormatType: number;
    calendarFormatType: number;
    numberFormatType: number;
    bookOnlineName: string;
    appType: number;
    primaryPayType: number;
    source: number;
    clockInOutEnable: number;
    clockInOutNotify: number;
    isEnableAccessCode: number;
    smartScheduleMaxDist: number;
    smartScheduleMaxTime: number;
    serviceAreaEnable: number;
    createTime: number;
    updateTime: number;
    facebook: string;
    instagram: string;
    google: string;
    yelp: string;
    smartScheduleStartLat: string;
    smartScheduleStartLng: string;
    smartScheduleEndLat: string;
    smartScheduleEndLng: string;
    smartScheduleServiceRange: number;
    smartScheduleStartAddr: string;
    smartScheduleEndAddr: string;
    sourceFrom: number;
    messageSendBy: number;
    sendDaily: number;
    businessMode: number;
    knowAboutUs: string | null;
    apptPerWeek: number;
    businessYears: number;
    moveFrom: number;
    retailEnable: number;
    notificationSoundEnable: number;
    contactEmail: string;
    invitationCode: string;
    maxVansNum: number;
    tiktok: string;
  };
  preference: {
    country: string;
    currencySymbol: string;
    currencyCode: string;
    timeFormatType: number;
    timeFormat: string;
    unitOfWeightType: number;
    unitOfWeight: string;
    unitOfDistanceType: number;
    unitOfDistance: string;
    timezoneName: string;
    timezoneSeconds: number;
    dateFormatType: number;
    dateFormat: string;
    calendarFormatType: number;
    calendarFormat: string;
    numberFormatType: number;
    numberFormat: string;
    autoReplyStatus: number;
    messageSendBy: number;
    notificationSoundEnable: number;
    needSendCode: boolean;
  };
  staff: {
    staffId: number;
    roleId: number;
    avatarPath: string;
    firstName: string;
    lastName: string;
    colorCode: string;
    employeeCategory: number;
    phoneNumber: string;
    note: string;
    bookOnlineAvailable: number;
    showOnCalendar: number;
    showCalendarStaffAll: number;
    accessCode: string;
    token: string;
  };
  company: {
    id: number;
    name: string;
    accountId: number;
    country: string;
    createTime: number;
    updateTime: number;
    locationNum: number;
    vansNum: number;
    level: number;
    isNewPricing: number;
    companyType: number;
    enableSquare: number;
    enableStripeReader: number;
    enterpriseId: number;
    premiumType: number;
    planVersion: number;
  };
}
