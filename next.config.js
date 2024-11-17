const { withAxiom } = require("next-axiom");

const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // 确保启用 standalone 输出
  // Add Axiom specific configuration
  logging: {
    axiom: {
      // Your dataset name from .env
      dataset: process.env.AXIOM_DATASET,
    },
  },
};

module.exports = withAxiom(nextConfig);
