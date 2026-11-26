<script>
  import '../app.css';
  import { version } from '$app/environment';
  import { onDestroy } from 'svelte';
  import { fly } from 'svelte/transition';
  import { CheckCircle2, AlertCircle, X } from '@lucide/svelte';
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
    toastMessage,
    toggleItem,
    submitLoan,
    handleLogout,
    stopRealtime,
  } from '../lib/stores.js';

  let { data, children } = $props();

  let path = $derived(page.url.pathname.replace(/\/$/, '') || '/');
  let toastTimer = null;

  $effect(() => {
    if ($toastMessage?.text) {
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toastMessage.set({ type: '', text: '' });
      }, 3200);
    }
  });

  onDestroy(() => {
    if (toastTimer) clearTimeout(toastTimer);
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
      {#key path}
        <div class="animate-fade-in-up">
          {@render children?.()}
        </div>
      {/key}
    {/if}
  </div>

  {#if $user && path !== '/login'}
    <LoanPanel
      selectedItems={$selectedItems}
      teachers={$teachers}
      isTeacher={$userType === 'teachers' || $userType === 'staff' || $userType === 'head' || $userType === 'super_admin' || $userType === 'superadmin' || $userType === 'admin' || $canAdmin}
      userRole={$userType}
      borrowerName={$user?.name || $user?.email || ''}
      borrowerEmail={$user?.email || ''}
      bind:open={$panelOpen}
      onClose={() => ($panelOpen = false)}
      onRemove={toggleItem}
      onClearAll={() => {
        selectedItems.set([]);
        toastMessage.set({ type: 'success', text: 'ล้างรายการอุปกรณ์ที่เลือกทั้งหมดแล้ว' });
      }}
      onSubmit={submitLoan}
    />
  {/if}

  <footer class="border-t border-[#e7e5df] bg-cream px-5 py-3 text-center text-[11px] text-[#879087]">
    <span>© {new Date().getFullYear()} · <a href="https://github.com/techasit5415" target="_blank" rel="noopener noreferrer" class="hover:text-ink hover:underline">นาย เตชสิทธิ์ วาณิชภัทรกุล</a> · <span class="font-mono tabular-nums" title="Semantic Versioning: MAJOR.MINOR.PATCH">v{version}</span></span>
    <nav aria-label="นโยบายและข้อกำหนด" class="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-0">
      <a href="/privacy" class="inline-flex min-h-7 items-center underline underline-offset-4 hover:text-ink">นโยบายความเป็นส่วนตัว</a>
      <a href="/terms" class="inline-flex min-h-7 items-center underline underline-offset-4 hover:text-ink">ข้อกำหนดการใช้งาน</a>
    </nav>
  </footer>
  <LegalConsent userId={$user?.id ?? null} enabled={!['/privacy', '/terms'].includes(path)} />

  {#if $toastMessage?.text}
    <div
      transition:fly={{ y: -24, duration: 220 }}
      role="status"
      aria-live="polite"
      class="fixed top-4 left-1/2 -translate-x-1/2 z-[120] flex w-[calc(100%-2rem)] max-w-md items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl backdrop-blur-md {$toastMessage.type === 'error'
        ? 'border-rose-200 bg-rose-50/95 text-rose-900'
        : 'border-emerald-200 bg-white/95 text-emerald-900'}"
    >
      {#if $toastMessage.type === 'error'}
        <AlertCircle size={18} class="shrink-0 text-rose-600" />
      {:else}
        <CheckCircle2 size={18} class="shrink-0 text-emerald-600" />
      {/if}
      <span class="flex-1">{$toastMessage.text}</span>
      <button
        type="button"
        class="rounded-lg p-1 text-[#89938b] hover:bg-black/5 hover:text-ink transition"
        aria-label="ปิดการแจ้งเตือน"
        onclick={() => toastMessage.set({ type: '', text: '' })}
      >
        <X size={14} />
      </button>
    </div>
  {/if}
</div>
