import PocketBase from 'pocketbase';

// ตั้งค่า PocketBase client
// หากเปิดใช้ Proxy หรือใช้ Relative path จะส่ง request ผ่าน Vite Proxy ('/')
const rawUrl = import.meta.env.VITE_POCKETBASE_URL;
const useDirectUrl = import.meta.env.VITE_USE_PROXY === 'false' && rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'));
const pbUrl = useDirectUrl ? rawUrl : (rawUrl && rawUrl !== '/' ? rawUrl : '/');

export const pb = new PocketBase(pbUrl);

export async function login(email, password) {
  const authData = await pb.collection('users').authWithPassword(email, password);
  return hydrateCurrentUser(authData);
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
  return { ...authData, record };
}

export async function hydrateCurrentUser(authData = { token: pb.authStore.token, record: pb.authStore.record }) {
  if (!authData.record?.id) return authData;
  const record = await pb.collection('users').getOne(authData.record.id, { expand: 'user_type' });
  pb.authStore.save(authData.token || pb.authStore.token, record);
  return { ...authData, record };
}

export function logout() {
  pb.authStore.clear();
}

export function isSuperadmin(record = pb.authStore.record) {
  const type = getUserType(record);
  return type === 'superadmin' || type === 'admin' || type === '000000000000009' || type === '000000000000000';
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

export async function createLoanRequest({ itemIds, borrowerName, email, dueDate, note, teacher }) {
  const currentUser = pb.authStore.record;
  const isTeacher = getUserType(currentUser) === 'teachers';
  const isAdmin = isSuperadmin(currentUser);

  const request = {
    itemIds,
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
  }

  return pb.collection('loan_requests').create(request);
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
  return pb.collection('loan_requests').getFullList({ filter, sort: '-created', expand: 'requester,teacher,caretaker', requestKey: null });
}

export async function getMyLoanRequests() {
  const userId = pb.authStore.record?.id;
  if (!userId) return [];
  return pb.collection('loan_requests').getFullList({
    filter: `requester = "${userId}"`,
    sort: '-created',
    expand: 'requester,teacher,caretaker',
    requestKey: null
  });
}

export async function updateLoanStatus(id, status, comment = '') {
  const user = pb.authStore.record?.id;
  const data = { status };
  const trimmed = comment ? comment.trim() : '';

  if (getUserType() === 'teachers') {
    // อาจารย์ใส่เหตุผลเฉพาะตอนไม่รับทราบ (rejected) เท่านั้น
    // ตอนรับทราบ (pending_caretaker) ไม่ต้องมีเหตุผล และกฎ PocketBase ไม่อนุญาตให้แก้ teacherComment
    if (status === 'rejected' && trimmed) {
      data.teacherComment = trimmed;
    }
  } else {
    // ผู้ดูแลระบบ / superadmin บันทึกหมายเลข MAC Address หรือข้อความตอนอนุมัติ/ปฏิเสธ
    if (trimmed) {
      data.adminComment = trimmed;
    }
    if (status === 'approved' || status === 'rejected') {
      if (user) data.caretaker = user;
    }
  }
  return pb.collection('loan_requests').update(id, data, { expand: 'requester,teacher,caretaker' });
}

export async function updateMyLoanRequest(id, { dueDate, note, teacher }) {
  return pb.collection('loan_requests').update(id, { dueDate, note, teacher }, { expand: 'requester,teacher,caretaker' });
}

export async function createItem(data) {
  return pb.collection('items').create(data);
}

export async function updateItem(id, data) {
  return pb.collection('items').update(id, data);
}

export async function deleteItem(id) {
  return pb.collection('items').delete(id);
}
