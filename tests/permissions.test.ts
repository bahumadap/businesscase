import assert from "node:assert/strict";
import test from "node:test";
import { can, permissionContext } from "../worker/permissions";

test("local development keeps the API usable without auth headers", () => {
  const context = permissionContext(new Request("http://localhost/api/enterprise"), false);
  assert(!(context instanceof Response));
  if (context instanceof Response) return;
  assert.equal(context.enforced, false);
  assert.equal(can(context, "edit"), true);
});

test("enforced auth rejects missing identity and role", () => {
  const context = permissionContext(new Request("http://localhost/api/enterprise"), true);
  assert(context instanceof Response);
  if (!(context instanceof Response)) return;
  assert.equal(context.status, 401);
});

test("viewer can read but cannot edit or inspect audit", () => {
  const context = permissionContext(new Request("http://localhost/api/enterprise", { headers: { "x-yol1-user": "finance@example.com", "x-yol1-role": "viewer" } }), true);
  assert(!(context instanceof Response));
  if (context instanceof Response) return;
  assert.equal(can(context, "read"), true);
  assert.equal(can(context, "edit"), false);
  assert.equal(can(context, "read_audit"), false);
});
