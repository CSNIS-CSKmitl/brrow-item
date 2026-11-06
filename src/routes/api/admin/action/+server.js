import { json } from '@sveltejs/kit';
import { adminPocketBase } from '$lib/server/pocketbase';
import { isBorrowlyAdmin } from '$lib/roles';

export async function POST({ request, locals }) {
	if (!isBorrowlyAdmin(locals.user)) {
		return json({ error: 'forbidden' }, { status: 403 });
	}

	try {
		const { id, action } = await request.json();
		if (!id || (action !== 'approve' && action !== 'reject')) {
			return json({ ok: false, error: 'invalid payload' }, { status: 400 });
		}

		const pb = await adminPocketBase();
		const record = await pb.collection('loan_requests').getOne(id);
		const confirmed = (
			action === 'approve' && record.status === 'approved' ||
			action === 'reject' && record.status === 'rejected'
		);

		if (!confirmed) {
			return json({ ok: true, recorded: false }, { status: 409 });
		}

		await pb.collection('admin_actions').create({
			service: 'loan',
			action,
			actor: locals.user.id,
			target_collection: 'loan_requests',
			target_id: id,
			target_label: String(record.borrowerName || '').slice(0, 256),
			metadata: { status: record.status }
		});

		return json({ ok: true, recorded: true });
	} catch (error) {
		console.warn('[admin/action] failed:', error);
		return json({ ok: true, recorded: false });
	}
}
