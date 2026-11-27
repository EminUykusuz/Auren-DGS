// Blender MCP eklentisinin soketine (127.0.0.1:9876) tek komut gönderir.
// Kullanım: node blender-rpc.mjs <komut> '<json-parametreler>'   |   node blender-rpc.mjs code <dosya.py>
import net from 'node:net'; import fs from 'node:fs';
const [, , cmd, arg] = process.argv;
const msg = cmd === 'code' ? { type: 'execute_code', params: { code: fs.readFileSync(arg, 'utf8') } } : { type: cmd, params: arg ? JSON.parse(arg) : {} };
const s = net.connect(9876, '127.0.0.1'); let buf = '';
s.on('connect', () => s.write(JSON.stringify(msg)));
s.on('data', d => { buf += d; try { JSON.parse(buf); console.log(buf); s.end(); process.exit(0); } catch {} });
s.on('error', e => { console.error('HATA', e.message); process.exit(1); });
setTimeout(() => { console.error('zaman aşımı', buf.slice(0, 300)); process.exit(2); }, 60000);
