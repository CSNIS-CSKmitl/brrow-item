import PocketBase from 'pocketbase';

export const SESSION_COOKIE = 'borrowly_auth';

const SESSION_CACHE_TTL_MS = 2 * 60 * 1000;
const sessionCache = new Map();

const ROLE_BY_TYPE_ID = {
  '000000000000009': 'superadmin',
  '000000000000000': 'admin',
  '000000000000002': 'teachers',
  '000000000000001': 'students',
  '000000000000004': 'staff'
};

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const i = part.indexOf('=');
    return i < 0 ? [part.trim(), ''] : [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())];
  }).filter(([key]) => key));
}

export function sessionToken(req) {
  return parseCookies(req.headers.cookie || '')[SESSION_COOKIE] || '';
}

export function sessionCookie(token, secure = true) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie(secure = true) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

export function jwtPayload(token = '') {
  try {
    const parts = String(token).split('.');
    if (parts.length < 2) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function jwtUserId(token = '') {
  const payload = jwtPayload(token);
  if (!payload || typeof payload.id !== 'string') return undefined;
  if (payload.exp && Date.now() >= Number(payload.exp) * 1000) return undefined;
  return payload.id;
}

export function userFromRecord(record) {
  if (!record?.id) return null;
  const type = record.expand?.user_type?.type || record.user_type || '';
  const role = ROLE_BY_TYPE_ID[type] || type;
  return { id: record.id, email: record.email || '', role };
}

export function cacheSessionUser(token, recordOrUser) {
  if (!token || !recordOrUser) return null;
  const payload = jwtPayload(token);
  if (payload?.exp && Date.now() >= Number(payload.exp) * 1000) return null;
  const user = recordOrUser.role ? recordOrUser : userFromRecord(recordOrUser);
  if (!user?.id || !user?.role) return null;
  const jwtExpiryMs = payload?.exp ? Number(payload.exp) * 1000 : Date.now() + SESSION_CACHE_TTL_MS;
  const expiresAt = Math.min(Date.now() + SESSION_CACHE_TTL_MS, jwtExpiryMs);
  sessionCache.set(token, { user, expiresAt });
  if (sessionCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of sessionCache.entries()) {
      if (v.expiresAt <= now) sessionCache.delete(k);
    }
  }
  return user;
}

export function invalidateSessionUser(token) {
  if (token) sessionCache.delete(token);
}

export async function getSessionUser(req) {
  const token = sessionToken(req);
  if (!token) return null;

  const cached = sessionCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }
  if (cached) sessionCache.delete(token);

  const pb = new PocketBase(process.env.POCKETBASE_URL || process.env.VITE_POCKETBASE_TARGET || 'http://127.0.0.1:8090');
  pb.autoCancellation(false);
  pb.authStore.save(token);
  try {
    const auth = await pb.collection('users').authRefresh({ expand: 'user_type' });
    const user = userFromRecord(auth.record);
    if (user) {
      cacheSessionUser(token, user);
      if (auth.token) cacheSessionUser(auth.token, user);
    }
    return user;
  } catch {
    const uid = jwtUserId(token);
    if (uid) {
      try {
        const record = await pb.collection('users').getOne(uid, { expand: 'user_type' });
        const user = userFromRecord(record);
        if (user) {
          cacheSessionUser(token, user);
          return user;
        }
      } catch {
        // Ignore fallback error
      }
    }
    return null;
  } finally {
    pb.authStore.clear();
  }
}

