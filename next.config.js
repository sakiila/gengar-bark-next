const { withAxiom } = require("next-axiom");

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  logging: {
    axiom: {
      dataset: process.env.AXIOM_DATASET,
    },
  },
  images: {
    domains: ['baobo.me', 'gengar.baobo.me'],
  },
  // 添加环境变量配置
  env: {
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  },
};

module.exports = withAxiom(nextConfig);
