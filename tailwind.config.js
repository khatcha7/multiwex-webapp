/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'mw-pink': '#ff007d',
        'mw-red': '#ff004b',
        'mw-yellow': '#f3d10b',
        'mw-cyan': '#00d9ff',
        'mw-cyan-light': '#07effe',
        'mw-purple': '#b200d9',
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
        'mw-btn': 'linear-gradient(90deg, #ff004b 0%, #ff007d 100%)',
        'mw-marquee': 'linear-gradient(90deg, #F3D10B 0%, #FF8A00 20%, #FF007D 45%, #B200D9 62%, #00D9FF 82%, #07EFFE 100%)',
        'mw-hero': 'linear-gradient(135deg, rgba(255,0,125,0.15) 0%, rgba(0,217,255,0.08) 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
