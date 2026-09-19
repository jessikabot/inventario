/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bruma: '#ECF0EE',
        papel: '#FFFFFF',
        pino: { DEFAULT: '#0E5A47', dark: '#0A4436', deep: '#0B2A22', soft: '#DCEBE6' },
        tinta: { DEFAULT: '#15241F', soft: '#56665F' },
        linea: '#D6DEDA',
        etiqueta: { DEFAULT: '#F2A900', soft: '#FDF1CF', dark: '#7A5600' },
        ladrillo: { DEFAULT: '#B3382C', soft: '#F8E1DE' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'Figtree', 'system-ui', 'sans-serif'],
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
