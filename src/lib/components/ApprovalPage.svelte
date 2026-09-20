<script>
  import { Check, Clock3, X } from 'lucide-svelte';
  import Button from './Button.svelte';
  import { items as mockItems } from '../mock-data.js';
  export let requests = [];
  export let items = [];
  export let role = '';
  export let onAction = () => {};
  const labels = { pending_teacher: 'รอ อจ. รับทราบ', pending_caretaker: 'รอคนดูแลอนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ' };
  function itemName(id) { return items.find((item) => item.id === id)?.name || mockItems.find((item) => item.id === id)?.name || id; }
  function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); }
</script>

<main class="mx-auto max-w-5xl px-5 py-12 lg:px-8"><div class="mb-8"><p class="eyebrow"><Clock3 size={14}/> LOAN WORKFLOW</p><h1 class="mt-2 text-3xl font-bold text-ink">คำขอยืมของ</h1><p class="mt-2 text-sm text-[#7c857e]">{role === 'teachers' ? 'ตรวจสอบและรับทราบคำขอที่ส่งถึงคุณ' : 'ติดตามคำขอของทุกคนแบบเรียลไทม์ และอนุมัติรายการที่รอผู้ดูแล'}</p></div><div class="space-y-4">{#if requests.length === 0}<div class="rounded-2xl border border-dashed border-[#d8d8d0] py-16 text-center text-[#7c857e]">ยังไม่มีคำขอในขั้นตอนนี้</div>{/if}{#each requests as request}<article class="rounded-2xl border border-[#e4e5de] bg-white p-5"><div class="flex flex-col justify-between gap-4 md:flex-row md:items-start"><div><div class="flex flex-wrap items-center gap-2"><h2 class="font-bold text-ink">คำขอของ {request.borrowerName}</h2><span class="rounded-full bg-[#eef2ed] px-3 py-1 text-xs font-bold text-sage">{labels[request.status] || request.status}</span></div><p class="mt-2 text-sm text-[#778078]">ของที่ขอยืม: <b class="text-ink">{(request.itemIds || []).map(itemName).join(', ') || '-'}</b></p><p class="mt-2 text-sm text-[#778078]">คืนวันที่ {formatDate(request.dueDate)} · {request.email}</p>{#if request.note}<p class="mt-2 text-sm text-[#778078]">หมายเหตุ: {request.note}</p>{/if}</div>{#if role === 'teachers' && request.status === 'pending_teacher'}<div class="flex gap-2"><Button variant="outline" size="sm" on:click={() => onAction(request, 'rejected')}><X size={15}/>ไม่รับทราบ</Button><Button size="sm" on:click={() => onAction(request, 'pending_caretaker')}><Check size={15}/>รับทราบ</Button></div>{:else if role === 'superadmin' && request.status === 'pending_caretaker'}<div class="flex gap-2"><Button variant="outline" size="sm" on:click={() => onAction(request, 'rejected')}><X size={15}/>ไม่อนุมัติ</Button><Button size="sm" on:click={() => onAction(request, 'approved')}><Check size={15}/>อนุมัติ</Button></div>{/if}</div></article>{/each}</div></main>
