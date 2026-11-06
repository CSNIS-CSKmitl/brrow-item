import { json } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { getPocketBaseUrl } from '$lib/server/pocketbase';
import { SESSION_COOKIE, cacheSessionUser } from '$lib/server/session';

const DEFAULT_USER_TYPE_ID = '000000000000001';
const ROLE_MAP = {
	student: '000000000000001',
	students: '000000000000001',
	teacher: '000000000000002',
	teachers: '000000000000002',
	guest: '000000000000003',
	guests: '000000000000003',
	staff: '000000000000004'
};

export async function POST({ request, cookies, url }) {
	try {
		const payload = await request.json();
		if (!payload?.token || !payload?.record?.id || !payload?.meta?.accessToken) {
			return json({ ok: false, error: 'invalid OAuth payload' }, { status: 400 });
		}

		const userInfoUrl = env.OIDC_USERINFO_URL || 'https://openidconnect.googleapis.com/v1/userinfo';
		const userInfoResponse = await fetch(userInfoUrl, {
			headers: { Authorization: `Bearer ${payload.meta.accessToken}` }
		});
		if (!userInfoResponse.ok) {
			return json({ ok: false, error: 'OIDC identity could not be verified' }, { status: 401 });
		}
		const identity = await userInfoResponse.json();
		const identityEmail = String(identity.email || '').trim().toLowerCase();
		if (!identityEmail || identity.email_verified === false) {
			return json({ ok: false, error: 'OIDC identity did not provide a verified email' }, { status: 401 });
		}

		const pb = new PocketBase(getPocketBaseUrl());
		pb.autoCancellation(false);
		pb.authStore.save(payload.token, payload.record);

		let authData;
		try {
			authData = await pb.collection('users').authRefresh();
		} catch {
			return json({ ok: false, error: 'PocketBase session could not be verified' }, { status: 401 });
		}

		const record = authData.record;
		if (record.id !== payload.record.id || String(record.email || '').trim().toLowerCase() !== identityEmail) {
			return json({ ok: false, error: 'OIDC identity does not match the PocketBase account' }, { status: 403 });
		}

		const hasNoRole = !record.user_type || (Array.isArray(record.user_type) && record.user_type.length === 0);
		if (hasNoRole) {
			if (!env.PB_ADMIN_EMAIL || !env.PB_ADMIN_PASSWORD) {
				return json({ ok: false, error: 'OIDC role assignment is not configured on the server' }, { status: 503 });
			}

			const claimedRole = identity.profile?.role ?? identity.role;
			const normalizedRole = typeof claimedRole === 'string' ? claimedRole.trim().toLowerCase() : '';
			const userTypeId = ROLE_MAP[normalizedRole] || DEFAULT_USER_TYPE_ID;

			const admin = new PocketBase(getPocketBaseUrl());
			admin.autoCancellation(false);
			await admin.collection('_superusers').authWithPassword(env.PB_ADMIN_EMAIL, env.PB_ADMIN_PASSWORD);
			const updated = await admin.collection('users').update(record.id, { user_type: userTypeId });

			cookies.set(SESSION_COOKIE, authData.token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: url.protocol === 'https:',
				maxAge: 60 * 60 * 24 * 7
			});
			cacheSessionUser(authData.token, updated);
			return json({ ok: true, record: updated });
		}

		cookies.set(SESSION_COOKIE, authData.token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60 * 60 * 24 * 7
		});
		cacheSessionUser(authData.token, record);
		return json({ ok: true, record });
	} catch (error) {
		const status = Number(error?.status) || 500;
		return json({ ok: false, error: status >= 500 ? 'OIDC sign-in could not be completed' : error.message }, { status });
	}
}
