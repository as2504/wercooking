/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#FFF4EC', 100: '#FFE4CF', 200: '#FDC59E', 300: '#FB9F63', 400: '#F47A33', 500: '#E35F14', 600: '#C2410C', 700: '#9A330D', 800: '#7C2D12', 900: '#5A2209' },
        leaf: { 50: '#F0F9F1', 100: '#DCF1DF', 500: '#3F8F4A', 600: '#2F7A3B', 700: '#24602E' },
        turmeric: { 100: '#FEF3C7', 400: '#F5B820', 500: '#E0A10A' },
        cream: '#FFF8F0',
        ink: { DEFAULT: '#2B1D14', soft: '#5C4A3D', muted: '#6F5E52' },
        line: '#EADFD3',
      },
      fontFamily: {
        sans: ['"Inter Variable"', '"Inter"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
      },
      boxShadow: { card: '0 1px 2px rgba(43,29,20,.06), 0 4px 16px rgba(43,29,20,.06)' },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pop: { '0%': { transform: 'scale(.9)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        slideup: { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
      },
      animation: { shimmer: 'shimmer 1.4s infinite', pop: 'pop .18s ease-out', slideup: 'slideup .22s ease-out' },
    },
  },
  plugins: [],
};
