import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, invalidateSessionUser } from '$lib/server/session';

export async function GET({ cookies }) {
	const token = cookies.get(SESSION_COOKIE);
	if (token) invalidateSessionUser(token);
	cookies.delete(SESSION_COOKIE, { path: '/' });
	throw redirect(303, '/login');
}

export async function POST({ cookies }) {
	const token = cookies.get(SESSION_COOKIE);
	if (token) invalidateSessionUser(token);
	cookies.delete(SESSION_COOKIE, { path: '/' });
	return new Response(null, { status: 204 });
}
