<script>
  import ItemCard from "../../lib/components/ItemCard.svelte";
  import Button from "../../lib/components/Button.svelte";
  import { items, itemsLoaded, itemsLoading, selectedItems, toggleItem } from "../../lib/stores.js";

  let detailItem = null;
</script>

<main class="mx-auto max-w-7xl px-5 py-12 lg:px-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-ink">แคตตาล็อก</h1>
  </div>
  {#if $itemsLoading && !$itemsLoaded}
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="กำลังโหลดรายการของ">
      {#each Array(3) as _}
        <div class="overflow-hidden rounded-2xl border border-[#e4e5de] bg-white">
          <div class="h-52 animate-pulse bg-[#e9ede7]"></div>
          <div class="space-y-3 p-4">
            <div class="h-5 w-2/3 animate-pulse rounded bg-[#e9ede7]"></div>
            <div class="h-4 w-full animate-pulse rounded bg-[#f0f2ee]"></div>
            <div class="h-10 w-full animate-pulse rounded-xl bg-[#e9ede7]"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if $items.length === 0}
    <div class="rounded-2xl border border-dashed border-[#d8d8d0] py-16 text-center text-[#7c857e]">
      ยังไม่มีของให้ยืมในระบบ
    </div>
  {:else}
    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {#each $items as item}
        <ItemCard
          {item}
          selected={$selectedItems.some((selected) => selected.id === item.id)}
          onSelect={toggleItem}
          onOpen={() => (detailItem = item)}
        />
      {/each}
    </div>
  {/if}
</main>

{#if detailItem}
  <div class="fixed inset-0 z-40 grid place-items-center p-5">
    <button
      type="button"
      class="absolute inset-0 cursor-default bg-ink/30"
      aria-label="ปิดรายละเอียดของ"
      on:click={() => (detailItem = null)}
    ></button>
    <div
      class="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="รายละเอียด {detailItem.name}"
    >
      <img
        src={detailItem.image}
        alt={detailItem.name}
        class="h-52 w-full object-cover"
      />
      <div class="p-6">
        <p class="text-xs font-bold text-sage">{detailItem.category}</p>
        <h2 class="mt-2 text-xl font-bold text-ink">{detailItem.name}</h2>
        <p class="mt-3 text-sm leading-7 text-[#778078]">
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
