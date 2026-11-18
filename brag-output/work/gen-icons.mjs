// Projenin kendi ikon kütüphanesinden (lucide-react) SVG üretir
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/msı/Desktop/Freelance/DGS-Touch/client/package.json');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const L = require('lucide-react');
const names = ['Flame', 'Target', 'Trophy', 'GraduationCap', 'CalendarClock', 'Clock', 'TrendingUp', 'ChevronDown'];
const out = {};
for (const n of names) out[n] = renderToStaticMarkup(React.createElement(L[n], { size: 16, 'aria-hidden': 'true' }));
writeFileSync(new URL('./icons.js', import.meta.url), 'window.ICONS = ' + JSON.stringify(out) + ';');
console.log(Object.keys(out).join(','), out.Flame.slice(0, 120));
