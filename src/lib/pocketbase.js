import PocketBase from 'pocketbase';

// ตั้งค่า VITE_POCKETBASE_URL ในไฟล์ .env เมื่อต้องการใช้ฐานข้อมูลจริง
export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090');

export async function login(email, password) {
  const authData = await pb.collection('users').authWithPassword(email, password);
  return hydrateCurrentUser(authData);
}

export async function loginWithOIDC() {
  const methods = await pb.collection('users').listAuthMethods();
  const preferred = import.meta.env.VITE_POCKETBASE_OIDC_PROVIDER || 'oidc';
  const provider = methods.oauth2?.providers?.find((entry) => entry.name === preferred) || methods.oauth2?.providers?.[0];
  if (!provider) throw new Error('ไม่พบ OAuth/OIDC provider ใน PocketBase');
  const authData = await pb.collection('users').authWithOAuth2({ provider: provider.name });
  return hydrateCurrentUser(authData);
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
  // อย่าผูกกับ id ของ relation เพราะ id แต่ละ PocketBase ไม่เหมือนกัน
  // และอาจทำให้ role อื่นถูกตีความเป็นผู้ดูแลโดยผิดพลาด
  return getUserType(record) === 'superadmin';
}

export function getUserType(record = pb.authStore.record) {
  return record?.expand?.user_type?.type || record?.user_type || '';
}

export async function getItems() {
  if (!import.meta.env.VITE_POCKETBASE_URL) return [];
  return pb.collection('items').getFullList({ sort: '-created', requestKey: null });
}

export async function createLoanRequest({ itemIds, borrowerName, email, dueDate, note, teacher }) {
  const currentUser = pb.authStore.record;
  const requesterIsTeacher = getUserType(currentUser) === 'teachers';
  const requesterIsSuperadmin = isSuperadmin(currentUser);
  const request = {
    itemIds,
    borrowerName: currentUser?.name || borrowerName || currentUser?.email,
    email: currentUser?.email || email,
    dueDate,
    note,
    requester: currentUser?.id,
    // ผู้ดูแลยืมได้ทันที แต่ยังเก็บรายการไว้เป็นประวัติที่ตรวจสอบได้
    teacher: requesterIsTeacher || requesterIsSuperadmin ? currentUser?.id : teacher,
    status: requesterIsSuperadmin ? 'approved' : requesterIsTeacher ? 'pending_caretaker' : 'pending_teacher'
  };
  if (requesterIsSuperadmin) request.caretaker = currentUser?.id;
  return pb.collection('loan_requests').create(request);
}

export async function getTeachers() {
  const users = await pb.collection('users').getFullList({ sort: 'name', expand: 'user_type', requestKey: null });
  return users.filter((user) => user.expand?.user_type?.type === 'teachers');
}

export async function getLoanRequests(status) {
  const filter = status ? `status = "${status}"` : '';
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

export async function updateLoanStatus(id, status, teacherComment = '') {
  const user = pb.authStore.record?.id;
  const data = { status };
  // ทั้งอาจารย์และผู้ดูแลต้องบอกเหตุผลเมื่อปฏิเสธ แต่มีผู้บันทึกคนละฟิลด์
  if (status === 'rejected' && getUserType() === 'teachers') data.teacherComment = teacherComment.trim();
  if (isSuperadmin() && status === 'rejected') data.adminComment = teacherComment.trim();
  if ((status === 'approved' || status === 'rejected') && isSuperadmin()) data.caretaker = user;
  return pb.collection('loan_requests').update(id, data, { expand: 'requester,teacher,caretaker' });
}

export async function updateMyLoanRequest(id, { dueDate, note, teacher }) {
  return pb.collection('loan_requests').update(id, { dueDate, note, teacher }, { expand: 'requester,teacher,caretaker' });
}

export async function createItem(data) {
  return pb.collection('items').create(data);
}

export async function deleteItem(id) {
  return pb.collection('items').delete(id);
}
