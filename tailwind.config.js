/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ClickUp brand palette
        brand: {
          50: '#f3f1ff',
          100: '#e9e5ff',
          200: '#d5cdff',
          300: '#b7a6ff',
          400: '#9474ff',
          500: '#7b68ee',
          600: '#6a4de0',
          700: '#5b3dc6',
          800: '#4c33a5',
          900: '#402c87',
        },
        surface: {
          light: '#ffffff',
          'light-2': '#fafbfc',
          'light-3': '#f0f1f3',
          dark: '#1e1f21',
          'dark-2': '#26272b',
          'dark-3': '#2f3036',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.08)',
        modal: '0 10px 40px rgba(0,0,0,0.2)',
      },
    },
  },
  plugins: [],
};
