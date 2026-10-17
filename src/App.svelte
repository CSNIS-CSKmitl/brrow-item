<script>
  import { onDestroy } from "svelte";
  import Header from "./lib/components/Header.svelte";
  import LoanPanel from "./lib/components/LoanPanel.svelte";
  import Router from "./lib/router/Router.svelte";
  import LegalConsent from "./lib/components/LegalConsent.svelte";
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
    loadAll,
    stopRealtime,
  } from "./lib/stores.js";

  let path = window.location.pathname.replace(/\/$/, "") || "/";

  function handlePopState() {
    path = window.location.pathname.replace(/\/$/, "") || "/";
  }

  function handleInternalNavigation(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!link || link.target || link.hasAttribute("download")) return;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;

    event.preventDefault();
    if (url.href === window.location.href) return;
    window.history.pushState({}, "", url);
    path = url.pathname.replace(/\/$/, "") || "/";
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  window.addEventListener("popstate", handlePopState);
  document.addEventListener("click", handleInternalNavigation);

  loadAll();

  onDestroy(() => {
    window.removeEventListener("popstate", handlePopState);
    document.removeEventListener("click", handleInternalNavigation);
    void stopRealtime();
  });
</script>

<svelte:head>
  <title>Borrowly — ยืมของได้ง่าย ๆ</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
  {#if $user && path !== "/login"}
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
    <Router {path} />
  </div>

  {#if $user && path !== "/login"}
    <LoanPanel
      selectedItems={$selectedItems}
      teachers={$teachers}
      isTeacher={$userType === "teachers"}
      borrowerName={$user?.name || $user?.email || ""}
      borrowerEmail={$user?.email || ""}
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
  <LegalConsent userId={$user?.id ?? null} enabled={!['/privacy', '/terms'].includes(path.replace(/\/$/, ''))} />
</div>
