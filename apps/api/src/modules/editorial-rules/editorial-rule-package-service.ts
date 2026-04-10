import type {
  RulePackageCandidate,
  RulePackagePreview,
  RulePackageSemanticCards,
  RulePackageWorkspaceSourceInput,
} from "@medical/contracts";
import { ExampleDocumentSnapshotAdapter } from "./example-document-snapshot-adapter.ts";
import { ExampleSourceSessionService } from "./example-source-session-service.ts";
import { ExamplePairDiffService } from "./example-pair-diff-service.ts";
import { RulePackagePreviewService } from "./rule-package-preview-service.ts";
import type {
  GenerateRulePackageCandidatesInput,
  GenerateRulePackageCandidatesFromReviewedCaseInput,
  RulePackageWorkspaceResult,
  PreviewRulePackageDraftInput,
  RulePackageRecognitionInput,
} from "./editorial-rule-package-types.ts";
import {
  recognizeRulePackages,
  type RulePackageSeed,
} from "./rule-package-recognizers.ts";
import { ReviewedCaseRulePackageSourceService } from "./reviewed-case-rule-package-source-service.ts";

export interface EditorialRulePackageServiceOptions {
  snapshotAdapter?: ExampleDocumentSnapshotAdapter;
  diffService?: ExamplePairDiffService;
  previewService?: RulePackagePreviewService;
  reviewedCaseSourceService?: ReviewedCaseRulePackageSourceService;
  exampleSourceSessionService?: ExampleSourceSessionService;
}

export class EditorialRulePackageService {
  private readonly snapshotAdapter: ExampleDocumentSnapshotAdapter;
  private readonly diffService: ExamplePairDiffService;
  private readonly previewService: RulePackagePreviewService;
  private readonly reviewedCaseSourceService?: ReviewedCaseRulePackageSourceService;
  private readonly exampleSourceSessionService?: ExampleSourceSessionService;

  constructor(options: EditorialRulePackageServiceOptions = {}) {
    this.snapshotAdapter = options.snapshotAdapter ?? new ExampleDocumentSnapshotAdapter();
    this.diffService = options.diffService ?? new ExamplePairDiffService();
    this.previewService = options.previewService ?? new RulePackagePreviewService();
    this.reviewedCaseSourceService = options.reviewedCaseSourceService;
    this.exampleSourceSessionService = options.exampleSourceSessionService;
  }

  generateCandidates(
    input: GenerateRulePackageCandidatesInput,
  ): RulePackageCandidate[] {
    const original = this.snapshotAdapter.fromFixture(input.original);
    const edited = this.snapshotAdapter.fromFixture(input.edited);
    const recognitionInput: RulePackageRecognitionInput = {
      context: input.context,
      original,
      edited,
      signals: this.diffService.extractSignals({ original, edited }),
    };

    return recognizeRulePackages(recognitionInput).map((seed) => ({
      package_id: seed.package_id,
      package_kind: seed.package_kind,
      title: seed.title,
      rule_object: seed.rule_object,
      suggested_layer: seed.suggested_layer,
      automation_posture: seed.automation_posture,
      status: seed.status,
      cards: buildSemanticFiveCards(seed),
      preview: buildInitialPreview(seed),
      semantic_draft: seed.semantic_draft,
      supporting_signals: seed.supporting_signals,
    }));
  }

  previewCandidate(input: PreviewRulePackageDraftInput): RulePackagePreview {
    return this.previewService.buildPreview(input);
  }

  async loadWorkspace(
    input: RulePackageWorkspaceSourceInput,
  ): Promise<RulePackageWorkspaceResult> {
    const pairInput = await this.resolveCandidateInput(input);
    const candidates = this.generateCandidates(pairInput);

    return {
      source: input,
      candidates,
      selectedPackageId: candidates[0]?.package_id ?? null,
    };
  }

  async generateCandidatesFromReviewedCase(
    input: GenerateRulePackageCandidatesFromReviewedCaseInput,
  ): Promise<RulePackageCandidate[]> {
    return (
      await this.loadWorkspace({
        sourceKind: "reviewed_case",
        reviewedCaseSnapshotId: input.reviewedCaseSnapshotId,
        ...(input.journalKey ? { journalKey: input.journalKey } : {}),
      })
    ).candidates;
  }

  async createExampleSourceSession(
    input: Parameters<ExampleSourceSessionService["createSession"]>[0],
  ) {
    if (!this.exampleSourceSessionService) {
      throw new Error(
        "Example-source session creation is not configured in EditorialRulePackageService.",
      );
    }

    return this.exampleSourceSessionService.createSession(input);
  }

  private resolveCandidateInput(
    input: RulePackageWorkspaceSourceInput,
  ): Promise<GenerateRulePackageCandidatesInput> {
    if (input.sourceKind === "reviewed_case") {
      if (!this.reviewedCaseSourceService) {
        throw new Error(
          "Reviewed-case candidate generation is not configured in EditorialRulePackageService.",
        );
      }

      return this.reviewedCaseSourceService.resolveCandidateInput({
        reviewedCaseSnapshotId: input.reviewedCaseSnapshotId,
        ...(input.journalKey ? { journalKey: input.journalKey } : {}),
      });
    }

    if (!this.exampleSourceSessionService) {
      throw new Error(
        "Example-source session resolution is not configured in EditorialRulePackageService.",
      );
    }

    return this.exampleSourceSessionService.resolveCandidateInput({
      exampleSourceSessionId: input.exampleSourceSessionId,
      ...(input.journalKey ? { journalKey: input.journalKey } : {}),
    });
  }
}

function buildSemanticFiveCards(seed: RulePackageSeed): RulePackageSemanticCards {
  return {
    rule_what: {
      title: seed.title,
      object: seed.rule_object,
      publish_layer: seed.suggested_layer,
    },
    ai_understanding: {
      summary: seed.summary,
      hit_objects: [...new Set(seed.supporting_signals.map((signal) => signal.object_hint))],
      hit_locations: seed.hit_locations,
    },
    applicability: {
      manuscript_types: seed.manuscript_types,
      modules: seed.modules,
      sections: seed.sections,
      table_targets: seed.table_targets,
    },
    evidence: {
      examples: seed.evidence_examples,
    },
    exclusions: {
      not_applicable_when: seed.not_applicable_when,
      human_review_required_when: seed.human_review_required_when,
      risk_posture: seed.automation_posture,
    },
  };
}

function buildInitialPreview(seed: RulePackageSeed): RulePackagePreview {
  return {
    hit_summary: `基于 ${seed.supporting_signals.length} 条编辑信号识别为${seed.title}。`,
    hits: seed.supporting_signals.slice(0, 3).map((signal) => ({
      target: signal.object_hint,
      reason: signal.rationale,
      matched_text: signal.after ?? signal.before,
    })),
    misses: seed.not_applicable_when.map((boundary) => ({
      target: seed.package_kind,
      reason: boundary,
    })),
    decision: {
      automation_posture: seed.automation_posture,
      needs_human_review: seed.automation_posture !== "safe_auto",
      reason: `${seed.title} 默认按 ${seed.automation_posture} 姿态进入后续预演。`,
    },
  };
}
