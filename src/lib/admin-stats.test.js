import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIME_RANGES,
  parseValidDate,
  parseDueDate,
  getTimeRangeBounds,
  filterRequestsByTimeRange,
  filterRequestsByDrilldown,
  isRequestOverdue,
  isReturnedOnTime,
  computeRequestTrend,
  computeAdminStats,
} from './admin-stats.js';

const NOW = new Date('2026-10-17T14:30:00.000Z');

test('TIME_RANGES defines all 5 expected range filters', () => {
  assert.deepEqual(
    TIME_RANGES.map((r) => r.value),
    ['today', '7d', 'month', 'year', 'all']
  );
});

test('parseValidDate and parseDueDate handle valid, PocketBase, date-only, and invalid strings', () => {
  assert.equal(parseValidDate(null), null);
  assert.equal(parseValidDate(''), null);
  assert.equal(parseValidDate('not-a-date'), null);

  const pbDate = parseValidDate('2026-10-15 09:00:00.000Z');
  assert.ok(pbDate instanceof Date);
  assert.equal(pbDate.toISOString(), '2026-10-15T09:00:00.000Z');

  const dueDateOnly = parseDueDate('2026-10-17');
  assert.ok(dueDateOnly instanceof Date);
  assert.equal(dueDateOnly.getHours(), 23);
  assert.equal(dueDateOnly.getMinutes(), 59);
  assert.equal(dueDateOnly.getSeconds(), 59);
});

test('isRequestOverdue only marks approved requests past dueDate as overdue', () => {
  assert.equal(
    isRequestOverdue({ status: 'approved', dueDate: '2026-10-16T10:00:00.000Z' }, NOW),
    true
  );
  assert.equal(
    isRequestOverdue({ status: 'approved', dueDate: '2026-10-18T10:00:00.000Z' }, NOW),
    false
  );
  assert.equal(
    isRequestOverdue({ status: 'returned', dueDate: '2026-10-10T10:00:00.000Z' }, NOW),
    false
  );
  assert.equal(
    isRequestOverdue({ status: 'pending_caretaker', dueDate: '2026-10-10T10:00:00.000Z' }, NOW),
    false
  );
  assert.equal(
    isRequestOverdue({ status: 'approved', dueDate: 'invalid-date' }, NOW),
    false
  );
});

test('isReturnedOnTime compares returnedAt (or updated) against dueDate', () => {
  // Returned before dueDate -> true
  assert.equal(
    isReturnedOnTime({
      status: 'returned',
      dueDate: '2026-10-15T12:00:00.000Z',
      returnedAt: '2026-10-15T10:00:00.000Z',
    }),
    true
  );

  // Returned after dueDate -> false
  assert.equal(
    isReturnedOnTime({
      status: 'returned',
      dueDate: '2026-10-15T12:00:00.000Z',
      returnedAt: '2026-10-16T08:00:00.000Z',
    }),
    false
  );

  // Fallback to updated when returnedAt is missing
  assert.equal(
    isReturnedOnTime({
      status: 'returned',
      dueDate: '2026-10-15T12:00:00.000Z',
      updated: '2026-10-15T11:30:00.000Z',
    }),
    true
  );

  // Non-returned or missing dates -> null
  assert.equal(
    isReturnedOnTime({
      status: 'approved',
      dueDate: '2026-10-15T12:00:00.000Z',
      returnedAt: '2026-10-15T10:00:00.000Z',
    }),
    null
  );
  assert.equal(
    isReturnedOnTime({
      status: 'returned',
      dueDate: 'invalid',
      returnedAt: '2026-10-15T10:00:00.000Z',
    }),
    null
  );
});

test('filterRequestsByTimeRange filters today, 7d, month, year, and all accurately', () => {
  const refLocal = new Date(2026, 9, 17, 15, 0, 0); // Oct 17, 2026 local
  const sample = [
    { id: 'today-1', created: new Date(2026, 9, 17, 9, 0, 0).toISOString() },
    { id: 'five-days-ago', created: new Date(2026, 9, 12, 12, 0, 0).toISOString() },
    { id: 'early-oct', created: new Date(2026, 9, 2, 12, 0, 0).toISOString() },
    { id: 'earlier-year', created: new Date(2026, 2, 15, 12, 0, 0).toISOString() },
    { id: 'prev-year', created: new Date(2025, 11, 20, 12, 0, 0).toISOString() },
    { id: 'bad-date', created: 'invalid-date' },
  ];

  assert.deepEqual(
    filterRequestsByTimeRange(sample, 'today', refLocal).map((r) => r.id),
    ['today-1']
  );
  assert.deepEqual(
    filterRequestsByTimeRange(sample, '7d', refLocal).map((r) => r.id),
    ['today-1', 'five-days-ago']
  );
  assert.deepEqual(
    filterRequestsByTimeRange(sample, 'month', refLocal).map((r) => r.id),
    ['today-1', 'five-days-ago', 'early-oct']
  );
  assert.deepEqual(
    filterRequestsByTimeRange(sample, 'year', refLocal).map((r) => r.id),
    ['today-1', 'five-days-ago', 'early-oct', 'earlier-year']
  );
  assert.equal(filterRequestsByTimeRange(sample, 'all', refLocal).length, 6);
});

test('filterRequestsByDrilldown filters by pending_all, approved, overdue, returned, rejected, and all', () => {
  const list = [
    { id: '1', status: 'pending_teacher' },
    { id: '2', status: 'pending_caretaker' },
    { id: '3', status: 'approved', dueDate: '2026-10-10T00:00:00.000Z' },
    { id: '4', status: 'approved', dueDate: '2026-10-20T00:00:00.000Z' },
    { id: '5', status: 'returned' },
    { id: '6', status: 'rejected' },
  ];

  assert.equal(filterRequestsByDrilldown(list, 'pending_all', NOW).length, 2);
  assert.equal(filterRequestsByDrilldown(list, 'pending', NOW).length, 1);
  assert.equal(filterRequestsByDrilldown(list, 'approved', NOW).length, 2);
  assert.equal(filterRequestsByDrilldown(list, 'overdue', NOW).length, 1);
  assert.equal(filterRequestsByDrilldown(list, 'overdue', NOW)[0].id, '3');
  assert.equal(filterRequestsByDrilldown(list, 'returned', NOW).length, 1);
  assert.equal(filterRequestsByDrilldown(list, 'rejected', NOW).length, 1);
  assert.equal(filterRequestsByDrilldown(list, 'all', NOW).length, 6);
});

test('computeAdminStats handles empty data without errors or NaN', () => {
  const stats = computeAdminStats({ items: [], requests: [], range: 'all', now: NOW });
  assert.equal(stats.items, 0);
  assert.equal(stats.totalUnits, 0);
  assert.equal(stats.availableUnits, 0);
  assert.equal(stats.borrowedUnits, 0);
  assert.equal(stats.currentlyBorrowed, 0);
  assert.equal(stats.pending, 0);
  assert.equal(stats.overdue, 0);
  assert.equal(stats.returned, 0);
  assert.equal(stats.borrowers, 0);
  assert.equal(stats.onTimeReturnRate, null);
  assert.equal(stats.popularEquipment, null);
  assert.equal(stats.trend.length, 6);
});

test('computeAdminStats normalizes legacy inventory where available exceeds total', () => {
  const stats = computeAdminStats({
    items: [{ id: 'legacy', name: 'Legacy item', total: 0, available: 9 }],
    requests: [],
    range: 'all',
    now: NOW,
  });
  assert.equal(stats.totalUnits, 9);
  assert.equal(stats.availableUnits, 9);
  assert.equal(stats.borrowedUnits, 0);
});

test('computeAdminStats calculates popular equipment, on-time return rate, overdue, and trend buckets', () => {
  const items = [
    { id: 'cam', name: 'กล้อง Olympus', total: 4, available: 2 },
    { id: 'proj', name: 'โปรเจคเตอร์ Epson', total: 3, available: 3 },
  ];
  const requests = [
    {
      id: 'r1',
      status: 'approved',
      itemIds: ['cam', 'proj'],
      email: 'student1@kmitl.ac.th',
      dueDate: '2026-10-10T10:00:00.000Z', // overdue
      created: '2026-10-12T08:00:00.000Z',
    },
    {
      id: 'r2',
      status: 'returned',
      itemIds: ['cam'],
      email: 'student2@kmitl.ac.th',
      dueDate: '2026-10-15T12:00:00.000Z',
      returnedAt: '2026-10-15T10:00:00.000Z', // on-time
      created: '2026-10-14T08:00:00.000Z',
    },
    {
      id: 'r3',
      status: 'returned',
      itemIds: ['cam'],
      email: 'student1@kmitl.ac.th',
      dueDate: '2026-10-15T12:00:00.000Z',
      returnedAt: '2026-10-16T10:00:00.000Z', // late
      created: '2026-10-14T09:00:00.000Z',
    },
    {
      id: 'r4',
      status: 'pending_caretaker',
      itemIds: ['proj'],
      email: 'student3@kmitl.ac.th',
      dueDate: '2026-10-20T12:00:00.000Z',
      created: '2026-10-17T09:00:00.000Z',
    },
    {
      id: 'r5',
      status: 'rejected',
      itemIds: ['proj', 'proj', 'proj'], // rejected should not inflate popular equipment
      email: 'student4@kmitl.ac.th',
      dueDate: '2026-10-20T12:00:00.000Z',
      created: '2026-10-17T10:00:00.000Z',
    },
  ];

  const stats = computeAdminStats({ items, requests, range: '7d', now: NOW });
  assert.equal(stats.items, 2);
  assert.equal(stats.totalUnits, 7);
  assert.equal(stats.availableUnits, 5);
  assert.equal(stats.borrowedUnits, 2);
  assert.equal(stats.currentlyBorrowed, 1);
  assert.equal(stats.pending, 1);
  assert.equal(stats.overdue, 1);
  assert.equal(stats.returned, 2);
  assert.equal(stats.rejected, 1);
  assert.equal(stats.borrowers, 4);
  assert.equal(stats.onTimeReturnRate, 50);
  assert.equal(stats.onTimeCount, 1);
  assert.equal(stats.lateReturnCount, 1);
  assert.deepEqual(stats.popularEquipment, { id: 'cam', name: 'กล้อง Olympus', count: 3 });
  assert.equal(stats.trend.length, 7);
});
