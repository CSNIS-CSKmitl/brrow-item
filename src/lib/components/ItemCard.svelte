<script>
  import { MapPin, Plus, Check } from '@lucide/svelte';
  import Button from './Button.svelte';
  import { canAdmin } from '../stores.js';
  export let item;
  export let selected = false;
  export let onSelect = () => {};
  export let onOpen = () => {};

  $: displayAvailable = Math.max(0, Number(item?.available) || 0);
  $: displayTotal = Math.max(0, Number(item?.total) || 0, displayAvailable);
</script>

<article class="group flex flex-col justify-between overflow-hidden rounded-xl border border-[#e8e5df] bg-white transition-colors duration-150 hover:border-[#cbcfcb]">
  <button class="block w-full text-left" on:click={onOpen} aria-label="ดูรายละเอียด {item.name}">
    <div class="relative h-48 overflow-hidden bg-[#edf0eb]">
      <img src={item.image} alt={item.name} class="h-full w-full object-cover" />
      <span class="absolute left-2.5 top-2.5 rounded-md border border-white/60 bg-white/95 px-2 py-0.5 font-mono text-[11px] text-[#4a6354]">
        {item.category}
      </span>
      {#if displayAvailable === 0}
        <div class="absolute inset-0 flex items-center justify-center bg-[#17211b]/40 backdrop-blur-[1px]">
          <span class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-[#17211b]">
            ถูกยืมหมดแล้ว
          </span>
        </div>
      {/if}
    </div>
  </button>
  <div class="flex flex-1 flex-col justify-between p-4">
    <div>
      <div class="mb-1.5 flex items-start justify-between gap-2">
        <h3 class="text-sm font-semibold leading-snug text-ink">{item.name}</h3>
      </div>
      <p class="mb-3 line-clamp-2 text-xs leading-5 text-[#6c766e]">{item.description}</p>
    </div>

    <div>
      <div class="mb-3 flex items-center justify-between text-xs text-[#8a918b]">
        <span class="flex items-center gap-1"><MapPin size={13} strokeWidth={1.5} />{item.location}</span>
        <span class="font-mono tabular-nums {displayAvailable > 0 ? 'text-[#2e6b4d]' : 'text-[#8a918b]'}">
          {#if $canAdmin}
            {displayAvailable}/{displayTotal} ชิ้นว่าง
          {:else}
            {displayAvailable > 0 ? 'พร้อมให้ยืม' : 'ไม่ว่าง'}
          {/if}
        </span>
      </div>
      <Button
        variant={selected ? 'selected' : displayAvailable === 0 ? 'disabled' : 'outline'}
        size="sm"
        disabled={displayAvailable === 0}
        on:click={() => onSelect(item)}
      >
        {#if selected}
          <Check size={14} strokeWidth={1.5} />
          <span>เพิ่มแล้วในรายการ</span>
        {:else}
          <Plus size={14} strokeWidth={1.5} />
          <span>เพิ่มในรายการยืม</span>
        {/if}
      </Button>
    </div>
  </div>
</article>
