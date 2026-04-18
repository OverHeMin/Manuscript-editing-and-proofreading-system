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
  assert.equal(isWorkbenchImplemented("knowledge-library"), true);
  assert.equal(isWorkbenchImplemented("evaluation-workbench"), true);
  assert.equal(isWorkbenchImplemented("harness-datasets"), true);
  assert.equal(isWorkbenchImplemented("template-governance"), true);
  assert.equal(isWorkbenchImplemented("system-settings"), true);
});

test("workbench routing maps manuscript processing surfaces to the manuscript workbench", () => {
  assert.equal(resolveWorkbenchRenderKind("submission"), "manuscript-workbench");
  assert.equal(resolveWorkbenchRenderKind("screening"), "manuscript-workbench");
  assert.equal(resolveWorkbenchRenderKind("editing"), "manuscript-workbench");
  assert.equal(resolveWorkbenchRenderKind("proofreading"), "manuscript-workbench");
  assert.equal(resolveWorkbenchRenderKind("knowledge-library"), "knowledge-library");
  assert.equal(resolveWorkbenchRenderKind("knowledge-review"), "knowledge-review");
  assert.equal(resolveWorkbenchRenderKind("evaluation-workbench"), "evaluation-workbench");
  assert.equal(resolveWorkbenchRenderKind("harness-datasets"), "harness-datasets");
  assert.equal(resolveWorkbenchRenderKind("template-governance"), "template-governance");
  assert.equal(resolveWorkbenchRenderKind("system-settings"), "system-settings");
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

test("workbench routing keeps submission as a compatibility hash inside the manuscript desk family", () => {
  assert.equal(formatWorkbenchHash("submission"), "#submission");
  assert.deepEqual(resolveWorkbenchLocation("#submission"), {
    workbenchId: "submission",
  });
});

test("workbench routing formats and resolves knowledge library handoff hashes", () => {
  const hash = formatWorkbenchHash("knowledge-library", {
    assetId: "knowledge-42",
    revisionId: "knowledge-42-revision-2",
  });

  assert.equal(
    hash,
    "#knowledge-library?assetId=knowledge-42&revisionId=knowledge-42-revision-2",
  );
  assert.deepEqual(resolveWorkbenchLocation(hash), {
    workbenchId: "knowledge-library",
    assetId: "knowledge-42",
    revisionId: "knowledge-42-revision-2",
  });
});

test("workbench routing formats and resolves knowledge library ledger hashes", () => {
  const hash = formatWorkbenchHash("knowledge-library", {
    assetId: "knowledge-42",
    revisionId: "knowledge-42-revision-2",
    knowledgeView: "ledger",
  });

  assert.equal(
    hash,
    "#knowledge-library?assetId=knowledge-42&revisionId=knowledge-42-revision-2&knowledgeView=ledger",
  );
  assert.deepEqual(resolveWorkbenchLocation(hash), {
    workbenchId: "knowledge-library",
    assetId: "knowledge-42",
    revisionId: "knowledge-42-revision-2",
    knowledgeView: "ledger",
  });
});

test("workbench routing preserves knowledge-entry prefill template hashes", () => {
  const hash = formatWorkbenchHash("knowledge-library", {
    knowledgeView: "ledger",
    knowledgePrefillTemplateId: "journal_table_style_basis",
  });

  assert.equal(
    hash,
    "#knowledge-library?knowledgeView=ledger&knowledgePrefillTemplateId=journal_table_style_basis",
  );
  assert.deepEqual(resolveWorkbenchLocation(hash), {
    workbenchId: "knowledge-library",
    knowledgeView: "ledger",
    knowledgePrefillTemplateId: "journal_table_style_basis",
  });
});

test("workbench routing formats and resolves knowledge review revision hashes", () => {
  const hash = formatWorkbenchHash("knowledge-review", {
    revisionId: "knowledge-42-revision-2",
  });

  assert.equal(hash, "#knowledge-review?revisionId=knowledge-42-revision-2");
  assert.deepEqual(resolveWorkbenchLocation(hash), {
    workbenchId: "knowledge-review",
    revisionId: "knowledge-42-revision-2",
  });
});

test("workbench routing formats and resolves system settings section hashes", () => {
  const hash = formatWorkbenchHash("system-settings", {
    settingsSection: "ai-access",
  });

  assert.equal(hash, "#system-settings?settingsSection=ai-access");
  assert.deepEqual(resolveWorkbenchLocation(hash), {
    workbenchId: "system-settings",
    settingsSection: "ai-access",
  });
});

test("workbench routing formats and resolves harness section hashes", () => {
  const hash = formatWorkbenchHash("evaluation-workbench", {
    harnessSection: "runs",
  });

  assert.equal(hash, "#evaluation-workbench?harnessSection=runs");
  assert.deepEqual(resolveWorkbenchLocation(hash), {
    workbenchId: "evaluation-workbench",
    harnessSection: "runs",
  });
});

test("workbench routing preserves selected learning candidate ids for rule center handoffs", () => {
  const hash = formatWorkbenchHash("template-governance", {
    manuscriptId: "manuscript-42",
    templateGovernanceView: "rule-ledger",
    ruleCenterMode: "learning",
    learningCandidateId: "candidate-42",
  });

  assert.equal(
    hash,
    "#template-governance?manuscriptId=manuscript-42&templateGovernanceView=rule-ledger&ruleCenterMode=learning&learningCandidateId=candidate-42",
  );
  assert.deepEqual(resolveWorkbenchLocation(hash), {
    workbenchId: "template-governance",
    manuscriptId: "manuscript-42",
    templateGovernanceView: "rule-ledger",
    ruleCenterMode: "learning",
    learningCandidateId: "candidate-42",
  });
});
