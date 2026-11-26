<script>
  import { MapPin, Plus, Check, Package } from '@lucide/svelte';
  import Button from './Button.svelte';
  import { canAdmin } from '../stores.js';
  export let item;
  export let selected = false;
  export let onSelect = () => {};
  export let onOpen = () => {};

  let imgLoaded = false;
  let imgError = false;
  let imgEl = null;

  $: if (item?.image) {
    if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
      imgLoaded = true;
      imgError = false;
    }
  }

  $: displayAvailable = Math.max(0, Number(item?.available) || 0);
  $: displayTotal = Math.max(0, Number(item?.total) || 0, displayAvailable);
</script>

<article class="group flex flex-col justify-between overflow-hidden rounded-xl border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md {selected ? 'border-blue-400/70 ring-2 ring-blue-500/15 shadow-xs' : 'border-[#e8e5df] hover:border-[#cbcfcb]'}">
  <button class="block w-full text-left" on:click={onOpen} aria-label="ดูรายละเอียด {item.name}">
    <div class="relative h-48 overflow-hidden bg-[#f6f7f4]">
      {#if item?.image && !imgError}
        {#if !imgLoaded}
          <div class="absolute inset-0 animate-pulse bg-gradient-to-r from-[#eef1ec] via-[#e3e8e0] to-[#eef1ec]"></div>
        {/if}
        <img
          bind:this={imgEl}
          src={item.image}
          alt={item.name}
          loading="lazy"
          decoding="async"
          on:load={() => { imgLoaded = true; }}
          on:error={() => { imgError = true; imgLoaded = true; }}
          class="h-full w-full object-contain p-2 transition-all duration-300 ease-out group-hover:scale-[1.05] {imgLoaded ? 'opacity-100' : 'opacity-0'}"
        />
      {:else}
        <div class="grid h-full w-full place-items-center text-[#a3ada4]">
          <Package size={36} strokeWidth={1.4} />
        </div>
      {/if}
      <span class="absolute left-2.5 top-2.5 rounded-md border border-white/60 bg-white/95 px-2 py-0.5 font-mono text-[11px] text-[#4a6354]">
        {item.category}
      </span>
      {#if selected}
        <span class="animate-badge-pop absolute right-2.5 top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-sm">
          <Check size={13} strokeWidth={2.5} />
        </span>
      {/if}
      {#if displayAvailable === 0}
        <div class="absolute inset-0 flex items-center justify-center bg-[#17211b]/40 ">
          <span class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-[var(--text)]">
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
        {#key selected}
          {#if selected}
            <span class="animate-check-pop inline-flex items-center">
              <Check size={14} strokeWidth={2} />
            </span>
            <span>เพิ่มแล้วในรายการ</span>
          {:else}
            <Plus size={14} strokeWidth={1.75} />
            <span>เพิ่มในรายการยืม</span>
          {/if}
        {/key}
      </Button>
    </div>
  </div>
</article>
