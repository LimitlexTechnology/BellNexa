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
          green: '#0A1B45',
          darkgreen: '#07142F',
          lightgreen: '#E7F9FC',
          orange: '#12C8E8',
          gold: '#54DDF4',
          cream: '#F1FCFE',
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
