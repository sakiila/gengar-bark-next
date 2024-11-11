import {
  ApiResponse,
  BusinessAccountResponse,
  CreateAppointmentRequest,
  Customer,
  LoginCredentials,
  LoginTokenRequest,
  LoginTokenResponse,
  QueryParams,
  Service,
  ServiceRequestPayload,
  ServiceResponse,
} from "@/lib/moego/types";

class AppointmentService {
  private email: string;
  private baseURL: string;
  private cookies: string[];
  private isAuthenticated: boolean;
  private businessId: string | null = null;
  private customerId: string | null = null;

  constructor(email: string, baseURL: string = "https://go.t2.moego.dev") {
    this.email = email.trim();
    this.baseURL = baseURL;
    this.cookies = [];
    this.isAuthenticated = false;
  }

  setContext(businessId: string, customerId: string) {
    this.businessId = businessId;
    this.customerId = customerId;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en,zh-CN;q=0.9,zh;q=0.8",
      "content-type": "application/json",
      origin: this.baseURL,
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
    };

    // 添加业务相关的请求头
    if (this.businessId) {
      headers["~b"] = this.businessId;
    }
    if (this.customerId) {
      headers["~c"] = this.customerId;
    }

    // 添加 cookies
    if (this.cookies.length > 0) {
      headers["cookie"] = this.cookies.join("; ");
    }

    return headers;
  }

  private storeCookies(response: Response): void {
    const setCookieHeader = response.headers.get("set-cookie");
    if (setCookieHeader) {
      // 处理多个 Set-Cookie 头（它们会被合并成一个字符串，用逗号分隔）
      this.cookies = setCookieHeader
        .split(",")
        .map((cookie) => cookie.trim().split(";")[0]);
    }
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (!response.ok) {
      if (response.status === 401) {
        this.isAuthenticated = false;
        this.cookies = [];
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    this.storeCookies(response);

    const data = await response.json();
    return {
      success: true,
      data,
    };
  }

  async getLoginToken(): Promise<LoginTokenResponse> {
    const url =
      "https://mis.t2.moego.dev/moego.admin.account.v1.AccountService/CreateLoginToken";

    const requestBody: LoginTokenRequest = {
      email: this.email,
      source: "business",
      renewable: true,
      maxAge: "1296000s", // 15 days in seconds
    };

    console.log("requestBody:", requestBody);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          accept: "*/*",
          "accept-language": "en,zh-CN;q=0.9,zh;q=0.8",
          "cache-control": "no-cache",
          "content-type": "application/json",
          dnt: "1",
          origin: "https://mis.t2.moego.dev",
          pragma: "no-cache",
          referer: "https://mis.t2.moego.dev/account/impersonate",
          "sec-ch-ua":
            '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          cookie:
            "MGSID-MIS-T2=1555858.3ELzJLc3Sz0aPXI43Sp_RLhQi7ZSrVLJdMsk31TQNRo",
        },
        credentials: "include", // This will include cookies in the request
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorResponse = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers),
          body: await response.text(),
        };
        console.error("Failed response details:", errorResponse);
        throw new Error(`Impersonate error! status: ${response.status}`);
      }

      const data = await response.json();

      this.cookies = data.token ? ["MGSID-B-T2=" + data.token] : [];
      this.isAuthenticated = true;

      return {
        token: data.token || "",
        cookie: data.token || "",
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "获取登录令牌失败",
      );
    }
  }

  async login(credentials: LoginCredentials): Promise<ApiResponse> {
    try {
      const response = await fetch(
        `);${this.baseURL}/moego.api.account.v1.AccountAccessService/Login`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify({
            byEmailPassword: {
              email: credentials.email,
              password: credentials.password,
            },
          }),
        },
      );

      const result = await this.handleResponse(response);
      this.isAuthenticated = true;
      return result;
    } catch (error) {
      this.isAuthenticated = false;
      this.cookies = [];
      return {
        success: false,
        error: error instanceof Error ? error.message : "登录失败",
      };
    }
  }

  async createAppointment(
    params: CreateAppointmentRequest,
  ): Promise<ApiResponse> {
    if (!this.isLoggedIn()) {
      return {
        success: false,
        error: "需要先登录才能创建预约",
      };
    }

    try {
      const response = await fetch(
        `${this.baseURL}/moego.api.appointment.v1.AppointmentService/CreateAppointment`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(params),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "创建预约失败",
      };
    }
  }

  async fetchAccountInfo(): Promise<ApiResponse> {
    if (!this.isLoggedIn()) {
      return {
        success: false,
        error: "需要先登录才能创建预约",
      };
    }

    try {
      const response = await fetch(
        `${this.baseURL}/api/business/account/v2/info`,
        {
          method: "GET",
          headers: this.getHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "创建预约失败",
      };
    }
  }

  async fetchCustomers(keyword: string): Promise<ApiResponse> {
    if (!this.isLoggedIn()) {
      return {
        success: false,
        error: "需要先登录才能获取顾客信息",
      };
    }

    const defaultParams: QueryParams = {
      source: 1,
      pageNum: 1,
      pageSize: 1,
      sort: {
        property: "first_name",
        order: "asc",
      },
      queries: {
        keyword: keyword,
      },
    };

    try {
      const response = await fetch(`${this.baseURL}/api/customer/smart-list`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(defaultParams),
        credentials: "include", // Include cookies in the request
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("data:", data);
      const clientPage = data.clientPage;
      const customers = clientPage.dataList as Customer[];

      return {
        success: true,
        data: customers[0],
      };
    } catch (error) {
      console.error("Error fetching customers:", error);
      throw error;
    }
  }

  async fetchRandomService(
    businessId: string,
    petId: string,
  ): Promise<ApiResponse> {
    if (!this.isLoggedIn()) {
      return {
        success: false,
        error: "需要先登录才能获取服务信息",
      };
    }

    const defaultParams: ServiceRequestPayload = {
      serviceType: 1,
      selectedServiceIds: [],
      petId: petId,
      businessId: businessId,
      onlyAvailable: true,
      selectedServiceItemType: 1,
      inactive: false,
      serviceItemType: 1,
    };

    try {
      const response = await fetch(
        `${this.baseURL}/moego.api.offering.v1.ServiceManagementService/GetApplicableServiceList`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(defaultParams),
          credentials: "include", // 包含 cookies
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ServiceResponse = await response.json();
      return {
        success: true,
        data: this.getRandomService(data),
      };
    } catch (error) {
      console.error("Failed to fetch applicable services:", error);
      throw error;
    }
  }

  getRandomService(response: ServiceResponse): Service | null {
    const services = response.categoryList.flatMap(
      (category) => category.services,
    );
    if (services.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * services.length);
    return services[randomIndex];
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated && this.cookies.length > 0;
  }

  getCurrentCookies(): string[] {
    return [...this.cookies];
  }

  logout(): void {
    this.isAuthenticated = false;
    this.cookies = [];
  }
}

export default AppointmentService;
