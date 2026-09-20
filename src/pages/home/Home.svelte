<script>
  import { ArrowRight, CheckCircle2, Search, SlidersHorizontal, Sparkles, UsersRound } from "lucide-svelte";
  import ItemCard from "../../lib/components/ItemCard.svelte";
  import Button from "../../lib/components/Button.svelte";
  import { categories } from "../../lib/mock-data.js";

  export let items = [];
  export let selectedItems = [];
  export let onToggleItem = () => {};
  export let submitted = false;
  export let submitError = "";
  export let workflowError = "";
  export let onResetSubmitted = () => {};
  export let onClearSubmitError = () => {};
  export let onClearWorkflowError = () => {};

  let search = "";
  let activeCategory = "ทั้งหมด";
  let showAll = false;
  let detailItem = null;

  $: filteredItems = items.filter(
    (item) =>
      (activeCategory === "ทั้งหมด" || item.category === activeCategory) &&
      `${item.name} ${item.description}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  $: shownItems = showAll ? filteredItems : filteredItems.slice(0, 6);
</script>

<main>
  <!-- Hero Section -->
  <section class="hero-wrap">
    <div class="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
      <div>
        <div class="eyebrow">
          <Sparkles size={14} /> แชร์ของดี ให้ทุกคนได้ใช้
        </div>
        <h1 class="mt-5 max-w-xl text-5xl font-extrabold leading-[1.08] tracking-[-.04em] text-ink sm:text-6xl">
          ของที่อยากใช้<br /><span class="text-sage">ไม่จำเป็นต้องซื้อ</span>
        </h1>
        <p class="mt-6 max-w-lg text-base leading-8 text-[#6f7971]">
          ยืมของจากคนในชุมชนได้ง่าย ๆ ประหยัดเงิน ลดของเหลือใช้
          และได้พบกับไอเทมที่ช่วยให้ชีวิตสะดวกขึ้น
        </p>
        <a href="#catalog">
          <Button size="lg">เริ่มเลือกของที่อยากยืม <ArrowRight size={18} /></Button>
        </a>
        <div class="mt-8 flex items-center gap-6 text-sm text-[#778078]">
          <span class="flex items-center gap-2"><CheckCircle2 size={17} class="text-sage" /> ยืมง่าย ไม่มีค่าธรรมเนียม</span>
          <span class="hidden items-center gap-2 sm:flex"><UsersRound size={17} class="text-sage" /> สมาชิก 1,240 คน</span>
        </div>
      </div>
      <div class="hero-art">
        <div class="floating-note">
          <span class="status-dot"></span>
          <div><b>พร้อมให้ยืม</b><small>อัปเดตเมื่อสักครู่นี้</small></div>
        </div>
        <img
          src="https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?auto=format&fit=crop&w=1000&q=85"
          alt="คนกำลังจัดของสำหรับการเดินทาง"
        />
      </div>
    </div>
  </section>

  <!-- Catalog Section -->
  <section id="catalog" class="mx-auto max-w-7xl px-5 py-16 lg:px-8">
    <div class="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div>
        <p class="eyebrow">EXPLORE THE LIBRARY</p>
        <h2 class="mt-2 text-3xl font-bold tracking-tight text-ink">
          เลือกของที่คุณต้องการ
        </h2>
        <p class="mt-2 text-sm text-[#7c857e]">
          มีของดี ๆ จากสมาชิกในชุมชนรอให้คุณค้นพบ
        </p>
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
          selected={selectedItems.some((selected) => selected.id === item.id)}
          onSelect={onToggleItem}
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
          ดูของทั้งหมด <ArrowRight size={17} />
        </Button>
      </div>
    {/if}
  </section>

  <!-- How It Works Section -->
  <section id="how" class="bg-[#eef2ed] px-5 py-16">
    <div class="mx-auto max-w-7xl">
      <div class="text-center">
        <p class="eyebrow justify-center">HOW IT WORKS</p>
        <h2 class="mt-2 text-3xl font-bold text-ink">
          ยืมของ ง่ายกว่าที่คิด
        </h2>
      </div>
      <div class="mt-10 grid gap-5 md:grid-cols-3">
        <div class="step-card">
          <span>01</span>
          <h3>ค้นหาของที่ใช่</h3>
          <p>เลือกดูของจากหมวดหมู่ หรือค้นหาด้วยคำที่ต้องการ</p>
        </div>
        <div class="step-card">
          <span>02</span>
          <h3>ส่งคำขอยืม</h3>
          <p>เพิ่มของในรายการ กรอกข้อมูล แล้วเลือกวันที่ต้องการคืน</p>
        </div>
        <div class="step-card">
          <span>03</span>
          <h3>รับของไปใช้</h3>
          <p>รอการยืนยันจากเจ้าของ แล้วนัดรับของได้เลย</p>
        </div>
      </div>
    </div>
  </section>

  <!-- About Section -->
  <section id="about" class="mx-auto max-w-7xl px-5 py-16 lg:px-8">
    <div class="rounded-3xl bg-ink px-7 py-10 text-white md:flex md:items-center md:justify-between md:px-12">
      <div>
        <p class="text-xs font-bold uppercase tracking-[.16em] text-[#b7d2bc]">
          ABOUT BORROWLY
        </p>
        <h2 class="mt-3 text-3xl font-bold">ยืมของได้ ใช้ทรัพยากรให้คุ้ม</h2>
        <p class="mt-3 max-w-xl text-sm leading-7 text-[#c7d0c8]">
          พื้นที่เล็ก ๆ สำหรับแบ่งปันของที่ไม่ได้ใช้ทุกวัน
          ให้คนในชุมชนเข้าถึงของดีได้ง่ายขึ้น
        </p>
      </div>
      <a
        href="#catalog"
        class="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-ink md:mt-0"
      >
        เริ่มเลือกของ <ArrowRight size={16} />
      </a>
    </div>
  </section>
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

<!-- Toasts -->
{#if submitted}
  <div class="toast">
    <CheckCircle2 size={21} />
    <div>
      <b>ส่งคำขอเรียบร้อยแล้ว</b>
      <p>เจ้าของจะติดต่อกลับเพื่อยืนยันการยืม</p>
    </div>
    <button on:click={onResetSubmitted}>×</button>
  </div>
{/if}

{#if submitError}
  <div class="toast error">
    <div>
      <b>ส่งคำขอไม่สำเร็จ</b>
      <p>{submitError}</p>
    </div>
    <button on:click={onClearSubmitError}>×</button>
  </div>
{/if}

{#if workflowError}
  <div class="toast error">
    <div>
      <b>อัปเดตสถานะไม่สำเร็จ</b>
      <p>{workflowError}</p>
    </div>
    <button on:click={onClearWorkflowError}>×</button>
  </div>
{/if}

<footer class="border-t border-[#e7e5df] bg-cream px-5 py-8 text-center text-sm text-[#879087]">
  © 2025 borrowly · แบ่งปันของดี ให้ชุมชนน่าอยู่ขึ้น
</footer>
