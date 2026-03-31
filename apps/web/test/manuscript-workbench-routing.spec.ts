import test from "node:test";
import assert from "node:assert/strict";
import {
  isWorkbenchImplemented,
  resolveWorkbenchRenderKind,
} from "../src/app/workbench-routing.ts";

test("workbench routing exposes manuscript processing surfaces as implemented", () => {
  assert.equal(isWorkbenchImplemented("submission"), true);
  assert.equal(isWorkbenchImplemented("screening"), true);
  assert.equal(isWorkbenchImplemented("editing"), true);
  assert.equal(isWorkbenchImplemented("proofreading"), true);
});

test("workbench routing maps manuscript processing surfaces to the manuscript workbench", () => {
  assert.equal(resolveWorkbenchRenderKind("submission"), "manuscript-workbench");
  assert.equal(resolveWorkbenchRenderKind("screening"), "manuscript-workbench");
  assert.equal(resolveWorkbenchRenderKind("editing"), "manuscript-workbench");
  assert.equal(resolveWorkbenchRenderKind("proofreading"), "manuscript-workbench");
  assert.equal(resolveWorkbenchRenderKind("knowledge-review"), "knowledge-review");
});
