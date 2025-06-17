const { GrowthBookClient } = require("@growthbook/growthbook");

// 创建全局客户端实例
let globalClient: any = null;
let isInitialized = false;

const API_HOST = process.env.GB_API_HOST;
const CLIENT_KEY = process.env.GB_CLIENT_KEY;

// 初始化 GrowthBook 客户端
async function initializeGrowthBook() {
  if (globalClient && isInitialized) {
    return globalClient;
  }

  try {
    globalClient = new GrowthBookClient({
      apiHost: API_HOST,
      clientKey: CLIENT_KEY,
      enableDevMode: true,
    });

    console.log("正在初始化 GrowthBook 客户端...");

    // 增加超时时间到 5 秒
    await globalClient.init({ timeout: 5000 });

    isInitialized = true;
    console.log("GrowthBook 客户端初始化成功");

    // 打印加载的特性标志信息
    const features = globalClient.getFeatures();
    console.log("已加载的特性标志:", Object.keys(features));

    return globalClient;
  } catch (error) {
    console.error("GrowthBook 初始化失败:", error);
    throw error;
  }
}

// 通用的特性标志评估函数
export async function evaluateFeatureFlag(featureKey: string, userAttributes: any = {}) {
  try {
    const client = await initializeGrowthBook();

    const userContext = {
      attributes: {
        "id": userAttributes.id || 0,
        "company": userAttributes.company || "moego",
        "deviceId": userAttributes.deviceId || "test-device",
        "loggedIn": userAttributes.loggedIn || true,
        "employee": userAttributes.employee || true,
        "country": userAttributes.country || "CN",
        "browser": userAttributes.browser || "chrome",
        "business": userAttributes.business || "pet",
        "enterprise": userAttributes.enterprise || true,
        "channel": userAttributes.channel || "business_web",
        "buildVersion": userAttributes.buildVersion || "1.0.0",
        "platform": userAttributes.platform || "web",
        ...userAttributes // 允许覆盖默认值
      }
    };

    console.log(`评估特性标志: ${featureKey}`);
    console.log("用户上下文:", userContext);

    const gb = client.createScopedInstance(userContext);
    const features = client.getFeatures();

    // 检查特性标志是否存在
    if (!features[featureKey]) {
      console.warn(`⚠️ 特性标志 '${featureKey}' 不存在`);

      // 查找相似的特性标志
      const allFeatures = Object.keys(features);
      const similarFeatures = allFeatures.filter(name => {
        const keyWords = featureKey.toLowerCase().split('_');
        return keyWords.some(word => name.toLowerCase().includes(word));
      });

      if (similarFeatures.length > 0) {
        console.log("💡 找到相似的特性标志:", similarFeatures);
      }

      return {
        value: false,
        on: false,
        off: true,
        source: 'notFound',
        ruleId: '',
        error: `Feature flag '${featureKey}' not found`
      };
    }

    const result = gb.evalFeature(featureKey);
    console.log("✅ 特性标志评估结果:", result);

    return result;
  } catch (error) {
    console.error("❌ 特性标志评估失败:", error);
    return {
      value: false,
      on: false,
      off: true,
      source: 'error',
      ruleId: '',
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

export async function getMessage() {
  // 使用新的通用函数测试特性标志
  const result1 = await evaluateFeatureFlag("enable_multi_pet_by_slot");
  const result2 = await evaluateFeatureFlag("enable_multi_pet_by_slot");
  const result3 = await evaluateFeatureFlag("enable_multi_pet_by_slot", { company: "119546" }); // 使用允许的公司 ID

  console.log("=== 测试结果汇总 ===");
  console.log("1. enable_multi_pet_by_slot:", result1);
  console.log("2. enable_multi_pet_by_slot (默认上下文):", result2);
  console.log("3. enable_multi_pet_by_slot (匹配规则的上下文):", result3);

  return result3; // 返回最后一个结果
}