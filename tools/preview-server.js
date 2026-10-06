// Local, read-only preview of static pages and the exact class routing rules.
// Not a Vercel emulator; API delivery and deployed routing still need platform QA.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.vtt': 'text/vtt', '.txt': 'text/plain', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  let url;
  try { url = new URL(req.url, 'http://127.0.0.1'); } catch { res.writeHead(400); return res.end(); }
  const headers = Object.fromEntries(vercel.headers.find((rule) => rule.source === '/(.*)').headers.map(({ key, value }) => [key, value]));
  // upgrade-insecure-requests would incorrectly upgrade localhost on some browsers.
  headers['Content-Security-Policy'] = headers['Content-Security-Policy'].replace('; upgrade-insecure-requests', '');
  res.setHeaders(new Headers({ ...headers, 'Cache-Control': 'no-store' }));
  const redirect = vercel.redirects?.find((rule) => rule.source === url.pathname);
  if (redirect) { res.writeHead(redirect.permanent ? 308 : 307, { Location: redirect.destination + url.search }); return res.end(); }
  let pathname = vercel.rewrites?.find((rule) => rule.source === url.pathname)?.destination || url.pathname;
  try { pathname = decodeURIComponent(pathname); } catch { res.writeHead(400); return res.end(); }
  if (pathname === '/') pathname = '/index.html';
  const relative = pathname.replace(/^\/+/, '');
  const file = path.resolve(root, relative);
  const ext = path.extname(file).toLowerCase();
  // Serve public static resources only; never expose repository/config/source internals.
  const publicPath = !relative.includes('\\') && (relative === 'class/index.html' || relative.startsWith('assets/') || relative.startsWith('banks/') || relative.startsWith('guides/') || !relative.includes('/'));
  if (!file.startsWith(root + path.sep) || !publicPath || relative.split('/').some((part) => part.startsWith('.')) || !types[ext] || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': types[ext], 'Content-Length': fs.statSync(file).size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
});
const port = Number(process.env.PORT) || 4173;
server.listen(port, '127.0.0.1', () => console.log(`Bank Harm Registry preview: http://127.0.0.1:${port}/class/`));
