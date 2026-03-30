import test from "node:test";
import assert from "node:assert/strict";
import {
  isWorkbenchImplemented,
  resolveWorkbenchRenderKind,
} from "../src/app/workbench-routing.ts";

test("workbench routing exposes learning review as an implemented surface", () => {
  assert.equal(isWorkbenchImplemented("knowledge-review"), true);
  assert.equal(isWorkbenchImplemented("learning-review"), true);
  assert.equal(isWorkbenchImplemented("admin-console"), false);
});

test("workbench routing maps learning review to a dedicated render kind", () => {
  assert.equal(resolveWorkbenchRenderKind("knowledge-review"), "knowledge-review");
  assert.equal(resolveWorkbenchRenderKind("learning-review"), "learning-review");
  assert.equal(resolveWorkbenchRenderKind("system-settings"), "placeholder");
});
