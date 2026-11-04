/** @type {import('tailwindcss').Config} */
// Renkler CSS değişkenlerinden okunur: tema (koyu/açık/ön ayar) değişince tüm arayüz otomatik uyum sağlar.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const slate = Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(n => [n, v('s' + n)]));

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        slate, white: v('fg'),                // white/10 gibi örtüler açık temada koyu örtüye döner
        obsidian: v('bg'), onaccent: '#090A0F',
        accent: v('accent'), cyan2: v('cyan2'),
      },
      fontFamily: { sans: ['Inter', '-apple-system', 'SF Pro Display', 'Segoe UI', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
