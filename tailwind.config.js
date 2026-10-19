/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        cardSecondary: 'rgb(var(--color-card-secondary) / <alpha-value>)',
        cardHover: 'rgb(var(--color-card-hover) / <alpha-value>)',
        borderSubtle: 'rgb(var(--color-border-subtle) / <alpha-value>)',
        borderMedium: 'rgb(var(--color-border-medium) / <alpha-value>)',
        textPrimary: 'rgb(var(--color-text-primary) / <alpha-value>)',
        textSecondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
        accentSky: 'rgb(var(--color-accent-sky) / <alpha-value>)',
        accentYellow: 'rgb(var(--color-accent-yellow) / <alpha-value>)',
        statusGreen: 'rgb(var(--color-status-green) / <alpha-value>)',
        statusRed: 'rgb(var(--color-status-red) / <alpha-value>)',
        statusNeutral: 'rgb(var(--color-status-neutral) / <alpha-value>)'
      }
    },
  },
  plugins: [],
}
