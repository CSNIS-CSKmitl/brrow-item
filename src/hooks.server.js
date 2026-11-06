import PocketBase from 'pocketbase';
import { getPocketBaseUrl, adminPocketBase } from '$lib/server/pocketbase';
import { SESSION_COOKIE, getSessionUser, jwtUserId } from '$lib/server/session';
import { getUserRoles, isBorrowlyAdmin } from '$lib/roles';

function resolveEmail(record) {
	if (record.email) return record.email;
	if (record.username) return `${record.username}@cskmitl.internal`;
	return 'unknown@cskmitl.internal';
}

function resolveRole(record) {
	const roles = getUserRoles(record);
	if (roles.includes('head')) return 'head';
	if (roles.includes('super_admin') || roles.includes('superadmin')) return 'super_admin';
	if (roles.includes('admin')) return 'admin';
	if (roles.includes('teachers') || roles.includes('teacher')) return 'teachers';
	if (roles.includes('staff') || roles.includes('stuff')) return 'staff';
	if (roles.includes('students') || roles.includes('student')) return 'students';
	return 'user';
}

async function writeAccessAudit(event, status) {
	try {
		const pb = await adminPocketBase();
		const user = event.locals.user?.id;
		const sourceIp = event.getClientAddress?.() || event.request.headers.get('x-forwarded-for') || '';
		await pb.collection('service_access_logs').create({
			service: 'borrowly',
			user: user || undefined,
			source_ip: sourceIp,
			method: event.request.method,
			path: event.url.pathname,
			action: event.url.pathname.startsWith('/api') ? 'api_request' : 'page_view',
			status_code: status,
			user_agent: event.request.headers.get('user-agent') || undefined
		});
	} catch {}
}

export const handle = async ({ event, resolve }) => {
	const pb = new PocketBase(getPocketBaseUrl());
	pb.autoCancellation(false);
	event.locals.pb = pb;

	const token = event.cookies.get(SESSION_COOKIE) || event.request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

	if (token) {
		pb.authStore.save(token);
		try {
			const auth = await pb.collection('users').authRefresh({ expand: 'user_type' });
			const full = auth.record;
			event.locals.user = {
				id: full.id,
				email: resolveEmail(full),
				name: full.name || full.username,
				username: full.username,
				role: resolveRole(full),
				roles: getUserRoles(full),
				isAdmin: isBorrowlyAdmin(full),
				token: auth.token
			};
		} catch {
			pb.authStore.clear();
			event.cookies.delete(SESSION_COOKIE, { path: '/' });
			event.locals.user = null;
		}
	} else {
		event.locals.user = null;
	}

	const response = await resolve(event);

	if (!event.url.pathname.startsWith('/_app') && event.url.pathname !== '/favicon.ico') {
		void writeAccessAudit(event, response.status);
	}

	return response;
};
