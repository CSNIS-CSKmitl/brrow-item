<script>
  import { onDestroy } from "svelte";
  import Header from "./lib/components/Header.svelte";
  import LoanPanel from "./lib/components/LoanPanel.svelte";
  import Router from "./lib/router/Router.svelte";
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

  window.addEventListener("popstate", handlePopState);

  loadAll();

  onDestroy(() => {
    window.removeEventListener("popstate", handlePopState);
    void stopRealtime();
  });
</script>

<svelte:head>
  <title>Borrowly — ยืมของได้ง่าย ๆ</title>
</svelte:head>

{#if $user && path !== "/login"}
  <Header
    loanCount={$selectedItems.length}
    onOpenLoans={() => ($panelOpen = true)}
    onLogout={handleLogout}
    canAdmin={$canAdmin}
    canApprove={$isTeacherOrAdmin}
  />
{/if}

<Router {path} />

{#if $user && path !== "/login"}
  <LoanPanel
    selectedItems={$selectedItems}
    teachers={$teachers}
    skipTeacherApproval={$userType === "teachers" || $canAdmin}
    autoApprove={$canAdmin}
    borrowerName={$user?.name || $user?.email || ""}
    borrowerEmail={$user?.email || ""}
    bind:open={$panelOpen}
    onClose={() => ($panelOpen = false)}
    onSubmit={submitLoan}
  />
{/if}
