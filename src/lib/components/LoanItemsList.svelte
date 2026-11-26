<script>
  import { Package } from '@lucide/svelte';
  export let request;
  export let allItems = [];

  let failedImages = {};

  function resolveItems(req, catalog) {
    const raw = req?.expand?.items || req?.items || req?.itemIds || [];
    if (!Array.isArray(raw)) return [];
    return raw.map((entry) => {
      if (entry && typeof entry === 'object') {
        const fallback = catalog.find((c) => c.id === entry.id);
        const qty = Math.max(1, Number(req?.quantities?.[entry.id]) || 1);
        return {
          id: entry.id,
          name: entry.name || fallback?.name || entry.id,
          category: entry.category || fallback?.category || '',
          image: entry.image || fallback?.image || '',
          qty,
        };
      }
      const found = catalog.find((c) => c.id === entry);
      const qty = Math.max(1, Number(req?.quantities?.[entry]) || 1);
      return {
        id: entry,
        name: found?.name || String(entry),
        category: found?.category || '',
        image: found?.image || '',
        qty,
      };
    });
  }

  $: resolvedItems = resolveItems(request, allItems);
</script>

{#if resolvedItems.length > 0}
  <div class="mt-2">
    <p class="text-xs font-semibold text-[#778078] mb-1.5">อุปกรณ์ที่ขอยืม ({resolvedItems.length} รายการ)</p>
    <div class="flex flex-wrap gap-2">
      {#each resolvedItems as item (item.id)}
        <div class="flex items-center gap-2.5 rounded-xl border border-[#e6e3dc] bg-[#fafaf7] px-2.5 py-2 pr-3 shadow-2xs">
          {#if item.image && !failedImages[item.id]}
            <img
              src={item.image}
              alt={item.name}
              class="h-12 w-12 shrink-0 rounded-lg border border-[#e7e5df] bg-white object-contain p-0.5"
              loading="lazy"
              on:error={() => {
                failedImages = { ...failedImages, [item.id]: true };
              }}
            />
          {:else}
            <div class="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-[#e7e5df] bg-white text-[#9aa29b]">
              <Package size={20} />
            </div>
          {/if}
          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-ink max-w-[200px] sm:max-w-[240px]" title={item.name}>{item.name}</p>
            <div class="mt-0.5 flex items-center gap-1.5">
              {#if item.category}
                <span class="truncate text-[11px] text-[#818981] max-w-[140px]">{item.category}</span>
              {/if}
              <span class="inline-flex items-center rounded-md bg-[#eef4ee] px-1.5 py-0.5 text-[11px] font-bold text-[#2d5236] border border-[#d3e3d4]">
                × {item.qty}
              </span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
{:else}
  <p class="text-sm text-[#778078]">ของที่ขอยืม: -</p>
{/if}
