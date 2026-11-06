import PocketBase from 'pocketbase';
import { getPocketBaseUrl } from './pocketbase.js';
import { getUserRoles, hasRole, isBorrowlyAdmin } from '../roles.js';

export const SESSION_COOKIE = 'borrowly_auth';

const SESSION_CACHE_TTL_MS = 2 * 60 * 1000;
const sessionCache = new Map();

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
	const roles = getUserRoles(record);
	let role = 'user';
	if (roles.includes('head')) role = 'head';
	else if (roles.includes('super_admin') || roles.includes('superadmin')) role = 'super_admin';
	else if (roles.includes('admin')) role = 'admin';
	else if (roles.includes('teachers') || roles.includes('teacher')) role = 'teachers';
	else if (roles.includes('staff') || roles.includes('stuff')) role = 'staff';
	else if (roles.includes('students') || roles.includes('student')) role = 'students';
	return { id: record.id, email: record.email || '', role, roles, isAdmin: isBorrowlyAdmin(record) };
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
	return user;
}

export function invalidateSessionUser(token) {
	if (token) sessionCache.delete(token);
}

export async function getSessionUser(token) {
	if (!token) return null;
	const cached = sessionCache.get(token);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.user;
	}
	if (cached) sessionCache.delete(token);

	const pb = new PocketBase(getPocketBaseUrl());
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
			} catch {}
		}
		return null;
	}
}
