import { createHash } from "node:crypto";
import type {
  CompiledEditorialRuleSeed,
  RulePackageCompileProjectionReadiness,
  RulePackageCompilePublishReadiness,
  RulePackageCompilePreviewEntry,
  PreviewCompileRulePackagesInput,
  RuleEvidenceExample,
  RulePackageAutomationPosture,
  RulePackageCompilePreview,
  RulePackageCompileReadiness,
  RulePackageDraft,
  RulePackageWorkspaceSourceInput,
} from "@medical/contracts";
import { getEditorialRuleObjectCatalogEntry } from "./editorial-rule-object-catalog.ts";
import { createEditorialRuleCoverageKey } from "./editorial-rule-resolution-service.ts";
import type { EditorialRuleResolutionService } from "./editorial-rule-resolution-service.ts";
import {
  EditorialRuleService,
  EditorialRuleSetNotEditableError,
  EditorialRuleSetNotFoundError,
} from "./editorial-rule-service.ts";
import type { EditorialRuleRepository } from "./editorial-rule-repository.ts";
import type {
  CompileRulePackagesToDraftInput,
  CompileRulePackagesToDraftResult,
} from "./editorial-rule-package-types.ts";
import type {
  EditorialRuleAction,
  EditorialRuleRecord,
  EditorialRuleScope,
  EditorialRuleSetRecord,
  EditorialRuleTrigger,
} from "./editorial-rule-record.ts";

const COMPILER_VERSION = "v2c-preview-1";
const PROJECTION_RELEVANT_FIELDS = [
  "summary",
  "applicability",
  "evidence",
  "boundaries",
] as const;
const DEFAULT_PROJECTION_KINDS = [
  "rule",
  "checklist",
  "prompt_snippet",
] as const satisfies RulePackageCompileProjectionReadiness["projected_kinds"];
type CompiledRuleSeedDraft = Omit<
  CompiledEditorialRuleSeed,
  "coverage_key" | "trigger" | "action"
> & {
  trigger: EditorialRuleTrigger;
  action: EditorialRuleAction;
};

export interface RulePackageCompileServiceOptions {
  repository: EditorialRuleRepository;
  resolutionService: Pick<EditorialRuleResolutionService, "resolve">;
  editorialRuleService: EditorialRuleService;
}

export class RulePackageCompileService {
  private readonly repository: EditorialRuleRepository;
  private readonly resolutionService: Pick<EditorialRuleResolutionService, "resolve">;
  private readonly editorialRuleService: EditorialRuleService;

  constructor(options: RulePackageCompileServiceOptions) {
    this.repository = options.repository;
    this.resolutionService = options.resolutionService;
    this.editorialRuleService = options.editorialRuleService;
  }

  async previewCompile(
    input: PreviewCompileRulePackagesInput,
  ): Promise<RulePackageCompilePreview> {
    const existingResolution = await this.resolutionService.resolve({
      templateFamilyId: input.templateFamilyId,
      journalTemplateId: input.journalTemplateId,
      module: input.module,
    });
    const activeCoverageKeys = new Set(
      existingResolution.resolved_rules.map((entry) => entry.coverage_key),
    );

    const packages = input.packageDrafts.map((packageDraft) =>
      buildCompilePreviewEntry({
        packageDraft,
        source: input.source,
        activeCoverageKeys,
      }),
    );

    return { packages };
  }

  async compileToDraft(
    input: CompileRulePackagesToDraftInput,
  ): Promise<CompileRulePackagesToDraftResult> {
    const preview = await this.previewCompile(input);
    const previewByPackageId = new Map(
      preview.packages.map((entry) => [entry.package_id, entry]),
    );
    const target = await resolveCompileTargetRuleSet({
      repository: this.repository,
      editorialRuleService: this.editorialRuleService,
      input,
    });
    const targetRuleSet = target.ruleSet;
    const existingRules = await this.repository.listRulesByRuleSetId(targetRuleSet.id);
    const createdRuleIds: string[] = [];
    const replacedRuleIds: string[] = [];
    const skippedPackages: CompileRulePackagesToDraftResult["skipped_packages"] = [];
    let nextOrderNo =
      existingRules.reduce((maxOrderNo, rule) => Math.max(maxOrderNo, rule.order_no), 0) +
      10;

    for (const packageDraft of input.packageDrafts) {
      const previewEntry = previewByPackageId.get(packageDraft.package_id);
      if (!previewEntry) {
        skippedPackages.push({
          package_id: packageDraft.package_id,
          reason: "Compile preview result is missing.",
        });
        continue;
      }

      if (
        previewEntry.readiness.status === "needs_confirmation" ||
        previewEntry.readiness.status === "unsupported"
      ) {
        skippedPackages.push({
          package_id: packageDraft.package_id,
          reason: previewEntry.readiness.reasons.join(" "),
        });
        continue;
      }

      const compiledMetadata = buildCompiledKnowledgeMetadata({
        packageDraft,
        source: input.source,
      });

      for (const seed of previewEntry.draft_rule_seeds) {
        const materializedSeed = materializeCompiledRuleSeed(seed);
        const matchingExistingRule = existingRules.find(
          (rule) =>
            isRulePackageOwnedRule(rule, seed.package_id) &&
            createEditorialRuleCoverageKey(rule) === seed.coverage_key,
        );

        if (matchingExistingRule) {
          const updatedRule: EditorialRuleRecord = {
            ...matchingExistingRule,
            rule_object: seed.rule_object,
            rule_type: seed.rule_type,
            execution_mode: seed.execution_mode,
            scope: materializedSeed.scope,
            selector: materializedSeed.selector,
            trigger: materializedSeed.trigger,
            action: materializedSeed.action,
            authoring_payload: materializedSeed.authoring_payload,
            confidence_policy: seed.confidence_policy,
            severity: seed.severity,
            enabled: true,
            ...(compiledMetadata.explanationPayload
              ? {
                  explanation_payload: structuredClone(
                    compiledMetadata.explanationPayload,
                  ),
                }
              : {}),
            ...(compiledMetadata.linkagePayload
              ? {
                  linkage_payload: structuredClone(compiledMetadata.linkagePayload),
                }
              : {}),
            ...(compiledMetadata.projectionPayload
              ? {
                  projection_payload: structuredClone(
                    compiledMetadata.projectionPayload,
                  ),
                }
              : {}),
            ...(compiledMetadata.evidenceLevel
              ? { evidence_level: compiledMetadata.evidenceLevel }
              : {}),
            ...(seed.example_before ? { example_before: seed.example_before } : {}),
            ...(seed.example_after ? { example_after: seed.example_after } : {}),
            ...(seed.manual_review_reason_template
              ? {
                  manual_review_reason_template: seed.manual_review_reason_template,
                }
              : {}),
          };
          await this.repository.saveRule(updatedRule);
          replacedRuleIds.push(updatedRule.id);
          continue;
        }

        const createdRule = await this.editorialRuleService.createRule(input.actorRole, {
          ruleSetId: targetRuleSet.id,
          orderNo: nextOrderNo,
          ruleObject: seed.rule_object,
          ruleType: seed.rule_type,
          executionMode: seed.execution_mode,
          scope: materializedSeed.scope,
          selector: materializedSeed.selector,
          trigger: materializedSeed.trigger,
          action: materializedSeed.action,
          authoringPayload: materializedSeed.authoring_payload,
          explanationPayload: compiledMetadata.explanationPayload,
          linkagePayload: compiledMetadata.linkagePayload,
          projectionPayload: compiledMetadata.projectionPayload,
          evidenceLevel: compiledMetadata.evidenceLevel,
          confidencePolicy: seed.confidence_policy,
          severity: seed.severity,
          enabled: true,
          exampleBefore: seed.example_before,
          exampleAfter: seed.example_after,
          manualReviewReasonTemplate: seed.manual_review_reason_template,
        });
        nextOrderNo += 10;
        createdRuleIds.push(createdRule.id);
        existingRules.push(createdRule);
      }
    }

    return {
      rule_set_id: targetRuleSet.id,
      target_mode: target.targetMode,
      created_rule_ids: createdRuleIds,
      replaced_rule_ids: [...new Set(replacedRuleIds)],
      skipped_packages: skippedPackages,
      publish_readiness: classifyPublishReadiness({
        preview,
        skippedPackages,
      }),
      projection_readiness: classifyProjectionReadiness({
        packageDrafts: input.packageDrafts,
        preview,
        skippedPackages,
      }),
    };
  }
}

async function resolveCompileTargetRuleSet(input: {
  repository: Pick<EditorialRuleRepository, "findRuleSetById">;
  editorialRuleService: Pick<EditorialRuleService, "createRuleSet">;
  input: CompileRulePackagesToDraftInput;
}): Promise<{
  ruleSet: EditorialRuleSetRecord;
  targetMode: CompileRulePackagesToDraftResult["target_mode"];
}> {
  if (input.input.targetRuleSetId) {
    const selectedDraft = await loadTargetDraftRuleSet(
      input.repository,
      input.input.targetRuleSetId,
    );
    if (ruleSetMatchesCompileContext(selectedDraft, input.input)) {
      return {
        ruleSet: selectedDraft,
        targetMode: "reused_selected_draft",
      };
    }
  }

  return {
    ruleSet: await input.editorialRuleService.createRuleSet(input.input.actorRole, {
      templateFamilyId: input.input.templateFamilyId,
      journalTemplateId: input.input.journalTemplateId,
      module: input.input.module,
    }),
    targetMode: "created_new_draft",
  };
}

function buildCompilePreviewEntry(input: {
  packageDraft: RulePackageDraft;
  source: RulePackageWorkspaceSourceInput;
  activeCoverageKeys: Set<string>;
}): RulePackageCompilePreviewEntry {
  const readiness = evaluateCompileReadiness(input.packageDraft);
  const draftRuleSeeds =
    readiness.status === "needs_confirmation" || readiness.status === "unsupported"
      ? []
      : compileRulePackageDraft(input.packageDraft, input.source);
  const overridesPublishedCoverageKeys = draftRuleSeeds
    .map((seed) => seed.coverage_key)
    .filter((coverageKey) => input.activeCoverageKeys.has(coverageKey));

  return {
    package_id: input.packageDraft.package_id,
    readiness,
    draft_rule_seeds: draftRuleSeeds,
    overrides_published_coverage_keys: overridesPublishedCoverageKeys,
    warnings: buildCompileWarnings(input.packageDraft, readiness, overridesPublishedCoverageKeys),
  };
}

function evaluateCompileReadiness(
  packageDraft: RulePackageDraft,
): RulePackageCompileReadiness {
  const semanticDraft = packageDraft.semantic_draft;
  if (!semanticDraft) {
    return {
      status: "needs_confirmation",
      reasons: ["Semantic draft is missing."],
    };
  }

  const missingReasons: string[] = [];
  if (!semanticDraft.confirmed_fields.includes("summary")) {
    missingReasons.push("Summary is not confirmed.");
  }
  if (!semanticDraft.confirmed_fields.includes("applicability")) {
    missingReasons.push("Applicability is not confirmed.");
  }
  if (!semanticDraft.confirmed_fields.includes("evidence")) {
    missingReasons.push("Evidence is not confirmed.");
  }
  if (
    !semanticDraft.confirmed_fields.includes("boundaries") &&
    semanticDraft.review_policy.length === 0 &&
    semanticDraft.failure_boundaries.length === 0
  ) {
    missingReasons.push("Boundaries or review policy must be confirmed.");
  }

  if (missingReasons.length > 0) {
    return {
      status: "needs_confirmation",
      reasons: missingReasons,
    };
  }

  if (compileRulePackageKindIsUnsupported(packageDraft.package_kind)) {
    return {
      status: "unsupported",
      reasons: [`Package kind "${packageDraft.package_kind}" is not compiled yet.`],
    };
  }

  return {
    status:
      packageDraft.automation_posture === "inspect_only"
        ? "ready_with_downgrade"
        : "ready",
    reasons:
      packageDraft.automation_posture === "inspect_only"
        ? ["This package compiles as inspect-only."]
        : [],
  };
}

function compileRulePackageKindIsUnsupported(
  packageKind: RulePackageDraft["package_kind"],
): boolean {
  return ![
    "front_matter",
    "abstract_keywords",
    "terminology",
    "heading_hierarchy",
    "statement",
    "manuscript_structure",
    "numeric_statistics",
    "three_line_table",
    "reference",
  ].includes(packageKind);
}

function compileRulePackageDraft(
  packageDraft: RulePackageDraft,
  source: RulePackageWorkspaceSourceInput,
): CompiledEditorialRuleSeed[] {
  switch (packageDraft.package_kind) {
    case "front_matter":
      return [
        buildTitleSeed(packageDraft, source),
        buildAuthorLineSeed(packageDraft, source),
      ];
    case "abstract_keywords":
      return [buildAbstractSeed(packageDraft, source), buildKeywordSeed(packageDraft, source)];
    case "terminology":
      return [buildTerminologySeed(packageDraft, source)];
    case "heading_hierarchy":
      return [buildHeadingHierarchySeed(packageDraft, source)];
    case "statement":
      return [buildStatementSeed(packageDraft, source)];
    case "manuscript_structure":
      return [buildManuscriptStructureSeed(packageDraft, source)];
    case "numeric_statistics":
      return [buildStatisticalExpressionSeed(packageDraft, source)];
    case "three_line_table":
      return [buildTableSeed(packageDraft, source)];
    case "reference":
      return [buildReferenceSeed(packageDraft, source)];
    default:
      return [];
  }
}

function buildTitleSeed(
  packageDraft: RulePackageDraft,
  source: RulePackageWorkspaceSourceInput,
): CompiledEditorialRuleSeed {
  const titlePattern = "journal_managed";
  const casingRule = "journal_managed";
  const subtitleHandling = "journal_managed";
  const seed: CompiledRuleSeedDraft = {
    package_id: packageDraft.package_id,
    rule_object: "title",
    rule_type: "format",
    execution_mode: mapExecutionMode(packageDraft.automation_posture, "title"),
    confidence_policy: mapConfidencePolicy(packageDraft.automation_posture),
    severity: "warning",
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
      pattern: titlePattern,
    },
    action: {
      kind: "normalize_title",
      casing_rule: casingRule,
      subtitle_handling: subtitleHandling,
    },
    authoring_payload: buildCompiledAuthoringPayload(packageDraft, source, {
      title_pattern: titlePattern,
      casing_rule: casingRule,
      subtitle_handling: subtitleHandling,
    }),
    manual_review_reason_template: firstReviewReason(packageDraft),
  };

  return {
    ...seed,
    coverage_key: createEditorialRuleCoverageKey({
      rule_object: seed.rule_object,
      selector: seed.selector,
      trigger: seed.trigger,
    }),
  };
}

function buildAuthorLineSeed(
  packageDraft: RulePackageDraft,
  source: RulePackageWorkspaceSourceInput,
): CompiledEditorialRuleSeed {
  const seed: CompiledRuleSeedDraft = {
    package_id: packageDraft.package_id,
    rule_object: "author_line",
    rule_type: "format",
    execution_mode: mapExecutionMode(packageDraft.automation_posture, "author_line"),
    confidence_policy: mapConfidencePolicy(packageDraft.automation_posture),
    severity: "warning",
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
      separator: "、",
    },
    action: {
      kind: "inspect_author_line",
      affiliation_format: "superscript_marker",
      corresponding_author_rule: "required",
    },
    authoring_payload: buildCompiledAuthoringPayload(packageDraft, source, {
      separator: "、",
      affiliation_format: "superscript_marker",
      corresponding_author_rule: "required",
    }),
    example_before: firstBeforeExample(packageDraft),
    example_after: firstAfterExample(packageDraft),
    manual_review_reason_template: firstReviewReason(packageDraft),
  };

  return {
    ...seed,
    coverage_key: createEditorialRuleCoverageKey({
      rule_object: seed.rule_object,
      selector: seed.selector,
      trigger: seed.trigger,
    }),
  };
}

function buildAbstractSeed(
  packageDraft: RulePackageDraft,
  source: RulePackageWorkspaceSourceInput,
): CompiledEditorialRuleSeed {
  const exampleBefore = firstBeforeExample(packageDraft);
  const exampleAfter = firstAfterExample(packageDraft);
  const seed: CompiledRuleSeedDraft = {
    package_id: packageDraft.package_id,
    rule_object: "abstract",
    rule_type: "format",
    execution_mode: mapExecutionMode(packageDraft.automation_posture, "abstract"),
    confidence_policy: mapConfidencePolicy(packageDraft.automation_posture),
    severity: "error",
    scope: {
      sections: ["abstract"],
      block_kind: "heading",
    },
    selector: {
      section_selector: "abstract",
      label_selector: {
        text: exampleBefore || "摘要 目的",
      },
    },
    trigger: {
      kind: "exact_text",
      text: exampleBefore || "摘要 目的",
    },
    action: {
      kind: "replace_heading",
      to: exampleAfter || "（摘要　目的）",
    },
    authoring_payload: buildCompileTracePayload(packageDraft, source),
    example_before: exampleBefore,
    example_after: exampleAfter,
    manual_review_reason_template: firstReviewReason(packageDraft),
  };

  return {
    ...seed,
    coverage_key: createEditorialRuleCoverageKey({
      rule_object: seed.rule_object,
      selector: seed.selector,
      trigger: seed.trigger,
    }),
  };
}

function buildKeywordSeed(
  packageDraft: RulePackageDraft,
  source: RulePackageWorkspaceSourceInput,
): CompiledEditorialRuleSeed {
  const seed: CompiledRuleSeedDraft = {
    package_id: packageDraft.package_id,
    rule_object: "keyword",
    rule_type: "format",
    execution_mode: mapExecutionMode(packageDraft.automation_posture, "keyword"),
    confidence_policy: mapConfidencePolicy(packageDraft.automation_posture),
    severity: "warning",
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
      keyword_count: "journal_managed",
    },
    action: {
      kind: "normalize_keywords",
      separator: "；",
      vocabulary_requirement: "journal_managed",
    },
    authoring_payload: buildCompileTracePayload(packageDraft, source),
    example_before: firstBeforeExample(packageDraft),
    example_after: firstAfterExample(packageDraft),
    manual_review_reason_template: firstReviewReason(packageDraft),
  };

  return {
    ...seed,
    coverage_key: createEditorialRuleCoverageKey({
      rule_object: seed.rule_object,
      selector: seed.selector,
      trigger: seed.trigger,
    }),
  };
}

function buildHeadingHierarchySeed(
  packageDraft: RulePackageDraft,
  source: RulePackageWorkspaceSourceInput,
): CompiledEditorialRuleSeed {
  const seed: CompiledRuleSeedDraft = {
    package_id: packageDraft.package_id,
    rule_object: "heading_hierarchy",
    rule_type: "format",
    execution_mode: mapExecutionMode(packageDraft.automation_posture, "heading_hierarchy"),
    confidence_policy: mapConfidencePolicy(packageDraft.automation_posture),
    severity: "warning",
    scope: {
      sections: ["body"],
      block_kind: "heading",
    },
    selector: {
      section_selector: "body",
      block_selector: "heading",
    },
    trigger: {
      kind: "structural_presence",
      field: "heading",
    },
    action: {
      kind: "normalize_heading_hierarchy",
      sequence: "journal_managed",
    },
    authoring_payload: buildCompileTracePayload(packageDraft, source),
    manual_review_reason_template: firstReviewReason(packageDraft),
  };

  return {
    ...seed,
    coverage_key: createEditorialRuleCoverageKey({
      rule_object: seed.rule_object,
      selector: seed.selector,
      trigger: seed.trigger,
    }),
  };
}

function buildTerminologySeed(
  packageDraft: RulePackageDraft,
  source: RulePackageWorkspaceSourceInput,
): CompiledEditorialRuleSeed {
  const targetSection = resolveTerminologyTargetSection(packageDraft);
  const preferredTerm = firstAfterExample(packageDraft) || "journal_preferred_term";
  const disallowedVariant = firstBeforeExample(packageDraft) || "journal_variant";
  const seed: CompiledRuleSeedDraft = {
    package_id: packageDraft.package_id,
    rule_object: "terminology",
    rule_type: "format",
    execution_mode: mapExecutionMode(packageDraft.automation_posture, "terminology"),
    confidence_policy: mapConfidencePolicy(packageDraft.automation_posture),
    severity: "warning",
    scope: {
      sections: [targetSection],
      block_kind: "paragraph",
    },
    selector: {
      section_selector: targetSection,
      pattern_selector: {
        content_class: "terminology",
      },
    },
    trigger: {
      kind: "terminology_variant",
      disallowed_variant: disallowedVariant,
    },
    action: {
      kind: "replace_terminology",
      preferred_term: preferredTerm,
    },
    authoring_payload: buildCompiledAuthoringPayload(packageDraft, source, {
      target_section: targetSection,
      preferred_term: preferredTerm,
      disallowed_variant: disallowedVariant,
    }),
    example_before: disallowedVariant,
    example_after: preferredTerm,
    manual_review_reason_template: firstReviewReason(packageDraft),
  };

  return {
    ...seed,
    coverage_key: createEditorialRuleCoverageKey({
      rule_object: seed.rule_object,
      selector: seed.selector,
      trigger: seed.trigger,
    }),
  };
}

function buildStatementSeed(
  packageDraft: RulePackageDraft,
  source: RulePackageWorkspaceSourceInput,
): CompiledEditorialRuleSeed {
  const statementKind = inferStatementKind(packageDraft);
  const requiredStatement =
    firstAfterExample(packageDraft) || "Provide the required statement.";
  const placement = "back_matter";
  const seed: CompiledRuleSeedDraft = {
    package_id: packageDraft.package_id,
    rule_object: "statement",
    rule_type: "content",
    execution_mode: "inspect",
    confidence_policy: "manual_only",
    severity: "warning",
    scope: {
      sections: ["back_matter"],
      block_kind: "statement",
    },
    selector: {
      statement_selector: {
        statement_kind: statementKind,
      },
    },
    trigger: {
      kind: "required_statement",
      statement_kind: statementKind,
    },
    action: {
      kind: "inspect_required_statement",
      placement,
    },
    authoring_payload: buildCompiledAuthoringPayload(packageDraft, source, {
      statement_kind: statementKind,
      required_statement: requiredStatement,
      placement,
    }),
    manual_review_reason_template: firstReviewReason(packageDraft),
  };

  return {
    ...seed,
    coverage_key: createEditorialRuleCoverageKey({
      rule_object: seed.rule_object,
      selector: seed.selector,
      trigger: seed.trigger,
    }),
  };
}

function buildManuscriptStructureSeed(
  packageDraft: RulePackageDraft,
  source: RulePackageWorkspaceSourceInput,
): CompiledEditorialRuleSeed {
  const manuscriptType = resolvePrimaryManuscriptType(packageDraft);
  const structureRecipe = firstAfterExample(packageDraft) || "journal_managed";
  const seed: CompiledRuleSeedDraft = {
    package_id: packageDraft.package_id,
    rule_object: "manuscript_structure",
    rule_type: "content",
    execution_mode: "inspect",
    confidence_policy: "manual_only",
    severity: "warning",
    scope: {
      block_kind: "manuscript_structure",
    },
    selector: {
      manuscript_structure_selector: {
        manuscript_type: manuscriptType,
      },
    },
    trigger: {
      kind: "section_order",
      manuscript_type: manuscriptType,
    },
    action: {
      kind: "inspect_manuscript_structure",
      required_sections: structureRecipe,
      section_order: structureRecipe,
    },
    authoring_payload: buildCompiledAuthoringPayload(packageDraft, source, {
      manuscript_type: manuscriptType,
      required_sections: structureRecipe,
      section_order: structureRecipe,
    }),
    manual_review_reason_template: firstReviewReason(packageDraft),
  };

  return {
    ...seed,
    coverage_key: createEditorialRuleCoverageKey({
      rule_object: seed.rule_object,
      selector: seed.selector,
      trigger: seed.trigger,
    }),
  };
}

function buildStatisticalExpressionSeed(
  packageDraft: RulePackageDraft,
  source: RulePackageWorkspaceSourceInput,
): CompiledEditorialRuleSeed {
  const seed: CompiledRuleSeedDraft = {
    package_id: packageDraft.package_id,
    rule_object: "statistical_expression",
    rule_type: "format",
    execution_mode: mapExecutionMode(packageDraft.automation_posture, "statistical_expression"),
    confidence_policy: mapConfidencePolicy(packageDraft.automation_posture),
    severity: "warning",
    scope: {
      sections: ["results"],
      block_kind: "paragraph",
    },
    selector: {
      section_selector: "results",
      pattern_selector: {
        content_class: "statistical_expression",
      },
    },
    trigger: {
      kind: "structural_presence",
      field: "statistical_expression",
    },
    action: {
      kind: "normalize_statistical_expression",
      requirement: "journal_managed",
    },
    authoring_payload: buildCompileTracePayload(packageDraft, source),
    manual_review_reason_template: firstReviewReason(packageDraft),
  };

  return {
    ...seed,
    coverage_key: createEditorialRuleCoverageKey({
      rule_object: seed.rule_object,
      selector: seed.selector,
      trigger: seed.trigger,
    }),
  };
}

function buildTableSeed(
  packageDraft: RulePackageDraft,
  source: RulePackageWorkspaceSourceInput,
): CompiledEditorialRuleSeed {
  const seed: CompiledRuleSeedDraft = {
    package_id: packageDraft.package_id,
    rule_object: "table",
    rule_type: "format",
    execution_mode: "inspect",
    confidence_policy: "manual_only",
    severity: "warning",
    scope: {
      sections: ["results"],
      block_kind: "table",
    },
    selector: {
      semantic_target: "header_cell",
      header_path_includes: ["Treatment group", "n (%)"],
    },
    trigger: {
      kind: "table_shape",
      layout: "three_line_table",
    },
    action: {
      kind: "inspect_table_rule",
      caption_requirement: "表题置于表上",
      layout_requirement: "禁用竖线",
    },
    authoring_payload: buildCompileTracePayload(packageDraft, source),
    manual_review_reason_template: firstReviewReason(packageDraft),
  };

  return {
    ...seed,
    coverage_key: createEditorialRuleCoverageKey({
      rule_object: seed.rule_object,
      selector: seed.selector,
      trigger: seed.trigger,
    }),
  };
}

function buildReferenceSeed(
  packageDraft: RulePackageDraft,
  source: RulePackageWorkspaceSourceInput,
): CompiledEditorialRuleSeed {
  const seed: CompiledRuleSeedDraft = {
    package_id: packageDraft.package_id,
    rule_object: "reference",
    rule_type: "format",
    execution_mode: mapExecutionMode(packageDraft.automation_posture, "reference"),
    confidence_policy: mapConfidencePolicy(packageDraft.automation_posture),
    severity: "warning",
    scope: {
      sections: ["reference"],
      block_kind: "reference_entry",
    },
    selector: {
      section_selector: "reference",
      block_selector: "reference_entry",
    },
    trigger: {
      kind: "structural_presence",
      field: "reference",
    },
    action: {
      kind: "normalize_reference_entry",
      citation_style: "journal_managed",
    },
    authoring_payload: buildCompileTracePayload(packageDraft, source),
    example_before: firstBeforeExample(packageDraft),
    example_after: firstAfterExample(packageDraft),
    manual_review_reason_template: firstReviewReason(packageDraft),
  };

  return {
    ...seed,
    coverage_key: createEditorialRuleCoverageKey({
      rule_object: seed.rule_object,
      selector: seed.selector,
      trigger: seed.trigger,
    }),
  };
}

function mapExecutionMode(
  posture: RulePackageAutomationPosture,
  ruleObject: string,
): CompiledEditorialRuleSeed["execution_mode"] {
  if (posture === "inspect_only" || ruleObject === "table") {
    return "inspect";
  }

  return posture === "safe_auto" ? "apply" : "apply_and_inspect";
}

function mapConfidencePolicy(
  posture: RulePackageAutomationPosture,
): CompiledEditorialRuleSeed["confidence_policy"] {
  switch (posture) {
    case "safe_auto":
      return "always_auto";
    case "guarded_auto":
      return "high_confidence_only";
    case "inspect_only":
    default:
      return "manual_only";
  }
}

function buildCompileWarnings(
  packageDraft: RulePackageDraft,
  readiness: RulePackageCompileReadiness,
  overridesPublishedCoverageKeys: string[],
): string[] {
  const warnings = [...readiness.reasons];

  if (packageDraft.automation_posture !== "safe_auto") {
    warnings.push("This package remains guarded and requires operator review before publish.");
  }

  if (overridesPublishedCoverageKeys.length > 0) {
    warnings.push("Compiled coverage overlaps with currently resolved published rules.");
  }

  return warnings;
}

function classifyPublishReadiness(input: {
  preview: RulePackageCompilePreview;
  skippedPackages: CompileRulePackagesToDraftResult["skipped_packages"];
}): RulePackageCompilePublishReadiness {
  const blockedPackageCount = input.skippedPackages.length;
  const overrideCount = new Set(
    input.preview.packages.flatMap((entry) => entry.overrides_published_coverage_keys),
  ).size;
  const guardedRuleCount = input.preview.packages.reduce(
    (count, entry) =>
      count +
      entry.draft_rule_seeds.filter((seed) => seed.execution_mode === "apply_and_inspect")
        .length,
    0,
  );
  const inspectRuleCount = input.preview.packages.reduce(
    (count, entry) =>
      count +
      entry.draft_rule_seeds.filter((seed) => seed.execution_mode === "inspect").length,
    0,
  );
  const reasons: string[] = [];

  if (blockedPackageCount > 0) {
    reasons.push(
      `${blockedPackageCount} package(s) were skipped and still need confirmation before publish review.`,
    );
  }
  if (overrideCount > 0) {
    reasons.push(
      `${overrideCount} compiled rule(s) overlap with published coverage and should be reviewed before publish.`,
    );
  }
  if (guardedRuleCount > 0) {
    reasons.push(
      `${guardedRuleCount} guarded rule(s) will require operator review before publish.`,
    );
  }
  if (inspectRuleCount > 0) {
    reasons.push(
      `${inspectRuleCount} inspect-only rule(s) must be reviewed manually before publish.`,
    );
  }

  const status: RulePackageCompilePublishReadiness["status"] =
    blockedPackageCount > 0
      ? "blocked"
      : overrideCount > 0 || guardedRuleCount > 0 || inspectRuleCount > 0
        ? "review_before_publish"
        : "ready_to_review";

  if (reasons.length === 0) {
    reasons.push(
      "Compiled packages are ready for draft review in the existing publish workflow.",
    );
  }

  return {
    status,
    reasons,
    blocked_package_count: blockedPackageCount,
    override_count: overrideCount,
    guarded_rule_count: guardedRuleCount,
    inspect_rule_count: inspectRuleCount,
  };
}

function classifyProjectionReadiness(input: {
  packageDrafts: RulePackageDraft[];
  preview: RulePackageCompilePreview;
  skippedPackages: CompileRulePackagesToDraftResult["skipped_packages"];
}): RulePackageCompileProjectionReadiness {
  const projectedKinds = new Set<
    RulePackageCompileProjectionReadiness["projected_kinds"][number]
  >();
  const confirmedFields = new Set<string>();
  const withheldFields = new Set<string>();

  for (const entry of input.preview.packages) {
    for (const seed of entry.draft_rule_seeds) {
      for (const projectionKind of getEditorialRuleObjectCatalogEntry(
        seed.rule_object,
      ).projection_kinds) {
        projectedKinds.add(projectionKind);
      }
    }
  }

  for (const packageDraft of input.packageDrafts) {
    const packageConfirmedFields = new Set(
      packageDraft.semantic_draft?.confirmed_fields ?? [],
    );
    for (const field of PROJECTION_RELEVANT_FIELDS) {
      if (packageConfirmedFields.has(field)) {
        confirmedFields.add(field);
      } else {
        withheldFields.add(field);
      }
    }
  }

  const orderedProjectedKinds = DEFAULT_PROJECTION_KINDS.filter((kind) =>
    projectedKinds.has(kind),
  );
  const orderedConfirmedFields = PROJECTION_RELEVANT_FIELDS.filter((field) =>
    confirmedFields.has(field),
  );
  const orderedWithheldFields = PROJECTION_RELEVANT_FIELDS.filter((field) =>
    withheldFields.has(field) && !confirmedFields.has(field),
  );
  const reasons: string[] = [];

  if (orderedProjectedKinds.length > 0) {
    reasons.push(
      `Projected after publish through the existing rule-set flow: ${orderedProjectedKinds.join(", ")}.`,
    );
  } else {
    reasons.push(
      "No compiled rules are currently ready to project after publish.",
    );
  }

  if (orderedWithheldFields.length > 0) {
    reasons.push(
      `These semantic fields remain withheld from high-confidence projection metadata until confirmed: ${orderedWithheldFields.join(", ")}.`,
    );
  } else {
    reasons.push(
      "Confirmed semantic fields will be projected after the draft rule set is published.",
    );
  }

  if (input.skippedPackages.length > 0) {
    reasons.push(
      `${input.skippedPackages.length} skipped package(s) will not contribute projection metadata until confirmation is complete.`,
    );
  }

  return {
    projected_kinds: orderedProjectedKinds,
    confirmed_semantic_fields: orderedConfirmedFields,
    withheld_semantic_fields: orderedWithheldFields,
    reasons,
  };
}

function buildCompileTracePayload(
  packageDraft: RulePackageDraft,
  source: RulePackageWorkspaceSourceInput,
): Record<string, unknown> {
  const sourceId =
    source.sourceKind === "reviewed_case"
      ? source.reviewedCaseSnapshotId
      : source.exampleSourceSessionId;
  const evidenceExamples =
    packageDraft.semantic_draft?.evidence_examples ??
    packageDraft.cards.evidence.examples;

  return {
    compile_trace: {
      package_id: packageDraft.package_id,
      package_kind: packageDraft.package_kind,
      source_kind: source.sourceKind,
      source_id: sourceId,
      semantic_hash: createSemanticHash(packageDraft),
      evidence_examples: evidenceExamples,
      confirmed_fields: packageDraft.semantic_draft?.confirmed_fields ?? [],
      compiled_at: new Date().toISOString(),
      compiler_version: COMPILER_VERSION,
    },
    source: "rule_package_compile",
  };
}

function buildCompiledAuthoringPayload(
  packageDraft: RulePackageDraft,
  source: RulePackageWorkspaceSourceInput,
  fields: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...buildCompileTracePayload(packageDraft, source),
    ...fields,
  };
}

function createSemanticHash(packageDraft: RulePackageDraft): string {
  return createHash("sha1")
    .update(
      JSON.stringify({
        package_id: packageDraft.package_id,
        semantic_draft: packageDraft.semantic_draft ?? null,
        cards: packageDraft.cards,
      }),
      "utf8",
    )
    .digest("hex");
}

function firstBeforeExample(packageDraft: RulePackageDraft): string | undefined {
  return firstEvidenceExample(packageDraft)?.before;
}

function firstAfterExample(packageDraft: RulePackageDraft): string | undefined {
  return firstEvidenceExample(packageDraft)?.after;
}

function firstEvidenceExample(
  packageDraft: RulePackageDraft,
): RuleEvidenceExample | undefined {
  return (
    packageDraft.semantic_draft?.evidence_examples[0] ??
    packageDraft.cards.evidence.examples[0]
  );
}

function firstReviewReason(packageDraft: RulePackageDraft): string | undefined {
  return (
    packageDraft.semantic_draft?.review_policy[0] ??
    packageDraft.cards.exclusions.human_review_required_when[0]
  );
}

function resolveTerminologyTargetSection(packageDraft: RulePackageDraft): string {
  const candidates = [
    ...packageDraft.cards.applicability.sections,
    ...(packageDraft.semantic_draft?.applicability ?? []),
  ];
  return (
    candidates.find((section) =>
      ["title", "abstract", "body", "global"].includes(section),
    ) ?? "body"
  );
}

function inferStatementKind(packageDraft: RulePackageDraft): string {
  const corpus = [
    packageDraft.title,
    packageDraft.cards.ai_understanding.summary,
    firstAfterExample(packageDraft),
    firstBeforeExample(packageDraft),
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (corpus.includes("注册") || corpus.includes("trial")) {
    return "trial_registration";
  }
  if (corpus.includes("基金") || corpus.includes("funding")) {
    return "funding";
  }
  if (corpus.includes("利益冲突") || corpus.includes("conflict")) {
    return "conflict_of_interest";
  }
  if (corpus.includes("作者贡献") || corpus.includes("contribution")) {
    return "author_contribution";
  }

  return "ethics";
}

function resolvePrimaryManuscriptType(packageDraft: RulePackageDraft): string {
  return packageDraft.cards.applicability.manuscript_types[0] ?? "clinical_study";
}

async function loadTargetDraftRuleSet(
  repository: Pick<EditorialRuleRepository, "findRuleSetById">,
  targetRuleSetId: string,
): Promise<EditorialRuleSetRecord> {
  const targetRuleSet = await repository.findRuleSetById(targetRuleSetId);
  if (!targetRuleSet) {
    throw new EditorialRuleSetNotFoundError(targetRuleSetId);
  }
  if (targetRuleSet.status !== "draft") {
    throw new EditorialRuleSetNotEditableError(targetRuleSetId, targetRuleSet.status);
  }
  return targetRuleSet;
}

function ruleSetMatchesCompileContext(
  ruleSet: EditorialRuleSetRecord,
  input: Pick<
    CompileRulePackagesToDraftInput,
    "templateFamilyId" | "journalTemplateId" | "module"
  >,
): boolean {
  return (
    ruleSet.template_family_id === input.templateFamilyId &&
    (ruleSet.journal_template_id ?? undefined) === (input.journalTemplateId ?? undefined) &&
    ruleSet.module === input.module
  );
}

function isRulePackageOwnedRule(
  rule: EditorialRuleRecord,
  packageId: string,
): boolean {
  const source = rule.authoring_payload["source"];
  const compileTrace = asRecord(rule.authoring_payload["compile_trace"]);
  return (
    source === "rule_package_compile" &&
    compileTrace?.["package_id"] === packageId
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value != null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function buildCompiledKnowledgeMetadata(input: {
  packageDraft: RulePackageDraft;
  source: RulePackageWorkspaceSourceInput;
}): {
  explanationPayload?: {
    rationale: string;
    applies_when?: string[];
    not_applies_when?: string[];
    correct_example?: string;
    incorrect_example?: string;
    review_prompt?: string;
  };
  linkagePayload?: {
    source_learning_candidate_id?: string;
    source_snapshot_asset_id?: string;
  };
  projectionPayload?: {
    projection_kind: "rule";
    summary?: string;
    standard_example?: string;
    incorrect_example?: string;
  };
  evidenceLevel?: EditorialRuleRecord["evidence_level"];
} {
  const semanticDraft = input.packageDraft.semantic_draft;
  if (!semanticDraft) {
    return {};
  }

  const confirmedFields = new Set(semanticDraft.confirmed_fields);
  const summary = confirmedFields.has("summary")
    ? normalizeText(semanticDraft.semantic_summary)
    : undefined;
  const applicability = confirmedFields.has("applicability")
    ? uniqueStrings([...semanticDraft.applicability, ...semanticDraft.hit_scope])
    : undefined;
  const evidenceExamples = confirmedFields.has("evidence")
    ? semanticDraft.evidence_examples
    : [];
  const primaryExample = evidenceExamples[0];
  const notAppliesWhen = confirmedFields.has("boundaries")
    ? uniqueStrings(semanticDraft.failure_boundaries)
    : undefined;
  const rationale = buildRationaleText({
    summary,
    normalizationRecipe: semanticDraft.normalization_recipe,
  });
  const reviewPrompt = buildReviewPrompt(semanticDraft.review_policy);
  const sourceId =
    input.source.sourceKind === "reviewed_case"
      ? input.source.reviewedCaseSnapshotId
      : input.source.exampleSourceSessionId;
  const evidenceLevel = classifyEvidenceLevel({
    source: input.source,
    hasConfirmedEvidence: evidenceExamples.length > 0,
    hasConfirmedBoundaries: Boolean(notAppliesWhen?.length),
  });

  return {
    explanationPayload:
      rationale ||
      applicability ||
      notAppliesWhen ||
      primaryExample ||
      reviewPrompt
        ? {
            rationale: rationale ?? "Compiled from confirmed package semantics.",
            ...(applicability ? { applies_when: applicability } : {}),
            ...(notAppliesWhen ? { not_applies_when: notAppliesWhen } : {}),
            ...(primaryExample?.after
              ? { correct_example: primaryExample.after }
              : {}),
            ...(primaryExample?.before
              ? { incorrect_example: primaryExample.before }
              : {}),
            ...(reviewPrompt ? { review_prompt: reviewPrompt } : {}),
          }
        : undefined,
    linkagePayload: {
      source_learning_candidate_id: input.packageDraft.package_id,
      source_snapshot_asset_id: sourceId,
    },
    projectionPayload:
      summary || primaryExample
        ? {
            projection_kind: "rule",
            ...(summary ? { summary } : {}),
            ...(primaryExample?.after
              ? { standard_example: primaryExample.after }
              : {}),
            ...(primaryExample?.before
              ? { incorrect_example: primaryExample.before }
              : {}),
          }
        : undefined,
    ...(evidenceLevel ? { evidenceLevel } : {}),
  };
}

function buildRationaleText(input: {
  summary?: string;
  normalizationRecipe: string[];
}): string | undefined {
  const segments = [
    input.summary,
    ...input.normalizationRecipe.map((value) => normalizeText(value)),
  ].filter((value): value is string => Boolean(value));
  return segments.length > 0 ? segments.join(" ") : undefined;
}

function buildReviewPrompt(reviewPolicy: string[]): string | undefined {
  const normalizedPolicy = uniqueStrings(reviewPolicy);
  return normalizedPolicy && normalizedPolicy.length > 0
    ? normalizedPolicy.join(" ")
    : undefined;
}

function classifyEvidenceLevel(input: {
  source: RulePackageWorkspaceSourceInput;
  hasConfirmedEvidence: boolean;
  hasConfirmedBoundaries: boolean;
}): EditorialRuleRecord["evidence_level"] {
  if (!input.hasConfirmedEvidence || !input.hasConfirmedBoundaries) {
    return "unknown";
  }

  return input.source.sourceKind === "reviewed_case" ? "medium" : "low";
}

function uniqueStrings(values: string[]): string[] | undefined {
  const normalizedValues = values
    .map((value) => normalizeText(value))
    .filter((value): value is string => Boolean(value));
  const uniqueValues = Array.from(new Set(normalizedValues));
  return uniqueValues.length > 0 ? uniqueValues : undefined;
}

function normalizeText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function materializeCompiledRuleSeed(seed: CompiledEditorialRuleSeed): {
  scope: EditorialRuleScope;
  selector: Record<string, unknown>;
  trigger: EditorialRuleTrigger;
  action: EditorialRuleAction;
  authoring_payload: Record<string, unknown>;
} {
  return {
    scope: structuredClone(seed.scope) as EditorialRuleScope,
    selector: structuredClone(seed.selector),
    trigger: coerceEditorialRuleTrigger(seed.trigger, seed.coverage_key),
    action: coerceEditorialRuleAction(seed.action, seed.coverage_key),
    authoring_payload: structuredClone(seed.authoring_payload),
  };
}

function coerceEditorialRuleTrigger(
  value: Record<string, unknown>,
  coverageKey: string,
): EditorialRuleTrigger {
  const kind = normalizeText(typeof value.kind === "string" ? value.kind : undefined);
  if (!kind) {
    throw new Error(`Compiled rule seed "${coverageKey}" is missing trigger.kind.`);
  }

  return structuredClone({
    ...value,
    kind,
  }) as EditorialRuleTrigger;
}

function coerceEditorialRuleAction(
  value: Record<string, unknown>,
  coverageKey: string,
): EditorialRuleAction {
  const kind = normalizeText(typeof value.kind === "string" ? value.kind : undefined);
  if (!kind) {
    throw new Error(`Compiled rule seed "${coverageKey}" is missing action.kind.`);
  }

  return structuredClone({
    ...value,
    kind,
  }) as EditorialRuleAction;
}
