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
};

module.exports = withAxiom(nextConfig);
