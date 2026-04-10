import type {
  AiRuleUnderstandingPayload,
  EditIntentSignal,
  RuleEvidenceExample,
  RulePackageAutomationPosture,
  RulePackageKind,
  RulePackageSuggestedLayer,
} from "@medical/contracts";
import type { RulePackageRecognitionInput } from "./editorial-rule-package-types.ts";

export interface RulePackageSeed {
  package_id: string;
  package_kind: RulePackageKind;
  title: string;
  rule_object: string;
  suggested_layer: RulePackageSuggestedLayer;
  automation_posture: RulePackageAutomationPosture;
  status: "draft";
  summary: string;
  hit_locations: string[];
  sections: string[];
  manuscript_types: RulePackageRecognitionInput["context"]["manuscript_type"][];
  modules: RulePackageRecognitionInput["context"]["module"][];
  table_targets: string[];
  evidence_examples: RuleEvidenceExample[];
  not_applicable_when: string[];
  human_review_required_when: string[];
  supporting_signals: EditIntentSignal[];
  semantic_draft: AiRuleUnderstandingPayload;
}

type RulePackageRecognizer = (
  input: RulePackageRecognitionInput,
) => RulePackageSeed | null;

interface RulePackageBlueprint {
  kind: RulePackageKind;
  title: string;
  rule_object: string;
  suggested_layer: RulePackageSuggestedLayer;
  automation_posture: RulePackageAutomationPosture;
  default_summary: string;
  hit_locations: string[];
  sections: string[];
  table_targets: string[];
  not_applicable_when: string[];
  human_review_required_when: string[];
}

const PACKAGE_BLUEPRINTS: Record<RulePackageKind, RulePackageBlueprint> = {
  front_matter: {
    kind: "front_matter",
    title: "前置信息包",
    rule_object: "front_matter",
    suggested_layer: "journal_template",
    automation_posture: "guarded_auto",
    default_summary: "统一作者行、单位行、通信作者等前置信息的期刊口径。",
    hit_locations: ["作者信息区", "单位与通信作者区"],
    sections: ["front_matter"],
    table_targets: [],
    not_applicable_when: ["原稿缺少完整作者元数据，无法安全补写。"],
    human_review_required_when: ["新增通信作者、单位序号或英文作者块时需要人工复核。"],
  },
  abstract_keywords: {
    kind: "abstract_keywords",
    title: "摘要关键词包",
    rule_object: "abstract",
    suggested_layer: "template_family",
    automation_posture: "guarded_auto",
    default_summary: "统一摘要标签、关键词标签与常见缩写分隔方式。",
    hit_locations: ["摘要段", "关键词段"],
    sections: ["abstract"],
    table_targets: [],
    not_applicable_when: ["中英文摘要尚未对齐，不能直接强制同步。"],
    human_review_required_when: ["关键词增删涉及医学含义变化时需要人工确认。"],
  },
  heading_hierarchy: {
    kind: "heading_hierarchy",
    title: "标题层级包",
    rule_object: "heading_hierarchy",
    suggested_layer: "template_family",
    automation_posture: "safe_auto",
    default_summary: "统一数字层级标题的编号、空格与层次表达。",
    hit_locations: ["正文标题层级"],
    sections: ["body"],
    table_targets: [],
    not_applicable_when: ["标题本身承载特殊语义标记时不应自动改写。"],
    human_review_required_when: ["一般不需要人工复核，除非存在非标准编号体系。"],
  },
  numeric_statistics: {
    kind: "numeric_statistics",
    title: "数值统计包",
    rule_object: "statistical_expression",
    suggested_layer: "template_family",
    automation_posture: "guarded_auto",
    default_summary: "统一单位、百分号、范围、P 值和统计连接符的写法。",
    hit_locations: ["结果段", "统计表达段"],
    sections: ["results"],
    table_targets: [],
    not_applicable_when: ["数值改写会影响医学意义时不能自动执行。"],
    human_review_required_when: ["涉及单位补全或统计学解释时需要人工复核。"],
  },
  three_line_table: {
    kind: "three_line_table",
    title: "三线表包",
    rule_object: "table",
    suggested_layer: "journal_template",
    automation_posture: "inspect_only",
    default_summary: "统一三线表列头、统计脚注、表注拆分与排序口径。",
    hit_locations: ["表题", "列表头", "统计脚注"],
    sections: ["results"],
    table_targets: ["header_cell", "footnote_item"],
    not_applicable_when: ["表格结构或合并关系不清楚时不能自动执行。"],
    human_review_required_when: ["表格一律需要人工复核后再落地。"],
  },
  reference: {
    kind: "reference",
    title: "参考文献包",
    rule_object: "reference",
    suggested_layer: "template_family",
    automation_posture: "guarded_auto",
    default_summary: "统一文献类型标识、全角标点、期卷页和图书条目写法。",
    hit_locations: ["参考文献列表"],
    sections: ["reference"],
    table_targets: [],
    not_applicable_when: ["文献原始信息缺失时不应盲目补齐。"],
    human_review_required_when: ["作者、题名或页码存在疑义时需要人工核对。"],
  },
};

export const RULE_PACKAGE_RECOGNIZERS: RulePackageRecognizer[] = [
  (input) => recognizePackage("front_matter", input),
  (input) => recognizePackage("abstract_keywords", input),
  (input) => recognizePackage("heading_hierarchy", input),
  (input) => recognizePackage("numeric_statistics", input),
  (input) => recognizePackage("three_line_table", input),
  (input) => recognizePackage("reference", input),
];

export function recognizeRulePackages(
  input: RulePackageRecognitionInput,
): RulePackageSeed[] {
  return RULE_PACKAGE_RECOGNIZERS.flatMap((recognizer) => {
    const recognized = recognizer(input);
    return recognized ? [recognized] : [];
  });
}

function recognizePackage(
  kind: RulePackageKind,
  input: RulePackageRecognitionInput,
): RulePackageSeed | null {
  const blueprint = PACKAGE_BLUEPRINTS[kind];
  const supportingSignals = input.signals.filter((signal) => signal.package_hint === kind);
  if (supportingSignals.length === 0) {
    return null;
  }

  const evidenceExamples = supportingSignals
    .filter((signal) => signal.before || signal.after)
    .map((signal) => ({
      before: signal.before ?? "",
      after: signal.after ?? "",
      note: signal.rationale,
    }));

  const summary = buildSummary(blueprint, supportingSignals);

  return {
    package_id: `package-${kind}`,
    package_kind: kind,
    title: blueprint.title,
    rule_object: blueprint.rule_object,
    suggested_layer: blueprint.suggested_layer,
    automation_posture: blueprint.automation_posture,
    status: "draft",
    summary,
    hit_locations: blueprint.hit_locations,
    sections: blueprint.sections,
    manuscript_types: [input.context.manuscript_type],
    modules: [input.context.module],
    table_targets: blueprint.table_targets,
    evidence_examples:
      evidenceExamples.length > 0
        ? evidenceExamples
        : [
            {
              before: "",
              after: "",
              note: blueprint.default_summary,
            },
          ],
    not_applicable_when: blueprint.not_applicable_when,
    human_review_required_when: blueprint.human_review_required_when,
    supporting_signals: supportingSignals,
    semantic_draft: buildSemanticDraft(
      blueprint,
      summary,
      supportingSignals,
      evidenceExamples,
    ),
  };
}

function buildSummary(
  blueprint: RulePackageBlueprint,
  supportingSignals: EditIntentSignal[],
): string {
  const changedObjects = new Set(supportingSignals.map((signal) => signal.object_hint));
  if (changedObjects.size === 0) {
    return blueprint.default_summary;
  }

  return `${blueprint.default_summary} 本次样稿主要覆盖：${[...changedObjects].join("、")}。`;
}

function buildSemanticDraft(
  blueprint: RulePackageBlueprint,
  summary: string,
  supportingSignals: EditIntentSignal[],
  evidenceExamples: RuleEvidenceExample[],
): AiRuleUnderstandingPayload {
  return {
    semantic_summary: summary,
    hit_scope: supportingSignals.map(
      (signal) => `${signal.object_hint}:${signal.signal_type}`,
    ),
    applicability: blueprint.sections,
    evidence_examples:
      evidenceExamples.length > 0
        ? evidenceExamples
        : [
            {
              before: "",
              after: "",
              note: blueprint.default_summary,
            },
          ],
    failure_boundaries: blueprint.not_applicable_when,
    normalization_recipe: supportingSignals.map((signal) => signal.rationale),
    review_policy: blueprint.human_review_required_when,
    confirmed_fields: ["summary", "applicability", "evidence", "boundaries"],
  };
}

