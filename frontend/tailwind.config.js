/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vilac: {
          green: '#00563F',
          darkgreen: '#003D2C',
          lightgreen: '#E6F2ED',
          orange: '#F4511E',
          gold: '#E6AD00',
          cream: '#FFF9E6',
        },
        brand: {
          primary: 'var(--color-primary, #00563F)',
          secondary: 'var(--color-secondary, #F4511E)',
          accent: 'var(--color-accent, #E6AD00)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 86, 63, 0.1)',
      }
    },
  },
  plugins: [],
}
