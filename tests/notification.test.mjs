import test from "node:test";
import assert from "node:assert/strict";
import { resolveLoanRecipients } from "../src/lib/server/notification.js";

function createMockPb(users) {
  return {
    collection(name) {
      assert.equal(name, "users");
      return {
        async getFullList() {
          return users;
        },
      };
    },
  };
}

const mockUsers = [
  { id: "stu1", email: "student@kmitl.ac.th", roles: ["students"] },
  { id: "tch1", email: "teacher@kmitl.ac.th", roles: ["teachers"] },
  { id: "stf1", email: "staff@kmitl.ac.th", roles: ["staff"] },
  { id: "sa1", email: "super1@kmitl.ac.th", roles: ["super_admin"] },
  { id: "sa2", email: "super2@kmitl.ac.th", roles: ["superadmin"] },
  { id: "adm1", email: "admin@kmitl.ac.th", roles: ["admin"] },
];

test("student borrows: notifies selected teacher AND super_admin", async () => {
  const pb = createMockPb(mockUsers);
  const recipients = await resolveLoanRecipients(pb, {
    event: "created",
    borrower: mockUsers[0],
    teacherEmail: "teacher@kmitl.ac.th",
  });

  assert.deepEqual(recipients.sort(), [
    "super1@kmitl.ac.th",
    "super2@kmitl.ac.th",
    "teacher@kmitl.ac.th",
  ]);
});

test("teacher approves student request: notifies super_admin only", async () => {
  const pb = createMockPb(mockUsers);
  const recipients = await resolveLoanRecipients(pb, {
    event: "teacher_approved",
    borrower: mockUsers[0],
    teacherEmail: "teacher@kmitl.ac.th",
    actorEmail: "teacher@kmitl.ac.th",
  });

  assert.deepEqual(recipients.sort(), [
    "super1@kmitl.ac.th",
    "super2@kmitl.ac.th",
  ]);
});

test("teacher borrows: notifies super_admin directly", async () => {
  const pb = createMockPb(mockUsers);
  const recipients = await resolveLoanRecipients(pb, {
    event: "created",
    borrower: mockUsers[1],
    teacherEmail: "",
  });

  assert.deepEqual(recipients.sort(), [
    "super1@kmitl.ac.th",
    "super2@kmitl.ac.th",
  ]);
});

test("staff borrows: notifies super_admin directly", async () => {
  const pb = createMockPb(mockUsers);
  const recipients = await resolveLoanRecipients(pb, {
    event: "created",
    borrower: mockUsers[2],
    teacherEmail: "",
  });

  assert.deepEqual(recipients.sort(), [
    "super1@kmitl.ac.th",
    "super2@kmitl.ac.th",
  ]);
});
