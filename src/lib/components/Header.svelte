<script>
  import { Bell, Menu, Package, UserRound } from 'lucide-svelte';
  export let loanCount = 0;
  export let onOpenLoans = () => {};
  export let onLogout = () => {};
  export let canAdmin = false;
  let menuOpen = false;
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  const activeClass = (path) => currentPath === path ? 'text-ink font-bold' : 'text-[#68726b] hover:text-ink';
</script>

<header class="border-b border-[#e7e5df] bg-cream/90 backdrop-blur">
  <div class="mx-auto max-w-7xl px-5 py-4 lg:px-8">
    <div class="flex items-center justify-between">
    <div class="flex items-center gap-3"><div class="brand-mark"><Package size={20} strokeWidth={2.5} /></div><span class="text-xl font-bold tracking-tight text-ink">borrowly<span class="text-clay">.</span></span></div>
    <nav class="hidden items-center gap-8 text-sm font-medium md:flex"><a class={activeClass('/catalog')} href="/catalog">แคตตาล็อก</a><a class={activeClass('/approvals')} href="/approvals">คำขอยืม</a><a class={activeClass('/how')} href="/how">วิธีใช้งาน</a><a class={activeClass('/about')} href="/about">เกี่ยวกับเรา</a>{#if canAdmin}<a class={activeClass('/admin')} href="/admin">แอดมิน</a>{/if}</nav>
    <div class="flex items-center gap-2"><button class="icon-btn hidden sm:inline-flex" aria-label="การแจ้งเตือน"><Bell size={19}/></button><button class="loan-pill" on:click={onOpenLoans}><Package size={17}/><span>รายการยืม</span>{#if loanCount}<b>{loanCount}</b>{/if}</button><button class="icon-btn" aria-label="ออกจากระบบ" title="ออกจากระบบ" on:click={onLogout}><UserRound size={19}/></button><button class="icon-btn md:hidden" aria-label="เมนู" aria-expanded={menuOpen} on:click={() => menuOpen = !menuOpen}><Menu size={19}/></button></div>
    </div>
    {#if menuOpen}
      <nav class="mt-4 grid gap-1 border-t border-[#e7e5df] pt-3 text-sm font-medium md:hidden"><a class="rounded-lg px-3 py-2 {activeClass('/catalog')} hover:bg-white" href="/catalog">แคตตาล็อก</a><a class="rounded-lg px-3 py-2 {activeClass('/approvals')} hover:bg-white" href="/approvals">คำขอยืม</a><a class="rounded-lg px-3 py-2 {activeClass('/how')} hover:bg-white" href="/how">วิธีใช้งาน</a><a class="rounded-lg px-3 py-2 {activeClass('/about')} hover:bg-white" href="/about">เกี่ยวกับเรา</a>{#if canAdmin}<a class="rounded-lg px-3 py-2 {activeClass('/admin')} hover:bg-white" href="/admin">แอดมิน</a>{/if}</nav>
    {/if}
  </div>
</header>
