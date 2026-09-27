/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cl: {
          bg: '#0E1119',
          surface1: '#141824',
          surface2: '#1A2030',
          blue: '#0847F7',
          wash: '#DCEBFF',
          gray: '#F5F7FA',
          primary: '#F5F7FA',
          muted: '#9AA3B5',
          green: '#05C46B',
          caution: '#FFDD59',
          red: '#FF5E57',
          unknown: '#6D7380',
        }
      },
      fontFamily: {
        sans: ['Inter', 'TASA Orbiter', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
