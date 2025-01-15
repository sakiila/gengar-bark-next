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
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'baobo.me',
      },
      {
        protocol: 'https',
        hostname: 'gengar.baobo.me',
      },
    ],
  },
};

module.exports = withAxiom(nextConfig);
