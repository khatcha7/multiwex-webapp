/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'mw-pink': '#ff007d',
        'mw-pink-2': '#ff0054',
        'mw-red': '#E40D0D',
        'mw-cyan': '#00D9FF',
        'mw-black': '#000000',
        'mw-dark': '#0a0a0f',
        'mw-darker': '#050508',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Impact', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-pink': '0 0 20px rgba(255, 0, 125, 0.55), 0 0 40px rgba(255, 0, 125, 0.25)',
        'neon-cyan': '0 0 20px rgba(0, 217, 255, 0.5), 0 0 40px rgba(0, 217, 255, 0.2)',
        'neon-red': '0 0 20px rgba(228, 13, 13, 0.5), 0 0 40px rgba(228, 13, 13, 0.2)',
      },
      backgroundImage: {
        'mw-gradient': 'linear-gradient(135deg, #ff007d 0%, #ff0054 100%)',
        'mw-gradient-2': 'linear-gradient(135deg, #ff007d 0%, #00D9FF 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
