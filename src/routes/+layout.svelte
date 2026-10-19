<script>
  import '../app.css';
  import { onDestroy } from 'svelte';
  import { page } from '$app/state';
  import Header from '../lib/components/Header.svelte';
  import LoanPanel from '../lib/components/LoanPanel.svelte';
  import LegalConsent from '../lib/components/LegalConsent.svelte';
  import AnnouncementCenter from '../lib/components/AnnouncementCenter.svelte';
  import UnauthorizedPage from '../lib/components/UnauthorizedPage.svelte';
  import {
    user,
    canAdmin,
    isTeacherOrAdmin,
    selectedItems,
    panelOpen,
    teachers,
    userType,
    submitLoan,
    handleLogout,
    stopRealtime,
  } from '../lib/stores.js';

  let { data, children } = $props();

  let path = $derived(page.url.pathname.replace(/\/$/, '') || '/');

  onDestroy(() => {
    void stopRealtime();
  });
</script>

<svelte:head>
  <title>Borrowly — ยืมของได้ง่าย ๆ</title>
</svelte:head>
<AnnouncementCenter />

<div class="flex min-h-screen flex-col">
  {#if $user && path !== '/login'}
    <Header
      loanCount={$selectedItems.length}
      onOpenLoans={() => ($panelOpen = true)}
      onLogout={handleLogout}
      canAdmin={$canAdmin}
      canApprove={$isTeacherOrAdmin}
      {path}
    />
  {/if}

  <div class="flex-1">
    {#if data?.guardFailed}
      <UnauthorizedPage message={data.guardMessage} />
    {:else}
      {@render children?.()}
    {/if}
  </div>

  {#if $user && path !== '/login'}
    <LoanPanel
      selectedItems={$selectedItems}
      teachers={$teachers}
      isTeacher={$userType === 'teachers'}
      borrowerName={$user?.name || $user?.email || ''}
      borrowerEmail={$user?.email || ''}
      bind:open={$panelOpen}
      onClose={() => ($panelOpen = false)}
      onSubmit={submitLoan}
    />
  {/if}

  <footer class="border-t border-[#e7e5df] bg-cream px-5 py-3 text-center text-[11px] text-[#879087]">
    <span>© {new Date().getFullYear()} · ผู้จัดทำ <a href="https://github.com/techasit5415" target="_blank" rel="noopener noreferrer" class="hover:text-ink hover:underline">นาย เตชสิทธิ์ วาณิชภัทรกุล</a></span>
    <nav aria-label="นโยบายและข้อกำหนด" class="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-0">
      <a href="/privacy" class="inline-flex min-h-7 items-center underline underline-offset-4 hover:text-ink">นโยบายความเป็นส่วนตัว</a>
      <a href="/terms" class="inline-flex min-h-7 items-center underline underline-offset-4 hover:text-ink">ข้อกำหนดการใช้งาน</a>
    </nav>
  </footer>
  <LegalConsent userId={$user?.id ?? null} enabled={!['/privacy', '/terms'].includes(path)} />
</div>
