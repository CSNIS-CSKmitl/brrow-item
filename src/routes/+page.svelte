<script>
  import { CheckCircle2, Search, SlidersHorizontal } from "lucide-svelte";
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
      (activeCategory === "ทั้งหมด" || item.category === activeCategory) &&
      `${item.name} ${item.description}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  $: shownItems = showAll ? filteredItems : filteredItems.slice(0, 6);
</script>

<main>

  {#if !$user}
    <section class="mx-auto max-w-7xl px-5 py-20 text-center lg:px-8">
      <h1 class="text-3xl font-bold tracking-tight text-ink">เข้าสู่ระบบเพื่อดูรายการ</h1>
      <a href="/login" class="mt-6 inline-flex rounded-xl bg-sage px-5 py-3 text-sm font-bold text-white">เข้าสู่ระบบ</a>
    </section>
  {:else}
  <!-- Catalog Section -->
  <section id="catalog" class="mx-auto max-w-7xl px-5 py-16 lg:px-8">
    <div class="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-ink">แคตตาล็อก</h1>
      </div>
      <div class="search-box">
        <Search size={18} />
        <input
          bind:value={search}
          placeholder="ค้นหาของที่อยากยืม..."
          aria-label="ค้นหา"
        />
        <SlidersHorizontal size={18} class="text-[#88928a]" />
      </div>
    </div>
    <div class="mb-8 flex gap-2 overflow-x-auto pb-1">
      {#each categories as category}
        <button
          class:active-category={activeCategory === category}
          class="category-pill"
          on:click={() => {
            activeCategory = category;
            showAll = false;
          }}
        >
          {category}
        </button>
      {/each}
    </div>
    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {#each shownItems as item}
        <ItemCard
          {item}
          selected={$selectedItems.some((selected) => selected.id === item.id)}
          onSelect={toggleItem}
          onOpen={() => (detailItem = item)}
        />
      {/each}
    </div>
    {#if shownItems.length === 0}
      <div class="rounded-2xl border border-dashed border-[#d8d8d0] py-16 text-center text-[#7c857e]">
        ไม่พบของที่ค้นหา ลองใช้คำอื่นดูนะ
      </div>
    {/if}
    {#if filteredItems.length > 6 && !showAll}
      <div class="mt-10 text-center">
        <Button variant="outline" on:click={() => (showAll = true)}>
          ดูทั้งหมด
        </Button>
      </div>
    {/if}
  </section>
  {/if}

</main>

<!-- Item Detail Modal -->
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
<!-- Toasts -->
{#if $toastMessage.text}
  <div class="toast {$toastMessage.type === 'error' ? 'error' : ''}">
    {#if $toastMessage.type !== 'error'}
      <CheckCircle2 size={21} />
    {/if}
    <div>
      <b>{$toastMessage.type === 'error' ? 'เกิดข้อผิดพลาด' : 'สำเร็จ'}</b>
      <p>{$toastMessage.text}</p>
    </div>
    <button on:click={() => toastMessage.set({ type: '', text: '' })}>×</button>
  </div>
{/if}
