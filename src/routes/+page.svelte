<script>
  import { CheckCircle2, Search, SlidersHorizontal, Package, ArrowUpRight } from '@lucide/svelte';
  import ItemCard from "../lib/components/ItemCard.svelte";
  import Button from "../lib/components/Button.svelte";
  import { categories } from "../lib/mock-data.js";
  import { items, selectedItems, toggleItem, toastMessage, user } from "../lib/stores.js";

  let search = "";
  let activeCategory = "ทั้งหมด";
  let showAll = false;
  let detailItem = null;

  $: filteredItems = $items.filter(
    (item) =>
      item.is_active !== false &&
      (activeCategory === "ทั้งหมด" || item.category === activeCategory) &&
      `${item.name} ${item.description}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  $: shownItems = showAll ? filteredItems : filteredItems.slice(0, 6);
</script>

<main>
  {#if !$user}
    <section class="mx-auto max-w-4xl px-6 py-20 text-center">
      <div class="mx-auto mb-4 grid size-12 place-items-center rounded-xl border border-[#e8e5df] bg-white text-[#4a6354]">
        <Package size={22} strokeWidth={1.5} />
      </div>
      <h1 class="text-2xl font-semibold tracking-tight text-ink">ระบบยืม-คืนอุปกรณ์ภาควิชา</h1>
      <p class="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[#778078]">
        กรุณาเข้าสู่ระบบด้วยบัญชี CS KMITL เพื่อตรวจสอบสถานะอุปกรณ์ และส่งคำขอยืมอุปกรณ์โครงงาน
      </p>
      <div class="mt-6">
        <a href="/login" class="inline-flex h-10 items-center justify-center rounded-lg bg-[#4a6354] px-5 text-xs font-medium text-white transition-colors hover:bg-[#3d5246]">
          เข้าสู่ระบบ
        </a>
      </div>
    </section>
  {:else}
    <!-- Catalog Section -->
    <section id="catalog" class="mx-auto max-w-7xl px-6 py-10">
      <!-- Section Header -->
      <div class="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p class="font-mono text-xs text-[#4a6354]">คลังอุปกรณ์และครุภัณฑ์ภาควิชา</p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight text-ink">รายการอุปกรณ์ทั้งหมด</h1>
          <p class="mt-1 text-xs text-[#778078]">
            เซนเซอร์, บอร์ดไมโครคอนโทรลเลอร์, อุปกรณ์เครือข่าย และชุดทดลองสำหรับนักศึกษา
          </p>
        </div>

        <div class="flex items-center gap-3">
          <div class="relative flex items-center">
            <Search size={15} strokeWidth={1.5} class="pointer-events-none absolute left-3 text-[#88928a]" />
            <input
              bind:value={search}
              placeholder="ค้นหาชื่ออุปกรณ์หรือคำอธิบาย…"
              aria-label="ค้นหา"
              class="h-9 w-64 rounded-lg border border-[#e8e5df] bg-white pl-9 pr-3 text-xs text-ink placeholder:text-[#88928a] focus:border-[#4a6354] focus:outline-none"
            />
          </div>
          <span class="font-mono text-xs text-[#778078]">
            {filteredItems.length} ชิ้น
          </span>
        </div>
      </div>

      <!-- Categories segmented buttons -->
      <div class="mb-6 flex flex-wrap items-center gap-1.5 border-b border-[#e8e5df]/80 pb-3">
        {#each categories as category}
          <button
            type="button"
            class="h-8 rounded-lg px-3 text-xs font-medium transition-colors {activeCategory === category
              ? 'bg-[#17211b] text-white'
              : 'border border-[#e8e5df] bg-white text-[#657168] hover:bg-[#f2efe9]'}"
            on:click={() => {
              activeCategory = category;
              showAll = false;
            }}
          >
            {category}
          </button>
        {/each}
      </div>

      <!-- Item Grid -->
      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {#each shownItems as item (item.id)}
          <ItemCard
            {item}
            selected={$selectedItems.some((selected) => selected.id === item.id)}
            onSelect={toggleItem}
            onOpen={() => (detailItem = item)}
          />
        {/each}
      </div>

      {#if shownItems.length === 0}
        <div class="rounded-xl border border-dashed border-[#d8d8d0] py-16 text-center text-xs text-[#7c857e]">
          ไม่พบรายการอุปกรณ์ที่ค้นหา
        </div>
      {/if}

      {#if filteredItems.length > 6 && !showAll}
        <div class="mt-8 text-center">
          <Button variant="outline" on:click={() => (showAll = true)}>
            ดูทั้งหมด ({filteredItems.length} รายการ)
          </Button>
        </div>
      {/if}
    </section>
  {/if}
</main>

<!-- Item Detail Modal -->
{#if detailItem}
  <div class="fixed inset-0 z-40 grid place-items-center p-4">
    <button
      type="button"
      class="absolute inset-0 cursor-default bg-[#17211b]/30 backdrop-blur-[2px]"
      aria-label="ปิดรายละเอียดของ"
      on:click={() => (detailItem = null)}
    ></button>
    <div
      class="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-[#e8e5df] bg-white shadow-xl"
      role="dialog"
      aria-modal="true"
      aria-label="รายละเอียด {detailItem.name}"
    >
      <img
        src={detailItem.image}
        alt={detailItem.name}
        class="h-48 w-full object-cover"
      />
      <div class="p-5">
        <span class="rounded-md border border-[#e8e5df] bg-[#fbfaf7] px-2 py-0.5 font-mono text-[11px] text-[#4a6354]">
          {detailItem.category}
        </span>
        <h2 class="mt-2 text-base font-semibold text-ink">{detailItem.name}</h2>
        <p class="mt-2 text-xs leading-5 text-[#6c766e]">
          {detailItem.description}
        </p>
        <div class="mt-5 flex gap-2">
          <Button variant="outline" on:click={() => (detailItem = null)}>ปิด</Button>
          <Button
            disabled={detailItem.available === 0}
            on:click={() => {
              toggleItem(detailItem);
              detailItem = null;
            }}
          >
            เพิ่มในรายการยืม
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Toasts -->
{#if $toastMessage.text}
  <div class="toast {$toastMessage.type === 'error' ? 'error' : ''}">
    {#if $toastMessage.type !== 'error'}
      <CheckCircle2 size={18} strokeWidth={1.5} />
    {/if}
    <div>
      <b>{$toastMessage.type === 'error' ? 'เกิดข้อผิดพลาด' : 'สำเร็จ'}</b>
      <p>{$toastMessage.text}</p>
    </div>
    <button on:click={() => toastMessage.set({ type: '', text: '' })}>×</button>
  </div>
{/if}
