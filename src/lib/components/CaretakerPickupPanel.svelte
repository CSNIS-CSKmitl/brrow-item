<script>
  import { CalendarClock, Check, MapPin, PackageCheck, RefreshCw } from '@lucide/svelte';
  import Button from './Button.svelte';
  import {
    PICKUP_LOCATION,
    formatPickupSchedule,
    getPickupStatusMeta,
  } from '../pickup.js';
  import {
    confirmPickupTime,
    requestPickupReschedule,
    markLoanPickedUp,
  } from '../pocketbase.js';

  export let request;
  export let canManage = false;
  export let onUpdated = () => {};

  let busy = false;
  let showRescheduleForm = false;
  let rescheduleNote = '';
  let errorMsg = '';

  $: pickupStatus = String(request?.pickup_status || '').trim();
  $: meta = getPickupStatusMeta(pickupStatus || 'pending_user_select');
  $: scheduleText = formatPickupSchedule(request);

  async function handleConfirm() {
    if (busy) return;
    busy = true;
    errorMsg = '';
    try {
      await confirmPickupTime(request.id);
      await onUpdated('ยืนยันเวลานัดรับอุปกรณ์และส่งอีเมลแจ้งผู้ยืมแล้ว');
    } catch (err) {
      errorMsg = err?.message || 'ไม่สามารถยืนยันเวลานัดรับได้';
    } finally {
      busy = false;
    }
  }

  async function handleRescheduleSubmit() {
    if (busy) return;
    if (!rescheduleNote.trim()) {
      errorMsg = 'กรุณาระบุเหตุผลหรือช่วงเวลาที่สะดวกให้ผู้ยืมทราบ';
      return;
    }
    busy = true;
    errorMsg = '';
    try {
      await requestPickupReschedule(request.id, rescheduleNote.trim());
      showRescheduleForm = false;
      rescheduleNote = '';
      await onUpdated('ส่งคำขอเปลี่ยนเวลานัดรับและแจ้งผู้ยืมทางอีเมลแล้ว');
    } catch (err) {
      errorMsg = err?.message || 'ไม่สามารถส่งคำขอเปลี่ยนเวลาได้';
    } finally {
      busy = false;
    }
  }

  async function handleMarkPickedUp() {
    if (busy) return;
    busy = true;
    errorMsg = '';
    try {
      await markLoanPickedUp(request.id);
      await onUpdated('บันทึกการส่งมอบอุปกรณ์เรียบร้อยแล้ว');
    } catch (err) {
      errorMsg = err?.message || 'ไม่สามารถบันทึกการรับอุปกรณ์ได้';
    } finally {
      busy = false;
    }
  }
</script>

{#if request?.status === 'approved'}
  <div class="mt-3 rounded-xl border border-[#dce5dc] bg-[#f8faf8] p-3.5 text-sm">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <span class="inline-flex items-center gap-1.5 font-bold text-ink text-xs">
          <CalendarClock size={15} class="text-[var(--accent-ink)]" />
          การนัดรับอุปกรณ์
        </span>
        <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold {meta.badgeClass}">
          <span class="h-1.5 w-1.5 rounded-full {meta.dotClass}"></span>
          {meta.label || 'รอผู้ยืมเลือกเวลานัดรับ'}
        </span>
      </div>
      <span class="inline-flex items-center gap-1 text-xs font-semibold text-[#546357]">
        <MapPin size={13} />
        {PICKUP_LOCATION}
      </span>
    </div>

    {#if pickupStatus === 'pending_caretaker_confirm'}
      <div class="mt-2.5 rounded-lg border border-indigo-200 bg-indigo-50/70 p-3">
        <p class="text-xs font-bold text-indigo-900">
          เวลาที่ผู้ยืมเสนอ: <span class="text-sm">{scheduleText}</span>
        </p>
        {#if request.pickup_note}
          <p class="mt-1 text-xs text-indigo-800">หมายเหตุจากผู้ยืม: {request.pickup_note}</p>
        {/if}

        {#if canManage}
          <div class="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} on:click={handleConfirm}>
              <Check size={14} /> {busy ? 'กำลังบันทึก...' : 'ยืนยันเวลานี้'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              on:click={() => {
                showRescheduleForm = !showRescheduleForm;
                errorMsg = '';
              }}
            >
              <RefreshCw size={14} /> ไม่ว่าง / ขอเปลี่ยนเวลา
            </Button>
          </div>
        {/if}
      </div>

      {#if showRescheduleForm && canManage}
        <div class="mt-2.5 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
          <label class="block text-xs font-bold text-amber-950">
            ระบุเหตุผลหรือช่วงเวลาที่สะดวกให้ผู้ยืมเลือกใหม่ <span class="text-rose-500">*</span>
            <textarea
              rows="2"
              bind:value={rescheduleNote}
              placeholder="เช่น ช่วงเวลานี้ติดประชุม รบกวนเลือกเป็นช่วงบ่าย 13:30-15:00 น. แทนครับ"
              class="mt-1.5 w-full rounded-lg border border-amber-300 bg-white p-2 text-xs text-ink font-normal"
            ></textarea>
          </label>
          <div class="mt-2 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} on:click={handleRescheduleSubmit}>
              {busy ? 'กำลังส่ง...' : 'ส่งคำขอเปลี่ยนเวลา (ส่งอีเมล)'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              on:click={() => {
                showRescheduleForm = false;
                rescheduleNote = '';
                errorMsg = '';
              }}
            >
              ยกเลิก
            </Button>
          </div>
        </div>
      {/if}
    {:else if pickupStatus === 'confirmed'}
      <div class="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
        <div>
          <p class="text-xs font-bold text-emerald-900">
            เวลานัดรับที่ยืนยันแล้ว: <span class="text-sm">{scheduleText}</span>
          </p>
          {#if request.pickup_note}
            <p class="mt-0.5 text-xs text-emerald-800">หมายเหตุจากผู้ยืม: {request.pickup_note}</p>
          {/if}
        </div>
        {#if canManage}
          <Button variant="outline" size="sm" disabled={busy} on:click={handleMarkPickedUp}>
            <PackageCheck size={14} /> {busy ? 'กำลังบันทึก...' : 'บันทึกรับของแล้ว'}
          </Button>
        {/if}
      </div>
    {:else if pickupStatus === 'reschedule_requested'}
      <div class="mt-2.5 rounded-lg border border-rose-200 bg-rose-50/70 p-2.5 text-xs text-rose-900">
        <p class="font-bold">ขอเปลี่ยนเวลาแล้ว — รอผู้ยืมเลือกวันและ Slot ใหม่</p>
        {#if scheduleText !== '-'}
          <p class="mt-0.5 text-rose-800">เวลาเดิมที่เสนอ: {scheduleText}</p>
        {/if}
        {#if request.caretaker_pickup_note}
          <p class="mt-0.5 text-rose-800">ข้อความที่แจ้งผู้ยืม: {request.caretaker_pickup_note}</p>
        {/if}
      </div>
    {:else if pickupStatus === 'picked_up'}
      <div class="mt-2 rounded-lg border border-teal-200 bg-teal-50/70 px-3 py-2 text-xs text-teal-900">
        ผู้ยืมมารับอุปกรณ์ ณ {PICKUP_LOCATION} เรียบร้อยแล้ว {#if scheduleText !== '-'}({scheduleText}){/if}
      </div>
    {:else}
      <p class="mt-2 text-xs text-[#6f7870]">
        รอผู้ยืมเลือกวันทำการ (จันทร์–ศุกร์) และช่วงเวลานัดรับ (09:00–16:00 น.)
      </p>
    {/if}

    {#if errorMsg}
      <p class="mt-2 text-xs font-semibold text-rose-600">{errorMsg}</p>
    {/if}
  </div>
{/if}
