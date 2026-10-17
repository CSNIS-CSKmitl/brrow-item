<script>
  import { createEventDispatcher } from 'svelte';
  import { RefreshCw, AlertTriangle, TrendingUp, Award, CheckCircle2, PackageCheck, FilterX } from 'lucide-svelte';
  import { TIME_RANGES } from '../admin-stats.js';
  import { formatDateTime } from '../csv.js';

  export let itemCount = 0;
  export let availableUnits = 0;
  export let totalUnits = 0;
  export let borrowedUnits = 0;
  export let currentlyBorrowed = 0;
  export let pendingCount = 0;
  export let overdueRequests = 0;
  export let returnedCount = 0;
  export let totalRequests = 0;
  export let borrowerCount = 0;
  export let popularEquipment = null;
  export let onTimeReturnRate = null;
  export let onTimeCount = 0;
  export let evaluatedReturnCount = 0;
  export let trend = [];

  export let selectedRange = 'all';
  export let activeFilter = 'all';
  export let loading = false;
  export let error = '';
  export let lastUpdated = '';
  export let isRealtime = false;

  export let onRangeChange = null;
  export let onDrilldown = null;
  export let onRefresh = null;

  const dispatch = createEventDispatcher();

  function selectRange(range) {
    if (selectedRange === range) return;
    selectedRange = range;
    if (typeof onRangeChange === 'function') onRangeChange(range);
    dispatch('rangeChange', range);
  }

  function handleCardClick(key) {
    const nextKey = activeFilter === key && key !== 'all' ? 'all' : key;
    if (typeof onDrilldown === 'function') onDrilldown(nextKey);
    dispatch('drilldown', nextKey);
  }

  function triggerRefresh() {
    if (typeof onRefresh === 'function') onRefresh();
    dispatch('refresh');
  }

  $: maxTrendCount = Math.max(1, ...(Array.isArray(trend) ? trend.map((b) => Number(b.count) || 0) : [1]));
  $: totalTrendVolume = (Array.isArray(trend) ? trend : []).reduce((sum, b) => sum + (Number(b.count) || 0), 0);
  $: rangeLabel = TIME_RANGES.find((r) => r.value === selectedRange)?.label || 'ทั้งหมด';
</script>

<section class="mb-8 space-y-4" aria-label="สถิติระบบยืมของ">
  <!-- Top Control Bar: Badge, Last Updated, Refresh, Time Range Selector -->
  <div class="flex flex-col justify-between gap-3 rounded-2xl border border-[#dce8dd] bg-white p-4 shadow-2xs lg:flex-row lg:items-center">
    <div class="flex flex-wrap items-center gap-2.5">
      <span class="text-sm font-bold text-ink">ภาพรวมสถิติการยืม-คืน</span>

      <!-- Realtime / Snapshot Badge -->
      <span
        class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold {isRealtime
          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          : 'bg-slate-100 text-slate-700 border border-slate-200'}"
      >
        <span class="h-1.5 w-1.5 rounded-full {isRealtime ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}"></span>
        {isRealtime ? 'Realtime' : 'Snapshot'}
      </span>

      <span class="text-xs text-[#68726b]">
        อัปเดตล่าสุด: <b class="text-ink">{lastUpdated ? formatDateTime(lastUpdated) : 'กำลังซิงค์...'}</b>
      </span>

      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg border border-[#c8d4c9] bg-[#f8faf8] px-2.5 py-1 text-xs font-semibold text-ink hover:bg-[#edf3ed] disabled:opacity-50 transition"
        on:click={triggerRefresh}
        disabled={loading}
      >
        <RefreshCw size={13} class="text-sage {loading ? 'animate-spin' : ''}" />
        <span>รีเฟรช</span>
      </button>
    </div>

    <!-- Time Range Selector -->
    <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="ตัวเลือกช่วงเวลาสถิติ">
      {#each TIME_RANGES as r}
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-bold transition {selectedRange === r.value
            ? 'bg-sage text-white shadow-2xs'
            : 'bg-[#f0f4ef] text-[#5e6960] hover:bg-[#e3ece2]'}"
          aria-pressed={selectedRange === r.value}
          on:click={() => selectRange(r.value)}
        >
          {r.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Explicit Loading or Error States -->
  {#if loading && !lastUpdated}
    <div class="rounded-2xl border border-[#dce8dd] bg-white p-8 text-center shadow-2xs" role="status">
      <RefreshCw size={24} class="mx-auto animate-spin text-sage" />
      <p class="mt-3 text-sm font-bold text-ink">กำลังโหลดสถิติ...</p>
      <p class="mt-1 text-xs text-[#68726b]">กำลังดึงข้อมูลรายการยืม-คืนและสถานะอุปกรณ์ล่าสุด</p>
    </div>
  {:else if error}
    <div class="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900 shadow-2xs" role="alert">
      <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div class="flex items-start gap-3">
          <AlertTriangle size={20} class="mt-0.5 shrink-0 text-rose-600" />
          <div>
            <p class="text-sm font-bold">โหลดข้อมูลไม่ได้</p>
            <p class="mt-0.5 text-xs text-rose-700">{error}</p>
          </div>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 self-start rounded-xl bg-rose-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-800 transition"
          on:click={triggerRefresh}
        >
          <RefreshCw size={13} /> ลองใหม่
        </button>
      </div>
    </div>
  {:else}
    <!-- Active Drill-down Indicator -->
    {#if activeFilter && activeFilter !== 'all'}
      <div class="flex items-center justify-between rounded-xl border border-[#cde0ce] bg-[#f4f8f4] px-3.5 py-2 text-xs text-[#2d5236]">
        <span>กำลังกรองรายการด้านล่างจากบัตรสถิติ · คลิกบัตรเดิมซ้ำหรือกดปุ่มขวาเพื่อแสดงทั้งหมด</span>
        <button
          type="button"
          class="inline-flex items-center gap-1 font-bold text-sage hover:underline"
          on:click={() => handleCardClick('all')}
        >
          <FilterX size={13} /> ล้างตัวกรอง
        </button>
      </div>
    {/if}

    <!-- Clickable Status / Drill-down Cards -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <button
        type="button"
        class="text-left rounded-2xl border p-4 transition hover:shadow-sm {activeFilter === 'all'
          ? 'border-[#3b453e] bg-white ring-2 ring-[#3b453e]/20'
          : 'border-[#dce8dd] bg-white hover:border-[#b7ccb9]'}"
        on:click={() => handleCardClick('all')}
      >
        <p class="text-xs font-semibold text-[#68726b]">ทั้งหมด ({rangeLabel})</p>
        <p class="mt-2 text-2xl font-bold text-ink">{totalRequests}</p>
        <p class="mt-1 text-[11px] text-[#68726b]">ผู้ยืม {borrowerCount} คน</p>
      </button>

      <button
        type="button"
        class="text-left rounded-2xl border p-4 transition hover:shadow-sm {activeFilter === 'pending_all' || activeFilter === 'pending'
          ? 'border-amber-600 bg-amber-50 ring-2 ring-amber-500/30'
          : 'border-amber-200 bg-amber-50/70 hover:border-amber-300'}"
        on:click={() => handleCardClick('pending_all')}
      >
        <p class="text-xs font-semibold text-amber-800">รออนุมัติ</p>
        <p class="mt-2 text-2xl font-bold text-amber-900">{pendingCount}</p>
        <p class="mt-1 text-[11px] text-amber-700">คลิกเพื่อกรองคำขอรออนุมัติ</p>
      </button>

      <button
        type="button"
        class="text-left rounded-2xl border p-4 transition hover:shadow-sm {activeFilter === 'approved'
          ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/30'
          : 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300'}"
        on:click={() => handleCardClick('approved')}
      >
        <p class="text-xs font-semibold text-emerald-800">กำลังถูกยืม</p>
        <p class="mt-2 text-2xl font-bold text-emerald-900">{currentlyBorrowed}</p>
        <p class="mt-1 text-[11px] text-emerald-700">ถูกยืมอยู่ {borrowedUnits} ชิ้น</p>
      </button>

      <button
        type="button"
        class="text-left rounded-2xl border p-4 transition hover:shadow-sm {activeFilter === 'overdue'
          ? 'border-rose-600 bg-rose-50 ring-2 ring-rose-500/30'
          : 'border-rose-200 bg-rose-50/70 hover:border-rose-300'}"
        on:click={() => handleCardClick('overdue')}
      >
        <p class="text-xs font-semibold text-rose-800">เกินกำหนดคืน</p>
        <p class="mt-2 text-2xl font-bold text-rose-900">{overdueRequests}</p>
        <p class="mt-1 text-[11px] text-rose-700">คลิกเพื่อดูรายการค้างคืน</p>
      </button>

      <button
        type="button"
        class="text-left rounded-2xl border p-4 transition hover:shadow-sm {activeFilter === 'returned'
          ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-500/30'
          : 'border-teal-200 bg-teal-50/70 hover:border-teal-300'}"
        on:click={() => handleCardClick('returned')}
      >
        <p class="text-xs font-semibold text-teal-800">คืนแล้ว</p>
        <p class="mt-2 text-2xl font-bold text-teal-900">{returnedCount}</p>
        <p class="mt-1 text-[11px] text-teal-700">คลิกเพื่อดูประวัติคืนแล้ว</p>
      </button>

      <div class="rounded-2xl border border-[#dce8dd] bg-[#f4f8f4] p-4">
        <p class="text-xs font-semibold text-[#68726b]">ของพร้อมให้ยืม</p>
        <p class="mt-2 text-2xl font-bold text-emerald-700">
          {availableUnits}<span class="ml-1 text-sm font-medium text-[#68726b]">/ {totalUnits}</span>
        </p>
        <p class="mt-1 text-[11px] text-[#68726b]">ทั้งหมด {itemCount} รายการ</p>
      </div>
    </div>

    <!-- App-Specific Metrics + Trend Chart -->
    <div class="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
      <!-- App-Specific Highlights -->
      <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        <div class="flex items-start gap-3 rounded-2xl border border-[#dce8dd] bg-white p-4">
          <div class="rounded-xl bg-amber-50 p-2.5 text-amber-700">
            <Award size={18} />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold text-[#68726b]">อุปกรณ์ยอดนิยม ({rangeLabel})</p>
            {#if popularEquipment}
              <p class="mt-1 truncate text-base font-bold text-ink" title={popularEquipment.name}>
                {popularEquipment.name}
              </p>
              <p class="text-xs text-sage font-semibold">ถูกขอยืม {popularEquipment.count} ครั้ง</p>
            {:else}
              <p class="mt-1 text-sm font-semibold text-[#7c857e]">ยังไม่มีข้อมูลการยืม</p>
            {/if}
          </div>
        </div>

        <div class="flex items-start gap-3 rounded-2xl border border-[#dce8dd] bg-white p-4">
          <div class="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
            <CheckCircle2 size={18} />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold text-[#68726b]">อัตราคืนตรงเวลา</p>
            {#if onTimeReturnRate !== null}
              <p class="mt-1 text-xl font-bold text-emerald-800">{onTimeReturnRate}%</p>
              <p class="text-xs text-[#68726b]">คืนตรงเวลา {onTimeCount}/{evaluatedReturnCount} รายการ</p>
            {:else}
              <p class="mt-1 text-sm font-semibold text-[#7c857e]">ยังไม่มีรายการคืน</p>
              <p class="text-xs text-[#68726b]">คำนวณเมื่อมีการบันทึกคืนของ</p>
            {/if}
          </div>
        </div>

        <div class="flex items-start gap-3 rounded-2xl border border-[#dce8dd] bg-white p-4">
          <div class="rounded-xl bg-blue-50 p-2.5 text-blue-700">
            <PackageCheck size={18} />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold text-[#68726b]">จำนวนที่กำลังถูกยืม</p>
            <p class="mt-1 text-xl font-bold text-ink">
              {currentlyBorrowed} <span class="text-xs font-normal text-[#68726b]">คำขอ ({borrowedUnits} ชิ้น)</span>
            </p>
            <p class="text-xs text-[#68726b]">คงเหลือพร้อมยืม {availableUnits} จาก {totalUnits} ชิ้น</p>
          </div>
        </div>
      </div>

      <!-- Trend Chart -->
      <div class="flex flex-col justify-between rounded-2xl border border-[#dce8dd] bg-white p-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <TrendingUp size={16} class="text-sage" />
            <h3 class="text-sm font-bold text-ink">แนวโน้มคำขอยืม ({rangeLabel})</h3>
          </div>
          <span class="text-xs font-semibold text-[#68726b]">รวม {totalTrendVolume} คำขอ</span>
        </div>

        {#if !trend || trend.length === 0 || totalTrendVolume === 0}
          <div class="flex h-40 items-center justify-center rounded-xl border border-dashed border-[#e4e5de] bg-[#fbfcfa] text-xs text-[#7c857e]">
            ไม่มีคำขอยืมในช่วงเวลาที่เลือก
          </div>
        {:else}
          <div class="flex h-44 items-end gap-1.5 overflow-x-auto pt-6 pb-1">
            {#each trend as bucket (bucket.key)}
              {@const heightPct = Math.max(bucket.count > 0 ? 12 : 4, Math.round((bucket.count / maxTrendCount) * 100))}
              <div class="group flex min-w-[24px] flex-1 flex-col items-center gap-1">
                <span class="text-[10px] font-bold text-[#5e6960]">
                  {bucket.count > 0 ? bucket.count : ''}
                </span>
                <div class=" flex h-28 w-full items-end justify-center rounded-t-lg bg-[#f3f6f3] px-0.5">
                  <div
                    class="w-full rounded-t-md transition-all {bucket.count > 0 ? 'bg-sage group-hover:bg-[#2d5236]' : 'bg-[#dce8dd]'}"
                    style="height: {heightPct}%"
                    title="{bucket.label}: {bucket.count} คำขอ"
                  ></div>
                </div>
                <span class="max-w-full truncate text-[10px] text-[#68726b]" title={bucket.label}>
                  {bucket.label}
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</section>
