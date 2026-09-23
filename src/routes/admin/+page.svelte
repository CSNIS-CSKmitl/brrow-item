<script>
  import { onMount, onDestroy } from 'svelte';
  import { Trash2, Plus, Pencil, PackageOpen, Check, X, Download, Clock3, Package, FileSpreadsheet } from 'lucide-svelte';
  import Button from '../../lib/components/Button.svelte';
  import { items as mockItems } from '../../lib/mock-data.js';
  import { items, user, teachers } from '../../lib/stores.js';
  import { createItem, updateItem, deleteItem, getLoanRequests, updateLoanStatus, getUserType, pb } from '../../lib/pocketbase.js';
  import { exportRequestsToCSV, exportSingleRequestToCSV, exportItemsToCSV, formatDateTime } from '../../lib/csv.js';
  import { getStatusBadgeClass, getStatusDotClass } from '../../lib/status.js';

  // Main Tab: 'requests' | 'items'
  let activeMainTab = 'requests';

  // --- Loan Requests / Approvals State ---
  const labels = {
    pending_teacher: 'รอ อจ. รับทราบ',
    pending_caretaker: 'รอผู้ดูแลอนุมัติ',
    approved: 'อนุมัติแล้ว',
    rejected: 'ไม่อนุมัติ',
  };

  let requests = [];
  let requestFilter = 'pending'; // 'pending' | 'approved' | 'rejected' | 'all'

  // Approve state with text
  let approvingId = '';
  let approveComment = '';
  let approveError = '';

  // Reject state with text
  let rejectingId = '';
  let rejectComment = '';
  let rejectError = '';

  let unsubRequests = null;

  async function loadRequests() {
    try {
      requests = await getLoanRequests();
    } catch (e) {
      requests = [];
    }
  }

  onMount(async () => {
    await loadRequests();
    try {
      unsubRequests = await pb.collection('loan_requests').subscribe('*', () => {
        void loadRequests();
      });
    } catch (e) {}
  });

  onDestroy(() => {
    if (unsubRequests) unsubRequests();
  });

  $: pendingTeacherRequests = requests.filter((r) => r.status === 'pending_teacher');
  $: pendingRequests = requests.filter((r) => r.status === 'pending_caretaker');
  $: approvedRequests = requests.filter((r) => r.status === 'approved');
  $: rejectedRequests = requests.filter((r) => r.status === 'rejected');

  $: filteredRequests =
    requestFilter === 'pending'
      ? pendingRequests
      : requestFilter === 'pending_teacher'
        ? pendingTeacherRequests
        : requestFilter === 'approved'
          ? approvedRequests
          : requestFilter === 'rejected'
            ? rejectedRequests
            : requests;

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
    if (t?.name) return t.name;
    if (t?.email) return t.email;
    const found = $teachers.find((entry) => entry.id === request.teacher);
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
      cancelApprove();
    } catch (error) {
      approveError = error?.response?.message || 'บันทึกการอนุมัติไม่สำเร็จ';
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
  const emptyForm = () => ({ name: '', category: 'อุปกรณ์ไอที', description: '', image: '', available: 1, total: 1, location: '' });
  let form = emptyForm();
  let itemError = '';
  let editingItemId = '';
  let saving = false;
  let deletingId = '';

  function startEditItem(item) {
    editingItemId = item.id;
    itemError = '';
    form = {
      name: item.name || '',
      category: item.category || '',
      description: item.description || '',
      image: item.image || '',
      available: Number(item.available ?? 0),
      total: Number(item.total ?? 1),
      location: item.location || '',
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
      const data = { ...form, total, available };
      if (editingItemId) {
        const updated = await updateItem(editingItemId, data);
        items.update((list) => list.map((entry) => entry.id === updated.id ? updated : entry));
      } else {
        const created = await createItem(data);
        items.update((list) => [created, ...list]);
      }
      cancelEditItem();
    } catch (cause) {
      itemError = cause?.response?.message || (editingItemId
        ? 'แก้ไขรายการไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ PocketBase'
        : 'เพิ่มรายการไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ PocketBase');
    } finally {
      saving = false;
    }
  }

  async function removeItem(item) {
    if (!confirm(`ลบ ${item.name} ใช่ไหม?`)) return;
    itemError = '';
    deletingId = item.id;
    try {
      await deleteItem(item.id);
      items.update((list) => list.filter((entry) => entry.id !== item.id));
      if (editingItemId === item.id) cancelEditItem();
    } catch (cause) {
      itemError = cause?.response?.message || 'ลบรายการไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ PocketBase';
    } finally {
      deletingId = '';
    }
  }
</script>

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
      <Download size={16} class="text-sage" />
      <span>
        {activeMainTab === 'requests' ? `Export คำขอยืม (${filteredRequests.length})` : `Export รายการของ (${$items.length})`}
      </span>
    </button>
  </div>

  <!-- Main Navigation Tabs -->
  <div class="mb-6 flex gap-3 border-b border-[#e4e5de] pb-3">
    <button
      type="button"
      class="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition {activeMainTab === 'requests' ? 'bg-sage text-white shadow-sm' : 'bg-white text-[#68726b] hover:bg-[#f3f6f3]'}"
      on:click={() => (activeMainTab = 'requests')}
    >
      <Clock3 size={16} />
      <span>คำขอยืมและอนุมัติ</span>
      {#if pendingRequests.length > 0}
        <span class="rounded-full bg-white/25 px-2 py-0.5 text-xs text-white">
          {pendingRequests.length}
        </span>
      {/if}
    </button>

    {#if getUserType($user) === 'superadmin'}
      <button
        type="button"
        class="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition {activeMainTab === 'items' ? 'bg-sage text-white shadow-sm' : 'bg-white text-[#68726b] hover:bg-[#f3f6f3]'}"
        on:click={() => (activeMainTab = 'items')}
      >
        <Package size={16} />
        <span>จัดการของยืม ({$items.length})</span>
      </button>
    {/if}
  </div>

  <!-- TAB 1: LOAN REQUESTS & APPROVALS -->
  {#if activeMainTab === 'requests'}
    <!-- Request Filter Tabs -->
    <div class="mb-6 flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-lg px-3.5 py-1.5 text-xs font-bold transition {requestFilter === 'pending' ? 'bg-blue-600 text-white shadow-xs' : 'bg-[#f0f4ef] text-[#5e6960] hover:bg-[#e4ede3]'}"
        on:click={() => (requestFilter = 'pending')}
      >
        รอผู้ดูแลอนุมัติ ({pendingRequests.length})
      </button>

      <button
        type="button"
        class="rounded-lg px-3.5 py-1.5 text-xs font-bold transition {requestFilter === 'pending_teacher' ? 'bg-amber-600 text-white shadow-xs' : 'bg-[#f0f4ef] text-[#5e6960] hover:bg-[#e4ede3]'}"
        on:click={() => (requestFilter = 'pending_teacher')}
      >
        รอ อจ. รับทราบ ({pendingTeacherRequests.length})
      </button>

      <button
        type="button"
        class="rounded-lg px-3.5 py-1.5 text-xs font-bold transition {requestFilter === 'approved' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-[#f0f4ef] text-[#5e6960] hover:bg-[#e4ede3]'}"
        on:click={() => (requestFilter = 'approved')}
      >
        อนุมัติแล้ว ({approvedRequests.length})
      </button>

      <button
        type="button"
        class="rounded-lg px-3.5 py-1.5 text-xs font-bold transition {requestFilter === 'rejected' ? 'bg-rose-600 text-white shadow-xs' : 'bg-[#f0f4ef] text-[#5e6960] hover:bg-[#e4ede3]'}"
        on:click={() => (requestFilter = 'rejected')}
      >
        ไม่อนุมัติ ({rejectedRequests.length})
      </button>

      <button
        type="button"
        class="rounded-lg px-3.5 py-1.5 text-xs font-bold transition {requestFilter === 'all' ? 'bg-[#3b453e] text-white shadow-xs' : 'bg-[#f0f4ef] text-[#5e6960] hover:bg-[#e4ede3]'}"
        on:click={() => (requestFilter = 'all')}
      >
        ทั้งหมด ({requests.length})
      </button>
    </div>

    <!-- Requests List -->
    <div class="space-y-4">
      {#if filteredRequests.length === 0}
        <div class="rounded-2xl border border-dashed border-[#d8d8d0] py-16 text-center text-[#7c857e]">
          ไม่มีคำขอในหมวดหมู่นี้
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
                </div>
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-[#c9d3c9] bg-white px-2.5 py-1 text-xs font-semibold text-[#546056] hover:bg-[#f0f4ef] transition shadow-xs"
                  title="ดาวน์โหลดคำขอนี้เป็นไฟล์ CSV"
                  on:click={() => exportSingleRequestToCSV(request, $items)}
                >
                  <Download size={13} class="text-sage" /> Export CSV
                </button>
              </div>

              <p class="text-sm text-[#778078]">
                ของที่ขอยืม: <b class="text-ink">{(request.itemIds || []).map(itemName).join(', ') || '-'}</b>
              </p>
              <p class="text-sm text-[#778078]">
                กำหนดเวลาคืน: <b class="text-ink">{formatDateTime(request.dueDate)}</b> · อีเมล: {request.email}
              </p>
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
              {#if request.adminComment}
                <div class="rounded-lg bg-[#f4f7f4] border border-[#dbe7dc] px-3 py-2 text-sm text-[#355238]">
                  <span class="text-xs font-bold text-sage">หมายเลข MAC Address:</span>
                  <div class="mt-1 flex flex-wrap items-center gap-1.5">
                    {#each (request.adminComment || '').split(',').map((s) => s.trim()).filter(Boolean) as mac}
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
  {#if activeMainTab === 'items' && getUserType($user) === 'superadmin'}
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
        <label>รายละเอียด<textarea bind:value={form.description} rows="3" required></textarea></label>
        <label>URL รูปภาพ<input bind:value={form.image} required placeholder="https://..." /></label>
        <div class="grid grid-cols-2 gap-3">
          <label>จำนวนทั้งหมด<input type="number" min="1" step="1" bind:value={form.total} required /></label>
          <label>พร้อมให้ยืม<input type="number" min="0" step="1" bind:value={form.available} required /></label>
        </div>
        <label>สถานที่จัดเก็บ<input bind:value={form.location} required placeholder="เช่น ห้อง 301" /></label>
        {#if itemError}
          <p class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{itemError}</p>
        {/if}
        <Button disabled={saving}>
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
        {#if $items.length === 0}
          <div class="rounded-2xl border border-dashed border-[#d8d8d0] py-16 text-center text-[#7c857e]">
            ยังไม่มีของในระบบ เพิ่มรายการแรกจากฟอร์มนี้ได้เลย
          </div>
        {/if}
        {#each $items as item}
          <div class="flex items-center gap-4 rounded-2xl border border-[#e4e5de] bg-white p-4 shadow-sm">
            <img src={item.image} alt="" class="h-16 w-16 rounded-xl object-cover" />
            <div class="min-w-0 flex-1">
              <h3 class="font-bold text-ink">{item.name}</h3>
              <p class="mt-1 text-xs text-[#7c857e]">{item.category} · ว่าง {item.available}/{item.total} ชิ้น · {item.location || 'ไม่ระบุสถานที่'}</p>
            </div>
            {#if getUserType($user) === 'superadmin'}
              <button
                type="button"
                class="icon-btn text-sage"
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
              on:click={() => removeItem(item)}
            >
              <Trash2 size={17} />
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</main>
