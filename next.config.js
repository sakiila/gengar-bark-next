const { withAxiom } = require('next-axiom');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',  // 确保启用 standalone 输出
};

module.exports = withAxiom(nextConfig);
