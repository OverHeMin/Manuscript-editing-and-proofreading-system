import test from "node:test";
import assert from "node:assert/strict";
import { resolveWorkbenchLocation } from "../src/app/workbench-routing.ts";
import { resolveTemplateGovernanceV2RouteState } from "../src/features/template-governance/template-governance-v2-route.ts";

test("rule center V2 route maps canonical views to stable route state", () => {
  assert.deepEqual(
    resolveTemplateGovernanceV2RouteState({
      templateGovernanceView: "overview",
    }),
    {
      section: "dashboard",
      panel: "none",
      selectedKind: "none",
      selectedId: undefined,
      subtype: undefined,
    },
  );

  assert.deepEqual(
    resolveTemplateGovernanceV2RouteState({
      templateGovernanceView: "rule-ledger",
      assetId: "asset-rule-42",
    }),
    {
      section: "rules",
      panel: "rule-detail",
      selectedKind: "rule-ledger-row",
      selectedId: "asset-rule-42",
      subtype: undefined,
    },
  );

  assert.deepEqual(
    resolveTemplateGovernanceV2RouteState({
      templateGovernanceView: "authoring",
      ruleCenterMode: "authoring",
    }),
    {
      section: "rules",
      panel: "rule-wizard",
      selectedKind: "none",
      selectedId: undefined,
      subtype: undefined,
    },
  );

  assert.deepEqual(
    resolveTemplateGovernanceV2RouteState({
      templateGovernanceView: "classic",
    }),
    {
      section: "advanced",
      panel: "advanced-compatibility",
      selectedKind: "none",
      selectedId: undefined,
      subtype: undefined,
    },
  );
});

test("rule center V2 route gives learning and AI modes priority over view", () => {
  assert.deepEqual(
    resolveTemplateGovernanceV2RouteState({
      templateGovernanceView: "large-template-ledger",
      ruleCenterMode: "learning",
      learningCandidateId: "candidate-42",
    }),
    {
      section: "recovery",
      panel: "candidate-detail",
      selectedKind: "learning-candidate",
      selectedId: "candidate-42",
      subtype: undefined,
    },
  );

  assert.deepEqual(
    resolveTemplateGovernanceV2RouteState({
      templateGovernanceView: "journal-template-ledger",
      ruleCenterMode: "learning",
      reviewItemId: "review-item-42",
    }),
    {
      section: "recovery",
      panel: "review-item-detail",
      selectedKind: "review-item",
      selectedId: "review-item-42",
      subtype: undefined,
    },
  );

  assert.deepEqual(
    resolveTemplateGovernanceV2RouteState({
      templateGovernanceView: "extraction-ledger",
      ruleCenterMode: "ai-intake",
    }),
    {
      section: "ai-intake",
      panel: "ai-intake",
      selectedKind: "none",
      selectedId: undefined,
      subtype: undefined,
    },
  );
});

test("rule center V2 route maps template and package ledgers to subtyped sections", () => {
  assert.deepEqual(
    resolveTemplateGovernanceV2RouteState({
      templateGovernanceView: "large-template-ledger",
    }),
    {
      section: "templates",
      panel: "none",
      selectedKind: "none",
      selectedId: undefined,
      subtype: "large",
    },
  );

  assert.deepEqual(
    resolveTemplateGovernanceV2RouteState({
      templateGovernanceView: "journal-template-ledger",
    }),
    {
      section: "templates",
      panel: "none",
      selectedKind: "none",
      selectedId: undefined,
      subtype: "journal",
    },
  );

  assert.deepEqual(
    resolveTemplateGovernanceV2RouteState({
      templateGovernanceView: "general-package-ledger",
    }),
    {
      section: "packages",
      panel: "none",
      selectedKind: "none",
      selectedId: undefined,
      subtype: "general",
    },
  );

  assert.deepEqual(
    resolveTemplateGovernanceV2RouteState({
      templateGovernanceView: "medical-package-ledger",
    }),
    {
      section: "packages",
      panel: "none",
      selectedKind: "none",
      selectedId: undefined,
      subtype: "medical",
    },
  );
});

test("rule center V2 route consumes normalized old aliases", () => {
  const templateLedger = resolveWorkbenchLocation(
    "#template-governance?templateGovernanceView=template-ledger",
  );
  const generalModule = resolveWorkbenchLocation(
    "#template-governance?templateGovernanceView=general-module-ledger",
  );
  const medicalModule = resolveWorkbenchLocation(
    "#template-governance?templateGovernanceView=medical-module-ledger",
  );

  assert.deepEqual(resolveTemplateGovernanceV2RouteState(templateLedger), {
    section: "templates",
    panel: "none",
    selectedKind: "none",
    selectedId: undefined,
    subtype: "large",
  });
  assert.deepEqual(resolveTemplateGovernanceV2RouteState(generalModule), {
    section: "packages",
    panel: "none",
    selectedKind: "none",
    selectedId: undefined,
    subtype: "general",
  });
  assert.deepEqual(resolveTemplateGovernanceV2RouteState(medicalModule), {
    section: "packages",
    panel: "none",
    selectedKind: "none",
    selectedId: undefined,
    subtype: "medical",
  });
});

test("rule center V2 route maps extraction selected task ids", () => {
  assert.deepEqual(
    resolveTemplateGovernanceV2RouteState({
      templateGovernanceView: "extraction-ledger",
      assetId: "task-42",
    }),
    {
      section: "extraction",
      panel: "extraction-detail",
      selectedKind: "extraction-task",
      selectedId: "task-42",
      subtype: undefined,
    },
  );
});
