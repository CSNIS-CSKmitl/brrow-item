import { redirect } from '@sveltejs/kit';
import { get } from 'svelte/store';
import { pb, establishServerSession } from '../lib/pocketbase.js';
import { loadAll, user, userType, canAdmin } from '../lib/stores.js';

export const ssr = false;
export const prerender = false;

function normalizePath(pathname = '/') {
  return pathname.replace(/\/$/, '') || '/';
}

function getRedirectTarget(url) {
  const raw = url.searchParams.get('redirect') || '/';
  return raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/login') ? raw : '/';
}

export async function load({ url }) {
  const cleanPath = normalizePath(url.pathname);
  const isPublicRoute = ['/login', '/privacy', '/terms'].includes(cleanPath);

  await loadAll();

  const currentUser = get(user);
  const currentRole = get(userType);
  const isAdmin = get(canAdmin);

  if (cleanPath === '/login') {
    if (currentUser && pb.authStore.isValid && pb.authStore.token) {
      try {
        const record = await establishServerSession({
          token: pb.authStore.token,
          record: pb.authStore.record || currentUser,
        });
        if (record) {
          pb.authStore.save(pb.authStore.token, record);
          user.set(record);
        }
        throw redirect(307, getRedirectTarget(url));
      } catch (err) {
        if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
          throw err;
        }
      }
    }
    return { cleanPath, guardFailed: false, guardMessage: '' };
  }

  if (!currentUser && !isPublicRoute) {
    const target = cleanPath === '/' ? '/login' : `/login?redirect=${encodeURIComponent(cleanPath)}`;
    throw redirect(307, target);
  }

  const guardFailed =
    (cleanPath === '/approvals' && !(currentRole === 'teachers' || isAdmin)) ||
    (cleanPath === '/admin' && !isAdmin);

  const guardMessage = guardFailed
    ? cleanPath === '/approvals'
      ? 'หน้านี้สำหรับอาจารย์และผู้ดูแลระบบเท่านั้น'
      : 'หน้านี้สำหรับผู้ดูแลระบบเท่านั้น'
    : '';

  return {
    cleanPath,
    guardFailed,
    guardMessage,
  };
}
