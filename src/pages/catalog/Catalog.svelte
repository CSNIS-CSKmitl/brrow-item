<script>
  import ItemCard from "../../lib/components/ItemCard.svelte";
  import Button from "../../lib/components/Button.svelte";

  export let items = [];
  export let selectedItems = [];
  export let onToggleItem = () => {};

  let detailItem = null;
</script>

<main class="mx-auto max-w-7xl px-5 py-16 lg:px-8">
  <div class="mb-10">
    <p class="eyebrow">EXPLORE THE LIBRARY</p>
    <h1 class="mt-2 text-4xl font-bold text-ink">แคตตาล็อกของทั้งหมด</h1>
    <p class="mt-3 text-[#7c857e]">ค้นหาและเลือกของที่ต้องการยืมจากชุมชน</p>
  </div>
  {#if items.length === 0}
    <div class="rounded-2xl border border-dashed border-[#d8d8d0] py-16 text-center text-[#7c857e]">
      ยังไม่มีของให้ยืมในระบบ
    </div>
  {:else}
    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {#each items as item}
        <ItemCard
          {item}
          selected={selectedItems.some((selected) => selected.id === item.id)}
          onSelect={onToggleItem}
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
              onToggleItem(detailItem);
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
