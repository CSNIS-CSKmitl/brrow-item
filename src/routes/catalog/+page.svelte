<script>
  import { onDestroy } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { Search, X, SlidersHorizontal, PackageOpen } from "@lucide/svelte";
  import ItemCard from "../../lib/components/ItemCard.svelte";
  import Button from "../../lib/components/Button.svelte";
  import { items, itemsLoaded, itemsLoading, selectedItems, toggleItem } from "../../lib/stores.js";

  const PAGE_SIZE = 12;

  let detailItem = null;
  let searchQuery = "";
  let selectedCategory = "all";
  let onlyAvailable = false;
  let visibleCount = PAGE_SIZE;
  let observer = null;

  $: activeItems = $items.filter((item) => item.is_active !== false);

  $: categories = Array.from(
    new Set(activeItems.map((item) => String(item.category || "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "th"));

  $: filteredItems = activeItems.filter((item) => {
    if (selectedCategory !== "all" && String(item.category || "").trim() !== selectedCategory) {
      return false;
    }
    if (onlyAvailable && (Number(item.available) || 0) <= 0) {
      return false;
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      String(item.name || "").toLowerCase().includes(q) ||
      String(item.category || "").toLowerCase().includes(q) ||
      String(item.description || "").toLowerCase().includes(q) ||
      String(item.location || "").toLowerCase().includes(q)
    );
  });

  // Reset pagination when search or filters change
  $: {
    searchQuery;
    selectedCategory;
    onlyAvailable;
    visibleCount = PAGE_SIZE;
  }

  $: visibleItems = filteredItems.slice(0, visibleCount);
  $: hasMore = visibleCount < filteredItems.length;

  function loadMore() {
    if (visibleCount < filteredItems.length) {
      visibleCount = Math.min(filteredItems.length, visibleCount + PAGE_SIZE);
    }
  }

  function observeSentinel(node) {
    if (typeof IntersectionObserver === "undefined") return;
    if (observer) observer.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(node);
    return {
      destroy() {
        observer?.disconnect();
      },
    };
  }

  function clearFilters() {
    searchQuery = "";
    selectedCategory = "all";
    onlyAvailable = false;
  }

  onDestroy(() => {
    observer?.disconnect();
  });
</script>

<svelte:window
  on:keydown={(e) => {
    if (e.key === "Escape" && detailItem) detailItem = null;
  }}
/>

<main class="mx-auto max-w-7xl px-5 py-8 lg:px-8 animate-fade-in-up">
  <!-- Header + Search & Category Filters -->
  <div class="mb-7 space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-ink">แคตตาล็อก</h1>
        <p class="mt-1 text-sm text-[#737d75]">
          ค้นหาและเลือกอุปกรณ์ที่ต้องการยืม ({filteredItems.length} รายการ)
        </p>
      </div>

      <!-- Search Input -->
      <div class="relative w-full sm:w-80 md:w-96">
        <Search size={16} class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a948b]" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="ค้นหาชื่ออุปกรณ์ หมวดหมู่ หรือห้อง..."
          aria-label="ค้นหาอุปกรณ์ในแคตตาล็อก"
          class="w-full rounded-xl border border-[#dce3dc] bg-white py-2.5 pl-10 pr-9 text-sm text-ink shadow-2xs placeholder:text-[#96a097] focus:border-[var(--accent)] focus:outline-none transition"
        />
        {#if searchQuery}
          <button
            type="button"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#8a948b] hover:bg-black/5 hover:text-ink transition"
            aria-label="ล้างคำค้นหา"
            on:click={() => (searchQuery = "")}
          >
            <X size={14} />
          </button>
        {/if}
      </div>
    </div>

    <!-- Category Pills & Availability Toggle -->
    <div class="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[#e6e9e4] bg-white p-3 shadow-2xs">
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-bold transition active:scale-[0.97] {selectedCategory === 'all'
            ? 'bg-ink text-white shadow-xs'
            : 'bg-[#f3f5f2] text-[#5c675e] hover:bg-[#e7ece6]'}"
          on:click={() => (selectedCategory = "all")}
        >
          ทั้งหมด ({activeItems.length})
        </button>
        {#each categories as cat}
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 text-xs font-bold transition active:scale-[0.97] {selectedCategory === cat
              ? 'bg-sage text-white shadow-xs'
              : 'bg-[#f3f5f2] text-[#5c675e] hover:bg-[#e7ece6]'}"
            on:click={() => (selectedCategory = cat)}
          >
            {cat}
          </button>
        {/each}
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition active:scale-[0.97] {onlyAvailable
          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
          : 'border-[#dde3dd] bg-white text-[#5e6960] hover:bg-[#f4f7f4]'}"
        on:click={() => (onlyAvailable = !onlyAvailable)}
      >
        <SlidersHorizontal size={13} />
        เฉพาะพร้อมให้ยืม
      </button>
    </div>
  </div>

  <!-- Initial Loading Skeletons -->
  {#if $itemsLoading && !$itemsLoaded}
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="กำลังโหลดรายการของ">
      {#each Array(6) as _}
        <div class="overflow-hidden rounded-xl border border-[#e8e5df] bg-white">
          <div class="h-48 animate-pulse bg-gradient-to-r from-[#eef1ec] via-[#e3e8e0] to-[#eef1ec]"></div>
          <div class="space-y-3 p-4">
            <div class="h-4 w-2/3 animate-pulse rounded bg-[#e9ede7]"></div>
            <div class="h-3 w-full animate-pulse rounded bg-[#f0f2ee]"></div>
            <div class="flex justify-between pt-1">
              <div class="h-3 w-16 animate-pulse rounded bg-[#eef1ec]"></div>
              <div class="h-3 w-14 animate-pulse rounded bg-[#eef1ec]"></div>
            </div>
            <div class="h-9 w-full animate-pulse rounded-lg bg-[#e9ede7]"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if filteredItems.length === 0}
    <div class="rounded-2xl border border-dashed border-[#d8d8d0] bg-white py-16 text-center text-[#7c857e]">
      <div class="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#eef3ed] text-sage">
        <PackageOpen size={22} />
      </div>
      <p class="font-bold text-ink">
        {searchQuery.trim() || selectedCategory !== "all" || onlyAvailable
          ? "ไม่พบอุปกรณ์ที่ตรงกับเงื่อนไขการค้นหา"
          : "ยังไม่มีของให้ยืมในระบบ"}
      </p>
      {#if searchQuery.trim() || selectedCategory !== "all" || onlyAvailable}
        <button
          type="button"
          class="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-[#d4ddd4] bg-white px-4 py-2 text-xs font-bold text-ink hover:bg-[#f3f6f3] active:scale-[0.97] transition"
          on:click={clearFilters}
        >
          ล้างตัวกรองทั้งหมด
        </button>
      {/if}
    </div>
  {:else}
    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {#each visibleItems as item (item.id)}
        <ItemCard
          {item}
          selected={$selectedItems.some((selected) => selected.id === item.id)}
          onSelect={toggleItem}
          onOpen={() => (detailItem = item)}
        />
      {/each}
    </div>

    <!-- Lazy-loading sentinel + Skeleton placeholders when more items remain -->
    {#if hasMore}
      <div use:observeSentinel class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {#each Array(3) as _}
          <div class="overflow-hidden rounded-xl border border-[#e8e5df] bg-white opacity-75">
            <div class="h-48 animate-pulse bg-gradient-to-r from-[#eef1ec] via-[#e3e8e0] to-[#eef1ec]"></div>
            <div class="space-y-3 p-4">
              <div class="h-4 w-2/3 animate-pulse rounded bg-[#e9ede7]"></div>
              <div class="h-3 w-4/5 animate-pulse rounded bg-[#f0f2ee]"></div>
              <div class="h-9 w-full animate-pulse rounded-lg bg-[#e9ede7]"></div>
            </div>
          </div>
        {/each}
      </div>
      <div class="mt-6 text-center">
        <button
          type="button"
          class="rounded-xl border border-[#d6ded6] bg-white px-5 py-2.5 text-xs font-bold text-ink shadow-2xs hover:bg-[#f4f7f4] active:scale-[0.97] transition"
          on:click={loadMore}
        >
          โหลดเพิ่ม ({filteredItems.length - visibleCount} รายการที่เหลือ)
        </button>
      </div>
    {/if}
  {/if}
</main>

{#if detailItem}
  <div
    role="dialog"
    aria-modal="true"
    aria-label="รายละเอียด {detailItem.name}"
    class="fixed inset-0 z-[80] grid place-items-center p-5"
  >
    <button
      type="button"
      transition:fade={{ duration: 160 }}
      class="fixed inset-0 cursor-default bg-ink/35 backdrop-blur-[2px]"
      aria-label="ปิดรายละเอียดของ"
      on:click={() => (detailItem = null)}
    ></button>
    <div
      transition:scale={{ start: 0.94, duration: 200 }}
      class="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
    >
      <img
        src={detailItem.image}
        alt={detailItem.name}
        loading="lazy"
        decoding="async"
        class="max-h-[60vh] w-full bg-[#f6f7f4] object-contain p-3"
      />
      <div class="p-6">
        <p class="text-xs font-bold text-[var(--accent-ink)]">{detailItem.category}</p>
        <h2 class="mt-2 text-xl font-bold text-ink">{detailItem.name}</h2>
        <p class="mt-3 text-sm leading-7 text-[#778078]">
          {detailItem.description || "ไม่มีรายละเอียดเพิ่มเติม"}
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
