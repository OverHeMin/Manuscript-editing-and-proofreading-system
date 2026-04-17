import {
  formatEditorialEvidenceLevelLabel,
  formatEditorialKnowledgeKindLabel,
  formatEditorialKnowledgeSourceTypeLabel,
  formatEditorialManuscriptTypeLabel,
  formatEditorialModuleLabel,
} from "../shared/editorial-taxonomy.ts";

export function formatTemplateGovernanceManuscriptTypeLabel(value: string): string {
  return formatEditorialManuscriptTypeLabel(value as Parameters<
    typeof formatEditorialManuscriptTypeLabel
  >[0]);
}

export function formatTemplateGovernanceModuleLabel(value: string): string {
  return value === "knowledge"
    ? "知识"
    : formatEditorialModuleLabel(value as Parameters<typeof formatEditorialModuleLabel>[0]);
}

export function formatTemplateGovernanceFamilyStatusLabel(value: string): string {
  switch (value) {
    case "draft":
      return "草稿";
    case "active":
      return "启用中";
    case "archived":
      return "已归档";
    default:
      return value;
  }
}

export function formatTemplateGovernanceRuleTypeLabel(value: string): string {
  switch (value) {
    case "format":
      return "格式";
    case "content":
      return "内容";
    default:
      return value;
  }
}

export function formatTemplateGovernanceExecutionModeLabel(value: string): string {
  switch (value) {
    case "apply":
      return "直接应用";
    case "inspect":
      return "仅检查";
    case "apply_and_inspect":
      return "应用并检查";
    default:
      return value;
  }
}

export function formatTemplateGovernanceConfidencePolicyLabel(value: string): string {
  switch (value) {
    case "always_auto":
      return "直接自动";
    case "high_confidence_only":
      return "仅高置信度自动";
    case "manual_only":
      return "仅人工处理";
    default:
      return value;
  }
}

export function formatTemplateGovernanceSeverityLabel(value: string): string {
  switch (value) {
    case "info":
      return "提示";
    case "warning":
      return "警示";
    case "error":
      return "错误";
    default:
      return value;
  }
}

export function formatTemplateGovernancePromptTemplateKindLabel(value: string): string {
  switch (value) {
    case "editing_instruction":
      return "编辑指令";
    case "proofreading_instruction":
      return "校对指令";
    case "legacy_prompt":
      return "兼容旧版提示";
    default:
      return value;
  }
}

export function formatTemplateGovernanceGovernedAssetStatusLabel(value: string): string {
  switch (value) {
    case "draft":
      return "草稿";
    case "active":
      return "启用中";
    case "published":
      return "已发布";
    case "pending_review":
      return "待审核";
    case "approved":
      return "已通过";
    case "superseded":
      return "已替代";
    case "deprecated":
      return "已停用";
    case "archived":
      return "已归档";
    default:
      return value;
  }
}

export function formatTemplateGovernanceKnowledgeKindLabel(value: string): string {
  return formatEditorialKnowledgeKindLabel(
    value as Parameters<typeof formatEditorialKnowledgeKindLabel>[0],
    value === "rule" ? "projection" : "rule",
  );
}

export function formatTemplateGovernanceKnowledgeSourceTypeLabel(value: string): string {
  return formatEditorialKnowledgeSourceTypeLabel(
    value as Parameters<typeof formatEditorialKnowledgeSourceTypeLabel>[0],
  );
}

export function formatTemplateGovernanceEvidenceLevelLabel(value: string): string {
  return formatEditorialEvidenceLevelLabel(
    value as Parameters<typeof formatEditorialEvidenceLevelLabel>[0],
  );
}

export function formatTemplateGovernanceExtractionTaskStatusLabel(value: string): string {
  switch (value) {
    case "awaiting_confirmation":
      return "待语义确认";
    case "partially_confirmed":
      return "部分已确认";
    case "completed":
      return "已完成";
    case "failed":
      return "提取失败";
    default:
      return value;
  }
}

export function formatTemplateGovernanceExtractionCandidateStatusLabel(value: string): string {
  switch (value) {
    case "ai_semantic_ready":
      return "AI 已生成";
    case "held":
      return "暂存待定";
    case "confirmed":
      return "已确认";
    case "rejected":
      return "已驳回";
    default:
      return value;
  }
}

export function formatTemplateGovernanceExtractionDestinationLabel(value: string): string {
  switch (value) {
    case "general_module":
      return "通用模块";
    case "medical_module":
      return "医学专用模块";
    case "template":
      return "模板台账";
    default:
      return value;
  }
}

export function formatTemplateGovernanceRetrievalSignalKindLabel(value: string): string {
  switch (value) {
    case "retrieval_drift":
      return "检索漂移";
    case "missing_knowledge":
      return "缺少知识依据";
    case "coverage_gap":
      return "覆盖缺口";
    case "rule_conflict":
      return "规则冲突";
    default:
      return value;
  }
}

export function formatTemplateGovernanceInstructionOperationLabel(value: string): string {
  switch (value) {
    case "sentence_rewrite":
      return "改写句式";
    case "change_medical_meaning":
      return "改变医学含义";
    case "issue_explanation":
      return "输出问题说明";
    case "rewrite_manuscript":
      return "直接改写正文";
    case "format_normalization":
      return "规范格式";
    case "table_alignment":
      return "调整表格对齐";
    default:
      return value;
  }
}

export function formatRulePackagePublishLayerLabel(value: string): string {
  switch (value) {
    case "journal_template":
      return "期刊层";
    case "family_template":
      return "模板族层";
    default:
      return value;
  }
}

export function formatRulePackageSuggestedLayerLabel(value: string): string {
  return formatRulePackagePublishLayerLabel(value);
}

export function formatRulePackageAutomationPostureLabel(value: string): string {
  switch (value) {
    case "guarded_auto":
      return "谨慎自动";
    case "inspect":
      return "仅检查";
    case "manual_only":
      return "人工处理";
    case "always_auto":
      return "直接自动";
    default:
      return value;
  }
}

export function formatRulePackageKindLabel(value: string): string {
  switch (value) {
    case "front_matter":
      return "前置信息";
    case "abstract_keywords":
      return "摘要与关键词";
    case "heading_hierarchy":
      return "标题层级";
    case "numeric_statistics":
      return "数值统计";
    case "three_line_table":
      return "三线表";
    case "reference":
      return "参考文献";
    default:
      return value;
  }
}

export function formatRulePackageTargetLabel(value: string): string {
  switch (value) {
    case "front_matter":
      return "前置信息块";
    case "author_line":
      return "作者行";
    case "corresponding_author":
      return "通信作者";
    case "classification_line":
      return "分类号行";
    case "abstract":
      return "摘要";
    case "keyword":
      return "关键词";
    case "heading":
      return "标题";
    case "title":
      return "题名";
    case "table":
      return "表格";
    case "reference":
      return "参考文献";
    default:
      return value;
  }
}

export function formatRulePackageDecisionReviewLabel(needsHumanReview: boolean): string {
  return needsHumanReview ? "需要人工复核" : "无需人工复核";
}

export function formatRulePackageCompileReadinessLabel(value: string): string {
  switch (value) {
    case "ready":
      return "可直接编译";
    case "ready_with_downgrade":
      return "可编译（降级执行）";
    case "blocked":
      return "存在阻塞";
    default:
      return value;
  }
}

export function formatRulePackagePublishReadinessStatusLabel(value: string): string {
  switch (value) {
    case "review_before_publish":
      return "发布前复核";
    case "ready":
      return "可发布";
    case "blocked":
      return "暂不可发布";
    default:
      return value;
  }
}

export function formatRulePackageProjectionKindLabel(value: string): string {
  switch (value) {
    case "rule":
      return "规则";
    case "checklist":
      return "检查清单";
    case "prompt_snippet":
      return "提示片段";
    case "reference":
      return "参考说明";
    default:
      return value;
  }
}

export function formatRulePackageSemanticFieldLabel(value: string): string {
  switch (value) {
    case "summary":
      return "摘要";
    case "applicability":
      return "适用范围";
    case "evidence":
      return "证据示例";
    case "boundaries":
      return "边界条件";
    default:
      return value;
  }
}

export function formatRulePackageTargetModeLabel(value: string): string {
  switch (value) {
    case "reused_selected_draft":
      return "复用当前草稿";
    case "created_new_draft":
      return "新建规则草稿";
    default:
      return value;
  }
}
