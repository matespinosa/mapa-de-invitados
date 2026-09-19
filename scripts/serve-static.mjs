import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist/client/', import.meta.url)));
const host = process.env.PREVIEW_HOST ?? 'localhost';
const port = Number(process.env.PREVIEW_PORT ?? 5173);
const types = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.rsc': 'text/x-component',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    let path = resolve(root, `.${pathname}`);
    if (path !== root && !path.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    const body = await readFile(path);
    response.writeHead(200, {
      'Content-Type': `${types[extname(path)] ?? 'application/octet-stream'}; charset=utf-8`,
      'Cache-Control': 'no-store',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404).end('No encontrado');
  }
}).listen(port, host, () => {
  console.log(`Vista previa: http://${host}:${port}/`);
});
