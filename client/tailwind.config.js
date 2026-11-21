/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#4f46e5',
          'primary-hover': '#4338ca',
          'primary-light': '#eef2ff',
          'primary-border': '#c7d2fe'
        },
        green: {
          rating: '#038d63'
        },
        slate: {
          dark: '#0f172a',
          body: '#1e293b',
          muted: '#64748b',
          border: '#e2e8f0',
          bg: '#f8fafc'
        }
      }
    }
  },
  plugins: []
}
