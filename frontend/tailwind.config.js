/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        radiai: {
          dark: '#0B1F3A',
          cyan: '#06B6D4',
          light: '#F8FAFC',
          border: '#E2E8F0',
          text: '#0F172A',
          muted: '#64748B'
        }
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'glow': '0 0 15px rgba(6, 182, 212, 0.3)',
      }
    },
  },
  plugins: [],
}
