import type { EditorialRuleViewModel } from "../editorial-rules/index.ts";
import { getRuleAuthoringPreset } from "./rule-authoring-presets.ts";
import type {
  AbstractRuleAuthoringDraft,
  AuthorLineRuleAuthoringDraft,
  DeclarationRuleAuthoringDraft,
  FigureRuleAuthoringDraft,
  HeadingHierarchyRuleAuthoringDraft,
  JournalColumnRuleAuthoringDraft,
  KeywordRuleAuthoringDraft,
  ManuscriptStructureRuleAuthoringDraft,
  NumericUnitRuleAuthoringDraft,
  ReferenceRuleAuthoringDraft,
  RuleAuthoringDraft,
  RuleAuthoringObject,
  RuleAuthoringPreview,
  SerializedRuleAuthoringDraft,
  StatementRuleAuthoringDraft,
  StatisticalExpressionRuleAuthoringDraft,
  TableRuleAuthoringDraft,
  TerminologyRuleAuthoringDraft,
  TitleRuleAuthoringDraft,
} from "./rule-authoring-types.ts";
import { isRuleAuthoringDraft } from "./rule-authoring-types.ts";

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
  const serialized = (() => {
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
    case "statement":
      return serializeStatementRule(draft);
    case "title":
      return serializeTitleRule(draft);
    case "author_line":
      return serializeAuthorLineRule(draft);
    case "keyword":
      return serializeKeywordRule(draft);
    case "terminology":
      return serializeTerminologyRule(draft);
    case "figure":
      return serializeFigureRule(draft);
    case "manuscript_structure":
      return serializeManuscriptStructureRule(draft);
    case "journal_column":
      return serializeJournalColumnRule(draft);
    }
  })();

  return mergeLinkedKnowledgePayload(serialized, draft.linkedKnowledgeItemIds);
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
        linkedKnowledgeItemIds: extractLinkedKnowledgeItemIds(rule),
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
        metricFamily:
          asStatisticsMetricFamily(rule.authoring_payload["metric_family"]) ??
          draft.payload.metricFamily,
        supportedMetrics:
          asString(rule.authoring_payload["supported_metrics"]) ??
          draft.payload.supportedMetrics,
        requiredCompanionEvidence:
          asString(rule.authoring_payload["required_companion_evidence"]) ??
          draft.payload.requiredCompanionEvidence,
        recalculationPolicy:
          asString(rule.authoring_payload["recalculation_policy"]) ??
          draft.payload.recalculationPolicy,
      });
    }
    case "table": {
      const draft = createRuleAuthoringDraft("table");
      const selector = asRecord(rule.selector);
      const legacyTableSelector = selector ? asRecord(selector["table_selector"]) : undefined;
      return applyCommonHydration(draft, rule, {
        ...draft.payload,
        tableKind:
          asTableKind(rule.authoring_payload["table_kind"]) ??
          asTableKind(legacyTableSelector?.["table_kind"]) ??
          asTableKind(rule.trigger["layout"]) ??
          draft.payload.tableKind,
        semanticTarget:
          asTableSemanticTarget(rule.authoring_payload["semantic_target"]) ??
          asTableSemanticTarget(selector?.["semantic_target"]) ??
          draft.payload.semanticTarget,
        headerPathIncludes:
          asStringArray(rule.authoring_payload["header_path_includes"]) ??
          asStringArray(selector?.["header_path_includes"]) ??
          draft.payload.headerPathIncludes,
        rowKey:
          asString(rule.authoring_payload["row_key"]) ??
          asString(selector?.["row_key"]) ??
          draft.payload.rowKey,
        columnKey:
          asString(rule.authoring_payload["column_key"]) ??
          asString(selector?.["column_key"]) ??
          draft.payload.columnKey,
        noteKind:
          asTableNoteKind(rule.authoring_payload["note_kind"]) ??
          asTableNoteKind(selector?.["note_kind"]) ??
          draft.payload.noteKind,
        unitContext:
          asTableUnitContext(rule.authoring_payload["unit_context"]) ??
          asTableUnitContext(selector?.["unit_context"]) ??
          draft.payload.unitContext,
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
    case "statement": {
      const draft = createRuleAuthoringDraft("statement");
      const statementKind =
        asStatementKind(rule.authoring_payload["statement_kind"]) ??
        asStatementKind(rule.authoring_payload["declaration_kind"]) ??
        draft.payload.statementKind;
      return applyCommonHydration(draft, rule, {
        ...draft.payload,
        statementKind,
        requiredStatement:
          asString(rule.authoring_payload["required_statement"]) ??
          draft.payload.requiredStatement,
        placement:
          asString(rule.authoring_payload["placement"]) ?? draft.payload.placement,
      });
    }
    case "title": {
      const draft = createRuleAuthoringDraft("title");
      return applyCommonHydration(draft, rule, {
        ...draft.payload,
        titlePattern:
          asString(rule.authoring_payload["title_pattern"]) ?? draft.payload.titlePattern,
        casingRule:
          asString(rule.authoring_payload["casing_rule"]) ?? draft.payload.casingRule,
        subtitleHandling:
          asString(rule.authoring_payload["subtitle_handling"]) ??
          draft.payload.subtitleHandling,
      });
    }
    case "author_line": {
      const draft = createRuleAuthoringDraft("author_line");
      return applyCommonHydration(draft, rule, {
        ...draft.payload,
        separator:
          asString(rule.authoring_payload["separator"]) ?? draft.payload.separator,
        affiliationFormat:
          asString(rule.authoring_payload["affiliation_format"]) ??
          draft.payload.affiliationFormat,
        correspondingAuthorRule:
          asString(rule.authoring_payload["corresponding_author_rule"]) ??
          draft.payload.correspondingAuthorRule,
      });
    }
    case "keyword": {
      const draft = createRuleAuthoringDraft("keyword");
      return applyCommonHydration(draft, rule, {
        ...draft.payload,
        keywordCount:
          asString(rule.authoring_payload["keyword_count"]) ?? draft.payload.keywordCount,
        separator:
          asString(rule.authoring_payload["separator"]) ?? draft.payload.separator,
        vocabularyRequirement:
          asString(rule.authoring_payload["vocabulary_requirement"]) ??
          draft.payload.vocabularyRequirement,
      });
    }
    case "terminology": {
      const draft = createRuleAuthoringDraft("terminology");
      return applyCommonHydration(draft, rule, {
        ...draft.payload,
        targetSection:
          asTerminologyTarget(rule.authoring_payload["target_section"]) ??
          draft.payload.targetSection,
        preferredTerm:
          asString(rule.authoring_payload["preferred_term"]) ??
          draft.payload.preferredTerm,
        disallowedVariant:
          asString(rule.authoring_payload["disallowed_variant"]) ??
          draft.payload.disallowedVariant,
      });
    }
    case "figure": {
      const draft = createRuleAuthoringDraft("figure");
      return applyCommonHydration(draft, rule, {
        ...draft.payload,
        figureKind:
          asFigureKind(rule.authoring_payload["figure_kind"]) ?? draft.payload.figureKind,
        captionRequirement:
          asString(rule.authoring_payload["caption_requirement"]) ??
          draft.payload.captionRequirement,
        fileRequirement:
          asString(rule.authoring_payload["file_requirement"]) ??
          draft.payload.fileRequirement,
      });
    }
    case "manuscript_structure": {
      const draft = createRuleAuthoringDraft("manuscript_structure");
      return applyCommonHydration(draft, rule, {
        ...draft.payload,
        manuscriptType:
          asString(rule.authoring_payload["manuscript_type"]) ??
          draft.payload.manuscriptType,
        requiredSections:
          asString(rule.authoring_payload["required_sections"]) ??
          draft.payload.requiredSections,
        sectionOrder:
          asString(rule.authoring_payload["section_order"]) ?? draft.payload.sectionOrder,
      });
    }
    case "journal_column": {
      const draft = createRuleAuthoringDraft("journal_column");
      return applyCommonHydration(draft, rule, {
        ...draft.payload,
        columnName:
          asString(rule.authoring_payload["column_name"]) ?? draft.payload.columnName,
        requirement:
          asString(rule.authoring_payload["requirement"]) ?? draft.payload.requirement,
        sourceSection:
          asString(rule.authoring_payload["source_section"]) ??
          draft.payload.sourceSection,
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

export function resolveRuleAuthoringDraftForOverview(input: {
  overview: {
    rules: EditorialRuleViewModel[];
    selectedJournalTemplateId: string | null;
    selectedRuleSetId: string | null;
  };
  preferredRuleObject: RuleAuthoringObject;
  previousSelectedRuleSetId?: string | null;
}): RuleAuthoringDraft {
  const firstStructuredRule = input.overview.rules.find(isRuleAuthoringDraft);
  const nextRuleDraft = firstStructuredRule
    ? hydrateRuleAuthoringDraft(firstStructuredRule)
    : createRuleAuthoringDraft(
        shouldResetToAbstractDraft(input) ? "abstract" : input.preferredRuleObject,
      );

  return {
    ...nextRuleDraft,
    journalTemplateId: input.overview.selectedJournalTemplateId,
  };
}

export function buildRuleAuthoringPreview(
  draft: RuleAuthoringDraft,
): RuleAuthoringPreview {
  const serialized = serializeRuleAuthoringDraft(draft);

  return {
    selectorSummary: describeSelector(serialized.selector ?? {}),
    automationRiskPosture: describeAutomationRisk(draft),
    templateScopeSummary: describeTemplateScope(draft),
    normalizedExample: describeNormalizedExample(draft, serialized),
    semanticHitSummary: describeSemanticHit(draft),
    expectedEvidenceSummary: describeExpectedEvidence(draft),
    overrideSummary: describeOverrideSummary(draft),
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
      metric_family: draft.payload.metricFamily,
    },
    action: {
      kind: "normalize_statistical_expression",
      requirement: draft.payload.reportingRequirement,
      recalculation_policy: draft.payload.recalculationPolicy,
    },
    authoringPayload: {
      target_section: draft.payload.targetSection,
      expression_pattern: draft.payload.expressionPattern,
      reporting_requirement: draft.payload.reportingRequirement,
      metric_family: draft.payload.metricFamily,
      supported_metrics: draft.payload.supportedMetrics,
      required_companion_evidence: draft.payload.requiredCompanionEvidence,
      recalculation_policy: draft.payload.recalculationPolicy,
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
  const selector = {
    semantic_target: draft.payload.semanticTarget,
    ...(draft.payload.headerPathIncludes.length > 0
      ? {
          header_path_includes: [...draft.payload.headerPathIncludes],
        }
      : {}),
    ...(draft.payload.rowKey.trim().length > 0
      ? {
          row_key: draft.payload.rowKey.trim(),
        }
      : {}),
    ...(draft.payload.columnKey.trim().length > 0
      ? {
          column_key: draft.payload.columnKey.trim(),
        }
      : {}),
    ...(draft.payload.semanticTarget === "footnote_item"
      ? {
          note_kind: draft.payload.noteKind,
        }
      : {}),
    ...(draft.payload.semanticTarget === "data_cell"
      ? {
          unit_context: draft.payload.unitContext,
        }
      : {}),
  };

  return {
    orderNo: draft.orderNo,
    ruleObject: draft.ruleObject,
    ruleType: draft.ruleType,
    executionMode: "inspect",
    scope: {
      block_kind: "table",
    },
    selector,
    trigger: {
      kind: "table_shape",
      layout: resolveTableLayout(draft.payload.tableKind),
    },
    action: {
      kind: "inspect_table_rule",
      caption_requirement: draft.payload.captionRequirement,
      layout_requirement: draft.payload.layoutRequirement,
    },
    authoringPayload: {
      table_kind: draft.payload.tableKind,
      semantic_target: draft.payload.semanticTarget,
      ...(draft.payload.headerPathIncludes.length > 0
        ? {
            header_path_includes: [...draft.payload.headerPathIncludes],
          }
        : {}),
      ...(draft.payload.rowKey.trim().length > 0
        ? {
            row_key: draft.payload.rowKey.trim(),
          }
        : {}),
      ...(draft.payload.columnKey.trim().length > 0
        ? {
            column_key: draft.payload.columnKey.trim(),
          }
        : {}),
      ...(draft.payload.semanticTarget === "footnote_item"
        ? {
            note_kind: draft.payload.noteKind,
          }
        : {}),
      ...(draft.payload.semanticTarget === "data_cell"
        ? {
            unit_context: draft.payload.unitContext,
          }
        : {}),
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

function serializeStatementRule(
  draft: StatementRuleAuthoringDraft,
): SerializedRuleAuthoringDraft {
  return {
    orderNo: draft.orderNo,
    ruleObject: draft.ruleObject,
    ruleType: draft.ruleType,
    executionMode: "inspect",
    scope: {
      sections: ["back_matter"],
      block_kind: "statement",
    },
    selector: {
      statement_selector: {
        statement_kind: draft.payload.statementKind,
      },
    },
    trigger: {
      kind: "required_statement",
      statement_kind: draft.payload.statementKind,
    },
    action: {
      kind: "inspect_required_statement",
      placement: draft.payload.placement,
    },
    authoringPayload: {
      statement_kind: draft.payload.statementKind,
      required_statement: draft.payload.requiredStatement,
      placement: draft.payload.placement,
    },
    evidenceLevel: draft.evidenceLevel,
    confidencePolicy: draft.confidencePolicy,
    severity: draft.severity,
    enabled: draft.enabled,
    manualReviewReasonTemplate:
      draft.manualReviewReasonTemplate ??
      `Inspect ${draft.payload.statementKind} statement placement and wording.`,
  };
}

function serializeTitleRule(
  draft: TitleRuleAuthoringDraft,
): SerializedRuleAuthoringDraft {
  return {
    orderNo: draft.orderNo,
    ruleObject: draft.ruleObject,
    ruleType: draft.ruleType,
    executionMode: draft.executionMode,
    scope: {
      sections: ["front_matter"],
      block_kind: "title",
    },
    selector: {
      section_selector: "front_matter",
      block_selector: "title",
    },
    trigger: {
      kind: "title_pattern",
      pattern: draft.payload.titlePattern,
    },
    action: {
      kind: "normalize_title",
      casing_rule: draft.payload.casingRule,
      subtitle_handling: draft.payload.subtitleHandling,
    },
    authoringPayload: {
      title_pattern: draft.payload.titlePattern,
      casing_rule: draft.payload.casingRule,
      subtitle_handling: draft.payload.subtitleHandling,
    },
    evidenceLevel: draft.evidenceLevel,
    confidencePolicy: draft.confidencePolicy,
    severity: draft.severity,
    enabled: draft.enabled,
    exampleBefore: draft.payload.titlePattern,
    exampleAfter: `${draft.payload.casingRule} | ${draft.payload.subtitleHandling}`,
  };
}

function serializeAuthorLineRule(
  draft: AuthorLineRuleAuthoringDraft,
): SerializedRuleAuthoringDraft {
  return {
    orderNo: draft.orderNo,
    ruleObject: draft.ruleObject,
    ruleType: draft.ruleType,
    executionMode: "inspect",
    scope: {
      sections: ["front_matter"],
      block_kind: "author_line",
    },
    selector: {
      section_selector: "front_matter",
      block_selector: "author_line",
    },
    trigger: {
      kind: "author_line_pattern",
      separator: draft.payload.separator,
    },
    action: {
      kind: "inspect_author_line",
      affiliation_format: draft.payload.affiliationFormat,
      corresponding_author_rule: draft.payload.correspondingAuthorRule,
    },
    authoringPayload: {
      separator: draft.payload.separator,
      affiliation_format: draft.payload.affiliationFormat,
      corresponding_author_rule: draft.payload.correspondingAuthorRule,
    },
    evidenceLevel: draft.evidenceLevel,
    confidencePolicy: draft.confidencePolicy,
    severity: draft.severity,
    enabled: draft.enabled,
    manualReviewReasonTemplate:
      draft.manualReviewReasonTemplate ??
      "Inspect author order, affiliation markers, and corresponding-author notes.",
  };
}

function serializeKeywordRule(
  draft: KeywordRuleAuthoringDraft,
): SerializedRuleAuthoringDraft {
  return {
    orderNo: draft.orderNo,
    ruleObject: draft.ruleObject,
    ruleType: draft.ruleType,
    executionMode: draft.executionMode,
    scope: {
      sections: ["keywords"],
      block_kind: "keyword_block",
    },
    selector: {
      section_selector: "keywords",
      block_selector: "keyword_block",
    },
    trigger: {
      kind: "keyword_block",
      keyword_count: draft.payload.keywordCount,
    },
    action: {
      kind: "normalize_keywords",
      separator: draft.payload.separator,
      vocabulary_requirement: draft.payload.vocabularyRequirement,
    },
    authoringPayload: {
      keyword_count: draft.payload.keywordCount,
      separator: draft.payload.separator,
      vocabulary_requirement: draft.payload.vocabularyRequirement,
    },
    evidenceLevel: draft.evidenceLevel,
    confidencePolicy: draft.confidencePolicy,
    severity: draft.severity,
    enabled: draft.enabled,
  };
}

function serializeTerminologyRule(
  draft: TerminologyRuleAuthoringDraft,
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
        content_class: "terminology",
      },
    },
    trigger: {
      kind: "terminology_variant",
      disallowed_variant: draft.payload.disallowedVariant,
    },
    action: {
      kind: "replace_terminology",
      preferred_term: draft.payload.preferredTerm,
    },
    authoringPayload: {
      target_section: draft.payload.targetSection,
      preferred_term: draft.payload.preferredTerm,
      disallowed_variant: draft.payload.disallowedVariant,
    },
    evidenceLevel: draft.evidenceLevel,
    confidencePolicy: draft.confidencePolicy,
    severity: draft.severity,
    enabled: draft.enabled,
    exampleBefore: draft.payload.disallowedVariant,
    exampleAfter: draft.payload.preferredTerm,
  };
}

function serializeFigureRule(
  draft: FigureRuleAuthoringDraft,
): SerializedRuleAuthoringDraft {
  return {
    orderNo: draft.orderNo,
    ruleObject: draft.ruleObject,
    ruleType: draft.ruleType,
    executionMode: "inspect",
    scope: {
      block_kind: "figure",
    },
    selector: {
      block_selector: "figure",
      figure_selector: {
        figure_kind: draft.payload.figureKind,
      },
    },
    trigger: {
      kind: "figure_rule",
      figure_kind: draft.payload.figureKind,
    },
    action: {
      kind: "inspect_figure_rule",
      caption_requirement: draft.payload.captionRequirement,
      file_requirement: draft.payload.fileRequirement,
    },
    authoringPayload: {
      figure_kind: draft.payload.figureKind,
      caption_requirement: draft.payload.captionRequirement,
      file_requirement: draft.payload.fileRequirement,
    },
    evidenceLevel: draft.evidenceLevel,
    confidencePolicy: draft.confidencePolicy,
    severity: draft.severity,
    enabled: draft.enabled,
    manualReviewReasonTemplate:
      draft.manualReviewReasonTemplate ??
      "Inspect figure numbering, caption placement, and source-file readiness.",
  };
}

function serializeManuscriptStructureRule(
  draft: ManuscriptStructureRuleAuthoringDraft,
): SerializedRuleAuthoringDraft {
  return {
    orderNo: draft.orderNo,
    ruleObject: draft.ruleObject,
    ruleType: draft.ruleType,
    executionMode: "inspect",
    scope: {
      block_kind: "manuscript_structure",
    },
    selector: {
      manuscript_structure_selector: {
        manuscript_type: draft.payload.manuscriptType,
      },
    },
    trigger: {
      kind: "section_order",
      manuscript_type: draft.payload.manuscriptType,
    },
    action: {
      kind: "inspect_manuscript_structure",
      required_sections: draft.payload.requiredSections,
      section_order: draft.payload.sectionOrder,
    },
    authoringPayload: {
      manuscript_type: draft.payload.manuscriptType,
      required_sections: draft.payload.requiredSections,
      section_order: draft.payload.sectionOrder,
    },
    evidenceLevel: draft.evidenceLevel,
    confidencePolicy: draft.confidencePolicy,
    severity: draft.severity,
    enabled: draft.enabled,
    manualReviewReasonTemplate:
      draft.manualReviewReasonTemplate ??
      "Inspect section completeness and ordering against the manuscript type.",
  };
}

function serializeJournalColumnRule(
  draft: JournalColumnRuleAuthoringDraft,
): SerializedRuleAuthoringDraft {
  return {
    orderNo: draft.orderNo,
    ruleObject: draft.ruleObject,
    ruleType: draft.ruleType,
    executionMode: "inspect",
    scope: {
      block_kind: "journal_column",
    },
    selector: {
      journal_column_selector: {
        column_name: draft.payload.columnName,
      },
    },
    trigger: {
      kind: "journal_column_rule",
      column_name: draft.payload.columnName,
    },
    action: {
      kind: "inspect_journal_column",
      requirement: draft.payload.requirement,
      source_section: draft.payload.sourceSection,
    },
    authoringPayload: {
      column_name: draft.payload.columnName,
      requirement: draft.payload.requirement,
      source_section: draft.payload.sourceSection,
    },
    evidenceLevel: draft.evidenceLevel,
    confidencePolicy: draft.confidencePolicy,
    severity: draft.severity,
    enabled: draft.enabled,
    manualReviewReasonTemplate:
      draft.manualReviewReasonTemplate ??
      "Inspect journal-column mapping before final template release.",
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
    linkedKnowledgeItemIds: extractLinkedKnowledgeItemIds(rule),
    payload,
  };
}

function mergeLinkedKnowledgePayload(
  serialized: SerializedRuleAuthoringDraft,
  linkedKnowledgeItemIds: string[] | undefined,
): SerializedRuleAuthoringDraft {
  const normalizedIds = normalizeLinkedKnowledgeItemIds(linkedKnowledgeItemIds);
  if (normalizedIds.length === 0) {
    return serialized;
  }

  return {
    ...serialized,
    linkagePayload: {
      ...serialized.linkagePayload,
      projected_knowledge_item_ids: normalizedIds,
    },
  };
}

function extractLinkedKnowledgeItemIds(rule: EditorialRuleViewModel): string[] {
  return normalizeLinkedKnowledgeItemIds(
    asStringArray(rule.linkage_payload?.["projected_knowledge_item_ids"]),
  );
}

function normalizeLinkedKnowledgeItemIds(value: string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  return [...new Set(value.map((item) => item.trim()).filter((item) => item.length > 0))];
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

  const semanticTarget = asString(selector["semantic_target"]);
  if (semanticTarget) {
    parts.push(`semantic_target=${semanticTarget}`);
  }

  const headerPathIncludes = asStringArray(selector["header_path_includes"]);
  if (headerPathIncludes?.length) {
    parts.push(`header_path=${headerPathIncludes.join(" > ")}`);
  }

  const rowKey = asString(selector["row_key"]);
  if (rowKey) {
    parts.push(`row_key=${rowKey}`);
  }

  const columnKey = asString(selector["column_key"]);
  if (columnKey) {
    parts.push(`column_key=${columnKey}`);
  }

  const noteKind = asString(selector["note_kind"]);
  if (noteKind) {
    parts.push(`note_kind=${noteKind}`);
  }

  const unitContext = asString(selector["unit_context"]);
  if (unitContext) {
    parts.push(`unit_context=${unitContext}`);
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

  const statementKind = statementSelector
    ? asString(statementSelector["statement_kind"])
    : undefined;
  if (statementKind) {
    parts.push(`statement=${statementKind}`);
  }

  const figureSelector = asRecord(selector["figure_selector"]);
  const figureKind = figureSelector ? asString(figureSelector["figure_kind"]) : undefined;
  if (figureKind) {
    parts.push(`figure=${figureKind}`);
  }

  const manuscriptStructureSelector = asRecord(
    selector["manuscript_structure_selector"],
  );
  const manuscriptType = manuscriptStructureSelector
    ? asString(manuscriptStructureSelector["manuscript_type"])
    : undefined;
  if (manuscriptType) {
    parts.push(`manuscript=${manuscriptType}`);
  }

  const journalColumnSelector = asRecord(selector["journal_column_selector"]);
  const columnName = journalColumnSelector
    ? asString(journalColumnSelector["column_name"])
    : undefined;
  if (columnName) {
    parts.push(`column=${columnName}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "通用选择器";
}

function describeAutomationRisk(draft: RuleAuthoringDraft): string {
  if (draft.executionMode === "inspect" || draft.confidencePolicy === "manual_only") {
    return "仅检查";
  }

  if (draft.executionMode === "apply_and_inspect") {
    return "自动应用并保留检查轨迹";
  }

  return "自动应用";
}

function describeTemplateScope(draft: RuleAuthoringDraft): string {
  return draft.journalTemplateId != null
    ? `期刊加层：${draft.journalTemplateId}`
    : "模板族基础规则";
}

function describeNormalizedExample(
  draft: RuleAuthoringDraft,
  serialized: SerializedRuleAuthoringDraft,
): string {
  if (serialized.exampleBefore && serialized.exampleAfter) {
    return `${serialized.exampleBefore} -> ${serialized.exampleAfter}`;
  }

  if (draft.ruleObject === "table") {
    return `${draft.payload.captionRequirement} | ${draft.payload.layoutRequirement}`;
  }

  return "尚未配置精确示例。";
}

function describeSemanticHit(draft: RuleAuthoringDraft): string {
  if (draft.ruleObject !== "table") {
    return "文本与章节选择器决定规则命中路径。";
  }

  const details = [`semantic_target=${draft.payload.semanticTarget}`];
  if (draft.payload.headerPathIncludes.length > 0) {
    details.push(`header_path=${draft.payload.headerPathIncludes.join(" > ")}`);
  }
  if (draft.payload.rowKey.trim().length > 0) {
    details.push(`row_key=${draft.payload.rowKey.trim()}`);
  }
  if (draft.payload.columnKey.trim().length > 0) {
    details.push(`column_key=${draft.payload.columnKey.trim()}`);
  }
  if (draft.payload.semanticTarget === "footnote_item") {
    details.push(`note_kind=${draft.payload.noteKind}`);
  }
  if (draft.payload.semanticTarget === "data_cell") {
    details.push(`unit_context=${draft.payload.unitContext}`);
  }

  return `预期语义命中：${details.join(" | ")}`;
}

function describeExpectedEvidence(draft: RuleAuthoringDraft): string {
  if (draft.ruleObject === "statistical_expression") {
    return [
      `metric_family=${draft.payload.metricFamily}`,
      `supported_metrics=${draft.payload.supportedMetrics}`,
      `companion_evidence=${draft.payload.requiredCompanionEvidence}`,
      `recalculation_policy=${draft.payload.recalculationPolicy}`,
    ].join(" | ");
  }

  if (draft.ruleObject !== "table") {
    return "运行证据会基于解析后的选择器和文本变换路径生成。";
  }

  const details = [
    "table_id=runtime-resolved",
    `semantic_target=${draft.payload.semanticTarget}`,
  ];
  if (draft.payload.headerPathIncludes.length > 0) {
    details.push(`header_path=${draft.payload.headerPathIncludes.join(" > ")}`);
  }
  if (draft.payload.rowKey.trim().length > 0) {
    details.push(`row_key=${draft.payload.rowKey.trim()}`);
  }
  if (draft.payload.columnKey.trim().length > 0) {
    details.push(`column_key=${draft.payload.columnKey.trim()}`);
  }
  if (draft.payload.semanticTarget === "footnote_item") {
    details.push(`note_kind=${draft.payload.noteKind}`);
  }
  if (draft.payload.semanticTarget === "data_cell") {
    details.push(`unit_context=${draft.payload.unitContext}`);
  }

  return details.join(" | ");
}

function describeOverrideSummary(draft: RuleAuthoringDraft): string {
  if (draft.journalTemplateId != null) {
    return `当期刊加层 ${draft.journalTemplateId} 与模板族基础规则命中同一语义坐标时，会优先替换基础规则。`;
  }

  return "在期刊模板发布同一语义坐标的加层规则前，模板族基础规则会持续生效。";
}

function shouldResetToAbstractDraft(input: {
  overview: {
    selectedRuleSetId: string | null;
  };
  previousSelectedRuleSetId?: string | null;
}): boolean {
  const nextRuleSetId = input.overview.selectedRuleSetId ?? null;
  const previousRuleSetId = input.previousSelectedRuleSetId ?? null;

  return nextRuleSetId !== null && nextRuleSetId !== previousRuleSetId;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value.filter((entry) => entry.length > 0)
    : undefined;
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

function asStatisticsMetricFamily(
  value: unknown,
): StatisticalExpressionRuleAuthoringDraft["payload"]["metricFamily"] | undefined {
  return value === "basic" ||
    value === "diagnostic" ||
    value === "regression" ||
    value === "inferential"
    ? value
    : undefined;
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

function asTableSemanticTarget(
  value: unknown,
): TableRuleAuthoringDraft["payload"]["semanticTarget"] | undefined {
  return value === "header_cell" ||
    value === "stub_column" ||
    value === "data_cell" ||
    value === "footnote_item"
    ? value
    : undefined;
}

function asTableNoteKind(
  value: unknown,
): TableRuleAuthoringDraft["payload"]["noteKind"] | undefined {
  return value === "statistical_significance" ||
    value === "abbreviation" ||
    value === "general"
    ? value
    : undefined;
}

function asTableUnitContext(
  value: unknown,
): TableRuleAuthoringDraft["payload"]["unitContext"] | undefined {
  return value === "header" || value === "stub" || value === "footnote"
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

function asStatementKind(
  value: unknown,
): StatementRuleAuthoringDraft["payload"]["statementKind"] | undefined {
  return value === "ethics" ||
    value === "trial_registration" ||
    value === "funding" ||
    value === "conflict_of_interest" ||
    value === "author_contribution"
    ? value
    : undefined;
}

function asTerminologyTarget(
  value: unknown,
): TerminologyRuleAuthoringDraft["payload"]["targetSection"] | undefined {
  return value === "title" ||
    value === "abstract" ||
    value === "body" ||
    value === "global"
    ? value
    : undefined;
}

function asFigureKind(
  value: unknown,
): FigureRuleAuthoringDraft["payload"]["figureKind"] | undefined {
  return value === "flowchart" ||
    value === "clinical_image" ||
    value === "trend_chart" ||
    value === "pathology_image"
    ? value
    : undefined;
}

function resolveTableLayout(
  tableKind: TableRuleAuthoringDraft["payload"]["tableKind"],
): string {
  return tableKind;
}
