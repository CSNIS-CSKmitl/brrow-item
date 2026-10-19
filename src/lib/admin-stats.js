export const TIME_RANGES = [
  { value: 'today', label: 'วันนี้' },
  { value: '7d', label: '7 วัน' },
  { value: 'month', label: 'เดือนนี้' },
  { value: 'year', label: 'ปีนี้' },
  { value: 'all', label: 'ทั้งหมด' },
];

/**
 * Safely parse a date string or Date into a valid Date instance, or null if invalid.
 * Handles PocketBase 'YYYY-MM-DD HH:mm:ss.SSSZ' strings as well as ISO strings.
 */
export function parseValidDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  const str = String(value).trim();
  if (!str) return null;
  const normalized = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Parse a dueDate value. If the input is a date-only string (YYYY-MM-DD),
 * treat the deadline as the end of that day (23:59:59.999 local time) so
 * returns made on the due date count as on-time and aren't marked overdue prematurely.
 */
export function parseDueDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    const date = new Date(y, m - 1, d, 23, 59, 59, 999);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return parseValidDate(value);
}

/**
 * Get the [start, end] Date bounds for a given range relative to `now`.
 * Returns { start: Date | null, end: Date | null }.
 */
export function getTimeRangeBounds(range = 'all', now = new Date()) {
  const ref = parseValidDate(now) || new Date();
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();

  switch (range) {
    case 'today':
      return {
        start: new Date(y, m, d, 0, 0, 0, 0),
        end: new Date(y, m, d, 23, 59, 59, 999),
      };
    case '7d':
      return {
        start: new Date(y, m, d - 6, 0, 0, 0, 0),
        end: new Date(y, m, d, 23, 59, 59, 999),
      };
    case 'month':
      return {
        start: new Date(y, m, 1, 0, 0, 0, 0),
        end: new Date(y, m + 1, 0, 23, 59, 59, 999),
      };
    case 'year':
      return {
        start: new Date(y, 0, 1, 0, 0, 0, 0),
        end: new Date(y, 11, 31, 23, 59, 59, 999),
      };
    case 'all':
    default:
      return { start: null, end: null };
  }
}

/**
 * Extract the primary timestamp of a loan request for range filtering and trend bucketing.
 */
export function getRequestTimestamp(request) {
  if (!request || typeof request !== 'object') return null;
  return (
    parseValidDate(request.created) ||
    parseValidDate(request.returnedAt) ||
    parseValidDate(request.updated) ||
    parseDueDate(request.dueDate)
  );
}

/**
 * Filter loan requests by the selected time range ('today' | '7d' | 'month' | 'year' | 'all').
 */
export function filterRequestsByTimeRange(requests = [], range = 'all', now = new Date()) {
  if (!Array.isArray(requests)) return [];
  if (!range || range === 'all') return [...requests];
  const { start, end } = getTimeRangeBounds(range, now);
  if (!start || !end) return [...requests];
  const startMs = start.getTime();
  const endMs = end.getTime();

  return requests.filter((req) => {
    const dt = getRequestTimestamp(req);
    if (!dt) return false;
    const ms = dt.getTime();
    return ms >= startMs && ms <= endMs;
  });
}

/**
 * Check whether a loan request is currently overdue.
 * Only active/approved loans (not returned/rejected) past their dueDate are overdue.
 */
export function isRequestOverdue(request, now = new Date()) {
  if (!request || request.status !== 'approved') return false;
  const due = parseDueDate(request.dueDate);
  if (!due) return false;
  const ref = parseValidDate(now) || new Date();
  return due.getTime() < ref.getTime();
}

/**
 * Determine if a returned request was returned on time.
 * Compares `returnedAt` (or fallback `returnDate` / `updated`) with `dueDate` (or `returnDate` deadline).
 * Returns true (on-time), false (late), or null (not returned or missing valid dates).
 */
export function isReturnedOnTime(request) {
  if (!request || request.status !== 'returned') return null;
  const actualReturn =
    parseValidDate(request.returnedAt) ||
    parseValidDate(request.returnDate) ||
    parseValidDate(request.updated);
  const due = parseDueDate(request.dueDate);
  if (!actualReturn || !due) return null;
  return actualReturn.getTime() <= due.getTime();
}

/**
 * Filter requests by drill-down card key or tab key.
 */
export function filterRequestsByDrilldown(requests = [], filter = 'all', now = new Date()) {
  if (!Array.isArray(requests)) return [];
  switch (filter) {
    case 'pending_all':
      return requests.filter((r) => r.status === 'pending_teacher' || r.status === 'pending_caretaker');
    case 'pending':
    case 'pending_caretaker':
      return requests.filter((r) => r.status === 'pending_caretaker');
    case 'pending_teacher':
      return requests.filter((r) => r.status === 'pending_teacher');
    case 'approved':
    case 'active':
      return requests.filter((r) => r.status === 'approved');
    case 'overdue':
      return requests.filter((r) => isRequestOverdue(r, now));
    case 'returned':
      return requests.filter((r) => r.status === 'returned');
    case 'rejected':
      return requests.filter((r) => r.status === 'rejected');
    case 'all':
    default:
      return [...requests];
  }
}

const THAI_SHORT_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatMonthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Build trend buckets (daily or monthly bars) for loan request volume.
 */
export function computeRequestTrend(requests = [], range = 'all', now = new Date()) {
  const ref = parseValidDate(now) || new Date();
  const safeRequests = Array.isArray(requests) ? requests : [];

  if (range === 'today' || range === '7d') {
    const days = range === 'today' ? 1 : 7;
    const buckets = [];
    const map = new Map();
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - i);
      const key = formatDateKey(dt);
      const label = `${dt.getDate()} ${THAI_SHORT_MONTHS[dt.getMonth()]}`;
      const bucket = { key, label, count: 0, approved: 0, returned: 0 };
      buckets.push(bucket);
      map.set(key, bucket);
    }
    for (const req of safeRequests) {
      const dt = getRequestTimestamp(req);
      if (!dt) continue;
      const bucket = map.get(formatDateKey(dt));
      if (bucket) {
        bucket.count += 1;
        if (req.status === 'approved') bucket.approved += 1;
        if (req.status === 'returned') bucket.returned += 1;
      }
    }
    return buckets;
  }

  if (range === 'month') {
    const y = ref.getFullYear();
    const m = ref.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const buckets = [];
    const map = new Map();
    for (let day = 1; day <= daysInMonth; day++) {
      const dt = new Date(y, m, day);
      const key = formatDateKey(dt);
      const label = `${day}`;
      const bucket = { key, label, count: 0, approved: 0, returned: 0 };
      buckets.push(bucket);
      map.set(key, bucket);
    }
    for (const req of safeRequests) {
      const dt = getRequestTimestamp(req);
      if (!dt) continue;
      const bucket = map.get(formatDateKey(dt));
      if (bucket) {
        bucket.count += 1;
        if (req.status === 'approved') bucket.approved += 1;
        if (req.status === 'returned') bucket.returned += 1;
      }
    }
    return buckets;
  }

  if (range === 'year') {
    const y = ref.getFullYear();
    const buckets = [];
    const map = new Map();
    for (let m = 0; m < 12; m++) {
      const dt = new Date(y, m, 1);
      const key = formatMonthKey(dt);
      const label = THAI_SHORT_MONTHS[m];
      const bucket = { key, label, count: 0, approved: 0, returned: 0 };
      buckets.push(bucket);
      map.set(key, bucket);
    }
    for (const req of safeRequests) {
      const dt = getRequestTimestamp(req);
      if (!dt) continue;
      const bucket = map.get(formatMonthKey(dt));
      if (bucket) {
        bucket.count += 1;
        if (req.status === 'approved') bucket.approved += 1;
        if (req.status === 'returned') bucket.returned += 1;
      }
    }
    return buckets;
  }

  // 'all' -> last 6 months up to `now`
  const buckets = [];
  const map = new Map();
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const key = formatMonthKey(dt);
    const label = `${THAI_SHORT_MONTHS[dt.getMonth()]} ${String(dt.getFullYear() + 543).slice(-2)}`;
    const bucket = { key, label, count: 0, approved: 0, returned: 0 };
    buckets.push(bucket);
    map.set(key, bucket);
  }
  for (const req of safeRequests) {
    const dt = getRequestTimestamp(req);
    if (!dt) continue;
    const bucket = map.get(formatMonthKey(dt));
    if (bucket) {
      bucket.count += 1;
      if (req.status === 'approved') bucket.approved += 1;
      if (req.status === 'returned') bucket.returned += 1;
    }
  }
  return buckets;
}

/**
 * Compute comprehensive Borrowly admin statistics for a given dataset and time range.
 */
export function computeAdminStats({ items = [], requests = [], range = 'all', now = new Date() } = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const safeRequests = Array.isArray(requests) ? requests : [];
  const ref = parseValidDate(now) || new Date();

  const normalizedInventory = safeItems.map((item) => {
    const available = Math.max(0, Number(item?.available) || 0);
    const total = Math.max(0, Number(item?.total) || 0, available);
    return { total, available: Math.min(available, total) };
  });
  const totalUnits = normalizedInventory.reduce((sum, item) => sum + item.total, 0);
  const availableUnits = normalizedInventory.reduce((sum, item) => sum + item.available, 0);
  const inventoryBorrowedUnits = Math.max(0, totalUnits - availableUnits);

  const filteredRequests = filterRequestsByTimeRange(safeRequests, range, ref);

  const pendingTeacher = filteredRequests.filter((r) => r?.status === 'pending_teacher').length;
  const pendingCaretaker = filteredRequests.filter((r) => r?.status === 'pending_caretaker').length;
  const pending = pendingTeacher + pendingCaretaker;

  const approvedList = filteredRequests.filter((r) => r?.status === 'approved');
  const activeLoans = approvedList.length;
  const activeBorrowedItemsCount = approvedList.reduce(
    (sum, r) => sum + (Array.isArray(r?.items) && r.items.length > 0 ? r.items.length : (Array.isArray(r?.itemIds) ? r.itemIds.length : 0)),
    0
  );
  const currentlyBorrowed = activeLoans;
  const borrowedUnits = inventoryBorrowedUnits > 0 ? inventoryBorrowedUnits : activeBorrowedItemsCount;

  const overdue = approvedList.filter((r) => isRequestOverdue(r, ref)).length;
  const returnedList = filteredRequests.filter((r) => r?.status === 'returned');
  const returned = returnedList.length;
  const rejected = filteredRequests.filter((r) => r?.status === 'rejected').length;

  const borrowers = new Set(
    filteredRequests.map((r) => String(r?.email || '').trim().toLowerCase()).filter(Boolean)
  ).size;

  let onTimeCount = 0;
  let lateReturnCount = 0;
  let evaluatedReturnCount = 0;
  for (const req of returnedList) {
    const onTime = isReturnedOnTime(req);
    if (onTime === true) {
      onTimeCount += 1;
      evaluatedReturnCount += 1;
    } else if (onTime === false) {
      lateReturnCount += 1;
      evaluatedReturnCount += 1;
    }
  }
  const onTimeReturnRate =
    evaluatedReturnCount > 0 ? Math.round((onTimeCount / evaluatedReturnCount) * 1000) / 10 : null;

  const itemNameMap = new Map(safeItems.map((item) => [item.id, item.name || item.id]));
  const itemBorrowCounts = new Map();
  for (const req of filteredRequests) {
    if (!req || req.status === 'rejected') continue;
    const ids = Array.isArray(req.items) && req.items.length > 0 ? req.items : (Array.isArray(req.itemIds) ? req.itemIds : []);
    for (const rawId of ids) {
      const id = String(rawId || '').trim();
      if (!id) continue;
      itemBorrowCounts.set(id, (itemBorrowCounts.get(id) || 0) + 1);
    }
  }

  const topItems = [...itemBorrowCounts.entries()]
    .map(([id, count]) => ({
      id,
      name: itemNameMap.get(id) || id,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th'));

  const popularEquipment = topItems[0] || null;
  const trend = computeRequestTrend(filteredRequests, range, ref);

  return {
    range,
    items: safeItems.length,
    totalUnits,
    availableUnits,
    borrowedUnits,
    currentlyBorrowed,
    activeLoans,
    pending,
    pendingTeacher,
    pendingCaretaker,
    overdue,
    returned,
    rejected,
    totalRequests: filteredRequests.length,
    borrowers,
    onTimeReturnRate,
    onTimeCount,
    lateReturnCount,
    evaluatedReturnCount,
    popularEquipment,
    topItems: topItems.slice(0, 5),
    trend,
    generatedAt: ref.toISOString(),
  };
}
