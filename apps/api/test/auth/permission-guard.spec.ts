import test from "node:test";
import assert from "node:assert/strict";
import {
  AuthorizationError,
  PermissionGuard,
} from "../../src/auth/permission-guard.ts";

test("role-based permission guard allows only the expected workbench-sensitive actions", () => {
  const guard = new PermissionGuard();

  assert.equal(guard.can("admin", "permissions.manage"), true);
  assert.equal(guard.can("knowledge_reviewer", "knowledge.review"), true);
  assert.equal(guard.can("knowledge_reviewer", "learning.review"), true);
  assert.equal(guard.can("admin", "learning.review"), true);
  assert.equal(guard.can("admin", "templates.publish"), true);
  assert.equal(guard.can("editor", "workbench.editing"), true);
  assert.equal(guard.can("editor", "templates.publish"), false);
  assert.equal(guard.can("editor", "permissions.manage"), false);

  assert.throws(
    () => guard.assert("proofreader", "knowledge.review"),
    AuthorizationError,
  );

  assert.doesNotThrow(() => guard.assert("screener", "workbench.screening"));
  assert.doesNotThrow(() => guard.assert("admin", "learning.review"));
});
