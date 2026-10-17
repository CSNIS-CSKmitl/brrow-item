<script>
  import { RefreshCw, AlertTriangle, Radio, Trophy, CheckCircle2, Package } from 'lucide-svelte';
  import { TIME_RANGES } from '../admin-stats.js';
  import { formatDateTime } from '../csv.js';

  export let stats = {};
  export let selectedRange = 'all';
  export let activeFilter = 'all';
  export let loading = false;
  export let error = '';
  export let lastUpdated = '';
  export let isRealtime = false;
  export let onRangeChange = () => {};
  export let onDrilldown = () => {};
  export let onRefresh = () => {};

  $: rangeLabel = TIME_RANGES.find((entry) => entry.value === selectedRange)?.label || 'ทั้งหมด';
  $: itemCount = Number(stats.items) || 0;
  $: availableUnits = Number(stats.availableUnits) || 0;
  $: totalUnits = Number(stats.totalUnits) || 0;
  $: borrowedUnits = Number(stats.borrowedUnits) || 0;
  $: currentlyBorrowed = Number(stats.currentlyBorrowed) || 0;
  $: pendingCount = Number(stats.pending) || 0;
  $: overdueRequests = Number(stats.overdue) || 0;
  $: returnedCount = Number(stats.returned) || 0;
  $: totalRequests = Number(stats.totalRequests) || 0;
  $: borrowerCount = Number(stats.borrowers) || 0;
  $: popularEquipment = stats.popularEquipment || null;
  $: onTimeReturnRate = stats.onTimeReturnRate ?? null;
  $: onTimeCount = Number(stats.onTimeCount) || 0;
  $: evaluatedReturnCount = Number(stats.evaluatedReturnCount) || 0;
  $: safeTrend = Array.isArray(stats.trend) ? stats.trend : [];
  $: maxTrend = Math.max(1, ...safeTrend.map((entry) => Number(entry.count) || 0));
  $: trendTotal = safeTrend.reduce((sum, entry) => sum + (Number(entry.count) || 0), 0);
  $: availabilityRate = totalUnits ? Math.round((availableUnits / totalUnits) * 100) : 0;

  function chooseFilter(filter) {
    onDrilldown(activeFilter === filter && filter !== 'all' ? 'all' : filter);
  }
</script>

<section class="mb-8 overflow-hidden rounded-3xl border border-[#dce4dc] bg-[#f8faf7] shadow-sm" aria-label="ภาพรวมสถิติการยืมคืน">
  <header class="flex flex-col gap-4 border-b border-[#dce4dc] bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
    <div>
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="text-lg font-bold text-ink">ภาพรวมการยืม–คืน</h2>
        <span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold {isRealtime ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}">
          <Radio size={12} class={isRealtime ? 'animate-pulse' : ''} />
          {isRealtime ? 'เชื่อมต่อแบบเรียลไทม์' : 'ข้อมูลล่าสุด'}
        </span>
      </div>
      <p class="mt-1 text-xs text-[#737d75]">{lastUpdated ? `อัปเดต ${formatDateTime(lastUpdated)}` : 'กำลังเตรียมข้อมูล'} · ช่วงเวลา {rangeLabel}</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex flex-wrap rounded-xl bg-[#eef3ed] p-1" role="group" aria-label="เลือกช่วงเวลา">
        {#each TIME_RANGES as range}
          <button type="button" class="rounded-lg px-3 py-1.5 text-xs font-bold transition {selectedRange === range.value ? 'bg-sage text-white shadow-sm' : 'text-[#637067] hover:bg-white'}" aria-pressed={selectedRange === range.value} on:click={() => onRangeChange(range.value)}>{range.label}</button>
        {/each}
      </div>
      <button type="button" class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#cad5ca] bg-white px-3 text-xs font-bold text-ink hover:bg-[#f2f6f1] disabled:opacity-50" disabled={loading} on:click={onRefresh}><RefreshCw size={14} class={loading ? 'animate-spin' : ''} /> รีเฟรช</button>
    </div>
  </header>

  {#if loading && !lastUpdated}
    <div class="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="กำลังโหลดสถิติ">
      {#each Array(4) as _}<div class="h-28 animate-pulse rounded-2xl border border-[#e2e8e1] bg-white"></div>{/each}
    </div>
  {:else if error}
    <div class="m-5 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 sm:flex-row sm:items-center sm:justify-between" role="alert">
      <div class="flex items-start gap-2.5"><AlertTriangle size={18} class="mt-0.5 shrink-0" /><div><p class="text-sm font-bold">โหลดสถิติไม่สำเร็จ</p><p class="text-xs">{error}</p></div></div>
      <button type="button" class="self-start rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white" on:click={onRefresh}>ลองใหม่</button>
    </div>
  {:else}
    <div class="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
      <button type="button" class="rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md {activeFilter === 'all' ? 'border-sage ring-2 ring-sage/15' : 'border-[#dce4dc]'}" on:click={() => chooseFilter('all')}><p class="text-xs font-semibold text-[#737d75]">คำขอทั้งหมด</p><p class="mt-2 text-3xl font-bold text-ink">{totalRequests}</p><p class="mt-1 text-xs text-[#737d75]">จากผู้ยืม {borrowerCount} คน</p></button>
      <button type="button" class="rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md {activeFilter === 'pending_all' || activeFilter === 'pending' ? 'border-amber-500 ring-2 ring-amber-500/15' : 'border-[#dce4dc]'}" on:click={() => chooseFilter('pending_all')}><p class="text-xs font-semibold text-amber-700">รอการอนุมัติ</p><p class="mt-2 text-3xl font-bold text-amber-800">{pendingCount}</p><p class="mt-1 text-xs text-[#737d75]">รายการที่ต้องดำเนินการ</p></button>
      <button type="button" class="rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md {activeFilter === 'approved' ? 'border-emerald-500 ring-2 ring-emerald-500/15' : 'border-[#dce4dc]'}" on:click={() => chooseFilter('approved')}><p class="text-xs font-semibold text-emerald-700">กำลังยืม</p><p class="mt-2 text-3xl font-bold text-emerald-800">{currentlyBorrowed}</p><p class="mt-1 text-xs text-[#737d75]">รวม {borrowedUnits} ชิ้น</p></button>
      <button type="button" class="rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md {activeFilter === 'overdue' ? 'border-rose-500 ring-2 ring-rose-500/15' : 'border-[#dce4dc]'}" on:click={() => chooseFilter('overdue')}><p class="text-xs font-semibold text-rose-700">เกินกำหนดคืน</p><p class="mt-2 text-3xl font-bold text-rose-800">{overdueRequests}</p><p class="mt-1 text-xs text-[#737d75]">รายการที่ต้องติดตาม</p></button>
    </div>

    <div class="grid gap-4 border-t border-[#e1e7e0] p-5 lg:grid-cols-[1.35fr_1fr]">
      <div class="rounded-2xl border border-[#dce4dc] bg-white p-5">
        <div class="flex items-center justify-between"><div><h3 class="text-sm font-bold text-ink">แนวโน้มคำขอ</h3><p class="text-xs text-[#737d75]">{trendTotal} คำขอในช่วง {rangeLabel}</p></div><span class="rounded-lg bg-[#eef4ee] px-2.5 py-1 text-xs font-bold text-sage">{trendTotal}</span></div>
        {#if trendTotal === 0}
          <div class="mt-4 grid h-40 place-items-center rounded-xl border border-dashed border-[#dce4dc] text-xs text-[#7c857e]">ยังไม่มีคำขอในช่วงเวลานี้</div>
        {:else}
          <div class="mt-5 flex h-44 items-end gap-1.5 overflow-x-auto">
            {#each safeTrend as bucket (bucket.key)}
              <div class="group flex min-w-[26px] flex-1 flex-col items-center gap-1"><span class="text-[10px] font-bold text-[#657168]">{bucket.count || ''}</span><div class="flex h-32 w-full items-end rounded-t-md bg-[#f1f4f0]"><div class="w-full rounded-t-md bg-sage transition group-hover:bg-[#304b3b]" style="height: {Math.max(bucket.count ? 8 : 2, (bucket.count / maxTrend) * 100)}%" title="{bucket.label}: {bucket.count} คำขอ"></div></div><span class="max-w-full truncate text-[10px] text-[#737d75]" title={bucket.label}>{bucket.label}</span></div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <div class="rounded-2xl border border-[#dce4dc] bg-white p-4"><div class="flex items-center gap-2 text-sage"><Package size={17} /><p class="text-xs font-bold">อุปกรณ์พร้อมยืม</p></div><div class="mt-2 flex items-end justify-between"><p class="text-2xl font-bold text-ink">{availableUnits}<span class="text-sm font-medium text-[#737d75]">/{totalUnits} ชิ้น</span></p><span class="text-xs font-bold text-emerald-700">{availabilityRate}%</span></div><div class="mt-2 h-2 overflow-hidden rounded-full bg-[#e8ede7]"><div class="h-full rounded-full bg-emerald-600" style="width: {availabilityRate}%"></div></div><p class="mt-2 text-xs text-[#737d75]">ทั้งหมด {itemCount} รายการ</p></div>
        <div class="rounded-2xl border border-[#dce4dc] bg-white p-4"><div class="flex items-center gap-2 text-amber-700"><Trophy size={17} /><p class="text-xs font-bold">อุปกรณ์ยอดนิยม</p></div>{#if popularEquipment}<p class="mt-2 truncate text-base font-bold text-ink" title={popularEquipment.name}>{popularEquipment.name}</p><p class="text-xs text-[#737d75]">ถูกขอยืม {popularEquipment.count} ครั้ง</p>{:else}<p class="mt-2 text-sm text-[#737d75]">ยังไม่มีข้อมูล</p>{/if}</div>
        <button type="button" class="rounded-2xl border border-[#dce4dc] bg-white p-4 text-left transition hover:border-teal-400 {activeFilter === 'returned' ? 'ring-2 ring-teal-500/15' : ''}" on:click={() => chooseFilter('returned')}><div class="flex items-center gap-2 text-teal-700"><CheckCircle2 size={17} /><p class="text-xs font-bold">การคืนตรงเวลา</p></div><p class="mt-2 text-2xl font-bold text-ink">{onTimeReturnRate === null ? '—' : `${onTimeReturnRate}%`}</p><p class="text-xs text-[#737d75]">ตรงเวลา {onTimeCount}/{evaluatedReturnCount} · คืนแล้ว {returnedCount}</p></button>
      </div>
    </div>
  {/if}
</section>
