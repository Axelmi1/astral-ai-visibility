/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        astral: {
          purple: '#4A3280',
          light: '#6B4DC4',
        },
      },
      fontFamily: {
        jakarta: ['var(--font-jakarta)', 'sans-serif'],
        dm: ['var(--font-dm)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
