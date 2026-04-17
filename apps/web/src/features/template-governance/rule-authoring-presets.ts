import type {
  AbstractRuleAuthoringDraft,
  AnyRuleAuthoringPreset,
  AuthorLineRuleAuthoringDraft,
  DeclarationRuleAuthoringDraft,
  FigureRuleAuthoringDraft,
  HeadingHierarchyRuleAuthoringDraft,
  JournalColumnRuleAuthoringDraft,
  KeywordRuleAuthoringDraft,
  ManuscriptStructureRuleAuthoringDraft,
  NumericUnitRuleAuthoringDraft,
  ReferenceRuleAuthoringDraft,
  RuleAuthoringObject,
  RuleAuthoringPreset,
  StatementRuleAuthoringDraft,
  StatisticalExpressionRuleAuthoringDraft,
  TableRuleAuthoringDraft,
  TerminologyRuleAuthoringDraft,
  TitleRuleAuthoringDraft,
} from "./rule-authoring-types.ts";

const ABSTRACT_OBJECTIVE_SOURCE = "\u6458\u8981 \u76ee\u7684";
const ABSTRACT_OBJECTIVE_NORMALIZED = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";

const ABSTRACT_PRESET: RuleAuthoringPreset<"abstract"> = {
  object: "abstract",
  objectLabel: "摘要",
  description: "统一结构式摘要标签，保留准确标点和全角间距。",
  automationRisk: "safe_auto",
  createDraft(): AbstractRuleAuthoringDraft {
    return {
      ruleObject: "abstract",
      orderNo: 10,
      ruleType: "format",
      executionMode: "apply_and_inspect",
      confidencePolicy: "always_auto",
      severity: "error",
      enabled: true,
      evidenceLevel: "high",
      payload: {
        labelRole: "objective",
        sourceLabelText: ABSTRACT_OBJECTIVE_SOURCE,
        normalizedLabelText: ABSTRACT_OBJECTIVE_NORMALIZED,
        punctuationStyle: "full_width_parentheses",
        spacingStyle: "full_width_gap",
      },
    };
  },
};

const HEADING_HIERARCHY_PRESET: RuleAuthoringPreset<"heading_hierarchy"> = {
  object: "heading_hierarchy",
  objectLabel: "标题层级",
  description: "保持医学稿件各级标题与编号的一致性。",
  automationRisk: "guarded_auto",
  createDraft(): HeadingHierarchyRuleAuthoringDraft {
    return {
      ruleObject: "heading_hierarchy",
      orderNo: 20,
      ruleType: "format",
      executionMode: "apply_and_inspect",
      confidencePolicy: "high_confidence_only",
      severity: "warning",
      enabled: true,
      evidenceLevel: "medium",
      payload: {
        targetSection: "body",
        expectedSequence: "1, 1.1, 1.1.1",
        headingPattern: "\u963f\u62c9\u4f2f\u6570\u5b57\u6807\u9898",
      },
    };
  },
};

const NUMERIC_UNIT_PRESET: RuleAuthoringPreset<"numeric_unit"> = {
  object: "numeric_unit",
  objectLabel: "数值与单位",
  description: "统一结果与方法部分的数值精度和单位写法。",
  automationRisk: "guarded_auto",
  createDraft(): NumericUnitRuleAuthoringDraft {
    return {
      ruleObject: "numeric_unit",
      orderNo: 30,
      ruleType: "format",
      executionMode: "apply_and_inspect",
      confidencePolicy: "high_confidence_only",
      severity: "warning",
      enabled: true,
      evidenceLevel: "medium",
      payload: {
        targetSection: "results",
        unitStandard: "SI",
        decimalPlaces: "2",
      },
    };
  },
};

const STATISTICAL_EXPRESSION_PRESET: RuleAuthoringPreset<"statistical_expression"> = {
  object: "statistical_expression",
  objectLabel: "统计表达",
  description: "规范 P 值、置信区间和统计量记法。",
  automationRisk: "guarded_auto",
  createDraft(): StatisticalExpressionRuleAuthoringDraft {
    return {
      ruleObject: "statistical_expression",
      orderNo: 40,
      ruleType: "format",
      executionMode: "apply_and_inspect",
      confidencePolicy: "high_confidence_only",
      severity: "warning",
      enabled: true,
      evidenceLevel: "high",
      payload: {
        targetSection: "results",
        expressionPattern: "P, 95%CI, OR, RR, HR",
        reportingRequirement: "\u7edf\u8ba1\u7b26\u53f7\u4e0e\u7f6e\u4fe1\u533a\u95f4\u683c\u5f0f\u7edf\u4e00",
        metricFamily: "basic",
        supportedMetrics: "P, 95% CI, mean\u00b1SD, n",
        requiredCompanionEvidence: "\u6837\u672c\u91cf\u3001\u5206\u7ec4\u4fe1\u606f\u3001\u7f6e\u4fe1\u533a\u95f4\u4e0a\u4e0b\u9650",
        recalculationPolicy: "recheck_from_counts_when_possible",
      },
    };
  },
};

const TABLE_PRESET: RuleAuthoringPreset<"table"> = {
  object: "table",
  objectLabel: "表格",
  description: "用稳定的语义选择器描述表格，避免依赖脆弱的原始坐标。",
  automationRisk: "inspect_only",
  createDraft(): TableRuleAuthoringDraft {
    return {
      ruleObject: "table",
      orderNo: 50,
      ruleType: "format",
      executionMode: "inspect",
      confidencePolicy: "manual_only",
      severity: "warning",
      enabled: true,
      evidenceLevel: "expert_opinion",
      manualReviewReasonTemplate:
        "\u4e09\u7ebf\u8868\u9700\u4eba\u5de5\u6838\u5bf9\u6392\u7248\u4e0e\u8868\u6ce8",
      payload: {
        tableKind: "three_line_table",
        semanticTarget: "header_cell",
        headerPathIncludes: ["Treatment group", "n (%)"],
        rowKey: "",
        columnKey: "Treatment group > n (%)",
        noteKind: "statistical_significance",
        unitContext: "header",
        captionRequirement: "\u8868\u9898\u7f6e\u4e8e\u8868\u4e0a",
        layoutRequirement: "\u7981\u7528\u7ad6\u7ebf",
        manualReviewReasonTemplate:
          "\u4e09\u7ebf\u8868\u9700\u4eba\u5de5\u6838\u5bf9\u6392\u7248\u4e0e\u8868\u6ce8",
      },
    };
  },
};

const REFERENCE_PRESET: RuleAuthoringPreset<"reference"> = {
  object: "reference",
  objectLabel: "参考文献",
  description: "记录参考文献的编号、标点和 DOI 要求。",
  automationRisk: "guarded_auto",
  createDraft(): ReferenceRuleAuthoringDraft {
    return {
      ruleObject: "reference",
      orderNo: 60,
      ruleType: "format",
      executionMode: "apply_and_inspect",
      confidencePolicy: "high_confidence_only",
      severity: "warning",
      enabled: true,
      evidenceLevel: "medium",
      payload: {
        citationStyle: "Vancouver",
        numberingScheme: "\u987a\u5e8f\u7f16\u7801",
        doiRequirement: "available_when_present",
      },
    };
  },
};

const DECLARATION_PRESET: RuleAuthoringPreset<"declaration"> = {
  object: "declaration",
  objectLabel: "声明",
  description: "兼容旧稿里仍以 declaration 保存伦理或基金检查的规则。",
  automationRisk: "inspect_only",
  createDraft(): DeclarationRuleAuthoringDraft {
    return {
      ruleObject: "declaration",
      orderNo: 65,
      ruleType: "content",
      executionMode: "inspect",
      confidencePolicy: "manual_only",
      severity: "error",
      enabled: true,
      evidenceLevel: "high",
      payload: {
        declarationKind: "ethics",
        requiredStatement: "\u9700\u8bf4\u660e\u4f26\u7406\u5ba1\u6279\u53ca\u6279\u51c6\u7f16\u53f7",
        placement: "\u6b63\u6587\u672b\u5c3e\u58f0\u660e\u90e8\u5206",
      },
    };
  },
};

const STATEMENT_PRESET: RuleAuthoringPreset<"statement"> = {
  object: "statement",
  objectLabel: "规范声明",
  description: "管理伦理、基金、注册和作者贡献等声明要求。",
  automationRisk: "inspect_only",
  createDraft(): StatementRuleAuthoringDraft {
    return {
      ruleObject: "statement",
      orderNo: 70,
      ruleType: "content",
      executionMode: "inspect",
      confidencePolicy: "manual_only",
      severity: "error",
      enabled: true,
      evidenceLevel: "high",
      payload: {
        statementKind: "ethics",
        requiredStatement: "\u9700\u8bf4\u660e\u4f26\u7406\u5ba1\u6279\u53ca\u6279\u51c6\u7f16\u53f7",
        placement: "\u6b63\u6587\u672b\u5c3e\u58f0\u660e\u90e8\u5206",
      },
    };
  },
};

const TITLE_PRESET: RuleAuthoringPreset<"title"> = {
  object: "title",
  objectLabel: "题名",
  description: "统一题名标点、大小写和副标题处理方式。",
  automationRisk: "guarded_auto",
  createDraft(): TitleRuleAuthoringDraft {
    return {
      ruleObject: "title",
      orderNo: 80,
      ruleType: "format",
      executionMode: "apply_and_inspect",
      confidencePolicy: "high_confidence_only",
      severity: "warning",
      enabled: true,
      evidenceLevel: "medium",
      payload: {
        titlePattern: "\u4e2d\u6587\u9898\u540d\u4e0d\u52a0\u4e66\u540d\u53f7",
        casingRule: "\u82f1\u6587\u526f\u9898\u540d\u9996\u5b57\u6bcd\u5927\u5199",
        subtitleHandling: "\u526f\u6807\u9898\u4e0e\u4e3b\u6807\u9898\u7528\u5192\u53f7\u8fde\u63a5",
      },
    };
  },
};

const AUTHOR_LINE_PRESET: RuleAuthoringPreset<"author_line"> = {
  object: "author_line",
  objectLabel: "作者行",
  description: "保持作者顺序、单位标记和通信作者说明的一致性。",
  automationRisk: "inspect_only",
  createDraft(): AuthorLineRuleAuthoringDraft {
    return {
      ruleObject: "author_line",
      orderNo: 90,
      ruleType: "format",
      executionMode: "inspect",
      confidencePolicy: "manual_only",
      severity: "warning",
      enabled: true,
      evidenceLevel: "expert_opinion",
      payload: {
        separator: "\u987f\u53f7",
        affiliationFormat: "\u59d3\u540d\u540e\u4f7f\u7528\u4e0a\u6807\u5bf9\u5e94\u5355\u4f4d",
        correspondingAuthorRule:
          "\u901a\u8baf\u4f5c\u8005\u4f7f\u7528\u661f\u53f7\u5e76\u5355\u5217\u90ae\u7bb1",
      },
    };
  },
};

const KEYWORD_PRESET: RuleAuthoringPreset<"keyword"> = {
  object: "keyword",
  objectLabel: "关键词",
  description: "控制关键词数量、分隔符和受控词表要求。",
  automationRisk: "guarded_auto",
  createDraft(): KeywordRuleAuthoringDraft {
    return {
      ruleObject: "keyword",
      orderNo: 100,
      ruleType: "format",
      executionMode: "apply_and_inspect",
      confidencePolicy: "high_confidence_only",
      severity: "warning",
      enabled: true,
      evidenceLevel: "medium",
      payload: {
        keywordCount: "3-8",
        separator: "\u5206\u53f7",
        vocabularyRequirement: "\u4f18\u5148\u4f7f\u7528 MeSH \u6216\u671f\u520a\u89c4\u5b9a\u8bcd",
      },
    };
  },
};

const TERMINOLOGY_PRESET: RuleAuthoringPreset<"terminology"> = {
  object: "terminology",
  objectLabel: "术语",
  description: "统一核心医学术语并拦截不允许的变体写法。",
  automationRisk: "guarded_auto",
  createDraft(): TerminologyRuleAuthoringDraft {
    return {
      ruleObject: "terminology",
      orderNo: 110,
      ruleType: "content",
      executionMode: "apply_and_inspect",
      confidencePolicy: "high_confidence_only",
      severity: "warning",
      enabled: true,
      evidenceLevel: "high",
      payload: {
        targetSection: "global",
        preferredTerm: "\u968f\u8bbf",
        disallowedVariant: "\u8ffd\u8e2a\u968f\u8bbf",
      },
    };
  },
};

const FIGURE_PRESET: RuleAuthoringPreset<"figure"> = {
  object: "figure",
  objectLabel: "图片",
  description: "检查图题、编号和源文件要求。",
  automationRisk: "inspect_only",
  createDraft(): FigureRuleAuthoringDraft {
    return {
      ruleObject: "figure",
      orderNo: 120,
      ruleType: "format",
      executionMode: "inspect",
      confidencePolicy: "manual_only",
      severity: "warning",
      enabled: true,
      evidenceLevel: "expert_opinion",
      payload: {
        figureKind: "flowchart",
        captionRequirement: "\u56fe\u9898\u7f6e\u4e8e\u56fe\u4e0b",
        fileRequirement: "\u9700\u63d0\u4f9b\u53ef\u7f16\u8f91\u6216\u9ad8\u6e05\u539f\u56fe",
      },
    };
  },
};

const MANUSCRIPT_STRUCTURE_PRESET: RuleAuthoringPreset<"manuscript_structure"> = {
  object: "manuscript_structure",
  objectLabel: "稿件结构",
  description: "检查稿件章节集合与顺序是否符合稿件类型要求。",
  automationRisk: "inspect_only",
  createDraft(): ManuscriptStructureRuleAuthoringDraft {
    return {
      ruleObject: "manuscript_structure",
      orderNo: 130,
      ruleType: "content",
      executionMode: "inspect",
      confidencePolicy: "manual_only",
      severity: "error",
      enabled: true,
      evidenceLevel: "high",
      payload: {
        manuscriptType: "clinical_study",
        requiredSections: "\u9898\u540d, \u6458\u8981, \u5f15\u8a00, \u8d44\u6599\u4e0e\u65b9\u6cd5, \u7ed3\u679c, \u8ba8\u8bba",
        sectionOrder: "\u524d\u540e\u987a\u5e8f\u4e0d\u53ef\u989b\u5012",
      },
    };
  },
};

const JOURNAL_COLUMN_PRESET: RuleAuthoringPreset<"journal_column"> = {
  object: "journal_column",
  objectLabel: "期刊栏目",
  description: "记录期刊特有的小模板要求和栏目元数据。",
  automationRisk: "inspect_only",
  createDraft(): JournalColumnRuleAuthoringDraft {
    return {
      ruleObject: "journal_column",
      orderNo: 140,
      ruleType: "content",
      executionMode: "inspect",
      confidencePolicy: "manual_only",
      severity: "warning",
      enabled: true,
      evidenceLevel: "expert_opinion",
      payload: {
        columnName: "\u4e34\u5e8a\u62a5\u9053",
        requirement: "\u9700\u5957\u7528\u671f\u520a\u5c0f\u6a21\u677f",
        sourceSection: "\u671f\u520a\u6295\u7a3f\u680f\u76ee",
      },
    };
  },
};

export const RULE_AUTHORING_PRESETS = [
  ABSTRACT_PRESET,
  HEADING_HIERARCHY_PRESET,
  NUMERIC_UNIT_PRESET,
  STATISTICAL_EXPRESSION_PRESET,
  TABLE_PRESET,
  REFERENCE_PRESET,
  DECLARATION_PRESET,
  STATEMENT_PRESET,
  TITLE_PRESET,
  AUTHOR_LINE_PRESET,
  KEYWORD_PRESET,
  TERMINOLOGY_PRESET,
  FIGURE_PRESET,
  MANUSCRIPT_STRUCTURE_PRESET,
  JOURNAL_COLUMN_PRESET,
] as const satisfies readonly AnyRuleAuthoringPreset[];

export function listRuleAuthoringPresets(): AnyRuleAuthoringPreset[] {
  return [...RULE_AUTHORING_PRESETS];
}

export function getRuleAuthoringPreset<TObject extends RuleAuthoringObject>(
  object: TObject,
): Extract<AnyRuleAuthoringPreset, { object: TObject }> {
  const preset = RULE_AUTHORING_PRESETS.find(
    (candidate) => candidate.object === object,
  ) as Extract<AnyRuleAuthoringPreset, { object: TObject }> | undefined;
  if (!preset) {
    throw new Error(`Unsupported rule authoring object: ${object}`);
  }

  return preset;
}
