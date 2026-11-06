import { json } from '@sveltejs/kit';
import { SESSION_COOKIE, invalidateSessionUser } from '$lib/server/session';

export async function POST({ cookies }) {
	const token = cookies.get(SESSION_COOKIE);
	if (token) invalidateSessionUser(token);
	cookies.delete(SESSION_COOKIE, { path: '/' });
	return json({ ok: true });
}
