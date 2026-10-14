/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#0B0E14',
        card: '#121824',
        cardSecondary: '#161F30',
        cardHover: '#1A263D',
        borderSubtle: '#1E293B',
        borderMedium: '#22314E',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        accentSky: '#38BDF8',
        accentYellow: '#FACC15',
        statusGreen: '#10B981',
        statusRed: '#EF4444',
        statusNeutral: '#FFFFFF'
      }
    },
  },
  plugins: [],
}
