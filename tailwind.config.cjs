/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./client/**/*.{html,ts,tsx}', './imports/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rooster: {
          grass: 'rgb(var(--color-rooster-grass) / <alpha-value>)',
          ink: 'rgb(var(--color-rooster-ink) / <alpha-value>)',
          line: 'rgb(var(--color-rooster-line) / <alpha-value>)',
          muted: 'rgb(var(--color-rooster-muted) / <alpha-value>)',
          paper: 'rgb(var(--color-rooster-paper) / <alpha-value>)',
          red: 'rgb(var(--color-rooster-red) / <alpha-value>)',
          sun: 'rgb(var(--color-rooster-sun) / <alpha-value>)',
        },
        rr: {
          accent: 'rgb(var(--rr-accent) / <alpha-value>)',
          bg: 'rgb(var(--rr-bg) / <alpha-value>)',
          border: 'rgb(var(--rr-border) / <alpha-value>)',
          brand: 'rgb(var(--rr-brand) / <alpha-value>)',
          charcoal: 'rgb(var(--rr-charcoal) / <alpha-value>)',
          cobaltBlue: 'rgb(var(--rr-cobalt-blue) / <alpha-value>)',
          cream: 'rgb(var(--rr-cream) / <alpha-value>)',
          danger: 'rgb(var(--rr-danger) / <alpha-value>)',
          fieldGreen: 'rgb(var(--rr-field-green) / <alpha-value>)',
          gold: 'rgb(var(--rr-gold) / <alpha-value>)',
          info: 'rgb(var(--rr-info) / <alpha-value>)',
          muted: 'rgb(var(--rr-text-muted) / <alpha-value>)',
          roosterRed: 'rgb(var(--rr-rooster-red) / <alpha-value>)',
          surface: 'rgb(var(--rr-surface) / <alpha-value>)',
          tanFeather: 'rgb(var(--rr-tan-feather) / <alpha-value>)',
          text: 'rgb(var(--rr-text) / <alpha-value>)',
          warning: 'rgb(var(--rr-warning) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
