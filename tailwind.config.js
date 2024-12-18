/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        wenkai: ['LXGW WenKai', 'sans-serif'],
        mashan: ['Ma Shan Zheng', 'cursive'],
        smiley: ['Smiley Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
} 