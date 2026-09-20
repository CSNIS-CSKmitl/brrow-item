<script>
  import { Check, Clock3, Pencil, X } from 'lucide-svelte';
  import { items as mockItems } from '../mock-data.js';
  import Button from './Button.svelte';

  export let requests = [];
  export let items = [];
  export let teachers = [];
  export let onUpdate = async () => {};

  let editingId = '';
  let editForm = { dueDate: '', note: '', teacher: '' };
  let editError = '';
  let saving = false;

  const steps = [
    { key: 'pending_teacher', label: 'รอ อจ. รับทราบ' },
    { key: 'pending_caretaker', label: 'รอผู้ดูแลตรวจสอบ' },
    { key: 'approved', label: 'อนุมัติแล้ว' }
  ];
  const labels = {
    pending_teacher: 'รอ อจ. รับทราบ',
    pending_caretaker: 'รอผู้ดูแลตรวจสอบ',
    approved: 'อนุมัติแล้ว',
    rejected: 'ไม่อนุมัติ'
  };

  function itemName(id) {
    return items.find((item) => item.id === id)?.name || mockItems.find((item) => item.id === id)?.name || id;
  }

  function stepIndex(status) {
    return steps.findIndex((step) => step.key === status);
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function teacherName(request) {
    const teacher = request.expand?.teacher;
    return teacher?.name || teacher?.email || teachers.find((entry) => entry.id === request.teacher)?.name || 'ไม่ระบุอาจารย์';
  }

  function startEditing(request) {
    editingId = request.id;
    editError = '';
    editForm = { dueDate: request.dueDate?.slice(0, 10) || '', note: request.note || '', teacher: request.teacher || '' };
  }

  async function saveEditing(request) {
    editError = '';
    saving = true;
    try {
      await onUpdate(request, editForm);
      editingId = '';
    } catch (error) {
      editError = error?.response?.message || 'บันทึกการแก้ไขไม่สำเร็จ';
    } finally {
      saving = false;
    }
  }
</script>

<main class="mx-auto max-w-5xl px-5 py-12 lg:px-8">
  <div class="mb-8">
    <p class="eyebrow"><Clock3 size={14}/> MY LOAN REQUESTS</p>
    <h1 class="mt-2 text-3xl font-bold text-ink">คำขอยืม</h1>
    <p class="mt-2 text-sm text-[#7c857e]">ดูของที่ขอยืม อาจารย์ผู้รับทราบ และสถานะของคำขอได้ในหน้าเดียว</p>
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
            <span class="rounded-full px-3 py-1.5 text-xs font-bold {request.status === 'rejected' ? 'bg-[#fff1ef] text-[#a34e43]' : 'bg-[#eef2ed] text-sage'}">
              {labels[request.status] || request.status}
            </span>
          </div>

          <div class="mt-4 rounded-xl bg-[#f5f7f3] p-4">
            <div class="space-y-2">
              {#each request.itemIds || [] as itemId}
                <p class="flex items-center gap-2 text-sm font-semibold text-ink"><span class="h-2 w-2 rounded-full bg-sage"></span>{itemName(itemId)}</p>
              {/each}
            </div>
            <p class="mt-3 text-sm text-[#778078]">อาจารย์ผู้รับทราบ: <b class="text-ink">{teacherName(request)}</b></p>
            <p class="mt-1 text-sm text-[#778078]">กำหนดคืน: <b class="text-ink">{formatDate(request.dueDate)}</b></p>
            {#if request.note}<p class="mt-1 text-sm text-[#778078]">หมายเหตุ: {request.note}</p>{/if}
          </div>

          {#if request.status === 'pending_teacher'}
            {#if editingId === request.id}
              <form class="mt-4 space-y-4 rounded-xl border border-[#dce5dc] bg-[#fbfcfa] p-4" on:submit|preventDefault={() => saveEditing(request)}>
                <div class="flex items-center justify-between gap-3"><p class="text-sm font-bold text-ink">แก้ไขคำขอ</p><button type="button" class="text-xs font-bold text-[#778078]" on:click={() => editingId = ''}>ยกเลิก</button></div>
                <label>อาจารย์ผู้รับทราบ<select bind:value={editForm.teacher} required><option value="">เลือก อจ.</option>{#each teachers as teacher}<option value={teacher.id}>{teacher.name || teacher.email}</option>{/each}</select></label>
                <label>วันที่ต้องการคืน<input type="date" bind:value={editForm.dueDate} required /></label>
                <label>หมายเหตุ <span class="font-normal text-[#9aa19b]">(ไม่บังคับ)</span><textarea bind:value={editForm.note} rows="3"></textarea></label>
                {#if editError}<p class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{editError}</p>{/if}
                <div class="flex gap-2"><Button size="sm" disabled={saving || !editForm.teacher || !editForm.dueDate}>{saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</Button></div>
              </form>
            {:else}
              <button type="button" class="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#c9d2c8] px-3 py-2 text-xs font-bold text-sage hover:bg-[#edf2ed]" on:click={() => startEditing(request)}><Pencil size={14}/>แก้ไขคำขอ</button>
              <p class="mt-2 text-xs text-[#89938b]">แก้ไขได้จนกว่า อจ. จะรับทราบ</p>
            {/if}
          {/if}

          {#if request.status === 'rejected'}
            <div class="mt-5 flex items-center gap-3 rounded-xl bg-[#fff1ef] p-4 text-sm font-semibold text-[#a34e43]"><X size={18}/> คำขอนี้ไม่ผ่านการอนุมัติ</div>
          {:else}
            <div class="mt-6 grid gap-3 md:grid-cols-3">
              {#each steps as step, index}
                <div class="flex items-start gap-3">
                  <div class="grid h-8 w-8 shrink-0 place-items-center rounded-full {index <= currentStep ? 'bg-sage text-white' : 'bg-[#e8ece7] text-[#89938b]'}">
                    {#if index < currentStep}<Check size={16}/>{:else}{index + 1}{/if}
                  </div>
                  <div><p class="text-sm font-bold {index <= currentStep ? 'text-ink' : 'text-[#9aa19b]'}">{step.label}</p><p class="mt-1 text-xs text-[#89938b]">{index < currentStep ? 'เสร็จแล้ว' : index === currentStep ? 'กำลังดำเนินการ' : 'รอดำเนินการ'}</p></div>
                </div>
              {/each}
            </div>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</main>
