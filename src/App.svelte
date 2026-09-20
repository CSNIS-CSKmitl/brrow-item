<script>
  import { onDestroy } from "svelte";
  import Header from "./lib/components/Header.svelte";
  import LoanPanel from "./lib/components/LoanPanel.svelte";

  import Home from "./pages/home/Home.svelte";
  import Login from "./pages/login/Login.svelte";
  import Admin from "./pages/admin/Admin.svelte";
  import Approval from "./pages/approvals/Approval.svelte";
  import MyRequests from "./pages/requests/MyRequests.svelte";
  import Catalog from "./pages/catalog/Catalog.svelte";
  import How from "./pages/how/How.svelte";
  import About from "./pages/about/About.svelte";
  import NotFound from "./pages/not-found/NotFound.svelte";

  import { items as mockItems } from "./lib/mock-data.js";
  import {
    createLoanRequest,
    createItem,
    deleteItem,
    getItems,
    getLoanRequests,
    getMyLoanRequests,
    getTeachers,
    getUserType,
    isSuperadmin,
    login,
    loginWithOIDC,
    logout,
    pb,
    updateLoanStatus,
    updateMyLoanRequest,
  } from "./lib/pocketbase.js";

  const hasPb = Boolean(import.meta.env.VITE_POCKETBASE_URL || import.meta.env.VITE_POCKETBASE_TARGET);
  let items = hasPb ? [] : mockItems;
  let selectedItems = [];
  let panelOpen = false;
  let submitted = false;
  let submitError = "";
  let workflowError = "";
  let path = window.location.pathname.replace(/\/$/, "") || "/";
  let user = pb.authStore.record;
  let canAdmin = isSuperadmin(user);
  let userType = getUserType(user);
  let requests = [];
  let myRequests = [];
  let teachers = [];
  let loginError = "";
  let unsubscribeLoanRequests = null;

  async function loadItems() {
    try {
      const remoteItems = await getItems();
      if (hasPb) items = remoteItems;
      else if (remoteItems.length) items = remoteItems;
    } catch (error) {
      console.error("Load items failed", error);
    }
  }

  function toggleItem(item) {
    selectedItems = selectedItems.some((selected) => selected.id === item.id)
      ? selectedItems.filter((selected) => selected.id !== item.id)
      : [...selectedItems, item];
  }

  async function submitLoan(form) {
    submitError = "";
    try {
      await createLoanRequest({
        ...form,
        itemIds: selectedItems.map((item) => item.id),
      });
      await loadMyRequests();
      submitted = true;
      panelOpen = false;
      selectedItems = [];
    } catch (error) {
      submitError =
        error?.response?.message ||
        "ส่งคำขอไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ PocketBase";
      console.error("Create loan request failed", error);
    }
  }

  function resetSubmitted() {
    submitted = false;
    selectedItems = [];
  }

  async function loadRequests() {
    try {
      if (userType === "teachers") {
        const pendingRequests = await getLoanRequests("pending_teacher");
        requests = pendingRequests.filter(
          (request) => request.teacher === user?.id,
        );
      } else if (userType === "superadmin") {
        requests = await getLoanRequests();
      } else {
        requests = [];
      }
    } catch (error) {
      requests = [];
      console.error("Load approval requests failed", error);
    }
  }

  async function loadMyRequests() {
    myRequests = await getMyLoanRequests().catch(() => []);
  }

  function loadTeachers() {
    getTeachers()
      .then((result) => {
        teachers = result;
      })
      .catch(() => {});
  }

  async function stopRealtime() {
    if (!unsubscribeLoanRequests) return;
    const unsubscribe = unsubscribeLoanRequests;
    unsubscribeLoanRequests = null;
    await unsubscribe();
  }

  async function startRealtime() {
    await stopRealtime();
    if (!pb.authStore.isValid) return;
    try {
      unsubscribeLoanRequests = await pb
        .collection("loan_requests")
        .subscribe("*", () => {
          void loadRequests();
          void loadMyRequests();
        });
    } catch (error) {
      console.error("PocketBase realtime connection failed", error);
    }
  }

  loadItems();
  loadTeachers();
  loadRequests();
  loadMyRequests();
  void startRealtime();

  const unsubscribeAuth = pb.authStore.onChange(() => {
    user = pb.authStore.record;
    canAdmin = isSuperadmin(user);
    userType = getUserType(user);
    loadItems();
    loadRequests();
    loadMyRequests();
    loadTeachers();
    void startRealtime();
  });

  onDestroy(() => {
    unsubscribeAuth();
    void stopRealtime();
  });

  async function handleLogin(email, password) {
    loginError = "";
    try {
      await login(email, password);
      window.location.href = "/";
    } catch (error) {
      loginError = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    }
  }

  async function handleOIDCLogin() {
    loginError = "";
    try {
      await loginWithOIDC();
      window.location.href = "/";
    } catch (error) {
      loginError = error.message || "ไม่สามารถเข้าสู่ระบบด้วย OIDC ได้";
    }
  }

  function handleLogout() {
    void stopRealtime();
    logout();
    window.location.href = "/login";
  }

  async function handleAddItem(data) {
    const created = await createItem(data);
    items = [created, ...items];
  }

  async function handleDeleteItem(item) {
    if (!confirm(`ลบ ${item.name} ใช่ไหม?`)) return false;
    await deleteItem(item.id);
    items = items.filter((entry) => entry.id !== item.id);
    return true;
  }

  async function handleLoanAction(request, status, teacherComment = "") {
    workflowError = "";
    try {
      await updateLoanStatus(request.id, status, teacherComment);
      await loadRequests();
    } catch (error) {
      workflowError =
        error?.response?.message ||
        "อัปเดตสถานะคำขอไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ PocketBase";
      console.error("Update loan request failed", error);
      throw error;
    }
  }

  async function handleMyRequestUpdate(request, changes) {
    workflowError = "";
    try {
      await updateMyLoanRequest(request.id, changes);
      await loadMyRequests();
    } catch (error) {
      workflowError =
        error?.response?.message || "แก้ไขคำขอไม่สำเร็จ กรุณาลองใหม่";
      throw error;
    }
  }
</script>

<svelte:head>
  <title>Borrowly — ยืมของได้ง่าย ๆ</title>
</svelte:head>

{#if user && path !== "/login"}
  <Header
    loanCount={selectedItems.length}
    onOpenLoans={() => (panelOpen = true)}
    onLogout={handleLogout}
    {canAdmin}
  />
{/if}

{#if path === "/login" || !user}
  <Login
    onLogin={handleLogin}
    onOAuthLogin={handleOIDCLogin}
    error={loginError}
  />
{:else if path === "/approvals" || path === "/requests"}
  <MyRequests
    requests={myRequests}
    {items}
    {teachers}
    onUpdate={handleMyRequestUpdate}
  />
  {#if userType === "teachers" || userType === "superadmin"}
    <Approval
      {requests}
      {items}
      role={userType}
      onAction={handleLoanAction}
    />
  {/if}
{:else if path === "/admin" && canAdmin}
  <Admin {items} onAdd={handleAddItem} onDelete={handleDeleteItem} />
{:else if path === "/admin"}
  <main class="mx-auto max-w-2xl px-5 py-24 text-center">
    <h1 class="text-3xl font-bold text-ink">ไม่มีสิทธิ์เข้าถึง</h1>
    <p class="mt-3 text-[#7c857e]">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
    <a class="btn primary mx-auto mt-8 max-w-xs px-5 py-3 text-sm" href="/">
      กลับหน้าแรก
    </a>
  </main>
{:else if path === "/"}
  <Home
    {items}
    {selectedItems}
    onToggleItem={toggleItem}
    {submitted}
    {submitError}
    {workflowError}
    onResetSubmitted={resetSubmitted}
    onClearSubmitError={() => (submitError = "")}
    onClearWorkflowError={() => (workflowError = "")}
  />
{:else if path === "/catalog"}
  <Catalog
    {items}
    {selectedItems}
    onToggleItem={toggleItem}
  />
{:else if path === "/how"}
  <How />
{:else if path === "/about"}
  <About />
{:else}
  <NotFound />
{/if}

{#if user && path !== "/login"}
  <LoanPanel
    {selectedItems}
    {teachers}
    skipTeacherApproval={userType === "teachers" || canAdmin}
    autoApprove={canAdmin}
    borrowerName={user?.name || user?.email || ""}
    borrowerEmail={user?.email || ""}
    bind:open={panelOpen}
    onClose={() => (panelOpen = false)}
    onSubmit={submitLoan}
  />
{/if}
