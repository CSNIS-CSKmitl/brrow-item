import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import PocketBase from 'pocketbase';
import { completeOidc } from './server/oidc-complete.js';
import {
  cacheSessionUser,
  clearSessionCookie,
  getSessionUser,
  invalidateSessionUser,
  jwtUserId,
  sessionCookie,
  sessionToken
} from './server/session.js';
import { computeAdminStats } from './server/admin-stats.js';

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

function isSecureRequest(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return proto === 'https' || Boolean(req.socket?.encrypted);
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw Object.assign(new Error('payload too large'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('invalid JSON payload'), { status: 400 });
  }
}

function jsonResponse(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

let sharedAdmin = null;
let sharedAdminAt = 0;
let sharedAdminPromise = null;

async function adminPocketBase() {
  if (!process.env.PB_ADMIN_EMAIL || !process.env.PB_ADMIN_PASSWORD) {
    throw new Error('admin credentials are not configured');
  }
  const now = Date.now();
  if (sharedAdmin && sharedAdmin.authStore.isValid && now - sharedAdminAt < 5 * 60 * 1000) {
    return sharedAdmin;
  }
  if (sharedAdminPromise) return sharedAdminPromise;

  sharedAdminPromise = (async () => {
    const pb = new PocketBase(pocketBaseTarget().toString());
    pb.autoCancellation(false);
    await pb.collection('_superusers').authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
    sharedAdmin = pb;
    sharedAdminAt = Date.now();
    return pb;
  })();

  try {
    return await sharedAdminPromise;
  } finally {
    sharedAdminPromise = null;
  }
}

async function loadBorrowlyStats(range = 'all') {
  const pb = await adminPocketBase();
  const [items, requests] = await Promise.all([
    pb.collection('items').getFullList({ fields: 'id,name,category,total,available' }),
    pb.collection('loan_requests').getFullList({ fields: 'id,status,dueDate,returnedAt,created,updated,email,itemIds,borrowerName' })
  ]);
  return computeAdminStats({ items, requests, range, now: new Date() });
}

async function writeProxyAudit(req, statusCode) {
  if (!process.env.PB_ADMIN_EMAIL || !process.env.PB_ADMIN_PASSWORD) return;
  try {
    const auditAdmin = await adminPocketBase();
    let userId;
    const authorization = req.headers.authorization;
    if (authorization?.startsWith('Bearer ')) {
      userId = jwtUserId(authorization.slice(7));
    }
    const trustedProxy = process.env.TRUST_PROXY === 'true';
    const realIp = trustedProxy ? req.headers['x-real-ip'] : undefined;
    const forwarded = trustedProxy ? req.headers['x-forwarded-for'] : undefined;
    const sourceIp = String(realIp || forwarded || req.socket.remoteAddress || '').split(',')[0].trim();
    await auditAdmin.collection('service_access_logs').create({
      service: 'borrowly', user: userId || undefined, source_ip: sourceIp,
      method: req.method, path: new URL(req.url, 'http://localhost').pathname,
      action: req.method === 'GET' ? 'api_read' : 'api_write', status_code: statusCode,
      user_agent: req.headers['user-agent'] || undefined,
      request_id: req.headers['x-request-id'] || undefined, metadata: {}
    });
  } catch (error) {
    console.warn('[audit] Unable to store borrowly access log:', error instanceof Error ? error.message : error);
  }
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
  const authPath = req.url.replace(/^\/api\/db(?=\/|$)/, '');
  const captureAuth = req.method === 'POST' && /\/api\/collections\/users\/(auth-with-password|auth-refresh|auth-with-oauth2)(?:$|\?)/.test(authPath);
  const upstream = transport(upstreamOptions(req, target), (response) => {
    if (!captureAuth) {
      res.writeHead(response.statusCode || 502, response.headers);
      void writeProxyAudit(req, response.statusCode || 502);
      response.pipe(res);
      return;
    }
    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('end', () => {
      const body = Buffer.concat(chunks);
      const headers = { ...response.headers };
      if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
        try {
          const payload = JSON.parse(body.toString('utf8'));
          if (payload.token) {
            const secure = isSecureRequest(req);
            headers['set-cookie'] = sessionCookie(payload.token, secure);
            if (payload.record) {
              cacheSessionUser(payload.token, payload.record);
            }
          }
        } catch { /* preserve PocketBase response */ }
      }
      res.writeHead(response.statusCode || 502, headers);
      res.end(body);
    });
    void writeProxyAudit(req, response.statusCode || 502);
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
  if (pathname === '/api/auth/logout') {
    invalidateSessionUser(sessionToken(req));
    const secure = isSecureRequest(req);
    res.writeHead(303, { Location: '/login', 'Set-Cookie': clearSessionCookie(secure) }).end();
    return;
  }
  if (pathname === '/api/auth/session') {
    if (req.method !== 'POST') {
      jsonResponse(res, 405, { ok: false, error: 'method not allowed' }, { Allow: 'POST' });
      return;
    }
    try {
      const payload = await readJsonBody(req);
      if (!payload?.token || !payload?.record?.id) {
        jsonResponse(res, 400, { ok: false, error: 'invalid authentication payload' });
        return;
      }
      const pb = new PocketBase(pocketBaseTarget().toString());
      pb.autoCancellation(false);
      pb.authStore.save(payload.token, payload.record);
      const authData = await pb.collection('users').authRefresh({ expand: 'user_type' });
      const activeToken = authData.token || payload.token;
      cacheSessionUser(payload.token, authData.record);
      cacheSessionUser(activeToken, authData.record);
      const secure = isSecureRequest(req);
      jsonResponse(res, 200, { ok: true, record: authData.record }, { 'Set-Cookie': sessionCookie(activeToken, secure) });
    } catch (error) {
      const status = Number(error?.status) >= 400 && Number(error?.status) < 500 ? Number(error.status) : 401;
      jsonResponse(res, status, { ok: false, error: 'authentication session could not be verified' });
    }
    return;
  }
  if (pathname === '/api/admin/stats') {
    if (req.method !== 'GET') {
      jsonResponse(res, 405, { ok: false, error: 'method not allowed' }, { Allow: 'GET' });
      return;
    }
    const user = await getSessionUser(req);
    if (!user || user.role !== 'superadmin') {
      jsonResponse(res, user ? 403 : 401, { ok: false, error: user ? 'forbidden' : 'authentication required' });
      return;
    }
    try {
      const urlObj = new URL(req.url, 'http://localhost');
      const range = urlObj.searchParams.get('range') || 'all';
      jsonResponse(res, 200, { ok: true, stats: await loadBorrowlyStats(range) });
    } catch (error) {
      console.error('[admin/stats] failed:', error instanceof Error ? error.message : error);
      jsonResponse(res, 503, { ok: false, error: 'statistics are temporarily unavailable' });
    }
    return;
  }
  if (pathname === '/api/db' || pathname.startsWith('/api/db/')) {
    proxyPocketBase(req, res);
    return;
  }

  const protectedPath = pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/approvals' || pathname.startsWith('/approvals/') || pathname === '/requests' || pathname.startsWith('/requests/');
  if (protectedPath) {
    const user = await getSessionUser(req);
    const allowed = user && (pathname.startsWith('/admin') ? user.role === 'superadmin' : pathname.startsWith('/approvals') ? ['teachers', 'admin', 'superadmin'].includes(user.role) : true);
    if (!allowed) {
      res.writeHead(user ? 403 : 303, user ? { 'Content-Type': 'text/plain; charset=utf-8' } : { Location: `/login?redirect=${encodeURIComponent(pathname)}` }).end(user ? 'Forbidden' : undefined);
      return;
    }
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
    const ext = path.extname(file);
    const contents = await readFile(file);
    const headers = {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream'
    };
    if (ext === '.html') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    }
    res.writeHead(200, headers);
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

const port = Number(process.env.PORT || 3000);
server.listen(port, process.env.HOST || '0.0.0.0', () => {
  console.log(`Borrowly server listening on port ${port}`);
});
