import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  describeHistoryComparisonGuidance,
  describeHistoryComparisonGuidanceSummary,
  describeHistoryComparisonRoleLabels,
  describeHistoryStatusPair,
  describeHistoryOriginSummary,
  describeHistoryEntryOriginLabel,
  describeGovernedLearningHandoffGuidance,
  describeComparisonOperatorSummary,
  describeComparisonBaselinePolicy,
  describeComparisonTriageHint,
  describeHistoryVisibilitySummary,
  describeHistoryControlSummaryLines,
  describeHistoryCompareStatusSummary,
  summarizeEvidencePackChanges,
  summarizeFinalizedEntry,
  summarizeBindingChanges,
  EvaluationWorkbenchEvidenceList,
  EvaluationWorkbenchEvidencePackSummary,
  EvaluationWorkbenchFinalizePanel,
  EvaluationWorkbenchGovernedSourceDetailCard,
  EvaluationWorkbenchLinkedSampleContextList,
  EvaluationWorkbenchHistoryEntrySignals,
  EvaluationWorkbenchPage,
  sortFinalizedRunHistory,
  EvaluationWorkbenchRunComparisonCard,
  EvaluationWorkbenchSelectedRunItemDetailCard,
  filterFinalizedRunHistory,
  isSelectedRunHiddenFromHistoryList,
  searchFinalizedRunHistory,
} from "../src/features/evaluation-workbench/evaluation-workbench-page.tsx";

function createFinalizedHistoryEntry(input: {
  runId: string;
  recommendationStatus: "recommended" | "needs_review" | "rejected";
  summaryStatus?: "recommended" | "needs_review" | "rejected";
  score: number;
  decisionReason: string;
  createdAt: string;
  regressionSummary?: string;
  failureSummary?: string;
  evidenceLabel?: string;
}) {
  return {
    run: {
      id: input.runId,
      suite_id: "suite-ops-1",
      sample_set_id: "sample-set-ops-1",
      baseline_binding: {
        lane: "baseline",
        model_id: "baseline-model-stable",
        runtime_id: "runtime-prod-1",
        prompt_template_id: "prompt-prod-1",
        skill_package_ids: ["skill-prod-1"],
        module_template_id: "template-prod-1",
      },
      candidate_binding: {
        lane: "candidate",
        model_id: `candidate-model-${input.runId}`,
        runtime_id: "runtime-candidate-1",
        prompt_template_id: `prompt-${input.runId}`,
        skill_package_ids: ["skill-candidate-1"],
        module_template_id: "template-candidate-1",
      },
      run_item_count: 1,
      status: "passed",
      evidence_ids: [`evidence-${input.runId}`],
      started_at: input.createdAt,
      finished_at: input.createdAt,
    },
    finalized: {
      run: {
        id: input.runId,
        suite_id: "suite-ops-1",
        status: "passed",
        evidence_ids: [`evidence-${input.runId}`],
        started_at: input.createdAt,
        finished_at: input.createdAt,
      },
      evidence_pack: {
        id: `pack-${input.runId}`,
        experiment_run_id: input.runId,
        summary_status: input.summaryStatus ?? input.recommendationStatus,
        score_summary: `Average weighted score ${input.score.toFixed(1)} across 1 item(s).`,
        regression_summary:
          input.regressionSummary ?? "No regression failures were recorded.",
        failure_summary: input.failureSummary ?? "No failure annotations were recorded.",
        cost_summary: "Cost tracking is not recorded in Phase 6A v1.",
        latency_summary: "Latency tracking is not recorded in Phase 6A v1.",
        created_at: input.createdAt,
      },
      recommendation: {
        id: `recommendation-${input.runId}`,
        experiment_run_id: input.runId,
        evidence_pack_id: `pack-${input.runId}`,
        status: input.recommendationStatus,
        decision_reason: input.decisionReason,
        created_at: input.createdAt,
      },
      evidence: [
        {
          id: `evidence-${input.runId}`,
          kind: "url",
          label: input.evidenceLabel ?? `Evidence for ${input.runId}`,
          uri: `https://example.test/evidence/${input.runId}`,
          created_at: input.createdAt,
        },
      ],
    },
  };
}

function createOperationsOverviewFixture() {
  const finalizedRunHistory = [
    createFinalizedHistoryEntry({
      runId: "run-12",
      recommendationStatus: "recommended",
      score: 96,
      decisionReason: "Latest finalized recommendation is safe to promote.",
      createdAt: "2026-04-12T09:00:00.000Z",
      evidenceLabel: "Latest browser QA",
    }),
    createFinalizedHistoryEntry({
      runId: "run-11",
      recommendationStatus: "needs_review",
      summaryStatus: "needs_review",
      score: 82,
      decisionReason: "Previous finalized recommendation needed manual review.",
      createdAt: "2026-04-11T09:00:00.000Z",
      regressionSummary: "Regression drift detected in terminology consistency.",
      failureSummary: "One hard gate warning remains open.",
      evidenceLabel: "Previous browser QA",
    }),
    createFinalizedHistoryEntry({
      runId: "run-10",
      recommendationStatus: "recommended",
      score: 91,
      decisionReason: "Historical reference remained recommended.",
      createdAt: "2026-04-10T09:00:00.000Z",
    }),
    createFinalizedHistoryEntry({
      runId: "run-09",
      recommendationStatus: "rejected",
      summaryStatus: "rejected",
      score: 54,
      decisionReason: "Inspection run was rejected for regression drift.",
      createdAt: "2026-04-09T09:00:00.000Z",
      regressionSummary: "2 regression-failed item(s) detected.",
      failureSummary: "Structure regression triggered the hard gate.",
    }),
    createFinalizedHistoryEntry({
      runId: "run-08",
      recommendationStatus: "recommended",
      score: 89,
      decisionReason: "Historical reference remained recommended.",
      createdAt: "2026-04-08T09:00:00.000Z",
    }),
    createFinalizedHistoryEntry({
      runId: "run-07",
      recommendationStatus: "needs_review",
      summaryStatus: "needs_review",
      score: 76,
      decisionReason: "Historical reference needs review.",
      createdAt: "2026-04-07T09:00:00.000Z",
      regressionSummary: "Regression drift detected in citation formatting.",
      failureSummary: "One hard gate warning remains open.",
    }),
    createFinalizedHistoryEntry({
      runId: "run-06",
      recommendationStatus: "recommended",
      score: 88,
      decisionReason: "Historical reference remained recommended.",
      createdAt: "2026-04-06T09:00:00.000Z",
    }),
    createFinalizedHistoryEntry({
      runId: "run-05",
      recommendationStatus: "recommended",
      score: 90,
      decisionReason: "Historical reference remained recommended.",
      createdAt: "2026-04-05T09:00:00.000Z",
    }),
    createFinalizedHistoryEntry({
      runId: "run-04",
      recommendationStatus: "needs_review",
      summaryStatus: "needs_review",
      score: 74,
      decisionReason: "Historical reference needs review.",
      createdAt: "2026-04-04T09:00:00.000Z",
      failureSummary: "Runtime_failed required a manual check.",
    }),
    createFinalizedHistoryEntry({
      runId: "run-03",
      recommendationStatus: "recommended",
      score: 86,
      decisionReason: "Historical reference remained recommended.",
      createdAt: "2026-04-03T09:00:00.000Z",
    }),
    createFinalizedHistoryEntry({
      runId: "run-02",
      recommendationStatus: "recommended",
      score: 84,
      decisionReason: "Older suite history remained recommended.",
      createdAt: "2026-04-02T09:00:00.000Z",
    }),
    createFinalizedHistoryEntry({
      runId: "run-01",
      recommendationStatus: "rejected",
      summaryStatus: "rejected",
      score: 49,
      decisionReason: "Selected inspection run regressed and was rejected.",
      createdAt: "2026-04-01T09:00:00.000Z",
      regressionSummary: "3 regression-failed item(s) detected.",
      failureSummary: "Structure regression triggered the hard gate.",
    }),
  ];
  const visibleHistory = finalizedRunHistory.slice(0, 10);

  return {
    checkProfiles: [{ id: "check-1", status: "published" }],
    releaseCheckProfiles: [{ id: "release-1", status: "published" }],
    sampleSets: [
      {
        id: "sample-set-ops-1",
        name: "Editing Suite Set",
        module: "editing",
        sample_count: 12,
        status: "published",
      },
    ],
    suites: [
      {
        id: "suite-ops-1",
        name: "Editing Delta Suite",
        suite_type: "governed_evaluation",
        status: "active",
        module_scope: ["editing"],
      },
    ],
    selectedSuiteId: "suite-ops-1",
    runs: finalizedRunHistory.map((entry) => entry.run),
    selectedRunId: "run-01",
    sampleSetItems: [],
    runItems: [],
    selectedRunEvidence: [
      {
        id: "selected-evidence-run-01",
        kind: "url",
        label: "Selected inspection evidence",
        uri: "https://example.test/evidence/selected-run-01",
        created_at: "2026-04-01T09:05:00.000Z",
      },
    ],
    previousRunEvidence: [],
    selectedRunFinalization: null,
    finalizedRunHistory,
    suiteOperations: {
      defaultWindow: "latest_10",
      visibleHistory,
      defaultComparison: {
        selected: visibleHistory[0],
        baseline: visibleHistory[1],
      },
      defaultComparisonDetail: {
        selectedEvidence: visibleHistory[0].finalized.evidence,
        baselineEvidence: visibleHistory[1].finalized.evidence,
      },
      delta: {
        classification: "better",
        reason: "recommendation_improved",
      },
      signals: {
        recommendationDistribution: {
          recommended: 6,
          needs_review: 3,
          rejected: 1,
        },
        evidencePackOutcomeMix: {
          recommended: 6,
          needs_review: 3,
          rejected: 1,
        },
        recurrence: {
          regressionMentions: 3,
          failureMentions: 4,
          runsWithRecurrenceSignals: 4,
        },
      },
      honestDegradation: null,
    },
    manuscriptContext: null,
  };
}

function renderLoadedPage(
  overview: ReturnType<typeof createOperationsOverviewFixture>,
): string {
  const controller = {
    loadOverview: async () => overview,
  } as React.ComponentProps<typeof EvaluationWorkbenchPage>["controller"];

  return renderToStaticMarkup(
    <EvaluationWorkbenchPage
      controller={controller}
      initialOverview={overview}
    />,
  );
}

function createHarnessGovernanceOverviewFixture() {
  const routingVersion = {
    id: "routing-version-1",
    policy_scope_id: "routing-policy-1",
    scope_kind: "module",
    scope_value: "editing",
    version_no: 1,
    primary_model_id: "model-primary-1",
    fallback_model_ids: ["model-fallback-1"],
    evidence_links: [],
    status: "active",
    created_at: "2026-04-12T08:00:00.000Z",
    updated_at: "2026-04-12T08:00:00.000Z",
  };

  return {
    templateFamilies: [
      {
        id: "family-ops-1",
        manuscript_type: "clinical_study",
        name: "Editing Clinical Family",
        status: "active",
      },
    ],
    selectedTemplateFamilyId: "family-ops-1",
    moduleTemplates: [],
    promptTemplates: [],
    skillPackages: [],
    executionProfiles: [
      {
        id: "profile-ops-1",
        module: "editing",
        manuscript_type: "clinical_study",
        template_family_id: "family-ops-1",
        module_template_id: "template-ops-1",
        prompt_template_id: "prompt-ops-1",
        skill_package_ids: [],
        knowledge_binding_mode: "profile_only",
        status: "active",
        version: 1,
      },
    ],
    qualityPackages: [
      {
        id: "quality-package-version-1",
        package_name: "Editing Quality",
        version: 1,
        status: "published",
      },
    ],
    modelRegistryEntries: [],
    modelRoutingPolicy: {
      policy_id: "routing-policy-1",
      scope_kind: "module",
      scope_value: "editing",
      active_version: routingVersion,
      versions: [routingVersion],
      decisions: [],
    },
    routingPolicies: [],
    toolGatewayTools: [],
    sandboxProfiles: [],
    agentProfiles: [],
    agentRuntimes: [],
    toolPermissionPolicies: [],
    verificationCheckProfiles: [
      {
        id: "check-profile-1",
        name: "Editing Browser QA",
        check_type: "browser_qa",
        status: "published",
        admin_only: true,
      },
    ],
    releaseCheckProfiles: [
      {
        id: "release-profile-1",
        name: "Editing Release Gate",
        check_type: "deploy_verification",
        status: "published",
        verification_check_profile_ids: ["check-profile-1"],
        admin_only: true,
      },
    ],
    evaluationSuites: [
      {
        id: "suite-ops-1",
        name: "Editing Delta Suite",
        suite_type: "governed_evaluation",
        status: "active",
        verification_check_profile_ids: ["check-profile-1"],
        module_scope: ["editing"],
        admin_only: true,
      },
    ],
    runtimeBindings: [
      {
        id: "binding-ops-1",
        module: "editing",
        manuscript_type: "clinical_study",
        template_family_id: "family-ops-1",
        runtime_id: "runtime-ops-1",
        sandbox_profile_id: "sandbox-ops-1",
        agent_profile_id: "agent-profile-1",
        tool_permission_policy_id: "tool-policy-1",
        prompt_template_id: "prompt-ops-1",
        skill_package_ids: [],
        quality_package_version_ids: ["quality-package-version-1"],
        execution_profile_id: "profile-ops-1",
        verification_check_profile_ids: ["check-profile-1"],
        evaluation_suite_ids: ["suite-ops-1"],
        release_check_profile_id: "release-profile-1",
        status: "active",
        version: 1,
      },
    ],
    harnessAdapters: [],
    harnessAdapterHealth: [],
    latestJudgeCalibrationBatchOutcome: null,
    agentExecutionLogs: [],
    aiProviderConnections: [],
    landing: {
      aiAccess: {
        totalConnections: 0,
        enabledConnections: 0,
        prodReadyModels: 0,
        connections: [],
      },
      harness: {
        evaluationSuiteCount: 1,
        runtimeBindingCount: 1,
        adapterHealthCount: 0,
        adapterHealth: [],
        latestJudgeCalibrationBatchOutcome: null,
      },
      warnings: [],
    },
  };
}

function createHarnessScopeFixture() {
  return {
    activeEnvironment: {
      execution_profile: {
        id: "profile-ops-1",
        module: "editing",
        manuscript_type: "clinical_study",
        template_family_id: "family-ops-1",
        module_template_id: "template-ops-1",
        prompt_template_id: "prompt-ops-1",
        skill_package_ids: [],
        knowledge_binding_mode: "profile_only",
        status: "active",
        version: 1,
      },
      runtime_binding: {
        id: "binding-ops-1",
        module: "editing",
        manuscript_type: "clinical_study",
        template_family_id: "family-ops-1",
        runtime_id: "runtime-ops-1",
        sandbox_profile_id: "sandbox-ops-1",
        agent_profile_id: "agent-profile-1",
        tool_permission_policy_id: "tool-policy-1",
        prompt_template_id: "prompt-ops-1",
        skill_package_ids: [],
        quality_package_version_ids: ["quality-package-version-1"],
        execution_profile_id: "profile-ops-1",
        verification_check_profile_ids: ["check-profile-1"],
        evaluation_suite_ids: ["suite-ops-1"],
        release_check_profile_id: "release-profile-1",
        status: "active",
        version: 1,
      },
      model_routing_policy_version: {
        id: "routing-version-1",
        policy_scope_id: "routing-policy-1",
        scope_kind: "module",
        scope_value: "editing",
        version_no: 1,
        primary_model_id: "model-primary-1",
        fallback_model_ids: ["model-fallback-1"],
        evidence_links: [],
        status: "active",
        created_at: "2026-04-12T08:00:00.000Z",
        updated_at: "2026-04-12T08:00:00.000Z",
      },
      retrieval_preset: {
        id: "retrieval-preset-1",
        name: "Editing Retrieval Preset",
      },
      manual_review_policy: {
        id: "manual-review-policy-1",
        name: "Senior Operator Review",
      },
    },
    retrievalPresets: [
      {
        id: "retrieval-preset-1",
        name: "Editing Retrieval Preset",
      },
    ],
    manualReviewPolicies: [
      {
        id: "manual-review-policy-1",
        name: "Senior Operator Review",
      },
    ],
  };
}

function createHarnessPreviewFixture() {
  const scope = createHarnessScopeFixture();

  return {
    active_environment: scope.activeEnvironment,
    candidate_environment: {
      ...scope.activeEnvironment,
      runtime_binding: {
        ...scope.activeEnvironment.runtime_binding,
        id: "binding-ops-2",
      },
      manual_review_policy: {
        id: "manual-review-policy-2",
        name: "Release Candidate Review",
      },
    },
    diff: {
      changed_components: ["runtime_binding", "manual_review_policy"],
    },
  };
}

function createHarnessDatasetsOverviewFixture() {
  return {
    exportRootDir: ".local-data/harness-exports/development",
    rubrics: [],
    draftVersions: [
      {
        id: "draft-1",
        familyId: "family-1",
        familyName: "Editing working set",
        familyScope: {
          module: "editing",
          manuscriptTypes: ["clinical_study"],
          measureFocus: "conformance",
        },
        versionNo: 1,
        status: "draft",
        itemCount: 2,
        createdBy: "persistent.admin",
        createdAt: "2026-04-16T10:00:00.000Z",
        deidentificationGatePassed: true,
        humanReviewGatePassed: true,
        rubricAssignment: {
          status: "missing",
        },
        sourceProvenance: [],
        publications: [],
      },
    ],
    publishedVersions: [
      {
        id: "published-1",
        familyId: "family-2",
        familyName: "Editing released set",
        familyScope: {
          module: "editing",
          manuscriptTypes: ["clinical_study"],
          measureFocus: "conformance",
        },
        versionNo: 2,
        status: "published",
        itemCount: 4,
        createdBy: "persistent.admin",
        createdAt: "2026-04-16T12:00:00.000Z",
        publishedBy: "persistent.admin",
        publishedAt: "2026-04-16T13:00:00.000Z",
        deidentificationGatePassed: true,
        humanReviewGatePassed: true,
        rubricAssignment: {
          status: "missing",
        },
        sourceProvenance: [],
        publications: [],
      },
    ],
    archivedVersions: [],
  };
}

test("evaluation workbench page renders an explicit loading state for server-side shell output", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchPage
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
        activateSuiteAndReload: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );

  assert.match(markup, /Harness 控制概览/u);
  assert.match(markup, /默认聚焦总体评测状态与风险分布。/u);
  assert.match(markup, /正在加载评测套件、运行记录与核验证据\.\.\./);
});

test("evaluation workbench loading placeholder follows section-specific first-view emphasis", () => {
  const overviewLoadingMarkup = renderToStaticMarkup(
    <EvaluationWorkbenchPage
      section="overview"
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );
  const runsLoadingMarkup = renderToStaticMarkup(
    <EvaluationWorkbenchPage
      section="runs"
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );

  assert.match(overviewLoadingMarkup, /Harness 控制概览/u);
  assert.match(overviewLoadingMarkup, /默认聚焦总体评测状态与风险分布。/u);
  assert.match(runsLoadingMarkup, /Harness 运行记录/u);
  assert.match(runsLoadingMarkup, /默认聚焦最近运行队列与最终建议变化。/u);
});

test("evaluation workbench loaded page renders a read-only release-gate summary card", () => {
  const markup = renderLoadedPage(createOperationsOverviewFixture());

  assert.match(markup, /发布门摘要/);
  assert.match(markup, /当前运行：run-12/);
  assert.match(markup, /基线运行：run-11/);
  assert.match(markup, /当前与基线：run-11 对 run-12/);
  assert.match(markup, /建议状态：可推荐/);
  assert.match(markup, /回归摘要： 未发现回归失败。/);
  assert.match(markup, /失败摘要： 未记录失败标注。/);
  assert.match(markup, /发布就绪摘要/);
  assert.match(
    markup,
    /当前运行 run-12 相对基线 run-11 的结论为 可推荐。回归摘要：未发现回归失败。 失败摘要：未记录失败标注。/,
  );
});

test("evaluation workbench page lands on different first-view emphasis for overview vs runs sections", () => {
  const overview = createOperationsOverviewFixture();
  const controller = {
    loadOverview: async () => overview,
  } as React.ComponentProps<typeof EvaluationWorkbenchPage>["controller"];

  const overviewMarkup = renderToStaticMarkup(
    <EvaluationWorkbenchPage
      controller={controller}
      section="overview"
      initialOverview={overview}
    />,
  );
  const runsMarkup = renderToStaticMarkup(
    <EvaluationWorkbenchPage
      controller={controller}
      section="runs"
      initialOverview={overview}
    />,
  );

  assert.match(overviewMarkup, /Harness 控制概览/u);
  assert.match(overviewMarkup, /默认聚焦总体评测状态与风险分布。/u);
  assert.match(runsMarkup, /Harness 运行记录/u);
  assert.match(runsMarkup, /默认聚焦最近运行队列与最终建议变化。/u);
});

test("evaluation workbench page renders the real harness control plane inside a unified harness workspace", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchPage
      controller={{
        loadOverview: async () => createOperationsOverviewFixture(),
      } as never}
      section="overview"
      initialOverview={createOperationsOverviewFixture() as never}
      initialHarnessOverview={createHarnessGovernanceOverviewFixture() as never}
      initialHarnessScope={createHarnessScopeFixture() as never}
      initialHarnessPreview={createHarnessPreviewFixture() as never}
      initialDatasetsOverview={createHarnessDatasetsOverviewFixture() as never}
    />,
  );

  assert.match(markup, /Harness 控制/u);
  assert.match(markup, /evaluation-workbench-unified-layout/u);
  assert.match(markup, /evaluation-workbench-workspace-sidebar/u);
  assert.match(markup, /evaluation-workbench-workspace-main/u);
  assert.match(markup, /evaluation-workbench-workspace-rail/u);
  assert.match(markup, /Harness 工作区/u);
  assert.match(markup, /Environment Editor/u);
  assert.match(markup, /Manuscript Type<\/span><select/u);
  assert.match(markup, /Template Family/u);
  assert.match(markup, /Editing Clinical Family/u);
  assert.match(markup, /Execution Profile/u);
  assert.match(markup, /Runtime Binding/u);
  assert.match(markup, /Routing Version/u);
  assert.match(markup, /Retrieval Preset/u);
  assert.match(markup, /Manual Review Policy/u);
  assert.match(markup, /Preview Candidate Environment/u);
  assert.match(markup, /Quality Lab/u);
  assert.match(markup, /Launch Candidate Run/u);
  assert.match(markup, /Activation Gate/u);
  assert.match(markup, /Activate Candidate Environment/u);
  assert.match(markup, /Roll Back Scope/u);
  assert.match(markup, /数据与样本/u);
  assert.match(markup, /草稿 1 个/u);
  assert.match(markup, /已发布 1 个/u);
});

test("evaluation workbench datasets section keeps the dataset workbench inside the same harness workspace", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchPage
      controller={{
        loadOverview: async () => createOperationsOverviewFixture(),
      } as never}
      section="datasets"
      initialOverview={createOperationsOverviewFixture() as never}
      initialHarnessOverview={createHarnessGovernanceOverviewFixture() as never}
      initialHarnessScope={createHarnessScopeFixture() as never}
      initialHarnessPreview={createHarnessPreviewFixture() as never}
      initialDatasetsOverview={createHarnessDatasetsOverviewFixture() as never}
    />,
  );

  assert.match(markup, /evaluation-workbench-unified-layout/u);
  assert.match(markup, /evaluation-workbench-workspace-main is-datasets/u);
  assert.match(markup, /harness-datasets-workbench is-embedded/u);
  assert.match(markup, /待整理队列/u);
  assert.match(markup, /已发布版本/u);
});

test("evaluation workbench loaded page renders a delta-first summary with bounded read-only history", () => {
  const markup = renderLoadedPage(createOperationsOverviewFixture());

  assert.match(markup, /Harness 控制/);
  assert.match(markup, /管理区/);
  assert.match(markup, /workbench-core-strip is-secondary/);
  assert.match(markup, /运行总览/);
  assert.match(markup, /变化分类：改善/i);
  assert.match(
    markup,
    /本次变化判定为改善，因为最新已定稿建议从待复核提升为可推荐。/,
  );
  assert.match(markup, /建议动作：可推进候选版本/);
  assert.match(markup, /最新结果与基线对照/);
  assert.match(markup, /默认对照：run-12 对 run-11/);
  assert.match(markup, /最近 10 次/);
  assert.match(markup, /最近 7 天/);
  assert.match(markup, /最近 30 天/);
  assert.match(markup, /全部套件历史/);
  assert.match(markup, /全部/);
  assert.match(markup, /可推荐/);
  assert.match(markup, /待复核/);
  assert.match(markup, /已拒绝/);
  assert.match(markup, /最新优先/);
  assert.match(markup, /失败优先/);
  assert.match(markup, /当前时间窗口展示 10 \/ 12 条已定稿运行。/);
  assert.match(markup, /run-12/);
  assert.match(markup, /run-03/);
  assert.doesNotMatch(markup, /run-02/);
  assert.match(markup, /默认最新运行/);
  assert.match(markup, /默认基线/);
  assert.match(markup, /当前查看运行：run-01/);
  assert.match(markup, /当前查看运行 run-01 不在当前历史窗口内。/);
  assert.match(markup, /建议分布/);
  assert.match(markup, /6 可推荐 \/ 3 待复核 \/ 1 已拒绝/);
  assert.match(markup, /证据包结果/);
  assert.match(markup, /复发信号/);
  assert.match(markup, /3 次回归提及 \/ 4 次失败提及 \/ 4 次运行被标记/);
  assert.doesNotMatch(markup, /Activate/);
  assert.doesNotMatch(markup, /Run Launch/);
  assert.doesNotMatch(markup, /完成运行并定稿/);
  assert.doesNotMatch(markup, /完成建议定稿/);
});

test("evaluation workbench release-gate summary falls back to an honest empty state when finalized evidence is missing", () => {
  const insufficientComparisonOverview = createOperationsOverviewFixture();
  const onlyVisibleEntry = insufficientComparisonOverview.finalizedRunHistory[0];
  insufficientComparisonOverview.suiteOperations = {
    ...insufficientComparisonOverview.suiteOperations,
    visibleHistory: [onlyVisibleEntry],
    defaultComparison: null,
    defaultComparisonDetail: null,
    delta: null,
    honestDegradation: {
      kind: "comparison_unavailable",
      reason: "fewer_than_two_visible_finalized_runs",
    },
  };
  const insufficientComparisonMarkup = renderLoadedPage(insufficientComparisonOverview);

  assert.match(insufficientComparisonMarkup, /发布门摘要/);
  assert.match(
    insufficientComparisonMarkup,
    /当前历史窗口至少需要展示 2 条已定稿运行后，才能生成发布门摘要。/,
  );

  const selectedRunNotFinalizedOverview = createOperationsOverviewFixture();
  selectedRunNotFinalizedOverview.runs = [
    {
      ...selectedRunNotFinalizedOverview.runs[0],
      id: "run-current",
      status: "passed",
      finished_at: "2026-04-13T09:00:00.000Z",
    },
    ...selectedRunNotFinalizedOverview.runs,
  ];
  selectedRunNotFinalizedOverview.selectedRunId = "run-current";
  selectedRunNotFinalizedOverview.selectedRunFinalization = null;
  const selectedRunNotFinalizedMarkup = renderLoadedPage(selectedRunNotFinalizedOverview);

  assert.match(selectedRunNotFinalizedMarkup, /发布门摘要/);
  assert.match(
    selectedRunNotFinalizedMarkup,
    /所选运行需要先生成已定稿建议与证据包后，才能查看发布门摘要。/,
  );
});

test("evaluation workbench loaded page keeps selected inspection finalization outside the visible history window", () => {
  const overview = createOperationsOverviewFixture();
  const selectedFinalized = overview.finalizedRunHistory.find((entry) => entry.run.id === "run-01");
  assert.ok(selectedFinalized);
  overview.selectedRunFinalization = {
    run: selectedFinalized.run,
    evidence_pack: selectedFinalized.finalized.evidence_pack,
    recommendation: selectedFinalized.finalized.recommendation,
  };

  const markup = renderLoadedPage(overview);

  assert.match(markup, /当前查看运行：run-01/);
  assert.match(markup, /建议结论：已拒绝/);
  assert.match(markup, /证据包：pack-run-01/);
  assert.match(markup, /Selected inspection run regressed and was rejected\./);
  assert.match(markup, /该运行不在默认摘要使用的历史窗口内。/);
});

test("evaluation workbench loaded page renders honest degradation when fewer than two finalized runs are visible", () => {
  const overview = createOperationsOverviewFixture();
  const onlyVisibleEntry = overview.finalizedRunHistory[0];
  overview.suiteOperations = {
    ...overview.suiteOperations,
    visibleHistory: [onlyVisibleEntry],
    defaultComparison: null,
    defaultComparisonDetail: null,
    delta: null,
    honestDegradation: {
      kind: "comparison_unavailable",
      reason: "fewer_than_two_visible_finalized_runs",
    },
    signals: {
      recommendationDistribution: {
        recommended: 1,
        needs_review: 0,
        rejected: 0,
      },
      evidencePackOutcomeMix: {
        recommended: 1,
        needs_review: 0,
        rejected: 0,
      },
      recurrence: {
        regressionMentions: 0,
        failureMentions: 0,
        runsWithRecurrenceSignals: 0,
      },
    },
  };

  const markup = renderLoadedPage(overview);

  assert.match(markup, /运行总览/);
  assert.match(
    markup,
    /当前最近 10 次内可见的已定稿运行不足 2 条，暂时无法形成默认变化结论。/,
  );
  assert.match(
    markup,
    /请先在当前窗口内再完成 1 条运行定稿后，再判断套件是改善、回落还是持平。/,
  );
});

test("evaluation workbench run-item detail card renders linked sample context and frozen bindings", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchSelectedRunItemDetailCard
      selectedRun={{
        id: "run-1",
        suite_id: "suite-1",
        sample_set_id: "sample-set-1",
        baseline_binding: {
          lane: "baseline",
          model_id: "baseline-model-1",
          runtime_id: "runtime-prod-1",
          prompt_template_id: "prompt-prod-1",
          skill_package_ids: ["skill-prod-1", "skill-prod-2"],
          module_template_id: "template-prod-1",
        },
        candidate_binding: {
          lane: "candidate",
          model_id: "candidate-model-1",
          runtime_id: "runtime-candidate-1",
          prompt_template_id: "prompt-candidate-1",
          skill_package_ids: ["skill-candidate-1"],
          module_template_id: "template-candidate-1",
        },
        release_check_profile_id: "release-1",
        run_item_count: 1,
        status: "running",
        evidence_ids: [],
        started_at: "2026-04-01T08:00:00.000Z",
      }}
      selectedRunItem={{
        id: "run-item-1",
        evaluation_run_id: "run-1",
        sample_set_item_id: "sample-item-1",
        lane: "candidate",
        result_asset_id: "asset-1",
        hard_gate_passed: false,
        weighted_score: 61,
        failure_kind: "regression_failed",
        failure_reason: "Structure regression triggered the hard gate.",
        diff_summary: "Candidate drifted from the approved editing structure.",
        requires_human_review: true,
      }}
      linkedSampleSetItem={{
        id: "sample-item-1",
        sample_set_id: "sample-set-1",
        manuscript_id: "manuscript-1",
        snapshot_asset_id: "snapshot-asset-1",
        reviewed_case_snapshot_id: "reviewed-case-snapshot-1",
        module: "editing",
        manuscript_type: "clinical_study",
        risk_tags: ["structure", "terminology"],
      }}
    />,
  );

  assert.match(markup, /当前样本详情/);
  assert.match(markup, /sample-item-1/);
  assert.match(markup, /clinical study/);
  assert.match(markup, /structure，terminology/);
  assert.match(markup, /snapshot-asset-1/);
  assert.match(markup, /reviewed-case-snapshot-1/);
  assert.match(markup, /baseline-model-1/);
  assert.match(markup, /candidate-model-1/);
  assert.match(markup, /skill-prod-1，skill-prod-2/);
  assert.match(markup, /skill-candidate-1/);
  assert.match(markup, /打开编辑工作台/);
  assert.match(
    markup,
    /#editing\?manuscriptId=manuscript-1&amp;reviewedCaseSnapshotId=reviewed-case-snapshot-1&amp;sampleSetItemId=sample-item-1/,
  );
});

test("evaluation workbench governed-source detail card renders execution trace and manuscript navigation", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchGovernedSourceDetailCard
      selectedRun={{
        id: "run-governed-1",
        suite_id: "suite-1",
        governed_source: {
          source_kind: "governed_module_execution",
          manuscript_id: "manuscript-1",
          source_module: "editing",
          agent_execution_log_id: "execution-log-1",
          execution_snapshot_id: "execution-snapshot-1",
          output_asset_id: "output-asset-1",
        },
        release_check_profile_id: "release-1",
        run_item_count: 0,
        status: "queued",
        evidence_ids: [],
        started_at: "2026-04-03T08:00:00.000Z",
      }}
    />,
  );

  assert.match(markup, /治理来源详情/);
  assert.match(markup, /来源模块：编辑/);
  assert.match(markup, /稿件：manuscript-1/);
  assert.match(markup, /执行快照：execution-snapshot-1/);
  assert.match(markup, /Agent 执行日志：execution-log-1/);
  assert.match(markup, /输出制品：output-asset-1/);
  assert.match(markup, /发布核查配置：release-1/);
  assert.match(markup, /下载治理输出制品/);
  assert.match(markup, /\/api\/v1\/document-assets\/output-asset-1\/download/);
  assert.match(markup, /打开编辑工作台/);
  assert.match(markup, /#editing\?manuscriptId=manuscript-1/);
  assert.doesNotMatch(markup, /reviewedCaseSnapshotId=/);
  assert.doesNotMatch(markup, /sampleSetItemId=/);
});

test("evaluation workbench comparison card renders binding deltas between finalized runs", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchRunComparisonCard
      comparisonScopeLabel="更广范围套件历史"
      selectedOriginLabel="当前稿件"
      previousOriginLabel="更广范围套件"
      selectedEvidence={[
        {
          id: "evidence-2",
          kind: "url",
          label: "Latest browser QA",
          uri: "https://example.test/evidence/latest-browser-qa",
          created_at: "2026-04-01T08:19:00.000Z",
        },
      ]}
      previousEvidence={[
        {
          id: "evidence-1",
          kind: "url",
          label: "已拒绝 browser QA",
          uri: "https://example.test/evidence/rejected-browser-qa",
          created_at: "2026-04-01T07:19:00.000Z",
        },
      ]}
      selectedEntry={{
        run: {
          id: "run-2",
          suite_id: "suite-1",
          sample_set_id: "sample-set-1",
          baseline_binding: {
            lane: "baseline",
            model_id: "baseline-model-2",
            runtime_id: "runtime-1",
            prompt_template_id: "prompt-1",
            skill_package_ids: ["skill-1"],
            module_template_id: "template-1",
          },
          candidate_binding: {
            lane: "candidate",
            model_id: "candidate-model-2",
            runtime_id: "runtime-1",
            prompt_template_id: "prompt-2",
            skill_package_ids: ["skill-1", "skill-2"],
            module_template_id: "template-1",
          },
          run_item_count: 1,
          status: "passed",
          evidence_ids: [],
          started_at: "2026-04-01T08:00:00.000Z",
          finished_at: "2026-04-01T08:20:00.000Z",
        },
        finalized: {
          run: {
            id: "run-2",
            suite_id: "suite-1",
            status: "passed",
            evidence_ids: [],
            started_at: "2026-04-01T08:00:00.000Z",
          },
          evidence_pack: {
            id: "pack-2",
            experiment_run_id: "run-2",
            summary_status: "recommended",
            score_summary: "Average weighted score 97.0 across 1 item(s).",
            regression_summary: "No regression failures were recorded.",
            failure_summary: "No failure annotations were recorded.",
            cost_summary: "Cost tracking is not recorded in Phase 6A v1.",
            latency_summary: "Latency tracking is not recorded in Phase 6A v1.",
            created_at: "2026-04-01T08:20:00.000Z",
          },
          recommendation: {
            id: "recommendation-2",
            experiment_run_id: "run-2",
            evidence_pack_id: "pack-2",
            status: "recommended",
            created_at: "2026-04-01T08:20:00.000Z",
          },
        },
      }}
      previousEntry={{
        run: {
          id: "run-1",
          suite_id: "suite-1",
          sample_set_id: "sample-set-1",
          baseline_binding: {
            lane: "baseline",
            model_id: "baseline-model-1",
            runtime_id: "runtime-1",
            prompt_template_id: "prompt-1",
            skill_package_ids: ["skill-1"],
            module_template_id: "template-1",
          },
          candidate_binding: {
            lane: "candidate",
            model_id: "candidate-model-1",
            runtime_id: "runtime-1",
            prompt_template_id: "prompt-1",
            skill_package_ids: ["skill-1"],
            module_template_id: "template-1",
          },
          run_item_count: 1,
          status: "passed",
          evidence_ids: [],
          started_at: "2026-04-01T07:00:00.000Z",
          finished_at: "2026-04-01T07:20:00.000Z",
        },
        finalized: {
          run: {
            id: "run-1",
            suite_id: "suite-1",
            status: "passed",
            evidence_ids: [],
            started_at: "2026-04-01T07:00:00.000Z",
          },
          evidence_pack: {
            id: "pack-1",
            experiment_run_id: "run-1",
            summary_status: "recommended",
            score_summary: "Average weighted score 91.0 across 1 item(s).",
            regression_summary: "No regression failures were recorded.",
            failure_summary: "No failure annotations were recorded.",
            cost_summary: "Cost tracking is not recorded in Phase 6A v1.",
            latency_summary: "Latency tracking is not recorded in Phase 6A v1.",
            created_at: "2026-04-01T07:20:00.000Z",
          },
          recommendation: {
            id: "recommendation-1",
            experiment_run_id: "run-1",
            evidence_pack_id: "pack-1",
            status: "recommended",
            created_at: "2026-04-01T07:20:00.000Z",
          },
        },
      }}
    />,
  );

  assert.match(
    markup,
    /操作摘要：相较于更广范围套件历史，在维持可推荐的同时提升了 6\.0 分。/,
  );
  assert.match(
    markup,
    /基线策略：按时间顺序选择更广范围套件历史中的上一条已定稿运行。/,
  );
  assert.match(markup, /建议动作：可推进候选版本/);
  assert.match(markup, /对照范围：更广范围套件历史/);
  assert.match(markup, /当前来源：当前稿件/);
  assert.match(markup, /基线来源：更广范围套件/);
  assert.match(markup, /当前摘要：完成于 2026-04-01T08:20:00.000Z/);
  assert.match(markup, /基线摘要：完成于 2026-04-01T07:20:00.000Z/);
  assert.match(markup, /绑定变化/);
  assert.match(markup, /证据包变化/);
  assert.match(markup, /建议变化：维持 可推荐/);
  assert.match(markup, /证据数量：1（原为 1）/);
  assert.match(markup, /基线模型：baseline-model-2（原为 baseline-model-1）/);
  assert.match(markup, /候选模型：candidate-model-2（原为 candidate-model-1）/);
  assert.match(markup, /候选提示模版：prompt-2（原为 prompt-1）/);
  assert.match(markup, /候选技能包：skill-1，skill-2（原为 skill-1）/);
  assert.match(
    markup,
    /评分摘要：平均加权得分 97.0（共 1 条）（原为 平均加权得分 91.0（共 1 条））/,
  );
  assert.match(markup, /当前证据：Latest browser QA/);
  assert.match(markup, /基线证据：已拒绝 browser QA/);
  assert.match(markup, /当前证据包/);
  assert.match(markup, /基线证据包/);
  assert.match(markup, /平均加权得分 97.0（共 1 条）/);
  assert.match(markup, /平均加权得分 91.0（共 1 条）/);
});

test("evaluation workbench evidence list renders actionable links for url and artifact evidence", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchEvidenceList
      evidence={[
        {
          id: "evidence-url-1",
          kind: "url",
          label: "Browser QA evidence",
          uri: "https://example.test/evidence/browser-qa",
          created_at: "2026-04-02T08:10:00.000Z",
        },
        {
          id: "evidence-artifact-1",
          kind: "artifact",
          label: "Proof artifact evidence",
          artifact_asset_id: "asset-proof-1",
          created_at: "2026-04-02T08:11:00.000Z",
        },
      ]}
    />,
  );

  assert.match(markup, /Browser QA evidence/);
  assert.match(markup, /打开证据链接/);
  assert.match(markup, /https:\/\/example\.test\/evidence\/browser-qa/);
  assert.match(markup, /Proof artifact evidence/);
  assert.match(markup, /下载证据制品/);
  assert.match(markup, /\/api\/v1\/document-assets\/asset-proof-1\/download/);
});

test("evaluation workbench finalize panel shows finalize-only guidance for machine-completed governed runs", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchFinalizePanel
      selectedRun={{
        id: "run-governed-1",
        suite_id: "suite-1",
        governed_source: {
          source_kind: "governed_module_execution",
          manuscript_id: "manuscript-1",
          source_module: "editing",
          agent_execution_log_id: "execution-log-1",
          execution_snapshot_id: "execution-snapshot-1",
          output_asset_id: "output-asset-1",
        },
        release_check_profile_id: "release-1",
        run_item_count: 0,
        status: "passed",
        evidence_ids: ["evidence-machine-1"],
        started_at: "2026-04-03T08:00:00.000Z",
        finished_at: "2026-04-03T08:05:00.000Z",
      }}
      effectiveFinalizedResult={null}
      finalizeForm={{
        status: "passed",
        evidenceKind: "url",
        evidenceLabel: "Browser QA evidence",
        evidenceUrl: "https://example.test/evidence/browser-qa",
        artifactAssetId: "",
      }}
      finalizeArtifactOptions={[]}
      selectedRunEvidence={[
        {
          id: "evidence-machine-1",
          kind: "url",
          label: "Automatic governed browser QA passed for Editing Output Check",
          uri: "/api/v1/document-assets/output-asset-1/download",
          check_profile_id: "check-1",
          created_at: "2026-04-03T08:04:00.000Z",
        },
      ]}
      isBusy={false}
      onFinalizeStatusChange={() => {}}
      onEvidenceKindChange={() => {}}
      onEvidenceLabelChange={() => {}}
      onEvidenceUrlChange={() => {}}
      onArtifactAssetIdChange={() => {}}
      onSelectArtifactSuggestion={() => {}}
      onCompleteAndFinalize={() => {}}
      onFinalizeRecommendation={() => {}}
    />,
  );

  assert.match(
    markup,
    /自动治理检查已完成，请先核对机器证据，再执行最终定稿。/,
  );
  assert.match(markup, /完成建议定稿/);
  assert.match(markup, /Automatic governed browser QA passed for Editing Output Check/);
  assert.doesNotMatch(markup, /完成运行并定稿/);
});

test("evaluation workbench finalize panel keeps the legacy completion path for queued sample-backed runs", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchFinalizePanel
      selectedRun={{
        id: "run-queued-1",
        suite_id: "suite-1",
        sample_set_id: "sample-set-1",
        run_item_count: 1,
        status: "queued",
        evidence_ids: [],
        started_at: "2026-04-03T08:00:00.000Z",
      }}
      effectiveFinalizedResult={null}
      finalizeForm={{
        status: "failed",
        evidenceKind: "artifact",
        evidenceLabel: "Result asset evidence",
        evidenceUrl: "",
        artifactAssetId: "human-final-demo-1",
      }}
      finalizeArtifactOptions={[
        {
          source: "result_asset",
          assetId: "human-final-demo-1",
          actionLabel: "Use Result Asset (human-final-demo-1)",
        },
      ]}
      selectedRunEvidence={[]}
      isBusy={false}
      onFinalizeStatusChange={() => {}}
      onEvidenceKindChange={() => {}}
      onEvidenceLabelChange={() => {}}
      onEvidenceUrlChange={() => {}}
      onArtifactAssetIdChange={() => {}}
      onSelectArtifactSuggestion={() => {}}
      onCompleteAndFinalize={() => {}}
      onFinalizeRecommendation={() => {}}
    />,
  );

  assert.match(markup, /运行状态/);
  assert.match(markup, /证据标签/);
  assert.match(markup, /完成运行并定稿/);
  assert.doesNotMatch(
    markup,
    /自动治理检查已完成，请先核对机器证据，再执行最终定稿。/,
  );
});

test("evaluation workbench evidence pack summary renders labeled outcome fields", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchEvidencePackSummary
      evidencePack={{
        id: "pack-1",
        experiment_run_id: "run-1",
        summary_status: "recommended",
        score_summary: "Average weighted score 94.0 across 1 item(s).",
        regression_summary: "No regression failures were recorded.",
        failure_summary: "No failure annotations were recorded.",
        cost_summary: "Cost tracking is not recorded in Phase 6A v1.",
        latency_summary: "Latency tracking is not recorded in Phase 6A v1.",
        created_at: "2026-04-02T08:15:00.000Z",
      }}
    />,
  );

  assert.match(markup, /摘要状态/);
  assert.match(markup, /可推荐/);
  assert.match(markup, /评分摘要/);
  assert.match(markup, /平均加权得分 94.0（共 1 条）/);
  assert.match(markup, /回归摘要/);
  assert.match(markup, /未发现回归失败。/);
  assert.match(markup, /失败摘要/);
  assert.match(markup, /未记录失败标注。/);
  assert.match(markup, /成本摘要/);
  assert.match(markup, /时延摘要/);
});

test("evaluation workbench history entry signals render structured list summaries", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchHistoryEntrySignals
      entry={{
        run: {
          id: "run-history-1",
        },
        finalized: {
          recommendation: {
            status: "rejected",
          },
          evidence_pack: {
            score_summary: "Average weighted score 52.0 across 1 item(s).",
            regression_summary: "1 regression-failed item(s) detected.",
            failure_summary: "Structure regression triggered the hard gate.",
          },
        },
      } as never}
    />,
  );

  assert.match(markup, /评分:/);
  assert.match(markup, /平均加权得分 52.0（共 1 条）/);
  assert.match(markup, /回归:/);
  assert.match(markup, /检测到 1 条回归失败项。/);
  assert.match(markup, /失败:/);
  assert.match(markup, /结构回归触发了硬门限。/);
});

test("evaluation workbench linked sample context list renders run-item sample mappings", () => {
  const focusedRunItems: string[] = [];
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchLinkedSampleContextList
      runItems={[
        {
          id: "run-item-1",
          lane: "candidate",
          sample_set_item_id: "sample-item-1",
          result_asset_id: "result-asset-1",
          weighted_score: 91,
          failure_kind: "regression_failed",
          failure_reason: "Structure regression triggered the hard gate.",
        },
      ] as never}
      sampleSetItems={[
        {
          id: "sample-item-1",
          module: "structure",
          manuscript_type: "clinical_study",
          snapshot_asset_id: "snapshot-asset-1",
          reviewed_case_snapshot_id: "reviewed-case-snapshot-1",
          manuscript_id: "manuscript-1",
        },
      ] as never}
      selectedRunItemId="run-item-1"
      defaultWorkbenchMode="editing"
      onFocusRunItem={(runItemId) => {
        focusedRunItems.push(runItemId);
      }}
    />,
  );

  assert.match(markup, /关联样本上下文/);
  assert.match(markup, /运行条目：run-item-1/);
  assert.match(markup, /候选/);
  assert.match(markup, /样本条目：sample-item-1/);
  assert.match(markup, /structure/);
  assert.match(markup, /clinical study/);
  assert.match(markup, /reviewed-case-snapshot-1/);
  assert.match(markup, /加权得分：91/);
  assert.match(markup, /Structure regression triggered the hard gate\./);
  assert.match(markup, /当前聚焦/);
  assert.match(markup, /查看运行条目 run-item-1/);
  assert.match(markup, /下载结果制品/);
  assert.match(markup, /\/api\/v1\/document-assets\/result-asset-1\/download/);
  assert.match(markup, /下载样本快照/);
  assert.match(markup, /\/api\/v1\/document-assets\/snapshot-asset-1\/download/);
  assert.match(markup, /打开编辑工作台/);
  assert.match(
    markup,
    /#editing\?manuscriptId=manuscript-1&amp;reviewedCaseSnapshotId=reviewed-case-snapshot-1&amp;sampleSetItemId=sample-item-1/,
  );
  assert.deepEqual(focusedRunItems, []);
});

test("evaluation workbench linked sample context falls back to manuscript-only handoff when sample context is unavailable", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchLinkedSampleContextList
      runItems={[
        {
          id: "run-item-1",
          lane: "candidate",
          sample_set_item_id: "",
          result_asset_id: "result-asset-1",
          weighted_score: 91,
        },
      ] as never}
      sampleSetItems={[
        {
          id: "",
          module: "editing",
          manuscript_type: "clinical_study",
          snapshot_asset_id: "snapshot-asset-1",
          reviewed_case_snapshot_id: "  ",
          manuscript_id: "manuscript-1",
        },
      ] as never}
      selectedRunItemId="run-item-1"
      defaultWorkbenchMode="editing"
    />,
  );

  assert.match(markup, /打开编辑工作台/);
  assert.match(markup, /#editing\?manuscriptId=manuscript-1/);
  assert.doesNotMatch(markup, /reviewedCaseSnapshotId=/);
  assert.doesNotMatch(markup, /sampleSetItemId=/);
});

test("describeGovernedLearningHandoffGuidance explains why learning handoff is unavailable without reviewed snapshot context", () => {
  assert.equal(
    describeGovernedLearningHandoffGuidance({
      hasFinalizedResult: true,
      hasLinkedSampleContext: false,
      hasGovernedSource: true,
    }),
    "治理来源运行在关联复核快照前，暂不能进入学习回流。",
  );

  assert.equal(
    describeGovernedLearningHandoffGuidance({
      hasFinalizedResult: true,
      hasLinkedSampleContext: true,
      hasGovernedSource: true,
    }),
    null,
  );
});

test("describeHistoryComparisonGuidance explains why history compare is unavailable", () => {
  assert.equal(
    describeHistoryComparisonGuidance({
      selectedRun: {
        id: "run-2",
        status: "running",
      } as never,
      selectedRunHistoryEntry: null,
      previousRunHistoryEntry: null,
    }),
    "当前运行 run-2 状态仍为 运行中，请先完成运行并定稿后再进行历史对照。",
  );

  assert.equal(
    describeHistoryComparisonGuidance({
      selectedRun: {
        id: "run-governed-2",
        status: "passed",
        governed_source: {
          source_kind: "governed_module_execution",
          manuscript_id: "manuscript-1",
          source_module: "editing",
          agent_execution_log_id: "execution-log-2",
          execution_snapshot_id: "execution-snapshot-2",
          output_asset_id: "output-asset-2",
        },
      } as never,
      selectedRunHistoryEntry: null,
      previousRunHistoryEntry: null,
    }),
    "当前运行 run-governed-2 已完成自动治理检查，请先完成建议定稿后再进行历史对照。",
  );

  assert.equal(
    describeHistoryComparisonGuidance({
      selectedRun: {
        id: "run-2",
        status: "passed",
      } as never,
      selectedRunHistoryEntry: {
        run: {
          id: "run-2",
        },
      } as never,
      previousRunHistoryEntry: null,
    }),
    "请先在该套件内再完成 1 条运行定稿，才能与历史进行对照。",
  );

  assert.equal(
    describeHistoryComparisonGuidance({
      selectedRun: {
        id: "run-2",
        status: "passed",
      } as never,
      selectedRunHistoryEntry: {
        run: {
          id: "run-2",
        },
      } as never,
      previousRunHistoryEntry: null,
      scope: "manuscript",
      totalFinalizedCount: 3,
      scopedCount: 1,
    }),
    "当前稿件仅有 1 条已定稿运行，可切换到全部套件历史查看更广范围的对照。",
  );

  assert.equal(
    describeHistoryComparisonGuidance({
      selectedRun: null,
      selectedRunHistoryEntry: null,
      previousRunHistoryEntry: null,
    }),
    "请先选择一条已定稿运行，用于与套件历史对照。",
  );

  assert.equal(
    describeHistoryComparisonGuidance({
      selectedRun: {
        id: "run-2",
        status: "passed",
      } as never,
      selectedRunHistoryEntry: {
        run: {
          id: "run-2",
        },
      } as never,
      previousRunHistoryEntry: {
        run: {
          id: "run-1",
        },
      } as never,
    }),
    null,
  );
});

test("describeHistoryComparisonGuidanceSummary explains the next compare recovery step", () => {
  assert.equal(
    describeHistoryComparisonGuidanceSummary({
      selectedRun: {
        id: "run-2",
        status: "running",
      } as never,
      selectedRunHistoryEntry: null,
      previousRunHistoryEntry: null,
    }),
    "当该运行生成已定稿建议并保存证据后，才可开启结果对照。",
  );

  assert.equal(
    describeHistoryComparisonGuidanceSummary({
      selectedRun: {
        id: "run-2",
        status: "passed",
      } as never,
      selectedRunHistoryEntry: {
        run: {
          id: "run-2",
        },
      } as never,
      previousRunHistoryEntry: null,
      scope: "manuscript",
      totalFinalizedCount: 3,
      scopedCount: 1,
    }),
    "更广范围的套件历史中已有 2 条额外已定稿运行可用于对照。",
  );

  assert.equal(
    describeHistoryComparisonGuidanceSummary({
      selectedRun: {
        id: "run-2",
        status: "passed",
      } as never,
      selectedRunHistoryEntry: {
        run: {
          id: "run-2",
        },
      } as never,
      previousRunHistoryEntry: null,
      scope: "suite",
      totalFinalizedCount: 1,
      scopedCount: 1,
    }),
    "当前套件历史中仅有这 1 条已定稿运行，暂时没有更早的基线。",
  );
});

test("describeHistoryComparisonRoleLabels marks selected and baseline history runs", () => {
  assert.deepEqual(
    describeHistoryComparisonRoleLabels({
      entryRunId: "run-2",
      selectedRunId: "run-2",
      previousRunId: "run-1",
    }),
    ["当前运行"],
  );

  assert.deepEqual(
    describeHistoryComparisonRoleLabels({
      entryRunId: "run-1",
      selectedRunId: "run-2",
      previousRunId: "run-1",
    }),
    ["对照基线"],
  );

  assert.deepEqual(
    describeHistoryComparisonRoleLabels({
      entryRunId: "run-3",
      selectedRunId: "run-2",
      previousRunId: "run-1",
    }),
    [],
  );
});

test("describeHistoryStatusPair formats recommendation and summary status with a readable separator", () => {
  assert.equal(
    describeHistoryStatusPair("recommended", "needs_review"),
    "可推荐 / 待复核",
  );
});

test("summarizeFinalizedEntry joins fields with a readable separator", () => {
  assert.equal(
    summarizeFinalizedEntry({
      run: {
        finished_at: "2026-04-01T07:20:00.000Z",
      },
      finalized: {
        recommendation: {
          decision_reason: "Accepted output",
        },
      },
    } as never),
    "Accepted output | 完成于 2026-04-01T07:20:00.000Z",
  );
});

test("describeHistoryEntryOriginLabel distinguishes current manuscript from broader suite history", () => {
  assert.equal(
    describeHistoryEntryOriginLabel({
      runId: "run-2",
      matchedRunIds: ["run-2", "run-1"],
      hasManuscriptContext: true,
      scope: "suite",
    }),
    "当前稿件",
  );

  assert.equal(
    describeHistoryEntryOriginLabel({
      runId: "run-3",
      matchedRunIds: ["run-2", "run-1"],
      hasManuscriptContext: true,
      scope: "suite",
    }),
    "更广范围套件",
  );

  assert.equal(
    describeHistoryEntryOriginLabel({
      runId: "run-2",
      matchedRunIds: ["run-2", "run-1"],
      hasManuscriptContext: true,
      scope: "manuscript",
    }),
    "命中稿件",
  );

  assert.equal(
    describeHistoryEntryOriginLabel({
      runId: "run-2",
      matchedRunIds: ["run-2", "run-1"],
      hasManuscriptContext: false,
      scope: "suite",
    }),
    null,
  );
});

test("describeHistoryOriginSummary counts manuscript and broader-suite runs", () => {
  assert.equal(
    describeHistoryOriginSummary({
      runIds: ["run-2", "run-3", "run-1"],
      matchedRunIds: ["run-2", "run-1"],
      hasManuscriptContext: true,
      scope: "suite",
    }),
    "当前稿件运行：2 | 更广范围套件参考：1",
  );

  assert.equal(
    describeHistoryOriginSummary({
      runIds: ["run-2", "run-1"],
      matchedRunIds: ["run-2", "run-1"],
      hasManuscriptContext: true,
      scope: "manuscript",
    }),
    "命中稿件运行：2",
  );

  assert.equal(
    describeHistoryOriginSummary({
      runIds: ["run-2"],
      matchedRunIds: ["run-2"],
      hasManuscriptContext: false,
      scope: "suite",
    }),
    null,
  );
});

test("describeComparisonOperatorSummary summarizes compare outcomes for operators", () => {
  assert.equal(
    describeComparisonOperatorSummary({
      comparisonScopeLabel: "更广范围套件历史",
      selectedStatus: "recommended",
      previousStatus: "recommended",
      selectedScoreSummary: "Average weighted score 97.0 across 1 item(s).",
      previousScoreSummary: "Average weighted score 91.0 across 1 item(s).",
    }),
    "操作摘要：相较于更广范围套件历史，在维持可推荐的同时提升了 6.0 分。",
  );

  assert.equal(
    describeComparisonOperatorSummary({
      comparisonScopeLabel: "全部套件历史",
      selectedStatus: "rejected",
      previousStatus: "recommended",
      selectedScoreSummary: "Average weighted score 52.0 across 1 item(s).",
      previousScoreSummary: "Average weighted score 91.0 across 1 item(s).",
    }),
    "操作摘要：相较于全部套件历史，结果从可推荐变为已拒绝，并下降 39.0 分。",
  );

  assert.equal(
    describeComparisonOperatorSummary({
      comparisonScopeLabel: "命中稿件历史",
      selectedStatus: "recommended",
      previousStatus: "recommended",
      selectedScoreSummary: "Average weighted score 91.0 across 1 item(s).",
      previousScoreSummary: "Average weighted score 91.0 across 1 item(s).",
    }),
    "操作摘要：相较于命中稿件历史，当前结果保持在可推荐。",
  );
});

test("describeComparisonTriageHint recommends next operator action", () => {
  assert.equal(
    describeComparisonTriageHint({
      selectedStatus: "recommended",
      previousStatus: "recommended",
      scoreDelta: 6,
    }),
    "建议动作：可推进候选版本",
  );

  assert.equal(
    describeComparisonTriageHint({
      selectedStatus: "recommended",
      previousStatus: "recommended",
      scoreDelta: 0,
    }),
    "建议动作：继续观察后再推进",
  );

  assert.equal(
    describeComparisonTriageHint({
      selectedStatus: "needs_review",
      previousStatus: "recommended",
      scoreDelta: -8,
    }),
    "建议动作：转人工复核",
  );

  assert.equal(
    describeComparisonTriageHint({
      selectedStatus: "rejected",
      previousStatus: "recommended",
      scoreDelta: -39,
    }),
    "建议动作：排查回归原因",
  );
});

test("describeComparisonBaselinePolicy explains how the compare baseline is chosen", () => {
  assert.equal(
    describeComparisonBaselinePolicy("全部套件历史"),
    "基线策略：按时间顺序选择全部套件历史中的上一条已定稿运行。",
  );

  assert.equal(
    describeComparisonBaselinePolicy("更广范围套件历史"),
    "基线策略：按时间顺序选择更广范围套件历史中的上一条已定稿运行。",
  );

  assert.equal(
    describeComparisonBaselinePolicy("命中稿件历史"),
    "基线策略：按时间顺序选择命中稿件历史中的上一条已定稿运行。",
  );
});

test("summarizeEvidencePackChanges lists only changed evidence-pack fields", () => {
  assert.deepEqual(
    summarizeEvidencePackChanges(
      {
        summary_status: "needs_review",
        score_summary: "Average weighted score 84.0 across 1 item(s).",
        regression_summary: "Regression drift detected in terminology consistency.",
        failure_summary: "One hard gate warning remains open.",
        cost_summary: "Average cost $0.18 per item.",
        latency_summary: "Average latency 7.2 seconds.",
      } as never,
      {
        summary_status: "recommended",
        score_summary: "Average weighted score 91.0 across 1 item(s).",
        regression_summary: "No regression failures were recorded.",
        failure_summary: "No failure annotations were recorded.",
        cost_summary: "Average cost $0.12 per item.",
        latency_summary: "Average latency 5.1 seconds.",
      } as never,
    ),
    [
      "摘要状态：待复核（原为 可推荐）",
      "评分摘要：平均加权得分 84.0（共 1 条）（原为 平均加权得分 91.0（共 1 条））",
      "回归摘要：检测到 terminology consistency 的回归漂移。（原为 未发现回归失败。）",
      "失败摘要：仍有 1 项硬门限告警待处理。（原为 未记录失败标注。）",
      "成本摘要：Average cost $0.18 per item.（原为 Average cost $0.12 per item.）",
      "时延摘要：Average latency 7.2 seconds.（原为 Average latency 5.1 seconds.）",
    ],
  );
});

test("summarizeBindingChanges normalizes optional harness binding ids when they are absent", () => {
  assert.deepEqual(
    summarizeBindingChanges(
      {
        baseline_binding: {
          lane: "baseline",
          model_id: "baseline-model-2",
          runtime_id: "baseline-runtime-2",
          prompt_template_id: "baseline-prompt-2",
          skill_package_ids: ["baseline-skill-1"],
          module_template_id: "baseline-template-2",
        },
        candidate_binding: {
          lane: "candidate",
          model_id: "candidate-model-2",
          runtime_id: "candidate-runtime-2",
          prompt_template_id: "candidate-prompt-2",
          skill_package_ids: ["candidate-skill-1"],
          module_template_id: "candidate-template-2",
        },
      } as never,
      {
        baseline_binding: {
          lane: "baseline",
          execution_profile_id: "profile-baseline-1",
          runtime_binding_id: "binding-baseline-1",
          model_routing_policy_version_id: "routing-baseline-1",
          retrieval_preset_id: "retrieval-baseline-1",
          manual_review_policy_id: "manual-review-baseline-1",
          model_id: "baseline-model-1",
          runtime_id: "baseline-runtime-1",
          prompt_template_id: "baseline-prompt-1",
          skill_package_ids: ["baseline-skill-1"],
          module_template_id: "baseline-template-1",
        },
        candidate_binding: {
          lane: "candidate",
          execution_profile_id: "profile-candidate-1",
          runtime_binding_id: "binding-candidate-1",
          model_routing_policy_version_id: "routing-candidate-1",
          retrieval_preset_id: "retrieval-candidate-1",
          manual_review_policy_id: "manual-review-candidate-1",
          model_id: "candidate-model-1",
          runtime_id: "candidate-runtime-1",
          prompt_template_id: "candidate-prompt-1",
          skill_package_ids: ["candidate-skill-1"],
          module_template_id: "candidate-template-1",
        },
      } as never,
    ),
    [
      "基线模型：baseline-model-2（原为 baseline-model-1）",
      "基线运行时：baseline-runtime-2（原为 baseline-runtime-1）",
      "基线执行配置：未记录（原为 profile-baseline-1）",
      "基线运行时绑定：未记录（原为 binding-baseline-1）",
      "基线路由版本：未记录（原为 routing-baseline-1）",
      "基线检索预设：未记录（原为 retrieval-baseline-1）",
      "基线人工复核策略：未记录（原为 manual-review-baseline-1）",
      "基线提示模版：baseline-prompt-2（原为 baseline-prompt-1）",
      "基线模块模版：baseline-template-2（原为 baseline-template-1）",
      "候选模型：candidate-model-2（原为 candidate-model-1）",
      "候选运行时：candidate-runtime-2（原为 candidate-runtime-1）",
      "候选执行配置：未记录（原为 profile-candidate-1）",
      "候选运行时绑定：未记录（原为 binding-candidate-1）",
      "候选路由版本：未记录（原为 routing-candidate-1）",
      "候选检索预设：未记录（原为 retrieval-candidate-1）",
      "候选人工复核策略：未记录（原为 manual-review-candidate-1）",
      "候选提示模版：candidate-prompt-2（原为 candidate-prompt-1）",
      "候选模块模版：candidate-template-2（原为 candidate-template-1）",
    ],
  );
});

test("describeHistoryVisibilitySummary explains how current controls narrow history", () => {
  assert.equal(
    describeHistoryVisibilitySummary({
      visibleCount: 1,
      totalCount: 2,
      scope: "suite",
      filter: "all",
      searchQuery: "run-1",
      sortMode: "newest",
      selectedRunId: "run-2",
      selectedRunHidden: true,
    }),
    '可见性摘要：1 / 2 条已定稿运行处于套件范围内。 当前条件：搜索“run-1”。 当前运行 run-2 不在当前结果集中。',
  );

  assert.equal(
    describeHistoryVisibilitySummary({
      visibleCount: 0,
      totalCount: 3,
      scope: "manuscript",
      filter: "rejected",
      searchQuery: "delta",
      sortMode: "failures_first",
      selectedRunId: null,
      selectedRunHidden: false,
    }),
    '可见性摘要：0 / 3 条已定稿运行处于稿件范围内。 当前条件：筛选 已拒绝，搜索“delta”，排序 失败优先。',
  );
});

test("describeHistoryControlSummaryLines formats readable labels for history controls", () => {
  assert.deepEqual(
    describeHistoryControlSummaryLines({
      scope: "suite",
      filter: "all",
      searchQuery: "",
      sortMode: "newest",
    }),
    [
      "范围：全部套件历史",
      "筛选：全部已定稿运行",
      "搜索：无",
      "排序：最新优先",
    ],
  );

  assert.deepEqual(
    describeHistoryControlSummaryLines({
      scope: "manuscript",
      filter: "rejected",
      searchQuery: "delta",
      sortMode: "failures_first",
    }),
    [
      "范围：命中稿件运行",
      "筛选：仅已拒绝",
      "搜索：delta",
      "排序：失败优先",
    ],
  );
});

test("describeHistoryCompareStatusSummary explains whether compare remains available", () => {
  assert.equal(
    describeHistoryCompareStatusSummary({
      selectedRunHistoryEntry: { run: { id: "run-2" } },
      previousRunHistoryEntry: { run: { id: "run-1" } },
      historyComparisonGuidance: null,
      historyComparisonGuidanceSummary: null,
    } as never),
    "对照状态：当前运行与对照基线的结果摘要可用。",
  );

  assert.equal(
    describeHistoryCompareStatusSummary({
      selectedRunHistoryEntry: null,
      previousRunHistoryEntry: null,
      historyComparisonGuidance: "请先选择一条已定稿运行，用于与套件历史对照。",
      historyComparisonGuidanceSummary:
        "当前可见的套件历史中已有 2 条已定稿运行可用于选择对照。",
    } as never),
    "对照状态：当前可见的套件历史中已有 2 条已定稿运行可用于选择对照。",
  );
});

test("filterFinalizedRunHistory narrows finalized runs by recommendation status", () => {
  const entries = [
    {
      run: { id: "run-recommended" },
      finalized: { recommendation: { status: "recommended" } },
    },
    {
      run: { id: "run-needs-review" },
      finalized: { recommendation: { status: "needs_review" } },
    },
    {
      run: { id: "run-rejected" },
      finalized: { recommendation: { status: "rejected" } },
    },
  ] as const;

  assert.deepEqual(
    filterFinalizedRunHistory(entries as never, "all").map((entry) => entry.run.id),
    ["run-recommended", "run-needs-review", "run-rejected"],
  );
  assert.deepEqual(
    filterFinalizedRunHistory(entries as never, "recommended").map((entry) => entry.run.id),
    ["run-recommended"],
  );
  assert.deepEqual(
    filterFinalizedRunHistory(entries as never, "needs_review").map((entry) => entry.run.id),
    ["run-needs-review"],
  );
  assert.deepEqual(
    filterFinalizedRunHistory(entries as never, "rejected").map((entry) => entry.run.id),
    ["run-rejected"],
  );
});

test("searchFinalizedRunHistory matches run ids, model bindings, and decision text", () => {
  const entries = [
    {
      run: {
        id: "run-alpha",
        baseline_binding: { model_id: "baseline-alpha" },
        candidate_binding: { model_id: "candidate-alpha" },
      },
      finalized: {
        evidence_pack: {
          id: "pack-alpha",
          score_summary: "Alpha score summary",
          regression_summary: "No regression failures were recorded.",
          failure_summary: "None",
        },
        recommendation: {
          status: "recommended",
          decision_reason: "Alpha is safe to promote",
        },
      },
    },
    {
      run: {
        id: "run-beta",
        baseline_binding: { model_id: "baseline-beta" },
        candidate_binding: { model_id: "candidate-beta" },
      },
      finalized: {
        evidence_pack: {
          id: "pack-beta",
          score_summary: "Beta score summary",
          regression_summary: "1 regression-failed item(s) detected.",
          failure_summary: "Hard gate failure",
        },
        recommendation: {
          status: "rejected",
          decision_reason: "Beta cannot be promoted",
        },
      },
    },
  ] as const;

  assert.deepEqual(
    searchFinalizedRunHistory(entries as never, "candidate-beta").map((entry) => entry.run.id),
    ["run-beta"],
  );
  assert.deepEqual(
    searchFinalizedRunHistory(entries as never, "safe to promote").map((entry) => entry.run.id),
    ["run-alpha"],
  );
  assert.deepEqual(
    searchFinalizedRunHistory(entries as never, "run-beta").map((entry) => entry.run.id),
    ["run-beta"],
  );
  assert.deepEqual(
    searchFinalizedRunHistory(entries as never, "pack-beta").map((entry) => entry.run.id),
    ["run-beta"],
  );
  assert.deepEqual(
    searchFinalizedRunHistory(entries as never, "regression-failed item").map((entry) => entry.run.id),
    ["run-beta"],
  );
});

test("isSelectedRunHiddenFromHistoryList detects when filters hide the current run", () => {
  const entries = [
    { run: { id: "run-one" } },
    { run: { id: "run-two" } },
  ] as const;

  assert.equal(isSelectedRunHiddenFromHistoryList(entries as never, "run-two"), false);
  assert.equal(isSelectedRunHiddenFromHistoryList(entries as never, "run-three"), true);
  assert.equal(isSelectedRunHiddenFromHistoryList(entries as never, null), false);
});

test("sortFinalizedRunHistory can prioritize failures ahead of recommendations", () => {
  const entries = [
    {
      run: { id: "run-recommended", finished_at: "2026-04-01T10:00:00.000Z" },
      finalized: { recommendation: { status: "recommended" } },
    },
    {
      run: { id: "run-needs-review", finished_at: "2026-04-01T09:00:00.000Z" },
      finalized: { recommendation: { status: "needs_review" } },
    },
    {
      run: { id: "run-rejected", finished_at: "2026-04-01T08:00:00.000Z" },
      finalized: { recommendation: { status: "rejected" } },
    },
  ] as const;

  assert.deepEqual(
    sortFinalizedRunHistory(entries as never, "newest").map((entry) => entry.run.id),
    ["run-recommended", "run-needs-review", "run-rejected"],
  );
  assert.deepEqual(
    sortFinalizedRunHistory(entries as never, "failures_first").map((entry) => entry.run.id),
    ["run-rejected", "run-needs-review", "run-recommended"],
  );
});

test("evaluation workbench selected run detail surfaces governed harness binding ids without exposing activation controls", () => {
  const markup = renderToStaticMarkup(
    <EvaluationWorkbenchSelectedRunItemDetailCard
      selectedRun={{
        id: "run-1",
        suite_id: "suite-1",
        sample_set_id: "sample-set-1",
        baseline_binding: {
          lane: "baseline",
          execution_profile_id: "profile-active-1",
          runtime_binding_id: "binding-active-1",
          model_routing_policy_version_id: "routing-active-1",
          retrieval_preset_id: "retrieval-active-1",
          manual_review_policy_id: "manual-review-active-1",
          model_id: "model-active-1",
          runtime_id: "runtime-active-1",
          prompt_template_id: "prompt-active-1",
          skill_package_ids: ["skill-active-1"],
          module_template_id: "template-active-1",
        },
        candidate_binding: {
          lane: "candidate",
          execution_profile_id: "profile-preview-2",
          runtime_binding_id: "binding-preview-2",
          model_routing_policy_version_id: "routing-preview-2",
          retrieval_preset_id: "retrieval-preview-2",
          manual_review_policy_id: "manual-review-preview-2",
          model_id: "model-preview-2",
          runtime_id: "runtime-preview-2",
          prompt_template_id: "prompt-preview-2",
          skill_package_ids: ["skill-preview-2"],
          module_template_id: "template-preview-2",
        },
        release_check_profile_id: "release-1",
        run_item_count: 1,
        status: "passed",
        evidence_ids: [],
        started_at: "2026-04-01T08:00:00.000Z",
      } as never}
      selectedRunItem={{
        id: "run-item-1",
        evaluation_run_id: "run-1",
        sample_set_item_id: "sample-item-1",
        lane: "candidate",
        result_asset_id: "asset-1",
        hard_gate_passed: true,
        weighted_score: 94,
        requires_human_review: false,
      }}
      linkedSampleSetItem={null}
    />,
  );

  assert.match(markup, /执行配置/i);
  assert.match(markup, /检索预设/i);
  assert.match(markup, /人工复核策略/i);
  assert.match(markup, /profile-preview-2/);
  assert.match(markup, /retrieval-preview-2/);
  assert.match(markup, /manual-review-preview-2/);
  assert.doesNotMatch(markup, /Activate/i);
  assert.doesNotMatch(markup, /Rollback/i);
});

