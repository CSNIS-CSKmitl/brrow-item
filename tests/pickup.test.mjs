import test from "node:test";
import assert from "node:assert/strict";
import {
  PICKUP_LOCATION,
  MORNING_SLOTS,
  AFTERNOON_SLOTS,
  ALL_PICKUP_SLOTS,
  isWeekday,
  isValidPickupDate,
  isValidPickupSlot,
  buildPickupIsoTime,
  needsUserPickupSelection,
} from "../src/lib/pickup.js";
import { resolveLoanRecipients } from "../src/lib/server/notification.js";

test("pickup constants define อาคารพระจอมเกล้า ห้อง 713 and 24 fifteen-minute slots excluding lunch", () => {
  assert.equal(PICKUP_LOCATION, "อาคารพระจอมเกล้า ห้อง 713");
  assert.equal(MORNING_SLOTS.length, 12);
  assert.equal(AFTERNOON_SLOTS.length, 12);
  assert.equal(ALL_PICKUP_SLOTS.length, 24);
  assert.equal(MORNING_SLOTS[0], "09:00-09:15");
  assert.equal(MORNING_SLOTS[11], "11:45-12:00");
  assert.equal(AFTERNOON_SLOTS[0], "13:00-13:15");
  assert.equal(AFTERNOON_SLOTS[11], "15:45-16:00");
  assert.equal(isValidPickupSlot("12:00-12:15"), false);
  assert.equal(isValidPickupSlot("16:00-16:15"), false);
  assert.equal(isValidPickupSlot("09:15-09:30"), true);
});

test("isWeekday and isValidPickupDate enforce Mon-Fri and non-past dates", () => {
  // 2026-11-26 is Thursday, 2026-11-28 is Saturday, 2026-11-29 is Sunday
  assert.equal(isWeekday("2026-11-26"), true);
  assert.equal(isWeekday("2026-11-27"), true);
  assert.equal(isWeekday("2026-11-28"), false);
  assert.equal(isWeekday("2026-11-29"), false);
  assert.equal(isWeekday("invalid"), false);

  assert.equal(isValidPickupDate("2026-11-26", "2026-11-26"), true);
  assert.equal(isValidPickupDate("2026-11-25", "2026-11-26"), false);
  assert.equal(isValidPickupDate("2026-11-28", "2026-11-26"), false);
});

test("buildPickupIsoTime produces Bangkok +07:00 ISO timestamp", () => {
  const iso = buildPickupIsoTime("2026-11-26", "09:15-09:30");
  assert.equal(iso, "2026-11-26T02:15:00.000Z");
  assert.equal(buildPickupIsoTime("2026-11-28", "09:15-09:30"), "");
});

test("needsUserPickupSelection matches approved requests needing selection or reschedule", () => {
  assert.equal(
    needsUserPickupSelection({
      status: "approved",
      pickup_status: "pending_user_select",
    }),
    true,
  );
  assert.equal(
    needsUserPickupSelection({
      status: "approved",
      pickup_status: "reschedule_requested",
    }),
    true,
  );
  assert.equal(
    needsUserPickupSelection({
      status: "approved",
      pickup_status: "pending_caretaker_confirm",
    }),
    false,
  );
  assert.equal(
    needsUserPickupSelection({
      status: "approved",
      pickup_status: "confirmed",
    }),
    false,
  );
  assert.equal(
    needsUserPickupSelection({
      status: "pending_caretaker",
      pickup_status: "pending_user_select",
    }),
    false,
  );
});

test("resolveLoanRecipients routes pickup_proposed event to super_admin", async () => {
  const fakePb = {
    collection: () => ({
      getFullList: async () => [
        {
          id: "sa1",
          email: "caretaker@cskmitl.com",
          expand: { user_type: [{ type: "super_admin" }] },
        },
        {
          id: "st1",
          email: "student@kmitl.ac.th",
          expand: { user_type: [{ type: "students" }] },
        },
      ],
    }),
  };

  const recipients = await resolveLoanRecipients(fakePb, {
    event: "pickup_proposed",
    borrower: { email: "student@kmitl.ac.th" },
  });
  assert.deepEqual(recipients, ["caretaker@cskmitl.com"]);
});
