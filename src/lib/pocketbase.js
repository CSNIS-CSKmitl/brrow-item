import PocketBase from 'pocketbase';

// Use the same-origin proxy in the browser, as the other production apps do.
// This avoids CORS and keeps the PocketBase host private behind the web server.
const pbUrl = '/api/db';

export const pb = new PocketBase(pbUrl);
pb.autoCancellation(false);

export async function establishServerSession(authData) {
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: authData.token, record: authData.record })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'ไม่สามารถสร้างเซสชันการเข้าสู่ระบบได้');
  return result.record || authData.record;
}

export async function login(identity, password) {
  // PocketBase accepts either the username or email as the identity field.
  const authData = await pb.collection('users').authWithPassword(identity.trim(), password);
  const record = await establishServerSession(authData);
  pb.authStore.save(authData.token, record);
  return { ...authData, record };
}

export async function loginWithOIDC(authWindow) {
  // Start PocketBase OAuth synchronously from the click handler. Fetching
  // auth methods first yields the browser's user activation and causes the
  // OAuth popup to be blocked by browsers.
  const provider = import.meta.env.VITE_POCKETBASE_OIDC_PROVIDER || 'oidc';
  const authData = await pb.collection('users').authWithOAuth2({
    provider,
    urlCallback: (url) => {
      if (!authWindow || authWindow.closed) {
        throw new Error('เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ OIDC กรุณาอนุญาตป๊อปอัปสำหรับ req.cskmitl.com');
      }
      authWindow.location.href = url;
    }
  });
  const response = await fetch('/api/auth/oidc/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: authData.token,
      record: authData.record,
      meta: authData.meta
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || 'ไม่สามารถกำหนดประเภทผู้ใช้จาก OIDC ได้');
  }

  const record = result.record || authData.record;
  pb.authStore.save(authData.token, record);
  const sessionRecord = await establishServerSession({ ...authData, record });
  pb.authStore.save(authData.token, sessionRecord);
  return { ...authData, record: sessionRecord };
}

export async function hydrateCurrentUser(authData = { token: pb.authStore.token, record: pb.authStore.record }) {
  if (!authData.record?.id) return authData;
  try {
    const record = await pb.collection('users').getOne(authData.record.id, {
      expand: 'user_type',
      requestKey: null
    });
    pb.authStore.save(authData.token || pb.authStore.token, record);
    return { ...authData, record };
  } catch (error) {
    console.warn('Unable to hydrate current user; continuing with authenticated record', error);
    return authData;
  }
}

export function logout() {
  pb.authStore.clear();
  void fetch('/api/auth/logout', { redirect: 'manual' }).catch(() => {});
}

export function isSuperadmin(record = pb.authStore.record) {
  // Application authorization is based only on the user's `user_type` role.
  // PocketBase `_superusers` are backend service accounts and must never grant
  // access to the Borrowly admin UI.
  const type = getUserType(record);
  return type === 'superadmin' || type === 'admin';
}

export function getUserType(record = pb.authStore.record) {
  const type = record?.expand?.user_type?.type || record?.user_type || '';
  if (type === '000000000000009') return 'superadmin';
  if (type === '000000000000000') return 'admin';
  if (type === '000000000000002') return 'teachers';
  if (type === '000000000000001') return 'students';
  if (type === '000000000000004') return 'staff';
  return type;
}

export async function getItems() {
  if (!import.meta.env.VITE_POCKETBASE_URL && !import.meta.env.VITE_POCKETBASE_TARGET) return [];
  return pb.collection('items').getFullList({ sort: '-created', requestKey: null });
}

export async function createLoanRequest({ itemIds, items, quantities, borrowerName, email, dueDate, note, teacher }) {
  const currentUser = pb.authStore.record;
  const isTeacher = getUserType(currentUser) === 'teachers';
  const isAdmin = isSuperadmin(currentUser);

  const request = {
    items: items || itemIds,
    quantities: quantities || Object.fromEntries((items || itemIds || []).map((id) => [id, 1])),
    borrowerName: currentUser?.name || borrowerName || currentUser?.email,
    email: currentUser?.email || email,
    dueDate,
    note,
    requester: currentUser?.id,
    // ถ้า role เป็น อจ ให้ส่งตรงไปรอ admin อนุมัติ (status: pending_caretaker)
    // ถ้า role เป็น นักศึกษา ให้ส่งไปรอ อจ. รับทราบก่อน (status: pending_teacher)
    teacher: isTeacher || isAdmin ? currentUser?.id : teacher,
    status: isTeacher ? 'pending_caretaker' : isAdmin ? 'approved' : 'pending_teacher'
  };
  if (isAdmin) {
    request.caretaker = currentUser?.id;
    request.approvedAt = new Date().toISOString();
  }

  const created = await pb.collection('loan_requests').create(request);
  try {
    const itemArr = Array.isArray(request.items) ? request.items : [];
    for (const itemId of itemArr) {
      if (!itemId) continue;
      const qty = Number(request.quantities?.[itemId]) || 1;
      await pb.collection('loan_items').create({
        request: created.id,
        item: itemId,
        quantity: qty,
        status: created.status === 'approved' ? 'borrowed' : 'pending'
      });
    }
  } catch (err) {
    console.warn('[loan_items] Sync failed (non-blocking):', err);
  }
  return created;
}

export async function getTeachers() {
  const users = await pb.collection('users').getFullList({ sort: 'name', expand: 'user_type', requestKey: null });
  return users.filter((user) => user.expand?.user_type?.type === 'teachers');
}

export async function getLoanRequests(status = '', teacherId = null) {
  const filters = [];
  if (status) filters.push(`status = "${status}"`);
  if (teacherId) filters.push(`teacher = "${teacherId}"`);
  const filter = filters.join(' && ');
  return pb.collection('loan_requests').getFullList({ filter, sort: '-created', expand: 'requester,teacher,caretaker,items', requestKey: null });
}

export async function getMyLoanRequests() {
  const userId = pb.authStore.record?.id;
  if (!userId) return [];
  return pb.collection('loan_requests').getFullList({
    filter: `requester = "${userId}"`,
    sort: '-created',
    expand: 'requester,teacher,caretaker,items',
    requestKey: null
  });
}

export async function updateLoanStatus(id, status, comment = '') {
  if (status === 'returned' && !isSuperadmin()) {
    throw new Error('เฉพาะผู้ดูแลระบบเท่านั้นที่บันทึกการคืนของได้');
  }
  const user = pb.authStore.record?.id;
  const data = { status, updated_by: user || undefined };
  const trimmed = comment ? comment.trim() : '';

  if (getUserType() === 'teachers') {
    // อาจารย์ใส่เหตุผลเฉพาะตอนไม่รับทราบ (rejected) เท่านั้น
    // ตอนรับทราบ (pending_caretaker) ไม่ต้องมีเหตุผล และกฎ PocketBase ไม่อนุญาตให้แก้ teacherComment
    if (status === 'rejected' && trimmed) {
      data.teacherComment = trimmed;
      data.rejectedAt = new Date().toISOString();
    }
  } else {
    // ผู้ดูแล/Admin:
    // ถ้าอนุมัติ -> บันทึกเลขครุภัณฑ์ / หมายเลขเครื่อง / MAC Address ลงใน asset_tags
    // ถ้าไม่อนุมัติ -> บันทึกเหตุผลลงใน adminComment
    if (status === 'approved') {
      if (trimmed) data.asset_tags = trimmed;
      data.approvedAt = new Date().toISOString();
    } else if (status === 'rejected') {
      if (trimmed) data.adminComment = trimmed;
      data.rejectedAt = new Date().toISOString();
    } else if (status === 'returned') {
      data.returnedAt = new Date().toISOString();
    }

    if (status === 'approved' || status === 'rejected' || status === 'returned') {
      if (user) data.caretaker = user;
    }
  }

  // Stock management for approved and returned status transitions
  let previousRecord = null;
  if (isSuperadmin() && (status === 'approved' || status === 'returned')) {
    try {
      previousRecord = await pb.collection('loan_requests').getOne(id);
    } catch {}
  }

  const updatedRecord = await pb.collection('loan_requests').update(id, data, { expand: 'requester,teacher,caretaker,items' });

  // Ask the server to record who made the decision in admin_actions (best-effort).
  if (status === 'approved' || status === 'rejected') {
    fetch('/api/admin/action', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: status === 'approved' ? 'approve' : 'reject' })
    }).catch(() => {});
  }

  if (isSuperadmin() && previousRecord) {
    const itemIdsToAdjust = Array.isArray(previousRecord.items) && previousRecord.items.length > 0
      ? previousRecord.items
      : (Array.isArray(previousRecord.itemIds) ? previousRecord.itemIds : []);

    if (status === 'approved' && previousRecord.status !== 'approved') {
      for (const itemId of itemIdsToAdjust) {
        try {
          const item = await pb.collection('items').getOne(itemId);
          const quantity = Math.max(1, Number(previousRecord.quantities?.[itemId]) || 1);
          const nextAvail = Math.max(0, (Number(item.available) || 0) - quantity);
          await pb.collection('items').update(itemId, { available: nextAvail, updated_by: user || undefined });
        } catch {}
      }
    } else if (status === 'returned' && previousRecord.status !== 'returned') {
      for (const itemId of itemIdsToAdjust) {
        try {
          const item = await pb.collection('items').getOne(itemId);
          const quantity = Math.max(1, Number(previousRecord.quantities?.[itemId]) || 1);
          const nextAvail = Math.min(Number(item.total) || 1, (Number(item.available) || 0) + quantity);
          await pb.collection('items').update(itemId, { available: nextAvail, updated_by: user || undefined });
        } catch {}
      }
    }
  }

  try {
    if (status === 'returned') {
      const items = await pb.collection('loan_items').getFullList({ filter: `request = "${id}"` });
      for (const it of items) {
        await pb.collection('loan_items').update(it.id, {
          status: 'returned',
          returned_at: new Date().toISOString()
        });
      }
    } else if (status === 'approved') {
      const items = await pb.collection('loan_items').getFullList({ filter: `request = "${id}"` });
      for (const it of items) {
        await pb.collection('loan_items').update(it.id, { status: 'borrowed' });
      }
    }
  } catch (err) {
    console.warn('[loan_items] Status update sync failed:', err);
  }

  return updatedRecord;
}

export async function markLoanReturned(id, comment = '') {
  return updateLoanStatus(id, 'returned', comment);
}

export async function updateMyLoanRequest(id, { dueDate, note, teacher, quantities }) {
  return pb.collection('loan_requests').update(id, { dueDate, note, teacher, quantities }, { expand: 'requester,teacher,caretaker,items' });
}

export async function cancelLoanRequest(id) {
  return updateLoanStatus(id, 'cancelled');
}

export async function updateLoanQuantities(id, quantities) {
  const updated = await pb.collection('loan_requests').update(id, { quantities }, { expand: 'requester,teacher,caretaker,items' });
  try {
    const loanItems = await pb.collection('loan_items').getFullList({ filter: `request = "${id}"` });
    for (const [itemId, qty] of Object.entries(quantities)) {
      const match = loanItems.find((li) => li.item === itemId);
      if (match) {
        await pb.collection('loan_items').update(match.id, { quantity: Number(qty) || 1 });
      }
    }
  } catch (err) {
    console.warn('[loan_items] Quantity sync failed:', err);
  }
  return updated;
}

export async function createItem(data) {
  const user = pb.authStore.record?.id;
  return pb.collection('items').create({ ...data, created_by: user || undefined, updated_by: user || undefined });
}

export async function updateItem(id, data) {
  const user = pb.authStore.record?.id;
  return pb.collection('items').update(id, { ...data, updated_by: user || undefined });
}

export async function deleteItem(id) {
  return pb.collection('items').delete(id);
}
