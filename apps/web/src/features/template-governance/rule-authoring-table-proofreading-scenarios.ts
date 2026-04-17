import type { TableRuleAuthoringDraft } from "./rule-authoring-types.ts";

export type TableProofreadingScenarioId =
  | "caption_above_table"
  | "note_below_table"
  | "three_line_layout"
  | "unit_and_stats_consistency";

export interface TableProofreadingScenario {
  id: TableProofreadingScenarioId;
  title: string;
  description: string;
  applyPatch: Partial<TableRuleAuthoringDraft["payload"]> & {
    manualReviewReasonTemplate: string;
  };
}

const TABLE_PROOFREADING_SCENARIOS: readonly TableProofreadingScenario[] = [
  {
    id: "caption_above_table",
    title: "表题置于表上",
    description: "先校对表题位置、编号样式和表题与表身之间的间距。",
    applyPatch: {
      semanticTarget: "header_cell",
      tableKind: "three_line_table",
      captionRequirement: "表题置于表上",
      layoutRequirement: "表题与表身间距一致",
      manualReviewReasonTemplate: "表题位置与编号样式需要人工复核",
    },
  },
  {
    id: "note_below_table",
    title: "表注置于表下",
    description: "适合校对统计注释、缩略语说明和表注整体摆放位置。",
    applyPatch: {
      semanticTarget: "footnote_item",
      noteKind: "general",
      captionRequirement: "表题置于表上",
      layoutRequirement: "表注置于表下",
      manualReviewReasonTemplate: "表注位置与注释顺序需要人工复核",
    },
  },
  {
    id: "three_line_layout",
    title: "三线表与禁用竖线",
    description: "适合校对三线表横线层级、竖线禁用和表身边界样式。",
    applyPatch: {
      semanticTarget: "header_cell",
      tableKind: "three_line_table",
      captionRequirement: "表题置于表上",
      layoutRequirement: "三线表与禁用竖线",
      manualReviewReasonTemplate: "三线表线型与表注位置需要人工复核",
    },
  },
  {
    id: "unit_and_stats_consistency",
    title: "单位与统计注释一致",
    description: "适合校对单位标注、统计学符号和脚注说明是否前后一致。",
    applyPatch: {
      semanticTarget: "data_cell",
      noteKind: "statistical_significance",
      unitContext: "header",
      captionRequirement: "单位标注前后一致",
      layoutRequirement: "单位与统计注释一致",
      manualReviewReasonTemplate: "单位标注与统计学注释需要人工交叉复核",
    },
  },
] as const;

export function listTableProofreadingScenarios(): TableProofreadingScenario[] {
  return [...TABLE_PROOFREADING_SCENARIOS];
}

export function getTableProofreadingScenario(
  scenarioId: TableProofreadingScenarioId,
): TableProofreadingScenario {
  const matchedScenario = TABLE_PROOFREADING_SCENARIOS.find(
    (scenario) => scenario.id === scenarioId,
  );
  if (!matchedScenario) {
    throw new Error(`Unsupported table proofreading scenario: ${scenarioId}`);
  }

  return matchedScenario;
}

export function applyTableProofreadingScenario(
  draft: TableRuleAuthoringDraft,
  scenarioId: TableProofreadingScenarioId,
): TableRuleAuthoringDraft {
  const scenario = getTableProofreadingScenario(scenarioId);
  const manualReviewReasonTemplate = scenario.applyPatch.manualReviewReasonTemplate;

  return {
    ...draft,
    manualReviewReasonTemplate,
    payload: {
      ...draft.payload,
      ...scenario.applyPatch,
      manualReviewReasonTemplate,
    },
  };
}
