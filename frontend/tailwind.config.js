/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5fbff',
          100: '#eaf6ff',
          200: '#cfeaff',
          300: '#a7d7ff',
          400: '#6fbaff',
          500: '#358fff',
          600: '#1f6ef0',
          700: '#1756c4',
          800: '#153f8d',
          900: '#142f66',
        },
      },
    },
  },
  plugins: [],
}