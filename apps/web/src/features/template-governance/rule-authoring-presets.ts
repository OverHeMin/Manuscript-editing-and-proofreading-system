import type {
  AbstractRuleAuthoringDraft,
  AnyRuleAuthoringPreset,
  DeclarationRuleAuthoringDraft,
  HeadingHierarchyRuleAuthoringDraft,
  NumericUnitRuleAuthoringDraft,
  ReferenceRuleAuthoringDraft,
  RuleAuthoringObject,
  RuleAuthoringPreset,
  StatisticalExpressionRuleAuthoringDraft,
  TableRuleAuthoringDraft,
} from "./rule-authoring-types.ts";

const ABSTRACT_OBJECTIVE_SOURCE = "\u6458\u8981 \u76ee\u7684";
const ABSTRACT_OBJECTIVE_NORMALIZED = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";

const ABSTRACT_PRESET: RuleAuthoringPreset<"abstract"> = {
  object: "abstract",
  objectLabel: "Abstract",
  description:
    "Normalize structured abstract labels and preserve exact punctuation and full-width spacing.",
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
  objectLabel: "Heading Hierarchy",
  description: "Keep manuscript heading levels and numbering consistent for medical sections.",
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
  objectLabel: "Numeric / Unit",
  description: "Normalize numeric precision and unit presentation in results and methods.",
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
  objectLabel: "Statistical Expression",
  description: "Standardize P values, confidence intervals, and test-statistic notation.",
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
      },
    };
  },
};

const TABLE_PRESET: RuleAuthoringPreset<"table"> = {
  object: "table",
  objectLabel: "Table",
  description:
    "Capture table structure expectations like three-line tables without overpromising auto layout rewrites.",
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
  objectLabel: "Reference",
  description: "Capture reference list numbering, punctuation, and DOI requirements.",
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
  objectLabel: "Declaration",
  description:
    "Require ethics, registration, funding, and conflict-of-interest statements in the right place.",
  automationRisk: "inspect_only",
  createDraft(): DeclarationRuleAuthoringDraft {
    return {
      ruleObject: "declaration",
      orderNo: 70,
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

export const RULE_AUTHORING_PRESETS = [
  ABSTRACT_PRESET,
  HEADING_HIERARCHY_PRESET,
  NUMERIC_UNIT_PRESET,
  STATISTICAL_EXPRESSION_PRESET,
  TABLE_PRESET,
  REFERENCE_PRESET,
  DECLARATION_PRESET,
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
