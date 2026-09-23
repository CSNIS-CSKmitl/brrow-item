import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { completeOidc } from './server/oidc-complete.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
for (const [key, value] of Object.entries(loadEnv('production', root, ''))) {
  process.env[key] ??= value;
}
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function pocketBaseTarget() {
  return new URL(process.env.POCKETBASE_URL || process.env.VITE_POCKETBASE_TARGET || 'http://127.0.0.1:8090');
}

function upstreamOptions(req, target) {
  const pathname = req.url.replace(/^\/api\/db(?=\/|$)/, '') || '/';
  return {
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || undefined,
    method: req.method,
    path: pathname,
    headers: { ...req.headers, host: target.host }
  };
}

function proxyPocketBase(req, res) {
  const target = pocketBaseTarget();
  const transport = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const upstream = transport(upstreamOptions(req, target), (response) => {
    res.writeHead(response.statusCode || 502, response.headers);
    response.pipe(res);
  });
  upstream.on('error', (error) => {
    console.error('[proxy/pocketbase] request failed:', error.message);
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'PocketBase is unavailable' }));
  });
  req.pipe(upstream);
}

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/auth/oidc/complete') {
    await completeOidc(req, res);
    return;
  }
  if (pathname === '/api/db' || pathname.startsWith('/api/db/')) {
    proxyPocketBase(req, res);
    return;
  }

  try {
    const requested = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    let file = path.resolve(dist, `.${requested}`);
    if (!file.startsWith(`${dist}${path.sep}`) && file !== path.join(dist, 'index.html')) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    try {
      if (!(await stat(file)).isFile()) throw new Error('not a file');
    } catch {
      file = path.join(dist, 'index.html');
    }
    const contents = await readFile(file);
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream' });
    res.end(contents);
  } catch {
    res.writeHead(500).end('Server error');
  }
});

server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (!(pathname === '/api/db' || pathname.startsWith('/api/db/'))) {
    socket.destroy();
    return;
  }
  const target = pocketBaseTarget();
  const transport = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const upstream = transport(upstreamOptions(req, target));
  upstream.on('upgrade', (response, upstreamSocket, upstreamHead) => {
    socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`);
    for (const [name, value] of Object.entries(response.headers)) {
      if (Array.isArray(value)) value.forEach((entry) => socket.write(`${name}: ${entry}\r\n`));
      else if (value !== undefined) socket.write(`${name}: ${value}\r\n`);
    }
    socket.write('\r\n');
    if (head.length) upstreamSocket.write(head);
    if (upstreamHead.length) socket.write(upstreamHead);
    socket.pipe(upstreamSocket);
    upstreamSocket.pipe(socket);
  });
  upstream.on('response', (response) => {
    socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n\r\n`);
    response.resume();
    socket.destroy();
  });
  upstream.on('error', () => socket.destroy());
  upstream.end();
});

const port = Number(process.env.PORT || 4173);
server.listen(port, process.env.HOST || '0.0.0.0', () => {
  console.log(`Borrowly server listening on port ${port}`);
});
