import { writable, derived } from 'svelte/store';
import { items as mockItems } from './mock-data.js';
import {
  pb,
  getUserType,
  isSuperadmin,
  getItems,
  getTeachers,
  createLoanRequest,
  establishServerSession,
  logout as pbLogout,
} from './pocketbase.js';

const hasPb = Boolean(
  import.meta.env.VITE_POCKETBASE_URL ||
    import.meta.env.VITE_POCKETBASE_TARGET
);

// Auth state
export const user = writable(pb.authStore.record);
// Distinguish "still restoring the session" from "confirmed signed out".
// Route guards must wait for this flag or the login page flashes while
// PocketBase refreshes an existing session.
export const authReady = writable(false);
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
let isRefreshingSession = false;
let initializedUserId = pb.authStore.record?.id || null;
let bootstrapPromise = null;

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
  if (unsubscribeRealtime || !pb.authStore.isValid) return;
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
  initializedUserId = null;
  stopRealtime();
  pbLogout();
  user.set(null);
  authReady.set(true);
  window.location.href = '/login';
}

export function loadAll() {
  if (!pb.authStore.isValid) {
    user.set(null);
    authReady.set(true);
    return;
  }
  if (!bootstrapPromise) {
    bootstrapPromise = refreshAndLoad().finally(() => {
      bootstrapPromise = null;
    });
  }
  return bootstrapPromise;
}

async function refreshAndLoad() {
  if (isRefreshingSession) return;
  isRefreshingSession = true;
  try {
    const authData = await pb.collection('users').authRefresh({
      expand: 'user_type',
      requestKey: null,
    });
    initializedUserId = authData?.record?.id || pb.authStore.record?.id || null;
    user.set(pb.authStore.record);
    void establishServerSession({
      token: pb.authStore.token,
      record: pb.authStore.record,
    }).catch(() => {});
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status === 401 || status === 403) {
      console.error('Borrowly session expired or unauthorized', error);
      initializedUserId = null;
      pb.authStore.clear();
      user.set(null);
      authReady.set(true);
      isRefreshingSession = false;
      return;
    }
    console.warn('Transient error refreshing Borrowly session; keeping current session', error);
  } finally {
    isRefreshingSession = false;
    authReady.set(true);
  }
  await Promise.all([loadItems(), loadTeachersList()]);
  void startRealtime();
}

// Mirror authentication changes only. Login flows navigate to a fresh page,
// whose single bootstrap performs authRefresh and data loading. Starting a new
// bootstrap here can recurse because authRefresh itself updates authStore.
pb.authStore.onChange(() => {
  const current = pb.authStore.record;
  user.update((prev) => {
    if (current && prev?.id === current.id && !current.expand?.user_type && prev.expand?.user_type) {
      return { ...current, expand: { ...current.expand, user_type: prev.expand.user_type } };
    }
    return current;
  });
  const currentId = current?.id || null;
  if (!currentId) {
    initializedUserId = null;
    void stopRealtime();
    return;
  }
  initializedUserId = currentId;
});
