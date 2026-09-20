<script>
  import { MapPin, Plus } from 'lucide-svelte';
  import Button from './Button.svelte';
  export let item;
  export let selected = false;
  export let onSelect = () => {};
  export let onOpen = () => {};
</script>

<article class="group overflow-hidden rounded-2xl border border-[#e8e5df] bg-white transition hover:-translate-y-1 hover:shadow-soft">
  <button class="block w-full text-left" on:click={onOpen} aria-label="ดูรายละเอียด {item.name}"><div class="relative h-52 overflow-hidden bg-[#edf0eb]"><img src={item.image} alt={item.name} class="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><span class="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-sage">{item.category}</span>{#if item.available === 0}<div class="absolute inset-0 flex items-center justify-center bg-ink/35"><span class="rounded-full bg-white px-4 py-2 text-xs font-bold text-ink">ถูกยืมหมดแล้ว</span></div>{/if}</div></button>
  <div class="p-4"><div class="mb-2 flex items-start justify-between gap-3"><h3 class="font-bold leading-snug text-ink">{item.name}</h3></div><p class="mb-4 line-clamp-2 text-sm leading-6 text-[#778078]">{item.description}</p><div class="mb-4 flex items-center justify-between text-xs text-[#8a918b]"><span class="flex items-center gap-1"><MapPin size={13} />{item.location}</span><span class:available={item.available > 0}>{item.available}/{item.total} ชิ้นว่าง</span></div><Button variant={selected ? 'selected' : item.available === 0 ? 'disabled' : 'outline'} size="sm" disabled={item.available === 0} on:click={() => onSelect(item)}><Plus size={16} />{selected ? 'เพิ่มแล้วในรายการ' : 'เพิ่มในรายการยืม'}</Button></div>
</article>
