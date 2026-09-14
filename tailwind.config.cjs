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
