import type {
  EvidenceLevel,
  KnowledgeKind,
  KnowledgeSourceType,
} from "../knowledge/index.ts";
import type { ManuscriptModule, ManuscriptType } from "../manuscripts/types.ts";

export type KnowledgeKindRuleLabelVariant =
  | "rule"
  | "projection"
  | "projection_legacy";

export const KNOWLEDGE_ENTRY_KIND_OPTIONS: readonly Exclude<KnowledgeKind, "rule">[] = [
  "reference",
  "checklist",
  "case_pattern",
  "prompt_snippet",
  "other",
];

export const KNOWLEDGE_MODULE_SCOPE_OPTIONS: ReadonlyArray<ManuscriptModule | "any"> = [
  "any",
  "screening",
  "editing",
  "proofreading",
  "manual",
  "learning",
];

export const RULE_WIZARD_MODULE_SCOPE_OPTIONS: ReadonlyArray<
  Extract<ManuscriptModule, "screening" | "editing" | "proofreading"> | "any"
> = ["any", "screening", "editing", "proofreading"];

export const EDITORIAL_MANUSCRIPT_TYPE_OPTIONS: readonly ManuscriptType[] = [
  "clinical_study",
  "review",
  "systematic_review",
  "meta_analysis",
  "case_report",
  "guideline_interpretation",
  "expert_consensus",
  "diagnostic_study",
  "basic_research",
  "nursing_study",
  "methodology_paper",
  "brief_report",
  "other",
];

export const EDITORIAL_SECTION_OPTIONS = [
  "title",
  "abstract",
  "keywords",
  "introduction",
  "methods",
  "results",
  "discussion",
  "conclusion",
  "references",
  "tables",
  "figures",
  "declarations",
  "front_matter",
  "supplement",
] as const;

export type EditorialSectionOption = (typeof EDITORIAL_SECTION_OPTIONS)[number];

export const EDITORIAL_EVIDENCE_LEVEL_OPTIONS: readonly EvidenceLevel[] = [
  "unknown",
  "low",
  "medium",
  "high",
  "expert_opinion",
];

export const EDITORIAL_KNOWLEDGE_SOURCE_TYPE_OPTIONS: readonly KnowledgeSourceType[] = [
  "paper",
  "guideline",
  "book",
  "website",
  "internal_case",
  "other",
];

export function getKnowledgeEntryKindOptions(
  currentKind: KnowledgeKind,
): readonly KnowledgeKind[] {
  return currentKind === "rule"
    ? (["rule", ...KNOWLEDGE_ENTRY_KIND_OPTIONS] as const)
    : KNOWLEDGE_ENTRY_KIND_OPTIONS;
}

export function formatEditorialKnowledgeKindLabel(
  value: KnowledgeKind,
  ruleVariant: KnowledgeKindRuleLabelVariant = "rule",
): string {
  switch (value) {
    case "rule":
      switch (ruleVariant) {
        case "projection":
          return "规则投影";
        case "projection_legacy":
          return "规则投影（历史兼容）";
        case "rule":
        default:
          return "规则";
      }
    case "case_pattern":
      return "案例模式";
    case "checklist":
      return "核查清单";
    case "prompt_snippet":
      return "提示片段";
    case "reference":
      return "参考资料";
    case "other":
    default:
      return "其他";
  }
}

export function formatEditorialModuleLabel(
  value: ManuscriptModule | "any",
): string {
  switch (value) {
    case "upload":
      return "上传";
    case "screening":
      return "初筛";
    case "editing":
      return "编辑";
    case "proofreading":
      return "校对";
    case "pdf_consistency":
      return "PDF 一致性";
    case "manual":
      return "人工处理";
    case "learning":
      return "学习回流";
    case "any":
    default:
      return "全部模块";
  }
}

export function formatEditorialManuscriptTypeLabel(
  value: ManuscriptType,
): string {
  switch (value) {
    case "clinical_study":
      return "临床研究";
    case "review":
      return "综述";
    case "systematic_review":
      return "系统综述";
    case "meta_analysis":
      return "Meta 分析";
    case "case_report":
      return "病例报告";
    case "guideline_interpretation":
      return "指南解读";
    case "expert_consensus":
      return "专家共识";
    case "diagnostic_study":
      return "诊断研究";
    case "basic_research":
      return "基础研究";
    case "nursing_study":
      return "护理研究";
    case "methodology_paper":
      return "方法学论文";
    case "brief_report":
      return "简报";
    case "other":
    default:
      return "其他";
  }
}

export function formatEditorialSectionLabel(
  value: EditorialSectionOption,
): string {
  switch (value) {
    case "title":
      return "标题";
    case "abstract":
      return "摘要";
    case "keywords":
      return "关键词";
    case "introduction":
      return "引言";
    case "methods":
      return "方法";
    case "results":
      return "结果";
    case "discussion":
      return "讨论";
    case "conclusion":
      return "结论";
    case "references":
      return "参考文献";
    case "tables":
      return "表格";
    case "figures":
      return "图片";
    case "declarations":
      return "声明";
    case "front_matter":
      return "前置信息";
    case "supplement":
    default:
      return "补充材料";
  }
}

export function formatEditorialEvidenceLevelLabel(
  value: EvidenceLevel,
): string {
  switch (value) {
    case "low":
      return "低证据";
    case "medium":
      return "中等证据";
    case "high":
      return "高证据";
    case "expert_opinion":
      return "专家经验";
    case "unknown":
    default:
      return "证据待补充";
  }
}

export function formatEditorialKnowledgeSourceTypeLabel(
  value: KnowledgeSourceType,
  style: "compact" | "full" = "full",
): string {
  switch (value) {
    case "paper":
      return style === "compact" ? "论文" : "论文/文献";
    case "guideline":
      return style === "compact" ? "指南" : "指南/规范";
    case "book":
      return style === "compact" ? "图书" : "图书资料";
    case "website":
      return style === "compact" ? "网站" : "网站资料";
    case "internal_case":
      return "内部案例";
    case "other":
    default:
      return style === "compact" ? "其他" : "其他来源";
  }
}
