<script>
  import { onMount, onDestroy } from 'svelte';
  import { Check, Clock3, Download, Filter, History, ListFilter, X } from 'lucide-svelte';
  import Button from '../../lib/components/Button.svelte';
  import { items as mockItems } from '../../lib/mock-data.js';
  import { items, user, userType, canAdmin } from '../../lib/stores.js';
  import { getLoanRequests, updateLoanStatus, pb } from '../../lib/pocketbase.js';
  import { exportRequestsToCSV, exportSingleRequestToCSV, formatDateTime } from '../../lib/csv.js';

  const labels = {
    pending_teacher: 'รอ อจ. รับทราบ',
    pending_caretaker: 'รอคนดูแลอนุมัติ',
    approved: 'อนุมัติแล้ว',
    rejected: 'ไม่อนุมัติ',
  };

  let requests = [];
  let activeTab = 'pending'; // 'pending' | 'history' | 'all'

  // Reject state
  let rejectingId = '';
  let rejectComment = '';
  let rejectError = '';

  // Approve state (with text input for admin)
  let approvingId = '';
  let approveComment = '';
  let approveError = '';

  let unsub = null;

  async function loadApprovalRequests() {
    try {
      if ($userType === 'teachers') {
        const allTeacherRequests = await getLoanRequests('', $user?.id);
        requests = allTeacherRequests.filter((r) => r.teacher === $user?.id);
      } else if ($userType === 'superadmin' || $canAdmin) {
        requests = await getLoanRequests();
      } else {
        requests = [];
      }
    } catch (error) {
      requests = [];
    }
  }

  onMount(async () => {
    await loadApprovalRequests();
    try {
      unsub = await pb.collection('loan_requests').subscribe('*', () => {
        void loadApprovalRequests();
      });
    } catch (error) {}
  });

  onDestroy(() => {
    if (unsub) unsub();
  });

  // Filter requests based on active tab
  $: pendingRequests = requests.filter((r) =>
    $userType === 'teachers' ? r.status === 'pending_teacher' : r.status === 'pending_caretaker'
  );

  $: historyRequests = requests.filter((r) =>
    $userType === 'teachers' ? r.status !== 'pending_teacher' : r.status !== 'pending_caretaker'
  );

  $: filteredRequests =
    activeTab === 'pending'
      ? pendingRequests
      : activeTab === 'history'
        ? historyRequests
        : requests;

  function itemName(id) {
    return $items.find((item) => item.id === id)?.name || mockItems.find((item) => item.id === id)?.name || id;
  }

  function formatDate(value) {
    return formatDateTime(value);
  }

  function statusLabel(request) {
    if (request.status === 'rejected' && request.teacherComment) return 'อาจารย์ไม่อนุมัติ';
    if (request.status === 'rejected' && request.adminComment) return 'ผู้ดูแลไม่อนุมัติ';
    return labels[request.status] || request.status;
  }

  // Reject flow
  function startReject(request) {
    rejectingId = request.id;
    approvingId = '';
    rejectComment = '';
    rejectError = '';
  }
  function cancelReject() {
    rejectingId = '';
    rejectComment = '';
    rejectError = '';
  }
  async function confirmReject(request) {
    if (!rejectComment.trim()) {
      rejectError = 'กรุณาระบุเหตุผลที่ไม่อนุมัติ';
      return;
    }
    rejectError = '';
    try {
      await updateLoanStatus(request.id, 'rejected', rejectComment);
      await loadApprovalRequests();
      cancelReject();
    } catch (error) {
      rejectError = error?.response?.message || 'บันทึกการไม่อนุมัติไม่สำเร็จ';
    }
  }

  // Teacher direct approve flow (no comment or reason needed)
  async function handleTeacherApprove(request) {
    try {
      await updateLoanStatus(request.id, 'pending_caretaker');
      await loadApprovalRequests();
    } catch (error) {
      alert(error?.response?.message || 'บันทึกการรับทราบไม่สำเร็จ');
    }
  }

  // Superadmin / Admin approve flow (with MAC address / note)
  function startApprove(request) {
    approvingId = request.id;
    rejectingId = '';
    approveComment = '';
    approveError = '';
  }
  function cancelApprove() {
    approvingId = '';
    approveComment = '';
    approveError = '';
  }
  async function confirmApprove(request) {
    approveError = '';
    try {
      await updateLoanStatus(request.id, 'approved', approveComment);
      await loadApprovalRequests();
      cancelApprove();
    } catch (error) {
      approveError = error?.response?.message || 'บันทึกการอนุมัติไม่สำเร็จ';
    }
  }

  function handleCSVExport() {
    const filename = `${$userType === 'teachers' ? 'teacher_requests' : 'admin_approvals'}_${activeTab}.csv`;
    exportRequestsToCSV(filteredRequests, $items, filename);
  }
</script>

<main class="mx-auto max-w-5xl px-5 py-12 lg:px-8">
  <div class="flex flex-col justify-between gap-4 md:flex-row md:items-center mb-8">
    <div>
      <p class="eyebrow"><Clock3 size={14} /> LOAN WORKFLOW</p>
      <h1 class="mt-2 text-3xl font-bold text-ink">
        {$userType === 'teachers' ? 'ระบบรับทราบคำขอยืม (อาจารย์)' : 'การอนุมัติคำขอยืม (ผู้ดูแลระบบ)'}
      </h1>
      <p class="mt-2 text-sm text-[#7c857e]">
        {$userType === 'teachers'
          ? 'ตรวจสอบคำขอที่ส่งถึงคุณ และดูประวัติการพิจารณาย้อนหลังได้ทั้งหมด'
          : 'ตรวจสอบคำขอที่รอผู้ดูแลอนุมัติ บันทึกข้อความการอนุมัติ และส่งออกรายงาน CSV'}
      </p>
    </div>

    <!-- Export CSV Button (Only for Admin / Superadmin, not for Teachers) -->
    {#if $userType !== 'teachers'}
      <button
        type="button"
        class="inline-flex items-center gap-2 self-start rounded-xl border border-[#c8d4c9] bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm hover:bg-[#f4f7f4] transition"
        on:click={handleCSVExport}
        disabled={filteredRequests.length === 0}
        title="ดาวน์โหลดรายการที่กำลังแสดงเป็นไฟล์ CSV"
      >
        <Download size={16} class="text-sage" />
        <span>Export CSV ({filteredRequests.length})</span>
      </button>
    {/if}
  </div>

  <!-- Filter Tabs (Pending, History, All) -->
  <div class="mb-6 flex flex-wrap items-center gap-2 border-b border-[#e4e5de] pb-3">
    <button
      type="button"
      class="rounded-xl px-4 py-2 text-sm font-bold transition {activeTab === 'pending' ? 'bg-sage text-white shadow-sm' : 'bg-white text-[#6b756d] hover:bg-[#f2f5f1]'}"
      on:click={() => (activeTab = 'pending')}
    >
      {$userType === 'teachers' ? 'รอ อจ. รับทราบ' : 'รอผู้ดูแลอนุมัติ'}
      <span class="ml-1.5 rounded-full px-2 py-0.5 text-xs {activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-[#eef2ed] text-[#717b73]'}">
        {pendingRequests.length}
      </span>
    </button>

    <button
      type="button"
      class="rounded-xl px-4 py-2 text-sm font-bold transition {activeTab === 'history' ? 'bg-sage text-white shadow-sm' : 'bg-white text-[#6b756d] hover:bg-[#f2f5f1]'}"
      on:click={() => (activeTab = 'history')}
    >
      <History size={14} class="inline -mt-0.5 mr-1" />
      ประวัติการพิจารณา
      <span class="ml-1.5 rounded-full px-2 py-0.5 text-xs {activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-[#eef2ed] text-[#717b73]'}">
        {historyRequests.length}
      </span>
    </button>

    <button
      type="button"
      class="rounded-xl px-4 py-2 text-sm font-bold transition {activeTab === 'all' ? 'bg-sage text-white shadow-sm' : 'bg-white text-[#6b756d] hover:bg-[#f2f5f1]'}"
      on:click={() => (activeTab = 'all')}
    >
      ทั้งหมด
      <span class="ml-1.5 rounded-full px-2 py-0.5 text-xs {activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-[#eef2ed] text-[#717b73]'}">
        {requests.length}
      </span>
    </button>
  </div>

  <!-- Requests List -->
  <div class="space-y-4">
    {#if filteredRequests.length === 0}
      <div class="rounded-2xl border border-dashed border-[#d8d8d0] py-16 text-center text-[#7c857e]">
        {#if activeTab === 'pending'}
          ไม่มีคำขอที่รอดำเนินการในขณะนี้
        {:else if activeTab === 'history'}
          ยังไม่มีประวัติการพิจารณาคำขอ
        {:else}
          ยังไม่มีรายการคำขอในระบบ
        {/if}
      </div>
    {/if}

    {#each filteredRequests as request}
      <article class="rounded-2xl border border-[#e4e5de] bg-white p-5 shadow-sm">
        <div class="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div class="space-y-1.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="font-bold text-ink">คำขอของ {request.borrowerName}</h2>
                <span class="rounded-full px-3 py-1 text-xs font-bold {request.status === 'rejected' ? 'bg-[#fff1ef] text-[#a34e43]' : request.status === 'approved' ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#eef2ed] text-sage'}">
                  {statusLabel(request)}
                </span>
              </div>
              {#if $userType !== 'teachers'}
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-[#c9d3c9] bg-white px-2.5 py-1 text-xs font-semibold text-[#546056] hover:bg-[#f0f4ef] transition shadow-xs"
                  title="ดาวน์โหลดคำขอนี้เป็นไฟล์ CSV"
                  on:click={() => exportSingleRequestToCSV(request, $items)}
                >
                  <Download size={13} class="text-sage" /> Export CSV
                </button>
              {/if}
            </div>

            <p class="text-sm text-[#778078]">
              ของที่ขอยืม: <b class="text-ink">{(request.itemIds || []).map(itemName).join(', ') || '-'}</b>
            </p>
            <p class="text-sm text-[#778078]">
              กำหนดเวลาคืน: <b class="text-ink">{formatDate(request.dueDate)}</b> · อีเมล: {request.email}
            </p>
            <p class="text-xs text-[#9aa29b]">
              ส่งคำขอเมื่อ: {formatDate(request.created)} · อจ. ผู้รับทราบ: {request.expand?.teacher?.name || request.expand?.teacher?.email || '-'}
            </p>

            {#if request.note}
              <p class="text-sm text-[#666f67] bg-[#f8faf7] p-2.5 rounded-lg border border-[#eef2eb]">
                <b>หมายเหตุจากผู้ยืม:</b> {request.note}
              </p>
            {/if}

            <!-- Comment display -->
            {#if request.teacherComment}
              <p class="rounded-lg bg-[#f9f9f6] border border-[#ecece4] px-3 py-2 text-sm text-[#5f6861]">
                <b>ความเห็นจากอาจารย์:</b> {request.teacherComment}
              </p>
            {/if}
            {#if request.adminComment}
              <div class="rounded-lg bg-[#f4f7f4] border border-[#dbe7dc] px-3 py-2 text-sm text-[#355238]">
                <span class="text-xs font-bold text-sage">หมายเลข MAC Address:</span>
                <div class="mt-1 flex flex-wrap items-center gap-1.5">
                  {#each (request.adminComment || '').split(',').map((s) => s.trim()).filter(Boolean) as mac}
                    <span class="inline-flex items-center font-mono text-xs font-bold bg-white border border-[#c6d7c7] px-2.5 py-1 rounded-md text-ink shadow-2xs">
                      {mac}
                    </span>
                  {/each}
                </div>
              </div>
            {/if}
          </div>

          <!-- Action Buttons for Teacher -->
          {#if $userType === 'teachers' && request.status === 'pending_teacher'}
            <div class="flex flex-wrap gap-2 self-start">
              <Button variant="outline" size="sm" on:click={() => startReject(request)}>
                <X size={15} /> ไม่รับทราบ
              </Button>
              <Button size="sm" on:click={() => handleTeacherApprove(request)}>
                <Check size={15} /> รับทราบ
              </Button>
            </div>
          {/if}

          <!-- Action Buttons for Superadmin / Admin -->
          {#if ($userType === 'superadmin' || $canAdmin) && request.status === 'pending_caretaker'}
            <div class="flex flex-wrap gap-2 self-start">
              <Button variant="outline" size="sm" on:click={() => startReject(request)}>
                <X size={15} /> ไม่อนุมัติ
              </Button>
              <Button size="sm" on:click={() => startApprove(request)}>
                <Check size={15} /> อนุมัติ
              </Button>
            </div>
          {/if}
        </div>

        <!-- Inline Form for Superadmin Approving with Text Note (MAC address) -->
        {#if approvingId === request.id && ($userType === 'superadmin' || $canAdmin)}
          <div class="mt-4 rounded-xl border border-[#cde0ce] bg-[#f7fbf7] p-4">
            <label class="text-sm font-bold text-ink">
              หมายเลข MAC Address (หากมีหลายเครื่อง ให้คั่นด้วยเครื่องหมายจุลภาค ,)
              <textarea
                bind:value={approveComment}
                rows="2"
                placeholder="ระบุหมายเลข MAC Address เช่น 00:1A:2B:3C:4D:5E, AA:BB:CC:DD:EE:FF"
                class="mt-1 w-full rounded-lg border border-[#c4d6c5] p-2.5 text-sm font-mono"
              ></textarea>
            </label>
            {#if approveError}
              <p class="mt-1 text-xs text-red-600">{approveError}</p>
            {/if}
            <div class="mt-3 flex gap-2">
              <Button variant="outline" size="sm" on:click={cancelApprove}>ยกเลิก</Button>
              <Button size="sm" on:click={() => confirmApprove(request)}>
                <Check size={15} /> ยืนยันอนุมัติคำขอนี้
              </Button>
            </div>
          </div>
        {/if}

        <!-- Inline Form for Rejecting with Reason -->
        {#if rejectingId === request.id}
          <div class="mt-4 rounded-xl border border-[#f2cfc9] bg-[#fff8f6] p-4">
            <label class="text-sm font-bold text-ink">
              {$userType === 'teachers' ? 'เหตุผลที่ไม่รับทราบ' : 'เหตุผลที่ไม่อนุมัติ'}
              <textarea
                bind:value={rejectComment}
                rows="2"
                required
                placeholder="ระบุเหตุผลให้ผู้ขอยืมทราบอย่างชัดเจน"
                class="mt-1 w-full rounded-lg border border-[#e5b8b0] p-2.5 text-sm"
              ></textarea>
            </label>
            {#if rejectError}
              <p class="mt-1 text-xs text-[#b14d42]">{rejectError}</p>
            {/if}
            <div class="mt-3 flex gap-2">
              <Button variant="outline" size="sm" on:click={cancelReject}>ยกเลิก</Button>
              <Button size="sm" on:click={() => confirmReject(request)}>
                <X size={15} /> ยืนยันไม่อนุมัติ
              </Button>
            </div>
          </div>
        {/if}
      </article>
    {/each}
  </div>
</main>
