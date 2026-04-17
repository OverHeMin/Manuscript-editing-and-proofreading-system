import type { CreateKnowledgeLibraryDraftInput } from "../knowledge-library/types.ts";

export interface TableProofreadingKnowledgeTemplate {
  id:
    | "journal_table_style_basis"
    | "statistical_annotation_basis"
    | "unit_reporting_basis"
    | "table_exception_examples";
  title: string;
  summary: string;
  knowledgeKind: "reference" | "checklist" | "case_pattern";
  moduleScope: "proofreading";
  sections: string[];
  riskTags: string[];
  sourceType: "guideline" | "paper" | "internal_case";
  evidenceLevel: "medium" | "high" | "expert_opinion";
}

export interface TableProofreadingHitValidationCheck {
  id:
    | "retrieval_keyword_hit"
    | "rule_scope_explainability"
    | "manual_review_gate";
  title: string;
  description: string;
}

const TABLE_PROOFREADING_KNOWLEDGE_TEMPLATES: readonly TableProofreadingKnowledgeTemplate[] = [
  {
    id: "journal_table_style_basis",
    title: "期刊表格样式依据",
    summary: "沉淀期刊或稿约对表题位置、表注位置、线型和编号格式的明确要求。",
    knowledgeKind: "reference",
    moduleScope: "proofreading",
    sections: ["tables"],
    riskTags: ["table-style", "layout"],
    sourceType: "guideline",
    evidenceLevel: "high",
  },
  {
    id: "statistical_annotation_basis",
    title: "统计注释与符号依据",
    summary: "沉淀 P 值、显著性符号、缩略语说明和表注排序的判定依据。",
    knowledgeKind: "reference",
    moduleScope: "proofreading",
    sections: ["tables"],
    riskTags: ["statistics", "table-footnote"],
    sourceType: "paper",
    evidenceLevel: "high",
  },
  {
    id: "unit_reporting_basis",
    title: "单位与数值报告依据",
    summary: "沉淀单位写法、有效数字、百分比与均值标准差等数值报告规范。",
    knowledgeKind: "checklist",
    moduleScope: "proofreading",
    sections: ["tables"],
    riskTags: ["unit", "numeric-reporting"],
    sourceType: "guideline",
    evidenceLevel: "high",
  },
  {
    id: "table_exception_examples",
    title: "表格异常示例库",
    summary: "积累常见误排版、错位脚注、单位冲突和截图型表格的异常示例。",
    knowledgeKind: "case_pattern",
    moduleScope: "proofreading",
    sections: ["tables"],
    riskTags: ["table-exception", "manual-review"],
    sourceType: "internal_case",
    evidenceLevel: "expert_opinion",
  },
] as const;

const TABLE_PROOFREADING_HIT_VALIDATION_CHECKS: readonly TableProofreadingHitValidationCheck[] = [
  {
    id: "retrieval_keyword_hit",
    title: "检索词命中",
    description: "检索先命中表题、表注、单位或统计关键词",
  },
  {
    id: "rule_scope_explainability",
    title: "规则命中可解释",
    description: "规则命中后需能解释是哪个表格块、哪条表头或脚注触发",
  },
  {
    id: "manual_review_gate",
    title: "人工复核闸口",
    description: "未命中表格块但触发表格规则时转人工复核",
  },
] as const;

export function listTableProofreadingKnowledgeTemplates(): TableProofreadingKnowledgeTemplate[] {
  return [...TABLE_PROOFREADING_KNOWLEDGE_TEMPLATES];
}

export function listTableProofreadingHitValidationChecks(): TableProofreadingHitValidationCheck[] {
  return [...TABLE_PROOFREADING_HIT_VALIDATION_CHECKS];
}

export function buildTableProofreadingKnowledgeDraftPrefill(
  templateId: string,
): CreateKnowledgeLibraryDraftInput | null {
  const template = TABLE_PROOFREADING_KNOWLEDGE_TEMPLATES.find((item) => item.id === templateId);
  if (!template) {
    return null;
  }

  return {
    title: template.title,
    canonicalText: resolveTableProofreadingKnowledgeCanonicalText(template.id),
    summary: template.summary,
    knowledgeKind: template.knowledgeKind,
    moduleScope: template.moduleScope,
    manuscriptTypes: "any",
    sections: [...template.sections],
    riskTags: [...template.riskTags],
    evidenceLevel: template.evidenceLevel,
    sourceType: template.sourceType,
  };
}

function resolveTableProofreadingKnowledgeCanonicalText(
  templateId: TableProofreadingKnowledgeTemplate["id"],
): string {
  switch (templateId) {
    case "journal_table_style_basis":
      return "\u8bf7\u6574\u7406\u671f\u520a\u6216\u79d1\u7ea6\u5bf9\u8868\u9898\u4f4d\u7f6e\u3001\u8868\u6ce8\u4f4d\u7f6e\u3001\u7ebf\u578b\u4e0e\u7f16\u53f7\u6837\u5f0f\u7684\u4f9d\u636e\u3002";
    case "statistical_annotation_basis":
      return "\u8bf7\u6574\u7406 P \u503c\u3001\u663e\u8457\u6027\u7b26\u53f7\u3001\u7f29\u7565\u8bed\u8bf4\u660e\u548c\u8868\u6ce8\u6392\u5e8f\u7684\u5224\u5b9a\u4f9d\u636e\u3002";
    case "unit_reporting_basis":
      return "\u8bf7\u6574\u7406\u5355\u4f4d\u5199\u6cd5\u3001\u6709\u6548\u6570\u5b57\u3001\u767e\u5206\u6bd4\u4e0e\u5747\u503c\u6807\u51c6\u5dee\u7b49\u6570\u503c\u62a5\u544a\u89c4\u5219\u3002";
    case "table_exception_examples":
      return "\u8bf7\u8865\u5145\u5e38\u89c1\u8bef\u6392\u7248\u3001\u9519\u4f4d\u811a\u6ce8\u3001\u5355\u4f4d\u51b2\u7a81\u548c\u622a\u56fe\u578b\u8868\u683c\u7684\u5f02\u5e38\u793a\u4f8b\u3002";
  }
}
