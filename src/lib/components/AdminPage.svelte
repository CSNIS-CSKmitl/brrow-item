<script>
  import { Trash2, Plus, PackageOpen } from 'lucide-svelte';
  import Button from './Button.svelte';

  export let items = [];
  export let onAdd = () => {};
  export let onDelete = () => {};

  const emptyForm = () => ({ name: '', category: 'อุปกรณ์ไอที', description: '', image: '', available: 1, total: 1, location: '' });
  let form = emptyForm();
  let error = '';
  let saving = false;
  let deletingId = '';

  async function submit() {
    error = '';
    const total = Number(form.total);
    const available = Number(form.available);
    if (!Number.isInteger(total) || total < 1 || !Number.isInteger(available) || available < 0 || available > total) {
      error = 'จำนวนพร้อมให้ยืมต้องอยู่ระหว่าง 0 ถึงจำนวนทั้งหมด';
      return;
    }
    saving = true;
    try {
      await onAdd({ ...form, total, available });
      form = emptyForm();
    } catch (cause) {
      error = cause?.response?.message || 'เพิ่มรายการไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ PocketBase';
    } finally {
      saving = false;
    }
  }

  async function remove(item) {
    error = '';
    deletingId = item.id;
    try {
      await onDelete(item);
    } catch (cause) {
      error = cause?.response?.message || 'ลบรายการไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ PocketBase';
    } finally {
      deletingId = '';
    }
  }
</script>

<main class="mx-auto max-w-7xl px-5 py-12 lg:px-8">
  <div class="mb-8"><p class="eyebrow"><PackageOpen size={14}/> ADMIN</p><h1 class="mt-2 text-3xl font-bold text-ink">จัดการของยืม</h1><p class="mt-2 text-sm text-[#7c857e]">เพิ่มหรือลบรายการของได้จากหน้านี้</p></div>
  <div class="grid gap-8 lg:grid-cols-[380px_1fr]">
    <form class="h-fit space-y-4 rounded-2xl border border-[#e4e5de] bg-white p-6" on:submit|preventDefault={submit}>
      <h2 class="text-lg font-bold text-ink">เพิ่มของใหม่</h2>
      <label>ชื่อของ<input bind:value={form.name} required placeholder="เช่น เต็นท์" /></label>
      <label>หมวดหมู่<input bind:value={form.category} required /></label>
      <label>รายละเอียด<textarea bind:value={form.description} rows="3" required></textarea></label>
      <label>URL รูปภาพ<input bind:value={form.image} required placeholder="https://..." /></label>
      <div class="grid grid-cols-2 gap-3"><label>จำนวนทั้งหมด<input type="number" min="1" step="1" bind:value={form.total} /></label><label>พร้อมให้ยืม<input type="number" min="0" step="1" bind:value={form.available} /></label></div>
      <label>สถานที่จัดเก็บ<input bind:value={form.location} required /></label>
      {#if error}<p class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>{/if}
      <Button disabled={saving}>{#if saving}กำลังบันทึก...{:else}<Plus size={17}/>เพิ่มรายการ{/if}</Button>
    </form>
    <div class="space-y-3">
      {#if items.length === 0}<div class="rounded-2xl border border-dashed border-[#d8d8d0] py-16 text-center text-[#7c857e]">ยังไม่มีของในระบบ เพิ่มรายการแรกจากฟอร์มนี้ได้เลย</div>{/if}
      {#each items as item}
        <div class="flex items-center gap-4 rounded-2xl border border-[#e4e5de] bg-white p-4"><img src={item.image} alt="" class="h-16 w-16 rounded-xl object-cover"/><div class="min-w-0 flex-1"><h3 class="font-bold text-ink">{item.name}</h3><p class="mt-1 text-xs text-[#7c857e]">{item.category} · ว่าง {item.available}/{item.total} ชิ้น</p></div><button class="icon-btn text-red-500 disabled:cursor-not-allowed disabled:opacity-50" aria-label="ลบ {item.name}" disabled={deletingId === item.id} on:click={() => remove(item)}><Trash2 size={17}/></button></div>
      {/each}
    </div>
  </div>
</main>
