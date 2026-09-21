<script>
  import { onMount, onDestroy } from 'svelte';
  import {
    Bell,
    ChevronRight,
    Clock3,
    LogOut,
    Menu,
    Package,
    Shield,
    User,
    UserRound,
    X,
  } from 'lucide-svelte';
  import { user, userType } from '../stores.js';

  export let loanCount = 0;
  export let onOpenLoans = () => {};
  export let onLogout = () => {};
  export let canAdmin = false;
  export let canApprove = false;

  let menuOpen = false;
  let profileOpen = false;
  let showProfileModal = false;
  let profileContainer = null;

  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  const activeClass = (path) => (currentPath === path ? 'text-ink font-bold' : 'text-[#68726b] hover:text-ink');

  function roleTitle(type) {
    if (type === 'superadmin') return 'ผู้ดูแลระบบสูงสุด (Superadmin)';
    if (type === 'admin') return 'ผู้ดูแลระบบ (Admin)';
    if (type === 'teachers') return 'อาจารย์ (Teacher)';
    if (type === 'students') return 'นักศึกษา (Student)';
    if (type === 'staff') return 'เจ้าหน้าที่ (Staff)';
    return 'ผู้ใช้งานระบบ (User)';
  }

  function roleBadgeColor(type) {
    if (type === 'superadmin') return 'bg-amber-100 text-amber-800 border-amber-200';
    if (type === 'admin') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (type === 'teachers') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (type === 'students') return 'bg-purple-100 text-purple-800 border-purple-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  }

  function formatDate(val) {
    if (!val) return '-';
    const d = new Date(val);
    return Number.isNaN(d.getTime())
      ? val
      : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function handleClickOutside(event) {
    if (profileOpen && profileContainer && !profileContainer.contains(event.target)) {
      profileOpen = false;
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      profileOpen = false;
      showProfileModal = false;
    }
  }

  onMount(() => {
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('click', handleClickOutside);
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

<header class="border-b border-[#e7e5df] bg-cream/90 backdrop-blur">
  <div class="mx-auto max-w-7xl px-5 py-4 lg:px-8">
    <div class="flex items-center justify-between">
      <a class="flex items-center gap-3" href="/">
        <div class="brand-mark"><Package size={20} strokeWidth={2.5} /></div>
        <span class="text-xl font-bold tracking-tight text-ink">borrowly<span class="text-clay">.</span></span>
      </a>

      <nav class="hidden items-center gap-8 text-sm font-medium md:flex">
        <a class={activeClass('/catalog')} href="/catalog">แคตตาล็อก</a>
        <a class={activeClass('/requests')} href="/requests">คำขอยืม</a>
        {#if canApprove}
          <a class={activeClass('/approvals')} href="/approvals">อนุมัติคำขอ</a>
        {/if}
        <a class={activeClass('/how')} href="/how">วิธีใช้งาน</a>
        <a class={activeClass('/about')} href="/about">เกี่ยวกับเรา</a>
        {#if canAdmin}
          <a class={activeClass('/admin')} href="/admin">แอดมิน</a>
        {/if}
      </nav>

      <div class="flex items-center gap-2">
        <button class="icon-btn hidden sm:inline-flex" aria-label="การแจ้งเตือน"><Bell size={19} /></button>

        <button class="loan-pill" on:click={onOpenLoans}>
          <Package size={17} />
          <span>รายการยืม</span>
          {#if loanCount}<b>{loanCount}</b>{/if}
        </button>

        <!-- Profile Button & Option Menu -->
        <div class="relative" bind:this={profileContainer}>
          <button
            class="icon-btn {profileOpen ? 'border-sage ring-2 ring-sage/20' : ''}"
            aria-label="โปรไฟล์และตัวเลือกผู้ใช้งาน"
            title="โปรไฟล์และตัวเลือก"
            on:click|stopPropagation={() => (profileOpen = !profileOpen)}
          >
            <UserRound size={19} />
          </button>

          {#if profileOpen}
            <div
              class="absolute right-0 top-12 z-50 w-72 origin-top-right rounded-2xl border border-[#e2e5df] bg-white p-3 shadow-xl backdrop-blur-md"
            >
              <!-- Profile Summary Card -->
              <div class="flex items-center gap-3 rounded-xl bg-[#f5f8f5] p-3 border border-[#e6eee6]">
                <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sage text-white font-bold text-base shadow-xs">
                  {($user?.name || $user?.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-bold text-ink">
                    {$user?.name || $user?.email || 'ผู้ใช้งาน'}
                  </p>
                  <p class="truncate text-xs text-[#717b73]">
                    {$user?.email || '-'}
                  </p>
                  <span class="mt-1 inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold {roleBadgeColor($userType)}">
                    {roleTitle($userType)}
                  </span>
                </div>
              </div>

              <!-- Options List -->
              <div class="mt-2 space-y-1">
                <!-- Option 1: View Profile Details -->
                <button
                  type="button"
                  class="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#4e5850] hover:bg-[#f2f6f2] hover:text-ink transition"
                  on:click={() => {
                    profileOpen = false;
                    showProfileModal = true;
                  }}
                >
                  <span class="flex items-center gap-2.5">
                    <User size={15} class="text-sage" />
                    ข้อมูลโปรไฟล์
                  </span>
                  <ChevronRight size={13} class="text-[#a0aaa1]" />
                </button>

                <!-- Option 2: My Loan Requests -->
                <a
                  href="/requests"
                  class="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#4e5850] hover:bg-[#f2f6f2] hover:text-ink transition"
                  on:click={() => (profileOpen = false)}
                >
                  <span class="flex items-center gap-2.5">
                    <Clock3 size={15} class="text-sage" />
                    คำขอยืมของฉัน
                  </span>
                  <ChevronRight size={13} class="text-[#a0aaa1]" />
                </a>

                <!-- Option 3: Approvals (Teacher or Admin) -->
                {#if canApprove}
                  <a
                    href="/approvals"
                    class="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#4e5850] hover:bg-[#f2f6f2] hover:text-ink transition"
                    on:click={() => (profileOpen = false)}
                  >
                    <span class="flex items-center gap-2.5">
                      <Package size={15} class="text-sage" />
                      อนุมัติคำขอยืม
                    </span>
                    <ChevronRight size={13} class="text-[#a0aaa1]" />
                  </a>
                {/if}

                <!-- Option 4: Admin Management (Superadmin) -->
                {#if canAdmin}
                  <a
                    href="/admin"
                    class="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#4e5850] hover:bg-[#f2f6f2] hover:text-ink transition"
                    on:click={() => (profileOpen = false)}
                  >
                    <span class="flex items-center gap-2.5">
                      <Shield size={15} class="text-sage" />
                      ระบบผู้ดูแล (Admin)
                    </span>
                    <ChevronRight size={13} class="text-[#a0aaa1]" />
                  </a>
                {/if}

                <div class="my-1.5 border-t border-[#edf1ec]"></div>

                <!-- Option 5: Logout -->
                <button
                  type="button"
                  class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#b44b3e] hover:bg-[#fff2f0] transition"
                  on:click={() => {
                    profileOpen = false;
                    onLogout();
                  }}
                >
                  <LogOut size={15} />
                  ออกจากระบบ
                </button>
              </div>
            </div>
          {/if}
        </div>

        <button class="icon-btn md:hidden" aria-label="เมนู" aria-expanded={menuOpen} on:click={() => (menuOpen = !menuOpen)}>
          <Menu size={19} />
        </button>
      </div>
    </div>

    {#if menuOpen}
      <nav class="mt-4 grid gap-1 border-t border-[#e7e5df] pt-3 text-sm font-medium md:hidden">
        <a class="rounded-lg px-3 py-2 {activeClass('/catalog')} hover:bg-white" href="/catalog">แคตตาล็อก</a>
        <a class="rounded-lg px-3 py-2 {activeClass('/requests')} hover:bg-white" href="/requests">คำขอยืม</a>
        {#if canApprove}
          <a class="rounded-lg px-3 py-2 {activeClass('/approvals')} hover:bg-white" href="/approvals">อนุมัติคำขอ</a>
        {/if}
        <a class="rounded-lg px-3 py-2 {activeClass('/how')} hover:bg-white" href="/how">วิธีใช้งาน</a>
        <a class="rounded-lg px-3 py-2 {activeClass('/about')} hover:bg-white" href="/about">เกี่ยวกับเรา</a>
        {#if canAdmin}
          <a class="rounded-lg px-3 py-2 {activeClass('/admin')} hover:bg-white" href="/admin">แอดมิน</a>
        {/if}
      </nav>
    {/if}
  </div>
</header>

<!-- Detailed Profile Modal -->
{#if showProfileModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
    <div class="w-full max-w-md rounded-3xl border border-[#e2e6df] bg-white p-6 shadow-2xl">
      <div class="flex items-center justify-between border-b border-[#eef2ec] pb-4">
        <div class="flex items-center gap-2.5">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef4ee] text-sage">
            <User size={18} />
          </div>
          <div>
            <h3 class="text-lg font-bold text-ink leading-tight">ข้อมูลโปรไฟล์</h3>
            <p class="text-xs text-[#7c867e]">รายละเอียดบัญชีผู้ใช้งานของคุณ</p>
          </div>
        </div>
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e4e7e1] text-[#717b73] hover:bg-[#f2f5f1] transition"
          on:click={() => (showProfileModal = false)}
        >
          <X size={16} />
        </button>
      </div>

      <div class="mt-5 space-y-4">
        <!-- Avatar & Name banner -->
        <div class="flex items-center gap-4 rounded-2xl bg-[#f6f9f5] p-4 border border-[#e5ece5]">
          <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sage text-white text-xl font-bold shadow-xs">
            {($user?.name || $user?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div class="min-w-0 flex-1">
            <h4 class="truncate text-base font-bold text-ink">{$user?.name || $user?.email}</h4>
            <p class="truncate text-xs text-[#6e7770]">{$user?.email}</p>
            <span class="mt-1.5 inline-block rounded-md border px-2.5 py-0.5 text-xs font-bold {roleBadgeColor($userType)}">
              {roleTitle($userType)}
            </span>
          </div>
        </div>

        <!-- Details List -->
        <div class="space-y-2.5 text-xs">
          <div class="flex justify-between rounded-xl bg-[#fafbf9] px-3.5 py-2.5 border border-[#edf1ec]">
            <span class="font-medium text-[#778078]">ชื่อ-นามสกุล</span>
            <span class="font-bold text-ink">{$user?.name || '-'}</span>
          </div>

          <div class="flex justify-between rounded-xl bg-[#fafbf9] px-3.5 py-2.5 border border-[#edf1ec]">
            <span class="font-medium text-[#778078]">อีเมล</span>
            <span class="font-bold text-ink">{$user?.email || '-'}</span>
          </div>

          <div class="flex justify-between rounded-xl bg-[#fafbf9] px-3.5 py-2.5 border border-[#edf1ec]">
            <span class="font-medium text-[#778078]">ชื่อผู้ใช้ (Username)</span>
            <span class="font-mono font-bold text-ink">{$user?.username || '-'}</span>
          </div>

          <div class="flex justify-between rounded-xl bg-[#fafbf9] px-3.5 py-2.5 border border-[#edf1ec]">
            <span class="font-medium text-[#778078]">บทบาทในระบบ</span>
            <span class="font-bold text-sage">{roleTitle($userType)}</span>
          </div>

          <div class="flex justify-between rounded-xl bg-[#fafbf9] px-3.5 py-2.5 border border-[#edf1ec]">
            <span class="font-medium text-[#778078]">รหัสผู้ใช้งาน (ID)</span>
            <span class="font-mono text-[11px] text-[#556056]">{$user?.id || '-'}</span>
          </div>

          <div class="flex justify-between rounded-xl bg-[#fafbf9] px-3.5 py-2.5 border border-[#edf1ec]">
            <span class="font-medium text-[#778078]">วันที่สร้างบัญชี</span>
            <span class="font-bold text-ink">{formatDate($user?.created)}</span>
          </div>
        </div>
      </div>

      <div class="mt-6 flex justify-end">
        <button
          type="button"
          class="rounded-xl border border-[#c9d3c9] bg-[#f0f4ef] px-5 py-2 text-xs font-bold text-[#445046] hover:bg-[#e4ede3] transition"
          on:click={() => (showProfileModal = false)}
        >
          ปิดหน้าต่าง
        </button>
      </div>
    </div>
  </div>
{/if}
