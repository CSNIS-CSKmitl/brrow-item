import PocketBase from 'pocketbase';

export const SESSION_COOKIE = 'borrowly_auth';

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

export async function getSessionUser(req) {
  const token = sessionToken(req);
  if (!token) return null;
  const pb = new PocketBase(process.env.POCKETBASE_URL || process.env.VITE_POCKETBASE_TARGET || 'http://127.0.0.1:8090');
  pb.autoCancellation(false);
  pb.authStore.save(token);
  try {
    const auth = await pb.collection('users').authRefresh({ expand: 'user_type' });
    const record = auth.record;
    const type = record.expand?.user_type?.type || record.user_type || '';
    const role = ({
      '000000000000009': 'superadmin',
      '000000000000000': 'admin',
      '000000000000002': 'teachers',
      '000000000000001': 'students',
      '000000000000004': 'staff'
    })[type] || type;
    return { id: record.id, email: record.email || '', role };
  } catch {
    return null;
  } finally {
    pb.authStore.clear();
  }
}
