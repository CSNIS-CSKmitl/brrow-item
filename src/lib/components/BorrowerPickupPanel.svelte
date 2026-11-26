<script>
  import { slide } from 'svelte/transition';
  import { CalendarClock, Check, Clock, MapPin, AlertTriangle, PackageCheck } from '@lucide/svelte';
  import Button from './Button.svelte';
  import {
    PICKUP_LOCATION,
    MORNING_SLOTS,
    AFTERNOON_SLOTS,
    getTodayBangkokDateStr,
    getNextWeekdayDateStr,
    isWeekday,
    isValidPickupDate,
    isValidPickupSlot,
    formatPickupSchedule,
    getPickupStatusMeta,
    needsUserPickupSelection,
  } from '../pickup.js';
  import { proposePickupTime } from '../pocketbase.js';
  import { toastMessage } from '../stores.js';

  export let request;
  export let onUpdated = () => {};

  let openSelector = false;
  let pickupDate = getNextWeekdayDateStr();
  let pickupSlot = '';
  let pickupNote = '';
  let submitting = false;
  let errorMsg = '';

  const todayStr = getTodayBangkokDateStr();

  $: pickupStatus = String(request?.pickup_status || '').trim();
  $: meta = getPickupStatusMeta(pickupStatus || 'pending_user_select');
  $: canSelect = needsUserPickupSelection(request);
  $: scheduleText = formatPickupSchedule(request);
  $: dateError =
    pickupDate && !isWeekday(pickupDate)
      ? 'กรุณาเลือกเฉพาะวันทำการ (วันจันทร์–วันศุกร์) เท่านั้น'
      : pickupDate && !isValidPickupDate(pickupDate, todayStr)
        ? 'ไม่สามารถเลือกวันที่ผ่านมาแล้วได้'
        : '';

  function openForm() {
    openSelector = true;
    pickupDate =
      request?.pickup_date && isValidPickupDate(request.pickup_date, todayStr)
        ? request.pickup_date
        : getNextWeekdayDateStr();
    pickupSlot = '';
    pickupNote = request?.pickup_note || '';
    errorMsg = '';
  }

  async function submitPickup() {
    if (submitting) return;
    if (!pickupDate || dateError) {
      errorMsg = dateError || 'กรุณาเลือกวันที่นัดรับ (จันทร์–ศุกร์)';
      return;
    }
    if (!isValidPickupSlot(pickupSlot)) {
      errorMsg = 'กรุณาเลือกช่วงเวลา (Slot 15 นาที) ที่สะดวกเข้ามารับอุปกรณ์';
      return;
    }
    submitting = true;
    errorMsg = '';
    try {
      await proposePickupTime(request.id, {
        pickupDate,
        pickupSlot,
        pickupNote,
      });
      openSelector = false;
      toastMessage.set({ type: 'success', text: 'ส่งเวลานัดรับอุปกรณ์เรียบร้อยแล้ว' });
      await onUpdated();
    } catch (err) {
      errorMsg = err?.message || 'ไม่สามารถบันทึกเวลานัดรับได้ กรุณาลองใหม่';
      toastMessage.set({ type: 'error', text: errorMsg });
    } finally {
      submitting = false;
    }
  }
</script>

{#if request?.status === 'approved'}
  <div class="mt-4 rounded-xl border border-[#dce5dc] bg-[#f8faf8] p-4 text-sm">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <span class="inline-flex items-center gap-1.5 font-bold text-ink text-xs">
          <CalendarClock size={15} class="text-[var(--accent-ink)]" />
          การนัดรับอุปกรณ์
        </span>
        <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold {meta.badgeClass}">
          <span class="h-1.5 w-1.5 rounded-full {meta.dotClass}"></span>
          {meta.label || 'รอเลือกเวลานัดรับ'}
        </span>
      </div>
      <span class="inline-flex items-center gap-1 text-xs font-semibold text-[#47594a]">
        <MapPin size={13} />
        {PICKUP_LOCATION}
      </span>
    </div>

    {#if canSelect}
      {#if pickupStatus === 'reschedule_requested'}
        <div class="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          <p class="flex items-center gap-1.5 font-bold">
            <AlertTriangle size={14} /> ผู้ดูแลไม่สะดวกในเวลาที่เสนอ กรุณาเลือกวันและเวลาใหม่
          </p>
          {#if scheduleText !== '-'}
            <p class="mt-1 text-rose-800">เวลาเดิมที่เสนอ: {scheduleText}</p>
          {/if}
          {#if request.caretaker_pickup_note}
            <p class="mt-1 rounded-md bg-white/80 px-2.5 py-1.5 font-semibold text-rose-900 border border-rose-200">
              ข้อความจากผู้ดูแล: {request.caretaker_pickup_note}
            </p>
          {/if}
        </div>
      {:else}
        <div class="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950">
          <p class="font-bold">คำขอได้รับการอนุมัติแล้ว กรุณาเลือกวันและเวลานัดรับอุปกรณ์</p>
          <p class="mt-0.5 text-amber-800">
            รับอุปกรณ์ได้ที่ <b>{PICKUP_LOCATION}</b> ในวันทำการ (จันทร์–ศุกร์) เวลา 09:00–12:00 น. และ 13:00–16:00 น.
          </p>
        </div>
      {/if}

      {#if !openSelector}
        <div class="mt-3">
          <Button size="sm" on:click={openForm}>
            <CalendarClock size={15} />
            {pickupStatus === 'reschedule_requested' ? 'เลือกวันและเวลานัดรับใหม่' : 'เลือกวันและเวลานัดรับอุปกรณ์'}
          </Button>
        </div>
      {:else}
        <div transition:slide={{ duration: 220 }} class="mt-3 space-y-3 rounded-xl border border-[#d4dfd5] bg-white p-4">
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block text-xs font-bold text-ink">
              วันที่นัดรับ (จันทร์–ศุกร์) <span class="text-rose-500">*</span>
              <input
                type="date"
                min={todayStr}
                bind:value={pickupDate}
                class="mt-1 w-full rounded-lg border border-[#c4d6c5] bg-white p-2 text-sm font-normal"
              />
              {#if dateError}
                <span class="mt-1 block text-[11px] font-semibold text-rose-600">{dateError}</span>
              {/if}
            </label>

            <div class="rounded-lg border border-[#e3eae3] bg-[#f5f8f5] p-2.5 text-xs">
              <p class="font-bold text-[#355238]">สถานที่รับอุปกรณ์</p>
              <p class="mt-1 flex items-center gap-1 font-semibold text-ink">
                <MapPin size={14} class="text-[var(--accent-ink)]" />
                {PICKUP_LOCATION}
              </p>
              <p class="mt-0.5 text-[11px] text-[#6d786f]">เฉพาะวันจันทร์–ศุกร์ (พักกลางวัน 12:00–13:00 น.)</p>
            </div>
          </div>

          <div>
            <p class="text-xs font-bold text-ink mb-2 flex items-center gap-1.5">
              <Clock size={14} class="text-[var(--accent-ink)]" />
              เลือกช่วงเวลานัดรับ (Slot ทุก 15 นาที) <span class="text-rose-500">*</span>
            </p>

            <div class="space-y-2.5">
              <div>
                <p class="text-[11px] font-semibold text-[#5b695d] mb-1.5">ช่วงเช้า (09:00 – 12:00 น.)</p>
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {#each MORNING_SLOTS as slot}
                    <button
                      type="button"
                      class="rounded-lg border px-2 py-1.5 text-xs font-mono font-semibold transition {pickupSlot === slot
                        ? 'border-[var(--accent-ink)] bg-[var(--accent-ink)] text-white shadow-xs'
                        : 'border-[#d6e0d7] bg-[#fbfcfa] text-ink hover:border-[var(--accent-ink)] hover:bg-[#eef5ee]'}"
                      on:click={() => {
                        pickupSlot = slot;
                        errorMsg = '';
                      }}
                    >
                      {slot}
                    </button>
                  {/each}
                </div>
              </div>

              <div class="flex items-center gap-2 text-[11px] text-[#8a948b]">
                <div class="h-px flex-1 bg-[#e7e5df]"></div>
                <span>พักกลางวัน 12:00 – 13:00 น.</span>
                <div class="h-px flex-1 bg-[#e7e5df]"></div>
              </div>

              <div>
                <p class="text-[11px] font-semibold text-[#5b695d] mb-1.5">ช่วงบ่าย (13:00 – 16:00 น.)</p>
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {#each AFTERNOON_SLOTS as slot}
                    <button
                      type="button"
                      class="rounded-lg border px-2 py-1.5 text-xs font-mono font-semibold transition {pickupSlot === slot
                        ? 'border-[var(--accent-ink)] bg-[var(--accent-ink)] text-white shadow-xs'
                        : 'border-[#d6e0d7] bg-[#fbfcfa] text-ink hover:border-[var(--accent-ink)] hover:bg-[#eef5ee]'}"
                      on:click={() => {
                        pickupSlot = slot;
                        errorMsg = '';
                      }}
                    >
                      {slot}
                    </button>
                  {/each}
                </div>
              </div>
            </div>
          </div>

          <label class="block text-xs font-bold text-ink">
            หมายเหตุเพิ่มเติม <span class="font-normal text-[#89938b]">(ไม่บังคับ)</span>
            <input
              type="text"
              bind:value={pickupNote}
              placeholder="เช่น จะเข้าไปรับพร้อมเพื่อน หรือเบอร์ติดต่อกลับ"
              class="mt-1 w-full rounded-lg border border-[#c4d6c5] bg-white p-2 text-xs font-normal"
            />
          </label>

          {#if errorMsg}
            <p class="text-xs font-semibold text-rose-600">{errorMsg}</p>
          {/if}

          <div class="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              disabled={submitting || !pickupDate || Boolean(dateError) || !pickupSlot}
              on:click={submitPickup}
            >
              <Check size={14} /> {submitting ? 'กำลังส่งข้อมูล...' : 'ยืนยันส่งเวลานัดรับ'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={submitting}
              on:click={() => {
                openSelector = false;
                errorMsg = '';
              }}
            >
              ยกเลิก
            </Button>
          </div>
        </div>
      {/if}
    {:else if pickupStatus === 'pending_caretaker_confirm'}
      <div class="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-950">
        <p class="font-bold">ส่งเวลานัดรับแล้ว — รอผู้ดูแลยืนยันเวลา</p>
        <p class="mt-1">
          เวลาที่เสนอ: <b class="text-sm">{scheduleText}</b>
        </p>
        <p class="mt-0.5">สถานที่: <b>{PICKUP_LOCATION}</b></p>
        {#if request.pickup_note}
          <p class="mt-0.5 text-indigo-800">หมายเหตุ: {request.pickup_note}</p>
        {/if}
        <p class="mt-1 text-[11px] text-indigo-700">ระบบจะส่งอีเมลแจ้งเตือนทันทีเมื่อผู้ดูแลยืนยันเวลาหรือขอเปลี่ยนเวลาครับ</p>
      </div>
    {:else if pickupStatus === 'confirmed'}
      <div class="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950">
        <p class="font-bold text-emerald-900">✅ ยืนยันเวลานัดรับอุปกรณ์เรียบร้อยแล้ว</p>
        <p class="mt-1">
          วันเวลานัดรับ: <b class="text-sm">{scheduleText}</b>
        </p>
        <p class="mt-0.5">สถานที่: <b>{PICKUP_LOCATION}</b></p>
        {#if request.pickup_note}
          <p class="mt-0.5 text-emerald-800">หมายเหตุ: {request.pickup_note}</p>
        {/if}
      </div>
    {:else if pickupStatus === 'picked_up'}
      <div class="mt-3 flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50/80 px-3 py-2 text-xs font-semibold text-teal-900">
        <PackageCheck size={15} />
        รับอุปกรณ์ ณ {PICKUP_LOCATION} เรียบร้อยแล้ว {#if scheduleText !== '-'}({scheduleText}){/if}
      </div>
    {/if}
  </div>
{/if}
