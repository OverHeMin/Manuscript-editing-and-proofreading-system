import test from "node:test";
import assert from "node:assert/strict";
import {
  AuthorizationError,
  PermissionGuard,
} from "../../src/auth/permission-guard.ts";

test("role-based permission guard allows only the expected workbench-sensitive actions", () => {
  const guard = new PermissionGuard();

  assert.equal(guard.can("admin", "permissions.manage"), true);
  assert.equal(guard.can("editor", "workbench.screening"), true);
  assert.equal(guard.can("editor", "workbench.editing"), true);
  assert.equal(guard.can("editor", "workbench.proofreading"), true);
  assert.equal(guard.can("admin", "template-governance.manage"), true);
  assert.equal(guard.can("knowledge_reviewer", "workbench.screening"), true);
  assert.equal(guard.can("knowledge_reviewer", "workbench.editing"), true);
  assert.equal(guard.can("knowledge_reviewer", "workbench.proofreading"), true);
  assert.equal(guard.can("knowledge_reviewer", "knowledge.review"), true);
  assert.equal(guard.can("knowledge_reviewer", "learning.review"), true);
  assert.equal(guard.can("knowledge_reviewer", "template-governance.manage"), true);
  assert.equal(guard.can("admin", "learning.review"), true);
  assert.equal(guard.can("admin", "templates.publish"), true);
  assert.equal(guard.can("editor", "templates.publish"), false);
  assert.equal(guard.can("editor", "permissions.manage"), false);
  assert.equal(guard.can("editor", "template-governance.manage"), false);

  assert.throws(
    () => guard.assert("proofreader", "knowledge.review"),
    AuthorizationError,
  );

  assert.doesNotThrow(() => guard.assert("screener", "workbench.screening"));
  assert.doesNotThrow(() => guard.assert("admin", "learning.review"));
});

test("internal team roles keep the intended bounded matrix while legacy desk roles stay compatible", () => {
  const guard = new PermissionGuard();

  assert.deepEqual(guard.permissionsFor("user"), ["manuscripts.submit"]);
  assert.deepEqual(guard.permissionsFor("screener"), ["workbench.screening"]);
  assert.deepEqual(guard.permissionsFor("editor"), [
    "workbench.screening",
    "workbench.editing",
    "workbench.proofreading",
  ]);
  assert.deepEqual(guard.permissionsFor("proofreader"), ["workbench.proofreading"]);
  assert.deepEqual(guard.permissionsFor("knowledge_reviewer"), [
    "workbench.screening",
    "workbench.editing",
    "workbench.proofreading",
    "knowledge.review",
    "learning.review",
    "template-governance.manage",
  ]);

  assert.equal(guard.can("knowledge_reviewer", "manuscripts.submit"), false);
  assert.equal(guard.can("knowledge_reviewer", "permissions.manage"), false);
  assert.equal(guard.can("user", "permissions.manage"), false);
  assert.equal(guard.can("proofreader", "workbench.screening"), false);
  assert.equal(guard.can("screener", "workbench.proofreading"), false);
});
