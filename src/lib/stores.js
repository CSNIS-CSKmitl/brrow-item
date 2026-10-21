import { writable, derived, get } from 'svelte/store';
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
export const authReady = writable(false);
export const userType = derived(user, ($user) => getUserType($user));
export const canAdmin = derived(user, ($user) => isSuperadmin($user));
export const isTeacherOrAdmin = derived(user, ($user) => isSuperadmin($user) || getUserType($user) === 'teachers');

// Shared Items & Loan Cart
export const items = writable(hasPb ? [] : mockItems);
export const itemsLoading = writable(hasPb);
export const itemsLoaded = writable(!hasPb);
export const selectedItems = writable([]);
export const panelOpen = writable(false);
export const teachers = writable([]);

// Global Toasts / Feedback
export const toastMessage = writable({ type: '', text: '' });

let unsubscribeRealtime = null;
let isRefreshingSession = false;
let initializedUserId = null;
let bootstrapPromise = null;

export async function loadItems() {
  itemsLoading.set(true);
  try {
    const list = await getItems();
    if (hasPb) items.set(list);
    else if (list.length) items.set(list);
  } catch (e) {
    console.error('Load items failed', e);
  } finally {
    itemsLoaded.set(true);
    itemsLoading.set(false);
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
    const ids = selected.map((i) => i.id);
    await createLoanRequest({
      ...form,
      itemIds: ids,
      items: ids,
      quantities: form.quantities || Object.fromEntries(ids.map((id) => [id, 1])),
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

export function loadAll({ force = false } = {}) {
  if (!pb.authStore.isValid) {
    initializedUserId = null;
    user.set(null);
    authReady.set(true);
    return Promise.resolve();
  }
  const currentRecordId = pb.authStore.record?.id || null;
  if (!force && get(authReady) && initializedUserId && currentRecordId === initializedUserId) {
    return Promise.resolve();
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
    await establishServerSession({
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
    initializedUserId = pb.authStore.record?.id || null;
  } finally {
    isRefreshingSession = false;
    authReady.set(true);
  }

  // Data stores own their loading state; authentication should not block the
  // whole application while catalog data is fetched.
  void loadItems();
  void loadTeachersList();
  void startRealtime();
}

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
  if (initializedUserId && initializedUserId !== currentId) {
    initializedUserId = null;
  }
});
