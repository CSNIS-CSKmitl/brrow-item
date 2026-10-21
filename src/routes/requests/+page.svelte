<script>
  import { onMount, onDestroy } from 'svelte';
  import { Check, Download, Pencil, X } from 'lucide-svelte';
  import { items as mockItems } from '../../lib/mock-data.js';
  import Button from '../../lib/components/Button.svelte';
  import { items, teachers, userType } from '../../lib/stores.js';
  import { getMyLoanRequests, updateMyLoanRequest, cancelLoanRequest, pb } from '../../lib/pocketbase.js';
  import { exportSingleRequestToCSV, formatDateTime } from '../../lib/csv.js';
  import { getStatusBadgeClass, getStatusDotClass } from '../../lib/status.js';

  let requests = [];
  let editingId = '';
  let editForm = { dueDate: '', note: '', teacher: '', quantities: {} };
  let editError = '';
  let saving = false;
  let unsub = null;

  const steps = [
    { key: 'pending_teacher', label: 'รอ อจ. รับทราบ' },
    { key: 'pending_caretaker', label: 'รอผู้ดูแลตรวจสอบ' },
    { key: 'approved', label: 'อนุมัติแล้ว' }
  ];
  const labels = {
    pending_teacher: 'รอ อจ. รับทราบ',
    pending_caretaker: 'รอผู้ดูแลตรวจสอบ',
    approved: 'อนุมัติแล้ว',
    returned: 'คืนแล้ว',
    rejected: 'ไม่อนุมัติ',
    cancelled: 'ยกเลิกแล้ว'
  };

  async function loadMyRequests() {
    try {
      requests = await getMyLoanRequests();
    } catch (e) {
      requests = [];
    }
  }

  onMount(async () => {
    await loadMyRequests();
    try {
      unsub = await pb.collection('loan_requests').subscribe('*', () => {
        void loadMyRequests();
      });
    } catch (e) {}
  });

  onDestroy(() => {
    if (unsub) unsub();
  });

  function itemName(id) {
    return $items.find((item) => item.id === id)?.name || mockItems.find((item) => item.id === id)?.name || id;
  }

  function requestItems(request) {
    return request.expand?.items || request.items || request.itemIds || [];
  }

  function requestQuantity(request, itemOrId) {
    const id = typeof itemOrId === 'object' ? itemOrId.id : itemOrId;
    return Math.max(1, Number(request.quantities?.[id]) || 1);
  }

  function canEdit(request) {
    return request.status === 'pending_teacher' || request.status === 'pending_caretaker';
  }

  function stepIndex(status) {
    if (status === 'returned') return steps.length;
    return steps.findIndex((step) => step.key === status);
  }

  function formatDate(value) {
    return formatDateTime(value);
  }

  function teacherName(request) {
    const teacher = request.expand?.teacher;
    return teacher?.name || teacher?.email || $teachers.find((entry) => entry.id === request.teacher)?.name || 'ไม่ระบุอาจารย์';
  }

  function statusLabel(request) {
    if (request.status === 'rejected' && request.teacherComment) return 'อาจารย์ไม่อนุมัติ';
    if (request.status === 'rejected' && request.adminComment) return 'ผู้ดูแลไม่อนุมัติ';
    return labels[request.status] || request.status;
  }

  function startEditing(request) {
    editingId = request.id;
    editError = '';
    let formattedDue = '';
    if (request.dueDate) {
      const d = new Date(request.dueDate.replace(' ', 'T'));
      if (!Number.isNaN(d.getTime())) {
        const pad = (n) => String(n).padStart(2, '0');
        formattedDue = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } else {
        formattedDue = request.dueDate.slice(0, 16);
      }
    }
    editForm = {
      dueDate: formattedDue,
      note: request.note || '',
      teacher: request.teacher || '',
      quantities: Object.fromEntries(requestItems(request).map((item) => [typeof item === 'object' ? item.id : item, requestQuantity(request, item)]))
    };
  }

  async function saveEditing(request) {
    editError = '';
    saving = true;
    try {
      await updateMyLoanRequest(request.id, editForm);
      await loadMyRequests();
      editingId = '';
    } catch (error) {
      editError = error?.response?.message || 'บันทึกการแก้ไขไม่สำเร็จ';
    } finally {
      saving = false;
    }
  }

  async function cancelRequest(request) {
    if (!window.confirm('ยืนยันยกเลิกคำขอยืมนี้หรือไม่')) return;
    try {
      await cancelLoanRequest(request.id);
      await loadMyRequests();
      editingId = '';
    } catch (error) {
      editError = error?.response?.message || 'ยกเลิกคำขอไม่สำเร็จ';
    }
  }
</script>

<main class="mx-auto max-w-5xl px-5 py-12 lg:px-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-ink">คำขอยืม</h1>
  </div>

  {#if requests.length === 0}
    <div class="rounded-2xl border border-dashed border-[#d8d8d0] py-16 text-center text-[#7c857e]">
      ยังไม่มีคำขอยืมของคุณ
      <a class="mt-4 inline-flex rounded-xl bg-sage px-5 py-3 text-sm font-bold text-white" href="/catalog">ไปเลือกของ</a>
    </div>
  {:else}
    <div class="space-y-5">
      {#each requests as request}
        {@const currentStep = stepIndex(request.status)}
        <article class="rounded-2xl border border-[#e4e5de] bg-white p-5 shadow-sm md:p-6">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-xs font-bold text-[#89938b]">คำขอเมื่อ {formatDate(request.created)}</p>
              <h2 class="mt-1 text-lg font-bold text-ink">ของที่ขอยืม</h2>
            </div>
            <div class="flex items-center gap-2">
              {#if $userType !== 'teachers'}
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-[#c9d2c8] bg-white px-3 py-1 text-xs font-bold text-[#5c685e] hover:bg-[#edf2ed] transition shadow-xs"
                  title="ดาวน์โหลดคำขอนี้เป็นไฟล์ CSV"
                  on:click={() => exportSingleRequestToCSV(request, $items)}
                >
                  <Download size={13} class="text-sage" /> Export CSV
                </button>
              {/if}
              <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold {getStatusBadgeClass(request.status)}">
                <span class="h-1.5 w-1.5 rounded-full {getStatusDotClass(request.status)}"></span>
                {statusLabel(request)}
              </span>
            </div>
          </div>

          <div class="mt-4 rounded-xl bg-[#f5f7f3] p-4">
            <div class="space-y-2">
              {#each requestItems(request) as itemOrId}
                <p class="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span class="h-2 w-2 rounded-full bg-sage"></span>
                  {typeof itemOrId === 'object' && itemOrId?.name ? itemOrId.name : itemName(itemOrId)}
                  <span class="text-xs font-normal text-[#89938b]">× {requestQuantity(request, itemOrId)}</span>
                </p>
              {/each}
            </div>
            <p class="mt-3 text-sm text-[#778078]">อาจารย์ผู้รับทราบ: <b class="text-ink">{teacherName(request)}</b></p>
            <p class="mt-1 text-sm text-[#778078]">กำหนดเวลาคืน: <b class="text-ink">{formatDate(request.dueDate)}</b></p>
            {#if request.approvedAt}
              <p class="mt-1 text-sm text-emerald-800">อนุมัติเมื่อ: <b class="text-ink">{formatDate(request.approvedAt)}</b></p>
            {/if}
            {#if request.note}<p class="mt-1 text-sm text-[#778078]">หมายเหตุ: {request.note}</p>{/if}
            {#if (request.asset_tags || request.adminComment) && request.status !== 'rejected'}
              <div class="mt-3 rounded-lg bg-[#eef7ee] border border-[#d3e5d3] p-3">
                <span class="text-xs font-bold text-sage">หมายเลขเครื่อง / MAC Address:</span>
                <div class="mt-1 flex flex-wrap items-center gap-1.5">
                  {#each (request.asset_tags || request.adminComment || '').split(',').map((s) => s.trim()).filter(Boolean) as mac}
                    <span class="inline-flex items-center font-mono text-xs font-bold bg-white border border-[#c6d7c7] px-2.5 py-1 rounded-md text-ink shadow-2xs">
                      {mac}
                    </span>
                  {/each}
                </div>
              </div>
            {/if}
          </div>

          {#if canEdit(request)}
            {#if editingId === request.id}
              <form class="mt-4 space-y-4 rounded-xl border border-[#dce5dc] bg-[#fbfcfa] p-4" on:submit|preventDefault={() => saveEditing(request)}>
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm font-bold text-ink">แก้ไขคำขอ</p>
                  <button type="button" class="text-xs font-bold text-[#778078]" on:click={() => editingId = ''}>ยกเลิก</button>
                </div>
                <label>อาจารย์ผู้รับทราบ
                  <select bind:value={editForm.teacher} required>
                    <option value="">เลือก อจ.</option>
                    {#each $teachers as teacher}
                      <option value={teacher.id}>{teacher.name || teacher.email}</option>
                    {/each}
                  </select>
                </label>
                <label>วันและเวลาที่ต้องการคืน<input type="datetime-local" bind:value={editForm.dueDate} required /></label>
                <div>
                  <p class="font-semibold">จำนวนที่ต้องการ</p>
                  <div class="mt-2 space-y-2">
                    {#each requestItems(request) as itemOrId}
                      {@const itemId = typeof itemOrId === 'object' ? itemOrId.id : itemOrId}
                      {@const item = typeof itemOrId === 'object' ? itemOrId : $items.find((entry) => entry.id === itemId)}
                      <label class="flex items-center justify-between gap-3 text-sm">
                        <span>{item?.name || itemName(itemId)}</span>
                        <input class="w-20 rounded-lg border border-[#c4d6c5] p-2 text-center" type="number" min="1" max={Math.max(1, Number(item?.available) || 99)} bind:value={editForm.quantities[itemId]} />
                      </label>
                    {/each}
                  </div>
                </div>
                <label>หมายเหตุ <span class="font-normal text-[#9aa19b]">(ไม่บังคับ)</span>
                  <textarea bind:value={editForm.note} rows="3"></textarea>
                </label>
                {#if editError}<p class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{editError}</p>{/if}
                <div class="flex gap-2">
                  <Button size="sm" disabled={saving || !editForm.teacher || !editForm.dueDate}>
                    {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                  </Button>
                </div>
              </form>
            {:else}
              <button type="button" class="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#c9d2c8] px-3 py-2 text-xs font-bold text-sage hover:bg-[#edf2ed]" on:click={() => startEditing(request)}>
                <Pencil size={14}/>แก้ไขคำขอ
              </button>
              <button type="button" class="ml-2 inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50" on:click={() => cancelRequest(request)}>
                <X size={14}/>ยกเลิกคำขอ
              </button>
              <p class="mt-2 text-xs text-[#89938b]">แก้ไขหรือยกเลิกได้ก่อนขั้นตอนถัดไปจะรับคำขอ</p>
            {/if}
          {/if}

          {#if request.status === 'cancelled'}
            <div class="mt-5 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">คำขอนี้ถูกยกเลิกแล้ว</div>
          {/if}

          {#if request.status === 'rejected' || request.status === 'cancelled'}
            <div class="mt-5 rounded-xl bg-[#fff1ef] p-4 text-sm font-semibold text-[#a34e43]">
              <div class="flex items-center gap-3">
                <X size={18}/> {request.status === 'cancelled' ? 'คำขอนี้ถูกยกเลิกแล้ว' : request.teacherComment ? 'อาจารย์ไม่อนุมัติคำขอนี้' : request.adminComment ? 'ผู้ดูแลไม่อนุมัติคำขอนี้' : 'คำขอนี้ไม่ผ่านการอนุมัติ'}
              </div>
              {#if request.teacherComment || request.adminComment}
                <p class="mt-2 pl-7 text-xs font-normal">เหตุผล: {request.teacherComment || request.adminComment}</p>
              {/if}
            </div>
          {:else}
            <div class="mt-6 grid gap-3 md:grid-cols-3">
              {#each steps as step, index}
                <div class="flex items-start gap-3">
                  <div class="grid h-8 w-8 shrink-0 place-items-center rounded-full font-bold text-xs {index < currentStep ? 'bg-emerald-600 text-white shadow-xs' : index === currentStep ? (currentStep === 0 ? 'bg-amber-500 text-white shadow-xs ring-4 ring-amber-100' : currentStep === 1 ? 'bg-blue-600 text-white shadow-xs ring-4 ring-blue-100' : 'bg-emerald-600 text-white shadow-xs ring-4 ring-emerald-100') : 'bg-[#e8ece7] text-[#89938b]'}">
                    {#if index < currentStep}<Check size={16}/>{:else}{index + 1}{/if}
                  </div>
                  <div>
                    <p class="text-sm font-bold {index <= currentStep ? 'text-ink' : 'text-[#9aa19b]'}">{step.label}</p>
                    <p class="mt-1 text-xs text-[#89938b]">{index < currentStep ? 'เสร็จแล้ว' : index === currentStep ? 'กำลังดำเนินการ' : 'รอดำเนินการ'}</p>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</main>
