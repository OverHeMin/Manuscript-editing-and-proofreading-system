import test from "node:test";
import assert from "node:assert/strict";
import {
  MANUSCRIPT_QUALITY_ACTION_LADDER,
} from "@medical/contracts";
import type {
  ManuscriptQualityAction,
  ManuscriptQualityFindingSummary,
  ManuscriptQualityIssue,
} from "@medical/contracts";
import { ExecutionTrackingService } from "../../src/modules/execution-tracking/execution-tracking-service.ts";
import { InMemoryExecutionTrackingRepository } from "../../src/modules/execution-tracking/in-memory-execution-tracking-repository.ts";
import { InMemoryManuscriptQualityPackageRepository } from "../../src/modules/manuscript-quality-packages/in-memory-manuscript-quality-package-repository.ts";
import { ManuscriptQualityService } from "../../src/modules/manuscript-quality/index.ts";
import {
  MEDICAL_SPECIALIZED_ISSUE_TYPES,
} from "../../src/modules/manuscript-quality/manuscript-quality-types.ts";

const medicalResearchGeneralStyleManifest = {
  section_expectations: {
    abstract: {
      required_labels: ["objective", "methods", "results", "conclusion"],
    },
  },
  tone_markers: {
    strong_claims: ["prove", "guarantee", "definitive", "cure"],
    cautious_claims: ["suggest", "may", "appears", "is associated with"],
  },
  posture_checks: {
    abstract: ["objective", "methods", "results", "conclusion"],
    results: ["measured", "observed", "compared", "improved"],
    conclusion: ["suggest", "may", "support", "indicate"],
  },
  genre_wording_suspicions: ["news report", "experience sharing"],
  issue_policy: {
    section_expectation_missing: {
      severity: "medium",
      action: "suggest_fix",
    },
    result_conclusion_jump: {
      severity: "high",
      action: "manual_review",
    },
    tone_overclaim: {
      severity: "medium",
      action: "suggest_fix",
    },
    genre_wording_suspicion: {
      severity: "medium",
      action: "suggest_fix",
    },
  },
} as const;

test("shared manuscript quality contract exposes the governed action ladder and structured issue fields", () => {
  const actions = [...MANUSCRIPT_QUALITY_ACTION_LADDER] satisfies
    ManuscriptQualityAction[];
  const issue = {
    issue_id: "issue-1",
    module_scope: "general_proofreading",
    issue_type: "punctuation.missing_terminal_mark",
    category: "punctuation_and_pairs",
    severity: "medium",
    action: "suggest_fix",
    confidence: 0.91,
    span: {
      start: 12,
      end: 16,
    },
    paragraph_index: 0,
    sentence_index: 1,
    source_kind: "deterministic_rule",
    source_id: "punctuation/terminal-mark",
    text_excerpt: "Treatment effective",
    normalized_excerpt: "Treatment effective.",
    suggested_replacement: "Treatment effective.",
    explanation: "Sentence is missing closing punctuation.",
  } satisfies ManuscriptQualityIssue;

  assert.deepEqual(actions, [
    "auto_fix",
    "suggest_fix",
    "manual_review",
    "block",
  ]);
  assert.equal(issue.module_scope, "general_proofreading");
  assert.equal(issue.category, "punctuation_and_pairs");
  assert.equal(issue.action, "suggest_fix");
});

test("medical specialized quality taxonomy keeps the fixed V1 issue families", () => {
  assert.deepEqual([...MEDICAL_SPECIALIZED_ISSUE_TYPES], [
    "medical_terminology",
    "medical_data_consistency",
    "statistical_expression",
    "evidence_alignment",
    "ethics_privacy",
  ]);
});

test("execution tracking stores an optional quality findings summary without mutating caller input", async () => {
  const repository = new InMemoryExecutionTrackingRepository();
  const service = new ExecutionTrackingService({
    repository,
    createId: (() => {
      const ids = ["snapshot-1"];
      return () => {
        const nextId = ids.shift();
        assert.ok(nextId, "Expected a deterministic execution tracking id.");
        return nextId;
      };
    })(),
    now: () => new Date("2026-04-12T08:30:00.000Z"),
  });
  const inputSummary: ManuscriptQualityFindingSummary = {
    total_issue_count: 3,
    issue_count_by_scope: {
      general_proofreading: 3,
    },
    issue_count_by_action: {
      auto_fix: 1,
      suggest_fix: 1,
      manual_review: 1,
    },
    issue_count_by_severity: {
      low: 1,
      medium: 1,
      high: 1,
    },
    highest_action: "manual_review",
    representative_issue_ids: ["issue-1", "issue-2"],
  };

  const snapshot = await service.recordSnapshot({
    manuscriptId: "manuscript-1",
    module: "proofreading",
    jobId: "job-1",
    executionProfileId: "profile-1",
    moduleTemplateId: "template-1",
    moduleTemplateVersionNo: 2,
    promptTemplateId: "prompt-1",
    promptTemplateVersion: "1.0.0",
    skillPackageIds: [],
    skillPackageVersions: [],
    modelId: "model-1",
    knowledgeHits: [],
    qualityFindingsSummary: inputSummary,
  });

  inputSummary.issue_count_by_scope.general_proofreading = 99;
  inputSummary.issue_count_by_action.auto_fix = 99;
  inputSummary.representative_issue_ids.push("issue-3");

  const loaded = await service.getSnapshot(snapshot.id);

  assert.deepEqual(snapshot.quality_findings_summary, {
    total_issue_count: 3,
    issue_count_by_scope: {
      general_proofreading: 3,
    },
    issue_count_by_action: {
      auto_fix: 1,
      suggest_fix: 1,
      manual_review: 1,
    },
    issue_count_by_severity: {
      low: 1,
      medium: 1,
      high: 1,
    },
    highest_action: "manual_review",
    representative_issue_ids: ["issue-1", "issue-2"],
  });
  assert.deepEqual(loaded?.quality_findings_summary, {
    total_issue_count: 3,
    issue_count_by_scope: {
      general_proofreading: 3,
    },
    issue_count_by_action: {
      auto_fix: 1,
      suggest_fix: 1,
      manual_review: 1,
    },
    issue_count_by_severity: {
      low: 1,
      medium: 1,
      high: 1,
    },
    highest_action: "manual_review",
    representative_issue_ids: ["issue-1", "issue-2"],
  });
});

test("manuscript quality service orchestrates requested general and medical scopes and summarizes merged findings", async () => {
  const service = new ManuscriptQualityService({
    workerAdapter: {
      async runGeneralProofreading(input) {
        assert.deepEqual(input.blocks, [
          {
            text: "Abstract: compare group A and group B.",
            style: "Heading 1",
          },
        ]);

        return {
          module_scope: "general_proofreading",
          issues: [
            {
              issue_id: "issue-worker-1",
              module_scope: "general_proofreading",
              issue_type: "logic.result_conclusion_conflict",
              category: "sentence_and_logic",
              severity: "high",
              action: "manual_review",
              confidence: 0.82,
              paragraph_index: 0,
              sentence_index: 0,
              source_kind: "deterministic_rule",
              source_id: "logic/result-conclusion-conflict",
              text_excerpt: "Result conflicts with conclusion.",
              explanation: "Potential contradiction between result and conclusion.",
            },
          ],
        };
      },
      async runMedicalSpecialized(input) {
        assert.deepEqual(input.blocks, [
          {
            text: "Abstract: compare group A and group B.",
            style: "Heading 1",
          },
        ]);

        return {
          module_scope: "medical_specialized",
          issues: [
            {
              issue_id: "issue-worker-2",
              module_scope: "medical_specialized",
              issue_type: "medical_data_consistency.sample_size_conflict",
              category: "medical_calculation_and_parsing",
              severity: "high",
              action: "manual_review",
              confidence: 0.88,
              paragraph_index: 0,
              sentence_index: 0,
              source_kind: "deterministic_rule",
              source_id: "medical-data/sample-size-conflict",
              text_excerpt: "Sample size statements conflict.",
              explanation: "Potential participant-count mismatch across sections.",
            },
          ],
        };
      },
    },
  });

  const result = await service.runChecks({
    blocks: [
      {
        text: "Abstract: compare group A and group B.",
        style: "Heading 1",
      },
    ],
    requestedScopes: ["general_proofreading", "medical_specialized"],
  });

  assert.deepEqual(result.requested_scopes, [
    "general_proofreading",
    "medical_specialized",
  ]);
  assert.deepEqual(result.completed_scopes, [
    "general_proofreading",
    "medical_specialized",
  ]);
  assert.equal(result.issues.length, 2);
  assert.equal(result.quality_findings_summary.total_issue_count, 2);
  assert.equal(result.quality_findings_summary.highest_action, "manual_review");
  assert.deepEqual(result.quality_findings_summary.issue_count_by_scope, {
    general_proofreading: 1,
    medical_specialized: 1,
  });
  assert.deepEqual(result.quality_findings_summary.issue_count_by_action, {
    manual_review: 2,
  });
  assert.deepEqual(result.quality_findings_summary.issue_count_by_severity, {
    high: 2,
  });
});

test("manuscript quality service degrades worker failures into one conservative manual-review system issue", async () => {
  const service = new ManuscriptQualityService({
    workerAdapter: {
      async runGeneralProofreading() {
        throw new Error("quality worker unavailable");
      },
    },
  });

  const result = await service.runChecks({
    blocks: [
      {
        text: "Result: symptoms improved.",
      },
    ],
  });

  assert.deepEqual(result.requested_scopes, ["general_proofreading"]);
  assert.deepEqual(result.completed_scopes, []);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.category, "system_fallback");
  assert.equal(result.issues[0]?.action, "manual_review");
  assert.equal(result.issues[0]?.source_kind, "system_fallback");
  assert.match(result.issues[0]?.explanation ?? "", /quality worker unavailable/);
  assert.equal(result.quality_findings_summary.total_issue_count, 1);
  assert.equal(result.quality_findings_summary.highest_action, "manual_review");
  assert.deepEqual(result.quality_findings_summary.issue_count_by_action, {
    manual_review: 1,
  });
});

test("medical scope keeps screening at least as conservative as editing for the same medical text", async () => {
  const sampleText = "Conclusion: this treatment is definitively effective for every patient.";
  const service = new ManuscriptQualityService({
    workerAdapter: {
      async runGeneralProofreading() {
        return {
          module_scope: "general_proofreading",
          issues: [],
        };
      },
      async runMedicalSpecialized(input) {
        assert.deepEqual(input.blocks, [
          {
            text: sampleText,
            style: "Normal",
          },
        ]);

        return {
          module_scope: "medical_specialized",
          issues: [
            {
              issue_id: "medical-issue-1",
              module_scope: "medical_specialized",
              issue_type: "evidence_alignment.overstated_conclusion",
              category: "medical_logic",
              severity: "high",
              action: "manual_review",
              confidence: 0.87,
              paragraph_index: 0,
              sentence_index: 0,
              source_kind: "language_model",
              source_id: "medical/evidence-alignment",
              text_excerpt: sampleText,
              explanation:
                "The conclusion strength appears stronger than the stated evidence.",
            },
          ],
        };
      },
    },
  });

  const editingResult = await service.runChecks({
    blocks: [
      {
        text: sampleText,
        style: "Normal",
      },
    ],
    requestedScopes: ["medical_specialized"],
    targetModule: "editing",
  });
  const screeningResult = await service.runChecks({
    blocks: [
      {
        text: sampleText,
        style: "Normal",
      },
    ],
    requestedScopes: ["medical_specialized"],
    targetModule: "screening",
  });

  assert.equal(editingResult.issues[0]?.module_scope, "medical_specialized");
  assert.equal(screeningResult.issues[0]?.module_scope, "medical_specialized");
  const rank = (action: ManuscriptQualityAction | undefined) =>
    action ? MANUSCRIPT_QUALITY_ACTION_LADDER.indexOf(action) : -1;
  assert.ok(
    rank(screeningResult.quality_findings_summary.highest_action) >=
      rank(editingResult.quality_findings_summary.highest_action),
  );
});

test("medical analyzer degradation appends one conservative fallback issue without dropping successful general findings", async () => {
  const service = new ManuscriptQualityService({
    workerAdapter: {
      async runGeneralProofreading() {
        return {
          module_scope: "general_proofreading",
          issues: [
            {
              issue_id: "issue-worker-general-1",
              module_scope: "general_proofreading",
              issue_type: "punctuation.repeated_mark",
              category: "punctuation_and_pairs",
              severity: "low",
              action: "auto_fix",
              confidence: 0.99,
              paragraph_index: 0,
              sentence_index: 0,
              source_kind: "deterministic_rule",
              source_id: "punctuation/repeated-mark",
              text_excerpt: "Result..",
              explanation: "Repeated punctuation marks are mechanical.",
            },
          ],
        };
      },
      async runMedicalSpecialized() {
        throw new Error("medical analyzer unavailable");
      },
    },
  });

  const result = await service.runChecks({
    blocks: [
      {
        text: "Result..",
        style: "Normal",
      },
    ],
    requestedScopes: ["general_proofreading", "medical_specialized"],
    targetModule: "screening",
  });

  assert.deepEqual(result.requested_scopes, [
    "general_proofreading",
    "medical_specialized",
  ]);
  assert.deepEqual(result.completed_scopes, ["general_proofreading"]);
  assert.equal(result.issues.length, 2);
  assert.equal(result.issues[0]?.module_scope, "general_proofreading");
  assert.equal(result.issues[1]?.module_scope, "medical_specialized");
  assert.equal(result.issues[1]?.category, "system_fallback");
  assert.equal(result.issues[1]?.action, "manual_review");
  assert.match(
    result.issues[1]?.explanation ?? "",
    /medical analyzer unavailable/,
  );
  assert.equal(result.quality_findings_summary.highest_action, "manual_review");
  assert.deepEqual(result.quality_findings_summary.issue_count_by_scope, {
    general_proofreading: 1,
    medical_specialized: 1,
  });
});

test("manuscript quality service forwards optional table snapshots to the medical worker scope", async () => {
  const service = new ManuscriptQualityService({
    workerAdapter: {
      async runGeneralProofreading() {
        return {
          module_scope: "general_proofreading",
          issues: [],
        };
      },
      async runMedicalSpecialized(input) {
        const forwarded = (
          input as {
            tableSnapshots?: Array<{ table_id: string }>;
          }
        ).tableSnapshots;
        assert.deepEqual(forwarded, [{ table_id: "Table 1" }]);

        return {
          module_scope: "medical_specialized",
          issues: [],
        };
      },
    },
  });

  const result = await service.runChecks({
    blocks: [
      {
        text: "ALT in Table 1 was 15.2 ± 1.3.",
        style: "Normal",
      },
    ],
    requestedScopes: ["medical_specialized"],
    tableSnapshots: [{ table_id: "Table 1" }],
  } as never);

  assert.deepEqual(result.completed_scopes, ["medical_specialized"]);
});

test("manuscript quality service resolves published quality packages and forwards their manifests to the worker", async () => {
  const manuscriptQualityPackageRepository =
    new InMemoryManuscriptQualityPackageRepository();
  await manuscriptQualityPackageRepository.save({
    id: "quality-package-version-1",
    package_name: "Medical Research Style",
    package_kind: "general_style_package",
    target_scopes: ["general_proofreading"],
    version: 2,
    status: "published",
    manifest: {
      style_family: "medical_research_article",
    },
  });

  const service = new ManuscriptQualityService({
    workerAdapter: {
      async runGeneralProofreading(input) {
        assert.deepEqual(input.qualityPackages, [
          {
            package_id: "quality-package-version-1",
            package_name: "Medical Research Style",
            package_kind: "general_style_package",
            target_scopes: ["general_proofreading"],
            version: 2,
            manifest: {
              style_family: "medical_research_article",
            },
          },
        ]);

        return {
          module_scope: "general_proofreading",
          issues: [],
        };
      },
    },
    manuscriptQualityPackageRepository,
  });

  const result = await service.runChecks({
    blocks: [
      {
        text: "Abstract: compare group A and group B.",
        style: "Heading 1",
      },
    ],
    qualityPackageVersionIds: ["quality-package-version-1"],
  });

  assert.deepEqual(result.resolved_quality_packages, [
    {
      package_id: "quality-package-version-1",
      package_name: "Medical Research Style",
      package_kind: "general_style_package",
      target_scopes: ["general_proofreading"],
      version: 2,
    },
  ]);
});

test("manuscript quality service preserves style findings returned by the general proofreading worker", async () => {
  const manuscriptQualityPackageRepository =
    new InMemoryManuscriptQualityPackageRepository();
  await manuscriptQualityPackageRepository.save({
    id: "quality-package-style-2",
    package_name: "Medical Research Style",
    package_kind: "general_style_package",
    target_scopes: ["general_proofreading"],
    version: 3,
    status: "published",
    manifest: structuredClone(medicalResearchGeneralStyleManifest),
  });

  const service = new ManuscriptQualityService({
    workerAdapter: {
      async runGeneralProofreading(input) {
        assert.deepEqual(input.qualityPackages, [
          {
            package_id: "quality-package-style-2",
            package_name: "Medical Research Style",
            package_kind: "general_style_package",
            target_scopes: ["general_proofreading"],
            version: 3,
            manifest: medicalResearchGeneralStyleManifest,
          },
        ]);

        return {
          module_scope: "general_proofreading",
          issues: [
            {
              issue_id: "style-issue-1",
              module_scope: "general_proofreading",
              issue_type: "style.section_expectation_missing",
              category: "sentence_and_logic",
              severity: "medium",
              action: "suggest_fix",
              confidence: 0.78,
              paragraph_index: 0,
              source_kind: "deterministic_rule",
              source_id: "style/section-expectation-missing",
              text_excerpt: "Abstract",
              explanation:
                "Section abstract is missing expected labels: objective.",
            },
          ],
        };
      },
    },
    manuscriptQualityPackageRepository,
  });

  const result = await service.runChecks({
    blocks: [
      {
        text: "Abstract",
        style: "Heading 1",
      },
      {
        text: "Methods: patients were grouped. Results: symptoms improved. Conclusion: treatment was safe.",
        style: "Normal",
      },
    ],
    qualityPackageVersionIds: ["quality-package-style-2"],
  });

  assert.deepEqual(result.completed_scopes, ["general_proofreading"]);
  assert.equal(
    result.issues.some(
      (issue) => issue.issue_type === "style.section_expectation_missing",
    ),
    true,
  );
  assert.equal(result.quality_findings_summary.highest_action, "suggest_fix");
});
