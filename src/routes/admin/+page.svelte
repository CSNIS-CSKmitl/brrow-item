<script>
  import { onMount, onDestroy } from 'svelte';
  import { Trash2, Plus, Pencil, PackageOpen, Check, X, Download, Clock3, Package, RotateCcw } from '@lucide/svelte';
  import Button from '../../lib/components/Button.svelte';
  import AdminStats from '../../lib/components/AdminStats.svelte';
  import { items as mockItems } from '../../lib/mock-data.js';
  import { items, user, teachers, loadItems } from '../../lib/stores.js';
  import { createItem, updateItem, deleteItem, getLoanRequests, updateLoanStatus, markLoanReturned, getUserType, isAdmin, pb } from '../../lib/pocketbase.js';
  import { exportRequestsToCSV, exportSingleRequestToCSV, exportItemsToCSV, formatDateTime } from '../../lib/csv.js';
  import { getStatusBadgeClass, getStatusDotClass } from '../../lib/status.js';
  import {
    computeAdminStats,
    filterRequestsByTimeRange,
    filterRequestsByDrilldown,
    isRequestOverdue,
  } from '../../lib/admin-stats.js';
  import { getAdminDashboardState, updateAdminDashboardState } from '../../lib/admin-dashboard-state.js';

  // Main Tab: 'requests' | 'items'
  let activeMainTab = 'requests';

  // --- Loan Requests / Approvals State ---
  const labels = {
    pending_teacher: 'รอ อจ. รับทราบ',
    pending_caretaker: 'รอผู้ดูแลอนุมัติ',
    approved: 'อนุมัติแล้ว',
    returned: 'คืนแล้ว',
    rejected: 'ไม่อนุมัติ',
  };

  const initialDashboard = getAdminDashboardState();
  let requests = initialDashboard.requests;
  let requestFilter = 'pending'; // 'pending' | 'pending_all' | 'pending_teacher' | 'approved' | 'overdue' | 'returned' | 'rejected' | 'all'
  let selectedRange = 'all'; // 'today' | '7d' | 'month' | 'year' | 'all'

  // Stats Loading / Error / Freshness state
  let statsLoading = !initialDashboard.loaded;
  let statsError = '';
  let lastUpdated = initialDashboard.lastUpdated;
  let isRealtime = false;
  let hasLoadedRequests = initialDashboard.loaded;

  // Approve state with text
  let approvingId = '';
  let approveComment = '';
  let approveError = '';

  // Reject state with text
  let rejectingId = '';
  let rejectComment = '';
  let rejectError = '';

  // Return state
  let returningId = '';
  let returnError = '';

  let unsubRequests = null;
  async function loadRequests() {
    const result = await getLoanRequests();
    requests = result;
    hasLoadedRequests = true;
    lastUpdated = new Date().toISOString();
    updateAdminDashboardState(requests, lastUpdated);
    return result;
  }

  async function refreshDashboardData() {
    statsLoading = true;
    statsError = '';
    const [reqOutcome, itemsOutcome] = await Promise.allSettled([
      loadRequests(),
      loadItems(),
    ]);
    const requestsOk = reqOutcome.status === 'fulfilled';
    const itemsOk = itemsOutcome.status === 'fulfilled';

    if (!requestsOk && !itemsOk && !hasLoadedRequests) {
      statsError = 'ไม่สามารถโหลดข้อมูลสถิติและรายการคำขอได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่';
    } else {
      lastUpdated = new Date().toISOString();
    }
    statsLoading = false;
  }

  onMount(async () => {
    await refreshDashboardData();
    try {
      unsubRequests = await pb.collection('loan_requests').subscribe('*', async () => {
        try {
          await loadRequests();
          lastUpdated = new Date().toISOString();
          statsError = '';
        } catch {}
      });
      isRealtime = true;
    } catch {
      isRealtime = false;
    }
  });

  onDestroy(() => {
    if (unsubRequests) unsubRequests();
  });

  $: rangeRequests = filterRequestsByTimeRange(requests, selectedRange);
  $: pendingTeacherRequests = rangeRequests.filter((r) => r.status === 'pending_teacher');
  $: pendingRequests = rangeRequests.filter((r) => r.status === 'pending_caretaker');
  $: approvedRequests = rangeRequests.filter((r) => r.status === 'approved');
  $: overdueRequestsList = rangeRequests.filter((r) => isRequestOverdue(r));
  $: returnedRequests = rangeRequests.filter((r) => r.status === 'returned');
  $: rejectedRequests = rangeRequests.filter((r) => r.status === 'rejected');

  $: localStats = computeAdminStats({
    items: $items,
    requests,
    range: selectedRange,
  });

  $: activeStats = localStats;
  $: pendingCount = activeStats.pending;

  $: filteredRequests = filterRequestsByDrilldown(rangeRequests, requestFilter);

  function handleRangeChange(nextRange) {
    selectedRange = nextRange;
  }

  function handleDrilldown(filterKey) {
    activeMainTab = 'requests';
    requestFilter = filterKey;
  }

  function itemName(id) {
    return $items.find((item) => item.id === id)?.name || mockItems.find((item) => item.id === id)?.name || id;
  }

  function formatDate(value) {
    return formatDateTime(value);
  }

  function statusLabel(request) {
    if (request.status === 'rejected' && request.teacherComment) return 'อาจารย์ไม่อนุมัติ';
    if (request.status === 'rejected' && request.adminComment) return 'ผู้ดูแลไม่อนุมัติ';
    return labels[request.status] || request.status;
  }

  function teacherName(request) {
    const t = request.expand?.teacher;
    if (t?.name && t?.email) return `${t.name} (${t.email})`;
    if (t?.name) return t.name;
    if (t?.email) return t.email;
    const found = $teachers.find((entry) => entry.id === request.teacher);
    if (found?.name && found?.email) return `${found.name} (${found.email})`;
    if (found?.name) return found.name;
    if (found?.email) return found.email;
    return request.teacher || 'ไม่ระบุอาจารย์';
  }

  function teacherDisplay(request) {
    const isTeacherSelf = request.teacher && request.requester && request.teacher === request.requester;
    return {
      label: isTeacherSelf ? 'อาจารย์ผู้ขอยืม' : 'อาจารย์ผู้รับทราบ / ขออนุมัติ',
      name: teacherName(request),
    };
  }

  // Approve flow
  function startApprove(request) {
    approvingId = request.id;
    rejectingId = '';
    approveComment = '';
    approveError = '';
  }
  function cancelApprove() {
    approvingId = '';
    approveComment = '';
    approveError = '';
  }
  async function confirmApprove(request) {
    approveError = '';
    try {
      await updateLoanStatus(request.id, 'approved', approveComment);
      await loadRequests();
      lastUpdated = new Date().toISOString();
      cancelApprove();
    } catch (error) {
      approveError = error?.response?.message || 'บันทึกการอนุมัติไม่สำเร็จ';
    }
  }

  // Return flow
  async function handleReturnLoan(request) {
    if (returningId || request.status !== 'approved') return;
    returnError = '';
    returningId = request.id;
    try {
      await markLoanReturned(request.id);
      await loadRequests();
      lastUpdated = new Date().toISOString();
    } catch (error) {
      returnError = error?.response?.message || 'บันทึกการคืนของไม่สำเร็จ';
    } finally {
      returningId = '';
    }
  }

  // Reject flow
  function startReject(request) {
    rejectingId = request.id;
    approvingId = '';
    rejectComment = '';
    rejectError = '';
  }
  function cancelReject() {
    rejectingId = '';
    rejectComment = '';
    rejectError = '';
  }
  async function confirmReject(request) {
    if (!rejectComment.trim()) {
      rejectError = 'กรุณาระบุเหตุผลที่ไม่อนุมัติ';
      return;
    }
    rejectError = '';
    try {
      await updateLoanStatus(request.id, 'rejected', rejectComment);
      await loadRequests();
      lastUpdated = new Date().toISOString();
      cancelReject();
    } catch (error) {
      rejectError = error?.response?.message || 'บันทึกการไม่อนุมัติไม่สำเร็จ';
    }
  }

  // CSV Export
  function exportCSV() {
    if (activeMainTab === 'requests') {
      exportRequestsToCSV(filteredRequests, $items, `admin_requests_${requestFilter}.csv`);
    } else {
      exportItemsToCSV($items, 'admin_items_catalog.csv');
    }
  }

  // --- Items Management State ---
  const emptyForm = () => ({ name: '', category: 'อุปกรณ์ไอที', description: '', image: '', available: 1, total: 1, location: '', is_active: true });
  let form = emptyForm();
  let itemError = '';
  let itemSuccess = '';
  let editingItemId = '';
  let saving = false;
  let deletingId = '';
  let itemFilter = 'all'; // 'all' | 'active' | 'archived'

  function startEditItem(item) {
    editingItemId = item.id;
    itemError = '';
    itemSuccess = '';
    form = {
      name: item.name || '',
      category: item.category || '',
      description: item.description || '',
      image: item.image || '',
      available: Number(item.available ?? 0),
      total: Number(item.total ?? 1),
      location: item.location || '',
      is_active: item.is_active !== false,
    };
  }

  function cancelEditItem() {
    editingItemId = '';
    form = emptyForm();
    itemError = '';
  }

  async function submitItem() {
    itemError = '';
    const total = Number(form.total);
    const available = Number(form.available);
    if (!Number.isInteger(total) || total < 1 || !Number.isInteger(available) || available < 0 || available > total) {
      itemError = 'จำนวนพร้อมให้ยืมต้องอยู่ระหว่าง 0 ถึงจำนวนทั้งหมด';
      return;
    }
    saving = true;
    try {
      const data = {
        name: form.name?.trim() || '',
        category: form.category?.trim() || 'อุปกรณ์ไอที',
        description: form.description?.trim() || '',
        image: form.image?.trim() || '',
        total,
        available,
        location: form.location?.trim() || '',
        is_active: Boolean(form.is_active),
      };
      if (editingItemId) {
        const updated = await updateItem(editingItemId, data);
        items.update((list) => list.map((entry) => (entry.id === updated.id ? updated : entry)));
        cancelEditItem();
        itemSuccess = `บันทึกการแก้ไข "${updated.name}" เรียบร้อยแล้ว`;
      } else {
        const created = await createItem(data);
        items.update((list) => [created, ...list]);
        cancelEditItem();
        itemSuccess = `เพิ่มรายการ "${created.name}" เรียบร้อยแล้ว`;
      }
    } catch (cause) {
      itemError = cause?.response?.message || (editingItemId
        ? 'แก้ไขรายการไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ PocketBase'
        : 'เพิ่มรายการไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ PocketBase');
    } finally {
      saving = false;
    }
  }

  async function toggleItemStatus(item, activate) {
    itemError = '';
    itemSuccess = '';
    deletingId = item.id;
    try {
      const updated = await updateItem(item.id, { is_active: activate });
      items.update((list) => list.map((entry) => (entry.id === updated.id ? updated : entry)));
      itemSuccess = activate
        ? `เปิดใช้งาน "${item.name}" ให้ยืมในระบบแล้ว`
        : `ยกเลิกการใช้งาน "${item.name}" (ซ่อนจากผู้ยืม) เรียบร้อยแล้ว`;
    } catch (cause) {
      itemError = cause?.response?.message || 'ปรับสถานะอุปกรณ์ไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ PocketBase';
    } finally {
      deletingId = '';
    }
  }

  async function removeItem(item) {
    if (!confirm(`ต้องการลบ "${item.name}" ใช่ไหม?`)) return;
    itemError = '';
    itemSuccess = '';
    deletingId = item.id;
    try {
      // ลองลบจริงออกจาก DB ก่อน (กรณีของใหม่ที่ยังไม่เคยมีประวัติการยืม จะลบได้สำเร็จ)
      await deleteItem(item.id);
      items.update((list) => list.filter((entry) => entry.id !== item.id));
      if (editingItemId === item.id) cancelEditItem();
      itemSuccess = `ลบ "${item.name}" ออกจากระบบเรียบร้อยแล้ว`;
    } catch (cause) {
      // หากลบไม่สำเร็จเนื่องจากติดประวัติการยืมใน DB (เคยถูกยืมและคืนแล้ว)
      // ให้ทำ Soft Delete โดยอัตโนมัติ เพื่อให้ประวัติการยืมเดิมไม่พัง
      console.warn('Hard delete failed, falling back to soft delete:', cause);
      try {
        const updated = await updateItem(item.id, { is_active: false });
        items.update((list) => list.map((entry) => (entry.id === updated.id ? updated : entry)));
        if (editingItemId === item.id) cancelEditItem();
        itemSuccess = `เนื่องจาก "${item.name}" มีประวัติการยืมในระบบแล้ว จึงเปลี่ยนสถานะเป็น "ยกเลิกใช้งาน (ซ่อน)" เพื่อรักษาประวัติการยืมเดิมไว้`;
      } catch (softErr) {
        itemError = softErr?.response?.message || cause?.response?.message || 'ลบรายการไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ PocketBase';
      }
    } finally {
      deletingId = '';
    }
  }

  $: displayedItems = $items.filter((item) => {
    if (itemFilter === 'active') return item.is_active !== false;
    if (itemFilter === 'archived') return item.is_active === false;
    return true;
  });
</script>

<svelte:window on:keydown={(e) => { if (e.key === 'Escape') { cancelApprove(); cancelReject(); } }} />

<main class="mx-auto max-w-7xl px-5 py-12 lg:px-8">
  <div class="flex flex-col justify-between gap-4 md:flex-row md:items-center mb-8">
    <div>
      <p class="eyebrow"><PackageOpen size={14} /> ADMIN DASHBOARD</p>
      <h1 class="mt-2 text-3xl font-bold text-ink">แผงควบคุมผู้ดูแลระบบ</h1>
      <p class="mt-2 text-sm text-[#7c857e]">
        จัดการคำขอยืมของ อนุมัติพร้อมระบุข้อความ และส่งออกรายงาน CSV ได้ทั้งหมดในหน้านี้
      </p>
    </div>

    <!-- Export CSV Button -->
    <button
      type="button"
      class="inline-flex items-center gap-2 self-start rounded-xl border border-[#c8d4c9] bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm hover:bg-[#f4f7f4] transition"
      on:click={exportCSV}
      title="ส่งออกข้อมูลหน้าปัจจุบันเป็นไฟล์ CSV (รองรับภาษาไทยใน Excel)"
    >
      <Download size={16} class="text-[var(--accent-ink)]" />
      <span>
        {activeMainTab === 'requests' ? `Export คำขอยืม (${filteredRequests.length})` : `Export รายการของ (${$items.length})`}
      </span>
    </button>
  </div>

  {#if returnError}
    <div class="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-800">
      {returnError}
    </div>
  {/if}

  <!-- Main Navigation Tabs (Top Operational Area) -->
  <div class="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e5de] pb-4">
    <div class="flex gap-2 sm:gap-3">
      <button
        type="button"
        class="flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-sm font-bold transition {activeMainTab === 'requests' ? 'bg-sage text-white shadow-sm ring-2 ring-sage/20' : 'bg-white text-[#68726b] border border-[#e4e5de] hover:bg-[#f3f6f3]'}"
        on:click={() => (activeMainTab = 'requests')}
      >
        <Clock3 size={17} />
        <span>คำขอยืมและอนุมัติ</span>
        {#if pendingRequests.length > 0}
          <span class="rounded-full bg-white/30 px-2 py-0.5 text-xs font-bold text-white">
            {pendingRequests.length}
          </span>
        {/if}
      </button>

      {#if isAdmin($user) || getUserType($user) === 'superadmin'}
        <button
          type="button"
          class="flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-sm font-bold transition {activeMainTab === 'items' ? 'bg-sage text-white shadow-sm ring-2 ring-sage/20' : 'bg-white text-[#68726b] border border-[#e4e5de] hover:bg-[#f3f6f3]'}"
          on:click={() => (activeMainTab = 'items')}
        >
          <Package size={17} />
          <span>จัดการของยืม ({$items.length})</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- TAB 1: LOAN REQUESTS & APPROVALS -->
  {#if activeMainTab === 'requests'}
    <!-- Request Filter Tabs (Redesigned: Spacious, high contrast, easy to navigate) -->
    <div class="mb-6 flex flex-wrap gap-2 sm:gap-2.5">
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition shadow-xs {requestFilter === 'pending' ? 'bg-blue-600 text-white ring-2 ring-blue-600/25' : 'bg-white border border-[#dce3dc] text-[#556157] hover:bg-[#f4f7f4]'}"
        on:click={() => (requestFilter = 'pending')}
      >
        <span>รอผู้ดูแลอนุมัติ</span>
        <span class="rounded-full px-2 py-0.5 text-xs font-bold {requestFilter === 'pending' ? 'bg-white/25 text-white' : 'bg-blue-50 text-blue-700'}">
          {pendingRequests.length}
        </span>
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition shadow-xs {requestFilter === 'pending_teacher' ? 'bg-amber-600 text-white ring-2 ring-amber-600/25' : 'bg-white border border-[#dce3dc] text-[#556157] hover:bg-[#f4f7f4]'}"
        on:click={() => (requestFilter = 'pending_teacher')}
      >
        <span>รอ อจ. รับทราบ</span>
        <span class="rounded-full px-2 py-0.5 text-xs font-bold {requestFilter === 'pending_teacher' ? 'bg-white/25 text-white' : 'bg-amber-50 text-amber-700'}">
          {pendingTeacherRequests.length}
        </span>
      </button>

      {#if requestFilter === 'pending_all'}
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition shadow-xs bg-amber-700 text-white ring-2 ring-amber-700/25"
          on:click={() => (requestFilter = 'pending_all')}
        >
          <span>รออนุมัติทั้งหมด</span>
          <span class="rounded-full px-2 py-0.5 text-xs font-bold bg-white/25 text-white">
            {pendingCount}
          </span>
        </button>
      {/if}

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition shadow-xs {requestFilter === 'approved' ? 'bg-emerald-600 text-white ring-2 ring-emerald-600/25' : 'bg-white border border-[#dce3dc] text-[#556157] hover:bg-[#f4f7f4]'}"
        on:click={() => (requestFilter = 'approved')}
      >
        <span>กำลังถูกยืม</span>
        <span class="rounded-full px-2 py-0.5 text-xs font-bold {requestFilter === 'approved' ? 'bg-white/25 text-white' : 'bg-emerald-50 text-emerald-700'}">
          {approvedRequests.length}
        </span>
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition shadow-xs {requestFilter === 'overdue' ? 'bg-rose-700 text-white ring-2 ring-rose-700/25' : 'bg-white border border-[#dce3dc] text-[#556157] hover:bg-[#f4f7f4]'}"
        on:click={() => (requestFilter = 'overdue')}
      >
        <span>เกินกำหนดคืน</span>
        <span class="rounded-full px-2 py-0.5 text-xs font-bold {requestFilter === 'overdue' ? 'bg-white/25 text-white' : 'bg-rose-50 text-rose-700'}">
          {overdueRequestsList.length}
        </span>
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition shadow-xs {requestFilter === 'returned' ? 'bg-teal-600 text-white ring-2 ring-teal-600/25' : 'bg-white border border-[#dce3dc] text-[#556157] hover:bg-[#f4f7f4]'}"
        on:click={() => (requestFilter = 'returned')}
      >
        <span>คืนแล้ว</span>
        <span class="rounded-full px-2 py-0.5 text-xs font-bold {requestFilter === 'returned' ? 'bg-white/25 text-white' : 'bg-teal-50 text-teal-700'}">
          {returnedRequests.length}
        </span>
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition shadow-xs {requestFilter === 'rejected' ? 'bg-rose-600 text-white ring-2 ring-rose-600/25' : 'bg-white border border-[#dce3dc] text-[#556157] hover:bg-[#f4f7f4]'}"
        on:click={() => (requestFilter = 'rejected')}
      >
        <span>ไม่อนุมัติ</span>
        <span class="rounded-full px-2 py-0.5 text-xs font-bold {requestFilter === 'rejected' ? 'bg-white/25 text-white' : 'bg-rose-50 text-rose-700'}">
          {rejectedRequests.length}
        </span>
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition shadow-xs {requestFilter === 'all' ? 'bg-[#28322b] text-white ring-2 ring-black/10' : 'bg-white border border-[#dce3dc] text-[#556157] hover:bg-[#f4f7f4]'}"
        on:click={() => (requestFilter = 'all')}
      >
        <span>ทั้งหมด</span>
        <span class="rounded-full px-2 py-0.5 text-xs font-bold {requestFilter === 'all' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-700'}">
          {rangeRequests.length}
        </span>
      </button>
    </div>

    <!-- Requests List -->
    <div class="space-y-4">
      {#if !hasLoadedRequests && statsLoading}
        <div class="rounded-2xl border border-dashed border-[#d8d8d0] py-16 text-center text-[#7c857e]">
          กำลังโหลดรายการคำขอ...
        </div>
      {:else if filteredRequests.length === 0}
        <div class="rounded-2xl border border-dashed border-[#d4ddd4] bg-white py-14 px-6 text-center shadow-2xs">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef3ed] text-[var(--accent-ink)]">
            <PackageOpen size={24} />
          </div>
          <p class="text-base font-bold text-ink">ไม่มีคำขอในหมวดหมู่นี้</p>
          <p class="mt-1 text-xs text-[#7c857e]">
            {requestFilter === 'pending'
              ? 'ขณะนี้ไม่มีคำขอที่รอผู้ดูแลตรวจสอบและอนุมัติ'
              : requestFilter === 'pending_teacher'
                ? 'ขณะนี้ไม่มีคำขอที่รออาจารย์รับทราบ'
                : requestFilter === 'approved'
                  ? 'ไม่มีรายการที่อยู่ระหว่างการยืมในขณะนี้'
                  : requestFilter === 'overdue'
                    ? 'ไม่มีรายการที่เกินกำหนดคืน'
                    : requestFilter === 'returned'
                      ? 'ยังไม่มีรายการที่ส่งคืนแล้ว'
                      : requestFilter === 'rejected'
                        ? 'ไม่มีรายการที่ไม่อนุมัติ'
                        : 'ยังไม่มีประวัติคำขอยืมในระบบ'}
          </p>
          {#if rangeRequests.length > 0}
            <div class="mt-5 flex flex-wrap justify-center gap-2">
              {#if requestFilter !== 'all'}
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-xl border border-[#c4d2c5] bg-[#f8faf7] px-4 py-2 text-xs font-bold text-ink hover:bg-[#ebf1eb] transition"
                  on:click={() => (requestFilter = 'all')}
                >
                  ดูคำขอทั้งหมด ({rangeRequests.length})
                </button>
              {/if}
              {#if returnedRequests.length > 0 && requestFilter !== 'returned'}
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-bold text-teal-800 hover:bg-teal-100 transition"
                  on:click={() => (requestFilter = 'returned')}
                >
                  ดูรายการคืนแล้ว ({returnedRequests.length})
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      {#each filteredRequests as request}
        <article class="rounded-2xl border border-[#e4e5de] bg-white p-5 shadow-sm">
          <div class="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div class="space-y-1.5 flex-1">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="font-bold text-ink">คำขอของ {request.borrowerName}</h2>
                  <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold {getStatusBadgeClass(request.status)}">
                    <span class="h-1.5 w-1.5 rounded-full {getStatusDotClass(request.status)}"></span>
                    {statusLabel(request)}
                  </span>
                  {#if isRequestOverdue(request)}
                    <span class="inline-flex items-center rounded-full border border-rose-300 bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-800">
                      เกินกำหนดคืน
                    </span>
                  {/if}
                </div>
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-[#c9d3c9] bg-white px-2.5 py-1 text-xs font-semibold text-[#546056] hover:bg-[#f0f4ef] transition shadow-xs"
                  title="ดาวน์โหลดคำขอนี้เป็นไฟล์ CSV"
                  on:click={() => exportSingleRequestToCSV(request, $items)}
                >
                  <Download size={13} class="text-[var(--accent-ink)]" /> Export CSV
                </button>
              </div>

              <p class="text-sm text-[#778078]">
                ของที่ขอยืม: <b class="text-ink">{(request.expand?.items ? request.expand.items.map((i) => i.name).join(', ') : (request.items || request.itemIds || []).map(itemName).join(', ')) || '-'}</b>
              </p>
              <p class="text-sm text-[#778078]">
                กำหนดเวลาคืน: <b class="text-ink">{formatDateTime(request.dueDate)}</b> · อีเมล: {request.email}
              </p>
              {#if request.approvedAt}
                <p class="text-sm text-emerald-800">
                  อนุมัติเมื่อ: <b>{formatDateTime(request.approvedAt)}</b>
                </p>
              {/if}
              <p class="text-xs text-[#9aa29b]">ผู้ส่งคำขอ: {request.expand?.requester?.name || request.borrowerName || '-'} · วันที่สร้าง: {formatDateTime(request.created)}</p>
              {#if (request.status === 'approved' || request.status === 'returned') && (request.caretaker || request.approved_by)}<p class="text-sm text-emerald-800">อนุมัติโดย: <b>{request.expand?.caretaker?.name || request.expand?.approved_by?.name || request.expand?.caretaker?.email || request.caretaker}</b></p>{/if}
              {#if request.returnedAt}
                <p class="text-sm text-teal-800">
                  คืนของเมื่อ: <b>{formatDateTime(request.returnedAt)}</b>
                </p>
              {/if}
              <p class="text-sm text-[#778078] flex flex-wrap items-center gap-1.5">
                <span>{teacherDisplay(request).label}:</span>
                <span class="inline-flex items-center rounded-md bg-[#eef4ee] px-2.5 py-0.5 text-xs font-bold text-[#2d5236] border border-[#d3e3d4]">
                  {teacherDisplay(request).name}
                </span>
              </p>
              <p class="text-xs text-[#9aa29b]">
                ส่งคำขอเมื่อ: {formatDateTime(request.created)}
              </p>

              {#if request.note}
                <p class="text-sm text-[#666f67] bg-[#f8faf7] p-2.5 rounded-lg border border-[#eef2eb]">
                  <b>หมายเหตุจากผู้ยืม:</b> {request.note}
                </p>
              {/if}

              <!-- Comments -->
              {#if request.teacherComment}
                <p class="rounded-lg bg-[#f9f9f6] border border-[#ecece4] px-3 py-2 text-sm text-[#5f6861]">
                  <b>ความเห็นจากอาจารย์:</b> {request.teacherComment}
                </p>
              {/if}
              {#if request.status === 'rejected' && request.adminComment}
                <p class="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800">
                  <b>เหตุผลที่ไม่อนุมัติ (ผู้ดูแล):</b> {request.adminComment}
                </p>
              {/if}
              {#if request.asset_tags || (request.status !== 'rejected' && request.adminComment)}
                <div class="rounded-lg bg-[#f4f7f4] border border-[#dbe7dc] px-3 py-2 text-sm text-[#355238]">
                  <span class="text-xs font-bold text-[var(--accent-ink)]">หมายเลขเครื่อง / เลขครุภัณฑ์ / MAC Address:</span>
                  <div class="mt-1 flex flex-wrap items-center gap-1.5">
                    {#each (request.asset_tags || (request.status !== 'rejected' ? request.adminComment : '') || '').split(',').map((s) => s.trim()).filter(Boolean) as mac}
                      <span class="inline-flex items-center font-mono text-xs font-bold bg-white border border-[#c6d7c7] px-2.5 py-1 rounded-md text-ink shadow-2xs">
                        {mac}
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>

            <!-- Action buttons / notices for caretaker -->
            {#if request.status === 'pending_teacher'}
              <div class="self-start rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-2xs">
                <span class="font-bold">⏳ รออาจารย์รับทราบก่อน</span>
                <p class="mt-0.5 text-[11px] text-amber-700">คำขอนี้ยังต้องรออาจารย์รับทราบ ผู้ดูแลยังไม่สามารถอนุมัติได้</p>
              </div>
            {:else if request.status === 'pending_caretaker'}
              <div class="flex flex-wrap gap-2 self-start">
                <Button variant="outline" size="sm" on:click={() => startReject(request)}>
                  <X size={15} /> ไม่อนุมัติ
                </Button>
                <Button size="sm" on:click={() => startApprove(request)}>
                  <Check size={15} /> อนุมัติ
                </Button>
              </div>
            {:else if request.status === 'approved'}
              <div class="flex flex-wrap gap-2 self-start">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!returningId}
                  on:click={() => handleReturnLoan(request)}
                >
                  <RotateCcw size={15} />
                  {returningId === request.id ? 'กำลังบันทึก...' : 'คืนของแล้ว'}
                </Button>
              </div>
            {/if}
          </div>

          <!-- Inline Form for Approving with Text Note (MAC address) -->
          {#if approvingId === request.id}
            <div class="mt-4 rounded-xl border border-[#cde0ce] bg-[#f7fbf7] p-4">
              <label class="text-sm font-bold text-ink">
                หมายเลข MAC Address (หากมีหลายเครื่อง ให้คั่นด้วยเครื่องหมายจุลภาค ,)
                <textarea
                  bind:value={approveComment}
                  rows="2"
                  placeholder="ระบุหมายเลข MAC Address เช่น 00:1A:2B:3C:4D:5E, AA:BB:CC:DD:EE:FF"
                  class="mt-1 w-full rounded-lg border border-[#c4d6c5] p-2.5 text-sm font-mono"
                ></textarea>
              </label>
              {#if approveError}
                <p class="mt-1 text-xs text-red-600">{approveError}</p>
              {/if}
              <div class="mt-3 flex gap-2">
                <Button variant="outline" size="sm" on:click={cancelApprove}>ยกเลิก</Button>
                <Button size="sm" on:click={() => confirmApprove(request)}>
                  <Check size={15} /> ยืนยันอนุมัติคำขอนี้
                </Button>
              </div>
            </div>
          {/if}

          <!-- Inline Form for Rejecting with Reason -->
          {#if rejectingId === request.id}
            <div class="mt-4 rounded-xl border border-[#f2cfc9] bg-[#fff8f6] p-4">
              <label class="text-sm font-bold text-ink">
                เหตุผลที่ไม่อนุมัติคำขอ
                <textarea
                  bind:value={rejectComment}
                  rows="2"
                  required
                  placeholder="ระบุเหตุผลให้ผู้ขอยืมทราบอย่างชัดเจน"
                  class="mt-1 w-full rounded-lg border border-[#e5b8b0] p-2.5 text-sm"
                ></textarea>
              </label>
              {#if rejectError}
                <p class="mt-1 text-xs text-[#b14d42]">{rejectError}</p>
              {/if}
              <div class="mt-3 flex gap-2">
                <Button variant="outline" size="sm" on:click={cancelReject}>ยกเลิก</Button>
                <Button size="sm" on:click={() => confirmReject(request)}>
                  <X size={15} /> ยืนยันไม่อนุมัติ
                </Button>
              </div>
            </div>
          {/if}
        </article>
      {/each}
    </div>
  {/if}

  <!-- TAB 2: ITEMS MANAGEMENT -->
  {#if activeMainTab === 'items' && (isAdmin($user) || getUserType($user) === 'superadmin')}
    <div class="grid gap-8 lg:grid-cols-[380px_1fr]">
      <form class="h-fit space-y-4 rounded-2xl border border-[#e4e5de] bg-white p-6 shadow-sm" on:submit|preventDefault={submitItem}>
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-bold text-ink">{editingItemId ? 'แก้ไขข้อมูลของ' : 'เพิ่มของใหม่'}</h2>
          {#if editingItemId}
            <button type="button" class="text-xs font-semibold text-[#69736b] hover:text-ink" on:click={cancelEditItem}>ยกเลิก</button>
          {/if}
        </div>
        <label>ชื่อของ<input bind:value={form.name} required placeholder="เช่น เต็นท์สนาม" /></label>
        <label>หมวดหมู่<input bind:value={form.category} required /></label>
        <label>รายละเอียด<textarea bind:value={form.description} rows="3"></textarea></label>
        <label>URL รูปภาพ<input bind:value={form.image} placeholder="https://..." /></label>
        <div class="grid grid-cols-2 gap-3">
          <label>จำนวนทั้งหมด<input type="number" min="1" step="1" bind:value={form.total} required /></label>
          <label>พร้อมให้ยืม<input type="number" min="0" step="1" bind:value={form.available} required /></label>
        </div>
        <label>สถานที่จัดเก็บ<input bind:value={form.location} placeholder="เช่น ห้อง 301" /></label>
        <label class="flex items-center gap-2 cursor-pointer pt-1">
          <input type="checkbox" bind:checked={form.is_active} class="h-4 w-4 rounded border-[#c4d6c5] text-[var(--accent-ink)] focus:ring-sage" />
          <span class="text-sm font-semibold text-ink">เปิดให้ยืมในแคตตาล็อก (Active)</span>
        </label>
        {#if itemError}
          <p class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{itemError}</p>
        {/if}
        {#if itemSuccess}
          <p class="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{itemSuccess}</p>
        {/if}
        <Button type="submit" disabled={saving}>
          {#if saving}
            กำลังบันทึก...
          {:else if editingItemId}
            <Check size={17} />บันทึกการแก้ไข
          {:else}
            <Plus size={17} />เพิ่มรายการ
          {/if}
        </Button>
      </form>

      <div class="space-y-3">
        <!-- Item Filter Tabs -->
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4e5de] pb-3">
          <div class="flex gap-1.5">
            <button
              type="button"
              class="rounded-lg px-3 py-1 text-xs font-bold transition {itemFilter === 'all' ? 'bg-[#3b453e] text-white shadow-xs' : 'bg-[#f0f4ef] text-[#5e6960] hover:bg-[#e4ede3]'}"
              on:click={() => (itemFilter = 'all')}
            >
              ทั้งหมด ({$items.length})
            </button>
            <button
              type="button"
              class="rounded-lg px-3 py-1 text-xs font-bold transition {itemFilter === 'active' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-[#f0f4ef] text-[#5e6960] hover:bg-[#e4ede3]'}"
              on:click={() => (itemFilter = 'active')}
            >
              เปิดให้ยืม ({$items.filter((i) => i.is_active !== false).length})
            </button>
            <button
              type="button"
              class="rounded-lg px-3 py-1 text-xs font-bold transition {itemFilter === 'archived' ? 'bg-amber-700 text-white shadow-xs' : 'bg-[#f0f4ef] text-[#5e6960] hover:bg-[#e4ede3]'}"
              on:click={() => (itemFilter = 'archived')}
            >
              ยกเลิกใช้งานแล้ว ({$items.filter((i) => i.is_active === false).length})
            </button>
          </div>
        </div>

        {#if displayedItems.length === 0}
          <div class="rounded-2xl border border-dashed border-[#d8d8d0] py-16 text-center text-[#7c857e]">
            {itemFilter === 'archived' ? 'ไม่มีรายการอุปกรณ์ที่ยกเลิกใช้งาน' : 'ยังไม่มีของในระบบ เพิ่มรายการแรกจากฟอร์มนี้ได้เลย'}
          </div>
        {/if}
        {#each displayedItems as item}
          <div class="flex items-center gap-4 rounded-2xl border border-[#e4e5de] bg-white p-4 shadow-sm {item.is_active === false ? 'bg-amber-50/40 border-amber-200/60 opacity-80' : ''}">
            <img src={item.image} alt="" class="h-16 w-16 rounded-xl object-cover" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-ink {item.is_active === false ? 'line-through text-gray-500' : ''}">{item.name}</h3>
                {#if item.is_active === false}
                  <span class="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    ยกเลิกใช้งาน (ซ่อน)
                  </span>
                {/if}
              </div>
              <p class="mt-1 text-xs text-[#7c857e]">{item.category} · ว่าง {item.available}/{item.total} ชิ้น · {item.location || 'ไม่ระบุสถานที่'}</p>
              {#if Number(item.available) > Number(item.total)}
                <p class="mt-1 text-xs font-bold text-rose-700">ข้อมูลไม่ถูกต้อง: จำนวนว่างมากกว่าจำนวนทั้งหมด กรุณาแก้ไขรายการนี้</p>
              {/if}
            </div>

            <!-- Soft delete / Restore toggle button -->
            {#if item.is_active === false}
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                title="นำกลับมาเปิดให้ยืมอีกครั้ง"
                disabled={deletingId === item.id}
                on:click={() => toggleItemStatus(item, true)}
              >
                <RotateCcw size={14} /> เปิดใช้งาน
              </button>
            {:else}
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-lg border border-[#c8d4c9] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#576459] hover:bg-[#f0f4ef] transition"
                title="ซ่อนออกจากแคตตาล็อก (ไม่ให้ยืมต่อ)"
                disabled={deletingId === item.id}
                on:click={() => toggleItemStatus(item, false)}
              >
                ซ่อน/เลิกใช้
              </button>
            {/if}

            {#if isAdmin($user) || getUserType($user) === 'superadmin'}
              <button
                type="button"
                class="icon-btn text-[var(--accent-ink)]"
                aria-label="แก้ไข {item.name}"
                title="แก้ไขข้อมูลของ"
                on:click={() => startEditItem(item)}
              >
                <Pencil size={17} />
              </button>
            {/if}
            <button
              type="button"
              class="icon-btn text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="ลบ {item.name}"
              disabled={deletingId === item.id}
              title="ลบรายการ"
              on:click={() => removeItem(item)}
            >
              <Trash2 size={17} />
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- BOTTOM SECTION: Prominent Stats Dashboard (เอา stat ไปไว้ล่างด้วย ให้ใหญ่ๆ) -->
  <section class="mt-14 border-t border-[var(--border)] pt-8" aria-label="สถิติภาพรวมระบบ">
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold text-ink">ภาพรวมและสถิติระบบ</h2>
        <p class="mt-0.5 text-xs text-[#737d75]">
          วิเคราะห์แนวโน้มการยืม–คืนและสถานะอุปกรณ์ทั้งหมดในระบบ
        </p>
      </div>
    </div>

    <AdminStats
      stats={activeStats}
      {selectedRange}
      activeFilter={requestFilter}
      loading={statsLoading}
      error={statsError}
      {lastUpdated}
      {isRealtime}
      onRangeChange={handleRangeChange}
      onDrilldown={handleDrilldown}
      onRefresh={() => refreshDashboardData(selectedRange)}
    />
  </section>
</main>
