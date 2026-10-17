<script>
  export let itemCount = 0;
  export let availableUnits = 0;
  export let totalUnits = 0;
  export let pendingCount = 0;
  export let overdueRequests = 0;
  export let borrowerCount = 0;
</script>

<section class="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="สถิติระบบยืมของ">
  <div class="rounded-2xl border border-[#dce8dd] bg-[#f4f8f4] p-4">
    <p class="text-xs font-semibold text-[#68726b]">รายการของ</p>
    <p class="mt-2 text-2xl font-bold text-ink">{itemCount}</p>
  </div>
  <div class="rounded-2xl border border-[#dce8dd] bg-[#f4f8f4] p-4">
    <p class="text-xs font-semibold text-[#68726b]">ของพร้อมให้ยืม</p>
    <p class="mt-2 text-2xl font-bold text-emerald-700">{availableUnits}<span class="ml-1 text-sm font-medium text-[#68726b]">/ {totalUnits}</span></p>
  </div>
  <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4">
    <p class="text-xs font-semibold text-amber-800">รออนุมัติ</p>
    <p class="mt-2 text-2xl font-bold text-amber-900">{pendingCount}</p>
  </div>
  <div class="rounded-2xl border border-rose-200 bg-rose-50 p-4">
    <p class="text-xs font-semibold text-rose-800">เกินกำหนดคืน</p>
    <p class="mt-2 text-2xl font-bold text-rose-900">{overdueRequests}</p>
  </div>
  <div class="rounded-2xl border border-[#dce8dd] bg-white p-4">
    <p class="text-xs font-semibold text-[#68726b]">ผู้ยืมที่มีคำขอ</p>
    <p class="mt-2 text-2xl font-bold text-ink">{borrowerCount}</p>
  </div>
</section>
