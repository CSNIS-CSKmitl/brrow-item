import test from "node:test";
import assert from "node:assert/strict";
import { isBorrowlyAdmin } from "../src/lib/roles.js";

test("isBorrowlyAdmin identifies authorized roles", () => {
  assert.equal(isBorrowlyAdmin({ email: "log@cskmitl.com" }), true);
  assert.equal(
    isBorrowlyAdmin({ expand: { user_type: { type: "admin" } } }),
    true,
  );
  assert.equal(
    isBorrowlyAdmin({ expand: { user_type: { type: "superadmin" } } }),
    true,
  );
  assert.equal(
    isBorrowlyAdmin({ expand: { user_type: { id: "000000000000005" } } }),
    true,
  );
  assert.equal(
    isBorrowlyAdmin({ expand: { user_type: { type: "student" } } }),
    false,
  );
  assert.equal(isBorrowlyAdmin(null), false);
});
