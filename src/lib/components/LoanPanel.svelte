<script>
  import { ArrowRight, CalendarDays, Check, X } from 'lucide-svelte';
  import Button from './Button.svelte';
  export let selectedItems = [];
  export let open = false;
  export let onClose = () => {};
  export let onSubmit = () => {};
  export let borrowerName = '';
  export let borrowerEmail = '';
  export let teachers = [];
  export let skipTeacherApproval = false;
  export let autoApprove = false;
  let teacherId = '';
  let dueDate = '';
  let note = '';
</script>

{#if open}
  <button type="button" class="fixed inset-0 z-30 cursor-default bg-ink/25 backdrop-blur-[2px]" aria-label="ปิดหน้าส่งคำขอยืม" on:click={onClose}></button>
  <aside class="fixed right-0 top-0 z-40 flex h-full w-full max-w-md flex-col bg-cream shadow-2xl">
    <div class="flex items-center justify-between border-b border-[#e7e5df] px-6 py-5"><div><p class="text-xs font-semibold uppercase tracking-[.16em] text-sage">ยืนยันการยืม</p><h2 class="mt-1 text-xl font-bold text-ink">รายการของที่เลือก</h2></div><button class="icon-btn" on:click={onClose}><X size={20}/></button></div>
    <div class="flex-1 overflow-y-auto p-6"><div class="space-y-3">{#each selectedItems as item}<div class="flex items-center gap-3 rounded-xl border border-[#e6e3dc] bg-white p-3"><img src={item.image} alt="" class="h-12 w-12 rounded-lg object-cover"/><div class="min-w-0"><p class="truncate text-sm font-bold text-ink">{item.name}</p><p class="text-xs text-[#818981]">{item.category}</p></div><Check class="ml-auto text-sage" size={18}/></div>{/each}</div><div class="my-6 h-px bg-[#e7e5df]"></div><div class="space-y-4"><div class="rounded-xl border border-[#e4e5de] bg-[#f5f7f3] px-4 py-3"><p class="text-[11px] font-bold text-[#89938b]">ผู้ขอยืมจากบัญชี</p><p class="mt-1 text-sm font-bold text-ink">{borrowerName}</p><p class="mt-1 text-xs text-[#778078]">{borrowerEmail}</p></div>{#if autoApprove}<div class="rounded-xl border border-[#dce5dc] bg-[#eef5ee] px-4 py-3 text-sm text-sage"><b>บัญชีผู้ดูแลระบบ</b><p class="mt-1 text-xs text-[#6f8973]">รายการของคุณจะได้รับอนุมัติทันที และยังแสดงในประวัติคำขอยืม</p></div>{:else if skipTeacherApproval}<div class="rounded-xl border border-[#dce5dc] bg-[#eef5ee] px-4 py-3 text-sm text-sage"><b>บัญชีอาจารย์</b><p class="mt-1 text-xs text-[#6f8973]">คำขอนี้จะส่งถึงผู้ดูแลโดยตรง ไม่ต้องรอ อจ. รับทราบ</p></div>{:else}<label>เลือก อจ. ผู้รับทราบ<select bind:value={teacherId} required><option value="">เลือก อจ.</option>{#each teachers as teacher}<option value={teacher.id}>{teacher.name || teacher.email}</option>{/each}</select></label>{/if}<label>วันและเวลาที่ต้องการคืน<div class="relative"><CalendarDays class="absolute left-3 top-3 text-[#8a918b]" size={17}/><input class="pl-10" type="datetime-local" bind:value={dueDate} required /></div></label><label>หมายเหตุ <span class="font-normal text-[#9aa19b]">(ไม่บังคับ)</span><textarea bind:value={note} rows="3" placeholder="บอกเราเพิ่มเติมได้เลย"></textarea></label></div></div>
    <div class="border-t border-[#e7e5df] bg-white p-6"><Button size="lg" disabled={selectedItems.length === 0 || !borrowerName || !borrowerEmail || (!skipTeacherApproval && !teacherId) || !dueDate} on:click={() => onSubmit({ dueDate, note, teacher: teacherId })}>{autoApprove ? 'ยืนยันยืมทันที' : skipTeacherApproval ? 'ส่งถึงผู้ดูแล' : 'ส่งคำขอยืม'} <ArrowRight size={17}/></Button></div>
  </aside>
{/if}
