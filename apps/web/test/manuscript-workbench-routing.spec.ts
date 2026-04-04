import test from "node:test";
import assert from "node:assert/strict";
import {
  formatWorkbenchHash,
  isWorkbenchImplemented,
  resolveWorkbenchLocation,
  resolveWorkbenchRenderKind,
} from "../src/app/workbench-routing.ts";

test("workbench routing exposes manuscript processing surfaces as implemented", () => {
  assert.equal(isWorkbenchImplemented("submission"), true);
  assert.equal(isWorkbenchImplemented("screening"), true);
  assert.equal(isWorkbenchImplemented("editing"), true);
  assert.equal(isWorkbenchImplemented("proofreading"), true);
  assert.equal(isWorkbenchImplemented("evaluation-workbench"), true);
  assert.equal(isWorkbenchImplemented("harness-datasets"), true);
  assert.equal(isWorkbenchImplemented("template-governance"), true);
});

test("workbench routing maps manuscript processing surfaces to the manuscript workbench", () => {
  assert.equal(resolveWorkbenchRenderKind("submission"), "manuscript-workbench");
  assert.equal(resolveWorkbenchRenderKind("screening"), "manuscript-workbench");
  assert.equal(resolveWorkbenchRenderKind("editing"), "manuscript-workbench");
  assert.equal(resolveWorkbenchRenderKind("proofreading"), "manuscript-workbench");
  assert.equal(resolveWorkbenchRenderKind("knowledge-review"), "knowledge-review");
  assert.equal(resolveWorkbenchRenderKind("evaluation-workbench"), "evaluation-workbench");
  assert.equal(resolveWorkbenchRenderKind("harness-datasets"), "harness-datasets");
  assert.equal(resolveWorkbenchRenderKind("template-governance"), "template-governance");
});

test("workbench routing formats and resolves manuscript handoff hashes", () => {
  const hash = formatWorkbenchHash("proofreading", "manuscript-42");

  assert.equal(hash, "#proofreading?manuscriptId=manuscript-42");
  assert.deepEqual(resolveWorkbenchLocation(hash), {
    workbenchId: "proofreading",
    manuscriptId: "manuscript-42",
  });
});

test("workbench routing formats and resolves sample-context manuscript handoff hashes", () => {
  const hash = formatWorkbenchHash("editing", {
    manuscriptId: "manuscript-42",
    reviewedCaseSnapshotId: "snapshot-42",
    sampleSetItemId: "sample-item-42",
  });

  assert.equal(
    hash,
    "#editing?manuscriptId=manuscript-42&reviewedCaseSnapshotId=snapshot-42&sampleSetItemId=sample-item-42",
  );
  assert.deepEqual(resolveWorkbenchLocation(hash), {
    workbenchId: "editing",
    manuscriptId: "manuscript-42",
    reviewedCaseSnapshotId: "snapshot-42",
    sampleSetItemId: "sample-item-42",
  });
});

test("workbench routing formats and resolves knowledge review handoff hashes", () => {
  const hash = formatWorkbenchHash("knowledge-review", {
    knowledgeItemId: "knowledge-42",
  });

  assert.equal(hash, "#knowledge-review?knowledgeItemId=knowledge-42");
  assert.deepEqual(resolveWorkbenchLocation(hash), {
    workbenchId: "knowledge-review",
    knowledgeItemId: "knowledge-42",
  });
});
