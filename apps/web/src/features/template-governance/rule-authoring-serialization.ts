import type { EditorialRuleViewModel } from "../editorial-rules/index.ts";
import { getRuleAuthoringPreset } from "./rule-authoring-presets.ts";
import type {
  AbstractRuleAuthoringDraft,
  DeclarationRuleAuthoringDraft,
  HeadingHierarchyRuleAuthoringDraft,
  NumericUnitRuleAuthoringDraft,
  ReferenceRuleAuthoringDraft,
  RuleAuthoringDraft,
  RuleAuthoringObject,
  RuleAuthoringPreview,
  SerializedRuleAuthoringDraft,
  StatisticalExpressionRuleAuthoringDraft,
  TableRuleAuthoringDraft,
} from "./rule-authoring-types.ts";

export function createRuleAuthoringDraft<TObject extends RuleAuthoringObject>(
  object: TObject,
): Extract<RuleAuthoringDraft, { ruleObject: TObject }> {
  return structuredClone(
    getRuleAuthoringPreset(object).createDraft(),
  ) as Extract<RuleAuthoringDraft, { ruleObject: TObject }>;
}

export function serializeRuleAuthoringDraft(
  draft: RuleAuthoringDraft,
): SerializedRuleAuthoringDraft {
  switch (draft.ruleObject) {
    case "abstract":
      return serializeAbstractRule(draft);
    case "heading_hierarchy":
      return serializeHeadingHierarchyRule(draft);
    case "numeric_unit":
      return serializeNumericUnitRule(draft);
    case "statistical_expression":
      return serializeStatisticalExpressionRule(draft);
    case "table":
      return serializeTableRule(draft);
    case "reference":
      return serializeReferenceRule(draft);
    case "declaration":
      return serializeDeclarationRule(draft);
  }
}

export function hydrateRuleAuthoringDraft(
  rule: EditorialRuleViewModel,
): RuleAuthoringDraft {
  switch (rule.rule_object) {
    case "abstract": {
      const draft = createRuleAuthoringDraft("abstract");
      return {
        ...draft,
        orderNo: rule.order_no,
        executionMode: rule.execution_mode,
        confidencePolicy: rule.confidence_policy,
        severity: rule.severity,
        enabled: rule.enabled,
        evidenceLevel: rule.evidence_level ?? draft.evidenceLevel,
        payload: {
          ...draft.payload,
          labelRole:
            asAbstractLabelRole(rule.authoring_payload["label_role"]) ?? draft.payload.labelRole,
          sourceLabelText:
            asString(rule.authoring_payload["source_label_text"]) ??
            rule.example_before ??
            draft.payload.sourceLabelText,
          normalizedLabelText:
            asString(rule.authoring_payload["normalized_label_text"]) ??
            rule.example_after ??
            draft.payload.normalizedLabelText,
        },
      };
    }
    case "heading_hierarchy": {
      const draft = createRuleAuthoringDraft("heading_hierarchy");
      return applyCommonHydration(draft, rule, {
        ...draft.payload,
        targetSection:
          asHeadingTarget(rule.authoring_payload["target_section"]) ?? draft.payload.targetSection,
        expectedSequence:
          asString(rule.authoring_payload["expected_sequence"]) ??
          draft.payload.expectedSequence,
        headingPattern:
          asString(rule.authoring_payload["heading_pattern"]) ?? draft.payload.headingPattern,
      });
    }
    case "numeric_unit": {
      const draft = createRuleAuthoringDraft("numeric_unit");
      return applyCommonHydration(draft, rule, {
        ...draft.payload,
        targetSection:
          asNumericUnitTarget(rule.authoring_payload["target_section"]) ??
          draft.payload.targetSection,
        unitStandard:
          asString(rule.authoring_payload["unit_standard"]) ?? draft.payload.unitStandard,
        decimalPlaces:
          asString(rule.authoring_payload["decimal_places"]) ?? draft.payload.decimalPlaces,
      });
    }
    case "statistical_expression": {
      const draft = createRuleAuthoringDraft("statistical_expression");
      return applyCommonHydration(draft, rule, {
        ...draft.payload,
        targetSection:
          asStatisticsTarget(rule.authoring_payload["target_section"]) ??
          draft.payload.targetSection,
        expressionPattern:
          asString(rule.authoring_payload["expression_pattern"]) ??
          draft.payload.expressionPattern,
        reportingRequirement:
          asString(rule.authoring_payload["reporting_requirement"]) ??
          draft.payload.reportingRequirement,
      });
    }
    case "table": {
      const draft = createRuleAuthoringDraft("table");
      return applyCommonHydration(draft, rule, {
        ...draft.payload,
        tableKind:
          asTableKind(rule.authoring_payload["table_kind"]) ?? draft.payload.tableKind,
        captionRequirement:
          asString(rule.authoring_payload["caption_requirement"]) ??
          draft.payload.captionRequirement,
        layoutRequirement:
          asString(rule.authoring_payload["layout_requirement"]) ??
          draft.payload.layoutRequirement,
        manualReviewReasonTemplate:
          asString(rule.authoring_payload["manual_review_reason_template"]) ??
          rule.manual_review_reason_template ??
          draft.payload.manualReviewReasonTemplate,
      });
    }
    case "reference": {
      const draft = createRuleAuthoringDraft("reference");
      return applyCommonHydration(draft, rule, {
        ...draft.payload,
        citationStyle:
          asString(rule.authoring_payload["citation_style"]) ?? draft.payload.citationStyle,
        numberingScheme:
          asString(rule.authoring_payload["numbering_scheme"]) ??
          draft.payload.numberingScheme,
        doiRequirement:
          asString(rule.authoring_payload["doi_requirement"]) ??
          draft.payload.doiRequirement,
      });
    }
    case "declaration":
    default: {
      const draft = createRuleAuthoringDraft("declaration");
      return applyCommonHydration(draft, rule, {
        ...draft.payload,
        declarationKind:
          asDeclarationKind(rule.authoring_payload["declaration_kind"]) ??
          draft.payload.declarationKind,
        requiredStatement:
          asString(rule.authoring_payload["required_statement"]) ??
          draft.payload.requiredStatement,
        placement:
          asString(rule.authoring_payload["placement"]) ?? draft.payload.placement,
      });
    }
  }
}

export function buildRuleAuthoringPreview(
  draft: RuleAuthoringDraft,
): RuleAuthoringPreview {
  const serialized = serializeRuleAuthoringDraft(draft);

  return {
    selectorSummary: describeSelector(serialized.selector ?? {}),
    automationRiskPosture: describeAutomationRisk(draft),
    templateScopeSummary:
      draft.journalTemplateId != null
        ? `Journal override: ${draft.journalTemplateId}`
        : "Base family rule",
    normalizedExample:
      serialized.exampleBefore && serialized.exampleAfter
        ? `${serialized.exampleBefore} -> ${serialized.exampleAfter}`
        : "No exact example configured.",
  };
}

function serializeAbstractRule(
  draft: AbstractRuleAuthoringDraft,
): SerializedRuleAuthoringDraft {
  return {
    orderNo: draft.orderNo,
    ruleObject: draft.ruleObject,
    ruleType: draft.ruleType,
    executionMode: draft.executionMode,
    scope: {
      sections: ["abstract"],
      block_kind: "heading",
    },
    selector: {
      section_selector: "abstract",
      label_selector: {
        text: draft.payload.sourceLabelText,
      },
    },
    trigger: {
      kind: "exact_text",
      text: draft.payload.sourceLabelText,
    },
    action: {
      kind: "replace_heading",
      to: draft.payload.normalizedLabelText,
    },
    authoringPayload: {
      label_role: draft.payload.labelRole,
      source_label_text: draft.payload.sourceLabelText,
      normalized_label_text: draft.payload.normalizedLabelText,
      punctuation_style: draft.payload.punctuationStyle,
      spacing_style: draft.payload.spacingStyle,
    },
    evidenceLevel: draft.evidenceLevel,
    confidencePolicy: draft.confidencePolicy,
    severity: draft.severity,
    enabled: draft.enabled,
    exampleBefore: draft.payload.sourceLabelText,
    exampleAfter: draft.payload.normalizedLabelText,
    ...(draft.manualReviewReasonTemplate
      ? {
          manualReviewReasonTemplate: draft.manualReviewReasonTemplate,
        }
      : {}),
  };
}

function serializeHeadingHierarchyRule(
  draft: HeadingHierarchyRuleAuthoringDraft,
): SerializedRuleAuthoringDraft {
  return {
    orderNo: draft.orderNo,
    ruleObject: draft.ruleObject,
    ruleType: draft.ruleType,
    executionMode: draft.executionMode,
    scope: {
      sections: [draft.payload.targetSection],
      block_kind: "heading",
    },
    selector: {
      section_selector: draft.payload.targetSection,
      block_selector: "heading",
    },
    trigger: {
      kind: "heading_sequence",
      expected: draft.payload.expectedSequence,
      pattern: draft.payload.headingPattern,
    },
    action: {
      kind: "normalize_heading_hierarchy",
      sequence: draft.payload.expectedSequence,
    },
    authoringPayload: {
      target_section: draft.payload.targetSection,
      expected_sequence: draft.payload.expectedSequence,
      heading_pattern: draft.payload.headingPattern,
    },
    evidenceLevel: draft.evidenceLevel,
    confidencePolicy: draft.confidencePolicy,
    severity: draft.severity,
    enabled: draft.enabled,
    exampleBefore: draft.payload.headingPattern,
    exampleAfter: draft.payload.expectedSequence,
  };
}

function serializeNumericUnitRule(
  draft: NumericUnitRuleAuthoringDraft,
): SerializedRuleAuthoringDraft {
  return {
    orderNo: draft.orderNo,
    ruleObject: draft.ruleObject,
    ruleType: draft.ruleType,
    executionMode: draft.executionMode,
    scope: {
      sections: [draft.payload.targetSection],
      block_kind: "paragraph",
    },
    selector: {
      section_selector: draft.payload.targetSection,
      pattern_selector: {
        content_class: "numeric_unit",
      },
    },
    trigger: {
      kind: "numeric_unit_pattern",
      unit_standard: draft.payload.unitStandard,
      decimal_places: draft.payload.decimalPlaces,
    },
    action: {
      kind: "normalize_numeric_unit",
      unit_standard: draft.payload.unitStandard,
      decimal_places: draft.payload.decimalPlaces,
    },
    authoringPayload: {
      target_section: draft.payload.targetSection,
      unit_standard: draft.payload.unitStandard,
      decimal_places: draft.payload.decimalPlaces,
    },
    evidenceLevel: draft.evidenceLevel,
    confidencePolicy: draft.confidencePolicy,
    severity: draft.severity,
    enabled: draft.enabled,
  };
}

function serializeStatisticalExpressionRule(
  draft: StatisticalExpressionRuleAuthoringDraft,
): SerializedRuleAuthoringDraft {
  return {
    orderNo: draft.orderNo,
    ruleObject: draft.ruleObject,
    ruleType: draft.ruleType,
    executionMode: draft.executionMode,
    scope: {
      sections: [draft.payload.targetSection],
      block_kind: "paragraph",
    },
    selector: {
      section_selector: draft.payload.targetSection,
      pattern_selector: {
        content_class: "statistical_expression",
      },
    },
    trigger: {
      kind: "statistical_expression",
      pattern: draft.payload.expressionPattern,
    },
    action: {
      kind: "normalize_statistical_expression",
      requirement: draft.payload.reportingRequirement,
    },
    authoringPayload: {
      target_section: draft.payload.targetSection,
      expression_pattern: draft.payload.expressionPattern,
      reporting_requirement: draft.payload.reportingRequirement,
    },
    evidenceLevel: draft.evidenceLevel,
    confidencePolicy: draft.confidencePolicy,
    severity: draft.severity,
    enabled: draft.enabled,
  };
}

function serializeTableRule(
  draft: TableRuleAuthoringDraft,
): SerializedRuleAuthoringDraft {
  return {
    orderNo: draft.orderNo,
    ruleObject: draft.ruleObject,
    ruleType: draft.ruleType,
    executionMode: "inspect",
    scope: {
      block_kind: "table",
    },
    selector: {
      block_selector: "table",
      table_selector: {
        table_kind: draft.payload.tableKind,
      },
    },
    trigger: {
      kind: "table_structure",
      table_kind: draft.payload.tableKind,
    },
    action: {
      kind: "inspect_table_rule",
      caption_requirement: draft.payload.captionRequirement,
      layout_requirement: draft.payload.layoutRequirement,
    },
    authoringPayload: {
      table_kind: draft.payload.tableKind,
      caption_requirement: draft.payload.captionRequirement,
      layout_requirement: draft.payload.layoutRequirement,
      manual_review_reason_template: draft.payload.manualReviewReasonTemplate,
    },
    evidenceLevel: draft.evidenceLevel,
    confidencePolicy: draft.confidencePolicy,
    severity: draft.severity,
    enabled: draft.enabled,
    manualReviewReasonTemplate:
      draft.manualReviewReasonTemplate ?? draft.payload.manualReviewReasonTemplate,
  };
}

function serializeReferenceRule(
  draft: ReferenceRuleAuthoringDraft,
): SerializedRuleAuthoringDraft {
  return {
    orderNo: draft.orderNo,
    ruleObject: draft.ruleObject,
    ruleType: draft.ruleType,
    executionMode: draft.executionMode,
    scope: {
      sections: ["references"],
      block_kind: "reference_list",
    },
    selector: {
      section_selector: "references",
      block_selector: "reference_list",
    },
    trigger: {
      kind: "reference_style",
      citation_style: draft.payload.citationStyle,
    },
    action: {
      kind: "normalize_reference_style",
      numbering_scheme: draft.payload.numberingScheme,
      doi_requirement: draft.payload.doiRequirement,
    },
    authoringPayload: {
      citation_style: draft.payload.citationStyle,
      numbering_scheme: draft.payload.numberingScheme,
      doi_requirement: draft.payload.doiRequirement,
    },
    evidenceLevel: draft.evidenceLevel,
    confidencePolicy: draft.confidencePolicy,
    severity: draft.severity,
    enabled: draft.enabled,
  };
}

function serializeDeclarationRule(
  draft: DeclarationRuleAuthoringDraft,
): SerializedRuleAuthoringDraft {
  return {
    orderNo: draft.orderNo,
    ruleObject: draft.ruleObject,
    ruleType: draft.ruleType,
    executionMode: draft.executionMode,
    scope: {
      sections: ["back_matter"],
      block_kind: "statement",
    },
    selector: {
      statement_selector: {
        declaration_kind: draft.payload.declarationKind,
      },
    },
    trigger: {
      kind: "required_statement",
      declaration_kind: draft.payload.declarationKind,
    },
    action: {
      kind: "inspect_required_statement",
      placement: draft.payload.placement,
    },
    authoringPayload: {
      declaration_kind: draft.payload.declarationKind,
      required_statement: draft.payload.requiredStatement,
      placement: draft.payload.placement,
    },
    evidenceLevel: draft.evidenceLevel,
    confidencePolicy: draft.confidencePolicy,
    severity: draft.severity,
    enabled: draft.enabled,
    manualReviewReasonTemplate:
      draft.manualReviewReasonTemplate ??
      `Inspect ${draft.payload.declarationKind} declaration placement and wording.`,
  };
}

function applyCommonHydration<TDraft extends RuleAuthoringDraft>(
  draft: TDraft,
  rule: EditorialRuleViewModel,
  payload: TDraft["payload"],
): TDraft {
  return {
    ...draft,
    orderNo: rule.order_no,
    executionMode: rule.execution_mode,
    confidencePolicy: rule.confidence_policy,
    severity: rule.severity,
    enabled: rule.enabled,
    evidenceLevel: rule.evidence_level ?? draft.evidenceLevel,
    manualReviewReasonTemplate:
      rule.manual_review_reason_template ?? draft.manualReviewReasonTemplate,
    payload,
  };
}

function describeSelector(selector: Record<string, unknown>): string {
  const parts: string[] = [];
  const sectionSelector = asString(selector["section_selector"]);
  if (sectionSelector) {
    parts.push(`section=${sectionSelector}`);
  }

  const blockSelector = asString(selector["block_selector"]);
  if (blockSelector) {
    parts.push(`block=${blockSelector}`);
  }

  const labelSelector = asRecord(selector["label_selector"]);
  const labelText = labelSelector ? asString(labelSelector["text"]) : undefined;
  if (labelText) {
    parts.push(`label=${labelText}`);
  }

  const tableSelector = asRecord(selector["table_selector"]);
  const tableKind = tableSelector ? asString(tableSelector["table_kind"]) : undefined;
  if (tableKind) {
    parts.push(`table=${tableKind}`);
  }

  const patternSelector = asRecord(selector["pattern_selector"]);
  const contentClass = patternSelector
    ? asString(patternSelector["content_class"])
    : undefined;
  if (contentClass) {
    parts.push(`pattern=${contentClass}`);
  }

  const statementSelector = asRecord(selector["statement_selector"]);
  const declarationKind = statementSelector
    ? asString(statementSelector["declaration_kind"])
    : undefined;
  if (declarationKind) {
    parts.push(`statement=${declarationKind}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "Generic selector";
}

function describeAutomationRisk(draft: RuleAuthoringDraft): string {
  if (draft.executionMode === "inspect" || draft.confidencePolicy === "manual_only") {
    return "Inspect only";
  }

  if (draft.executionMode === "apply_and_inspect") {
    return "Auto-apply with inspection trace";
  }

  return "Auto-apply";
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asAbstractLabelRole(
  value: unknown,
): AbstractRuleAuthoringDraft["payload"]["labelRole"] | undefined {
  return value === "objective" ||
    value === "methods" ||
    value === "results" ||
    value === "conclusion"
    ? value
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value != null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function asHeadingTarget(
  value: unknown,
): HeadingHierarchyRuleAuthoringDraft["payload"]["targetSection"] | undefined {
  return value === "body" || value === "abstract" ? value : undefined;
}

function asNumericUnitTarget(
  value: unknown,
): NumericUnitRuleAuthoringDraft["payload"]["targetSection"] | undefined {
  return value === "methods" || value === "results" || value === "body"
    ? value
    : undefined;
}

function asStatisticsTarget(
  value: unknown,
): StatisticalExpressionRuleAuthoringDraft["payload"]["targetSection"] | undefined {
  return value === "results" || value === "body" ? value : undefined;
}

function asTableKind(
  value: unknown,
): TableRuleAuthoringDraft["payload"]["tableKind"] | undefined {
  return value === "three_line_table" ||
    value === "general_data_table" ||
    value === "baseline_characteristics_table" ||
    value === "outcome_indicator_table"
    ? value
    : undefined;
}

function asDeclarationKind(
  value: unknown,
): DeclarationRuleAuthoringDraft["payload"]["declarationKind"] | undefined {
  return value === "ethics" ||
    value === "trial_registration" ||
    value === "funding" ||
    value === "conflict_of_interest"
    ? value
    : undefined;
}
