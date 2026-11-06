import { json } from '@sveltejs/kit';
import { adminPocketBase } from '$lib/server/pocketbase';
import { isBorrowlyAdmin } from '$lib/roles';
import { computeAdminStats } from '$lib/admin-stats.js';

export async function GET({ url, locals }) {
	if (!isBorrowlyAdmin(locals.user)) {
		return json({ error: 'forbidden' }, { status: 403 });
	}

	const range = url.searchParams.get('range') || 'all';
	try {
		const pb = await adminPocketBase();
		const [items, requests] = await Promise.all([
			pb.collection('items').getFullList({ fields: 'id,name,category,total,available' }),
			pb.collection('loan_requests').getFullList({
				fields: 'id,status,dueDate,returnedAt,approvedAt,created,updated,email,items,asset_tags,adminComment,borrowerName'
			})
		]);
		const stats = computeAdminStats({ items, requests, range, now: new Date() });
		return json(stats);
	} catch (error) {
		console.error('[admin/stats] failed:', error);
		return json({ error: 'failed to load stats' }, { status: 500 });
	}
}
