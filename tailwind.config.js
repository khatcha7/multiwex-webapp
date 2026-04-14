/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'mw-pink': '#e8005a',
        'mw-red': '#ff004b',
        'mw-yellow': '#f3d10b',
        'mw-cyan': '#00d9ff',
        'mw-cyan-light': '#07effe',
        'mw-purple': '#7b00e0',
        'mw-black': '#000000',
        'mw-bg': '#080808',
        'mw-surface': '#111111',
        'mw-surface-alt': '#1a1a1a',
        'mw-dark': '#111111',
        'mw-darker': '#080808',
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
        'mw-btn': 'linear-gradient(135deg, #e8005a 0%, #7b00e0 100%)',
        'mw-marquee': 'linear-gradient(90deg, #F3D10B 0%, #FF8A00 20%, #e8005a 45%, #7b00e0 62%, #00D9FF 82%, #07EFFE 100%)',
        'mw-hero': 'linear-gradient(135deg, rgba(232,0,90,0.15) 0%, rgba(123,0,224,0.10) 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
