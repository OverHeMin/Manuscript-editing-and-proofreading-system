import test from "node:test";
import assert from "node:assert/strict";
import type { TemplateGovernanceWorkbenchController } from "../src/features/template-governance/template-governance-controller.ts";
import { loadTemplateGovernanceV2SectionData } from "../src/features/template-governance/template-governance-v2-data.ts";
import type { TemplateGovernanceV2RouteState } from "../src/features/template-governance/template-governance-v2-types.ts";

test("rule center V2 data loads dashboard from overview only", async () => {
  const { controller, calls } = createMockController();

  const result = await loadTemplateGovernanceV2SectionData(
    controller,
    routeState({ section: "dashboard" }),
  );

  assert.equal(result.section, "dashboard");
  assert.deepEqual(calls, [["loadOverview", undefined]]);
});

test("rule center V2 data loads rules from overview and rule ledger", async () => {
  const { controller, calls } = createMockController();

  const result = await loadTemplateGovernanceV2SectionData(
    controller,
    routeState({
      section: "rules",
      selectedKind: "rule-ledger-row",
      selectedId: "rule-row-42",
    }),
  );

  assert.equal(result.section, "rules");
  assert.deepEqual(calls, [
    ["loadOverview", undefined],
    ["loadRuleLedger", { selectedRowId: "rule-row-42" }],
  ]);
});

test("rule center V2 data loads template sections from their real sources", async () => {
  const { controller, calls } = createMockController();

  await loadTemplateGovernanceV2SectionData(
    controller,
    routeState({
      section: "templates",
      subtype: "large",
      selectedKind: "template",
      selectedId: "template-42",
    }),
  );
  await loadTemplateGovernanceV2SectionData(
    controller,
    routeState({ section: "templates", subtype: "journal" }),
  );

  assert.deepEqual(calls, [
    ["loadTemplateLedger", { selectedTemplateId: "template-42" }],
    ["loadOverview", undefined],
  ]);
});

test("rule center V2 data loads package sections by module class", async () => {
  const { controller, calls } = createMockController();

  await loadTemplateGovernanceV2SectionData(
    controller,
    routeState({
      section: "packages",
      subtype: "general",
      selectedKind: "package",
      selectedId: "general-module-42",
    }),
  );
  await loadTemplateGovernanceV2SectionData(
    controller,
    routeState({
      section: "packages",
      subtype: "medical",
      selectedKind: "package",
      selectedId: "medical-module-42",
    }),
  );

  assert.deepEqual(calls, [
    [
      "loadContentModuleLedger",
      { moduleClass: "general", selectedModuleId: "general-module-42" },
    ],
    [
      "loadContentModuleLedger",
      {
        moduleClass: "medical_specialized",
        selectedModuleId: "medical-module-42",
      },
    ],
  ]);
});

test("rule center V2 data loads extraction and recovery from dedicated methods", async () => {
  const { controller, calls } = createMockController();

  await loadTemplateGovernanceV2SectionData(
    controller,
    routeState({
      section: "extraction",
      selectedKind: "extraction-task",
      selectedId: "task-42",
    }),
  );
  await loadTemplateGovernanceV2SectionData(
    controller,
    routeState({ section: "recovery" }),
  );

  assert.deepEqual(calls, [
    ["loadExtractionLedger", { selectedTaskId: "task-42" }],
    ["loadLearningCandidates", undefined],
    ["loadReviewItems", undefined],
  ]);
});

test("rule center V2 data loads release and advanced from overview", async () => {
  const { controller, calls } = createMockController();

  await loadTemplateGovernanceV2SectionData(
    controller,
    routeState({ section: "release" }),
  );
  await loadTemplateGovernanceV2SectionData(
    controller,
    routeState({ section: "advanced" }),
  );

  assert.deepEqual(calls, [
    ["loadOverview", undefined],
    ["loadOverview", undefined],
  ]);
});

function routeState(
  input: Partial<TemplateGovernanceV2RouteState> &
    Pick<TemplateGovernanceV2RouteState, "section">,
): TemplateGovernanceV2RouteState {
  return {
    section: input.section,
    panel: input.panel ?? "none",
    selectedKind: input.selectedKind ?? "none",
    selectedId: input.selectedId,
    subtype: input.subtype,
  };
}

function createMockController() {
  const calls: Array<[string, unknown]> = [];
  const controller = {
    async loadOverview(input?: unknown) {
      calls.push(["loadOverview", input]);
      return { kind: "overview" };
    },
    async loadRuleLedger(input?: unknown) {
      calls.push(["loadRuleLedger", input]);
      return { kind: "rule-ledger" };
    },
    async loadTemplateLedger(input?: unknown) {
      calls.push(["loadTemplateLedger", input]);
      return { kind: "template-ledger" };
    },
    async loadContentModuleLedger(input: unknown) {
      calls.push(["loadContentModuleLedger", input]);
      return { kind: "content-module-ledger" };
    },
    async loadExtractionLedger(input?: unknown) {
      calls.push(["loadExtractionLedger", input]);
      return { kind: "extraction-ledger" };
    },
    async loadLearningCandidates() {
      calls.push(["loadLearningCandidates", undefined]);
      return [];
    },
    async loadReviewItems(input?: unknown) {
      calls.push(["loadReviewItems", input]);
      return [];
    },
  } as unknown as TemplateGovernanceWorkbenchController;

  return { controller, calls };
}
