import { writable, derived } from 'svelte/store';
import { items as mockItems } from './mock-data.js';
import {
  pb,
  getUserType,
  isSuperadmin,
  getItems,
  getTeachers,
  createLoanRequest,
  logout as pbLogout,
} from './pocketbase.js';

const hasPb = Boolean(
  import.meta.env.VITE_POCKETBASE_URL ||
    import.meta.env.VITE_POCKETBASE_TARGET
);

// Auth state
export const user = writable(pb.authStore.record);
export const userType = derived(user, ($user) => getUserType($user));
export const canAdmin = derived(user, ($user) => isSuperadmin($user));
export const isTeacherOrAdmin = derived(user, ($user) => isSuperadmin($user) || getUserType($user) === 'teachers');

// Shared Items & Loan Cart
export const items = writable(hasPb ? [] : mockItems);
export const selectedItems = writable([]);
export const panelOpen = writable(false);
export const teachers = writable([]);

// Global Toasts / Feedback
export const toastMessage = writable({ type: '', text: '' });

let unsubscribeRealtime = null;

export async function loadItems() {
  try {
    const list = await getItems();
    if (hasPb) items.set(list);
    else if (list.length) items.set(list);
  } catch (e) {
    console.error('Load items failed', e);
  }
}

export async function loadTeachersList() {
  try {
    const result = await getTeachers();
    teachers.set(result);
  } catch (e) {
    teachers.set([]);
  }
}

export function toggleItem(item) {
  selectedItems.update((list) =>
    list.some((selected) => selected.id === item.id)
      ? list.filter((selected) => selected.id !== item.id)
      : [...list, item]
  );
}

export async function submitLoan(form) {
  let selected = [];
  selectedItems.subscribe((val) => (selected = val))();

  try {
    await createLoanRequest({
      ...form,
      itemIds: selected.map((i) => i.id),
    });
    selectedItems.set([]);
    panelOpen.set(false);
    toastMessage.set({ type: 'success', text: 'ส่งคำขอเรียบร้อยแล้ว' });
    return true;
  } catch (error) {
    const msg = error?.response?.message || 'ส่งคำขอไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ PocketBase';
    toastMessage.set({ type: 'error', text: msg });
    throw error;
  }
}

export async function startRealtime() {
  await stopRealtime();
  if (!pb.authStore.isValid) return;
  try {
    unsubscribeRealtime = await pb.collection('loan_requests').subscribe('*', () => {
      // triggers realtime notifications
    });
  } catch (e) {
    console.error('Realtime connection failed', e);
  }
}

export async function stopRealtime() {
  if (unsubscribeRealtime) {
    const unsub = unsubscribeRealtime;
    unsubscribeRealtime = null;
    await unsub();
  }
}

export function handleLogout() {
  stopRealtime();
  pbLogout();
  user.set(null);
  window.location.href = '/login';
}

export function loadAll() {
  loadItems();
  loadTeachersList();
  void startRealtime();
}

// Subscribe to PocketBase auth changes
pb.authStore.onChange(() => {
  const current = pb.authStore.record;
  user.set(current);
  loadAll();
});
