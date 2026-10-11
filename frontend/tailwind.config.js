/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#F3F8FF',
          100: '#DFEAF8',
          200: '#C5D5EB',
          300: '#9FB4D4',
          400: '#7892BA',
          500: '#55719A',
          600: '#3C5780',
          700: '#263F68',
          800: '#1A3158',
          900: '#10244A',
          950: '#07142F',
        },
        bellnexa: {
          navy: '#0A1B45',
          navyDark: '#07142F',
          cyan: '#12C8E8',
          cyanBright: '#54DDF4',
          mist: '#E7F9FC',
        },
        brand: {
          primary: 'var(--color-primary, #0A1B45)',
          secondary: 'var(--color-secondary, #12C8E8)',
          accent: 'var(--color-accent, #54DDF4)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(10, 27, 69, 0.24)',
      }
    },
  },
  plugins: [],
}
