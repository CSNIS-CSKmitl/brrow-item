<script>
  import { onDestroy } from "svelte";
  import {
    ArrowRight,
    CheckCircle2,
    Search,
    SlidersHorizontal,
    Sparkles,
    UsersRound,
  } from "lucide-svelte";
  import Header from "./lib/components/Header.svelte";
  import ItemCard from "./lib/components/ItemCard.svelte";
  import LoanPanel from "./lib/components/LoanPanel.svelte";
  import Button from "./lib/components/Button.svelte";
  import { categories, items as mockItems } from "./lib/mock-data.js";
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
  import LoginPage from "./lib/components/LoginPage.svelte";
  import AdminPage from "./lib/components/AdminPage.svelte";
  import ApprovalPage from "./lib/components/ApprovalPage.svelte";
  import MyRequestsPage from "./lib/components/MyRequestsPage.svelte";

  let items = import.meta.env.VITE_POCKETBASE_URL ? [] : mockItems;
  let search = "";
  let activeCategory = "ทั้งหมด";
  let selectedItems = [];
  let panelOpen = false;
  let submitted = false;
  let submitError = "";
  let workflowError = "";
  let showAll = false;
  let detailItem = null;
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
      if (import.meta.env.VITE_POCKETBASE_URL) items = remoteItems;
      else if (remoteItems.length) items = remoteItems;
    } catch (error) {
      console.error("Load items failed", error);
    }
  }
  loadItems();
  $: filteredItems = items.filter(
    (item) =>
      (activeCategory === "ทั้งหมด" || item.category === activeCategory) &&
      `${item.name} ${item.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  $: shownItems = showAll ? filteredItems : filteredItems.slice(0, 6);
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
      } else if (userType === "superadmin") requests = await getLoanRequests();
      else requests = [];
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

<svelte:head><title>Borrowly — ยืมของได้ง่าย ๆ</title></svelte:head>
{#if user && path !== "/login"}
  <Header
    loanCount={selectedItems.length}
    onOpenLoans={() => (panelOpen = true)}
    onLogout={handleLogout}
    {canAdmin}
  />
{/if}
{#if path === "/login"}
  <LoginPage
    onLogin={handleLogin}
    onOAuthLogin={handleOIDCLogin}
    error={loginError}
  />
{:else if !user}
  <LoginPage
    onLogin={handleLogin}
    onOAuthLogin={handleOIDCLogin}
    error={loginError}
  />
{:else if path === "/approvals" || path === "/requests"}
  <MyRequestsPage
    requests={myRequests}
    {items}
    {teachers}
    onUpdate={handleMyRequestUpdate}
  />
  {#if userType === "teachers" || userType === "superadmin"}
    <ApprovalPage
      {requests}
      {items}
      role={userType}
      onAction={handleLoanAction}
    />
  {/if}
{:else if path === "/admin" && canAdmin}
  <AdminPage {items} onAdd={handleAddItem} onDelete={handleDeleteItem} />
{:else if path === "/admin"}
  <main class="mx-auto max-w-2xl px-5 py-24 text-center">
    <h1 class="text-3xl font-bold text-ink">ไม่มีสิทธิ์เข้าถึง</h1>
    <p class="mt-3 text-[#7c857e]">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
    <a class="btn primary mx-auto mt-8 max-w-xs px-5 py-3 text-sm" href="/"
      >กลับหน้าแรก</a
    >
  </main>
{:else if path === "/"}
  <main>
    <section class="hero-wrap">
      <div
        class="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24"
      >
        <div>
          <div class="eyebrow">
            <Sparkles size={14} /> แชร์ของดี ให้ทุกคนได้ใช้
          </div>
          <h1
            class="mt-5 max-w-xl text-5xl font-extrabold leading-[1.08] tracking-[-.04em] text-ink sm:text-6xl"
          >
            ของที่อยากใช้<br /><span class="text-sage">ไม่จำเป็นต้องซื้อ</span>
          </h1>
          <p class="mt-6 max-w-lg text-base leading-8 text-[#6f7971]">
            ยืมของจากคนในชุมชนได้ง่าย ๆ ประหยัดเงิน ลดของเหลือใช้
            และได้พบกับไอเทมที่ช่วยให้ชีวิตสะดวกขึ้น
          </p>
          <a href="#catalog"
            ><Button size="lg"
              >เริ่มเลือกของที่อยากยืม <ArrowRight size={18} /></Button
            ></a
          >
          <div class="mt-8 flex items-center gap-6 text-sm text-[#778078]">
            <span class="flex items-center gap-2"
              ><CheckCircle2 size={17} class="text-sage" /> ยืมง่าย ไม่มีค่าธรรมเนียม</span
            ><span class="hidden items-center gap-2 sm:flex"
              ><UsersRound size={17} class="text-sage" /> สมาชิก 1,240 คน</span
            >
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
    <section id="catalog" class="mx-auto max-w-7xl px-5 py-16 lg:px-8">
      <div
        class="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"
      >
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
          <Search size={18} /><input
            bind:value={search}
            placeholder="ค้นหาของที่อยากยืม..."
            aria-label="ค้นหา"
          /><SlidersHorizontal size={18} class="text-[#88928a]" />
        </div>
      </div>
      <div class="mb-8 flex gap-2 overflow-x-auto pb-1">
        {#each categories as category}<button
            class:active-category={activeCategory === category}
            class="category-pill"
            on:click={() => {
              activeCategory = category;
              showAll = false;
            }}>{category}</button
          >{/each}
      </div>
      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {#each shownItems as item}<ItemCard
            {item}
            selected={selectedItems.some((selected) => selected.id === item.id)}
            onSelect={toggleItem}
            onOpen={() => (detailItem = item)}
          />{/each}
      </div>
      {#if shownItems.length === 0}<div
          class="rounded-2xl border border-dashed border-[#d8d8d0] py-16 text-center text-[#7c857e]"
        >
          ไม่พบของที่ค้นหา ลองใช้คำอื่นดูนะ
        </div>{/if}{#if filteredItems.length > 6 && !showAll}<div
          class="mt-10 text-center"
        >
          <Button variant="outline" on:click={() => (showAll = true)}
            >ดูของทั้งหมด <ArrowRight size={17} /></Button
          >
        </div>{/if}
    </section>
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
    <section id="about" class="mx-auto max-w-7xl px-5 py-16 lg:px-8">
      <div
        class="rounded-3xl bg-ink px-7 py-10 text-white md:flex md:items-center md:justify-between md:px-12"
      >
        <div>
          <p
            class="text-xs font-bold uppercase tracking-[.16em] text-[#b7d2bc]"
          >
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
          >เริ่มเลือกของ <ArrowRight size={16} /></a
        >
      </div>
    </section>
  </main>
  {#if detailItem}<div class="fixed inset-0 z-40 grid place-items-center p-5">
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
            <Button variant="outline" on:click={() => (detailItem = null)}
              >ปิด</Button
            ><Button
              disabled={detailItem.available === 0}
              on:click={() => {
                toggleItem(detailItem);
                detailItem = null;
              }}>เพิ่มในรายการยืม</Button
            >
          </div>
        </div>
      </div>
    </div>{/if}
  {#if submitted}<div class="toast">
      <CheckCircle2 size={21} />
      <div>
        <b>ส่งคำขอเรียบร้อยแล้ว</b>
        <p>เจ้าของจะติดต่อกลับเพื่อยืนยันการยืม</p>
      </div>
      <button on:click={resetSubmitted}>×</button>
    </div>{/if}
  {#if submitError}<div class="toast error">
      <div>
        <b>ส่งคำขอไม่สำเร็จ</b>
        <p>{submitError}</p>
      </div>
      <button on:click={() => (submitError = "")}>×</button>
    </div>{/if}
  {#if workflowError}<div class="toast error">
      <div>
        <b>อัปเดตสถานะไม่สำเร็จ</b>
        <p>{workflowError}</p>
      </div>
      <button on:click={() => (workflowError = "")}>×</button>
    </div>{/if}
  <footer
    class="border-t border-[#e7e5df] bg-cream px-5 py-8 text-center text-sm text-[#879087]"
  >
    © 2025 borrowly · แบ่งปันของดี ให้ชุมชนน่าอยู่ขึ้น
  </footer>
{:else if path === "/catalog"}
  <main class="mx-auto max-w-7xl px-5 py-16 lg:px-8">
    <div class="mb-10">
      <p class="eyebrow">EXPLORE THE LIBRARY</p>
      <h1 class="mt-2 text-4xl font-bold text-ink">แคตตาล็อกของทั้งหมด</h1>
      <p class="mt-3 text-[#7c857e]">ค้นหาและเลือกของที่ต้องการยืมจากชุมชน</p>
    </div>
    {#if items.length === 0}<div
        class="rounded-2xl border border-dashed border-[#d8d8d0] py-16 text-center text-[#7c857e]"
      >
        ยังไม่มีของให้ยืมในระบบ
      </div>{:else}<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {#each items as item}<ItemCard
            {item}
            selected={selectedItems.some((selected) => selected.id === item.id)}
            onSelect={toggleItem}
            onOpen={() => (detailItem = item)}
          />{/each}
      </div>{/if}
  </main>
{:else if path === "/how"}
  <main class="mx-auto max-w-5xl px-5 py-20 lg:px-8">
    <div class="text-center">
      <p class="eyebrow justify-center">HOW IT WORKS</p>
      <h1 class="mt-3 text-4xl font-bold text-ink">วิธีใช้งาน Borrowly</h1>
      <p class="mx-auto mt-4 max-w-xl leading-8 text-[#7c857e]">
        ยืมของดีจากคนในชุมชนได้ง่าย ๆ ใน 3 ขั้นตอน
      </p>
    </div>
    <div class="mt-12 grid gap-6 md:grid-cols-3">
      <div class="step-card">
        <span>01</span>
        <h3>ค้นหาของที่ใช่</h3>
        <p>เลือกดูของจากแคตตาล็อก หรือค้นหาด้วยคำที่ต้องการ</p>
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
    <div class="mt-12 text-center">
      <a class="btn primary mx-auto max-w-xs px-5 py-3 text-sm" href="/catalog"
        >ไปเลือกของ</a
      >
    </div>
  </main>
{:else if path === "/about"}
  <main class="mx-auto max-w-5xl px-5 py-20 lg:px-8">
    <div class="rounded-3xl bg-ink px-8 py-14 text-center text-white md:px-16">
      <p class="text-xs font-bold uppercase tracking-[.16em] text-[#b7d2bc]">
        ABOUT BORROWLY
      </p>
      <h1 class="mt-4 text-4xl font-bold">ยืมของได้ ใช้ทรัพยากรให้คุ้ม</h1>
      <p class="mx-auto mt-5 max-w-2xl leading-8 text-[#c7d0c8]">
        Borrowly คือพื้นที่สำหรับแบ่งปันของที่ไม่ได้ใช้ทุกวัน
        ให้คนในชุมชนเข้าถึงของดีได้ง่ายขึ้น ประหยัดเงิน
        และลดการซื้อของที่ใช้ไม่บ่อย
      </p>
      <a
        class="mt-8 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-bold text-ink"
        href="/catalog">ดูแคตตาล็อก</a
      >
    </div>
  </main>
{:else}
  <main class="mx-auto max-w-3xl px-5 py-24 text-center">
    <h1 class="text-4xl font-bold text-ink">ไม่พบหน้านี้</h1>
    <p class="mt-4 text-[#7c857e]">ลองกลับไปที่หน้าแรกหรือแคตตาล็อก</p>
    <a class="btn primary mx-auto mt-8 max-w-xs px-5 py-3 text-sm" href="/"
      >กลับหน้าแรก</a
    >
  </main>
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
