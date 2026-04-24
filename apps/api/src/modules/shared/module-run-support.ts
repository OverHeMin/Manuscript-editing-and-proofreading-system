import type { RoleKey } from "../../users/roles.ts";
import type {
  ManuscriptQualityPackageKind,
  ModuleExecutionMode,
} from "@medical/contracts";
import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { ResolvedModelSelection } from "../ai-gateway/ai-gateway-service.ts";
import type { KnowledgeRecord } from "../knowledge/knowledge-record.ts";
import type { KnowledgeRepository } from "../knowledge/knowledge-repository.ts";
import type { ManuscriptRecord } from "../manuscripts/manuscript-record.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import type { RetrievalPresetRecord } from "../retrieval-presets/retrieval-preset-record.ts";
import type {
  ModuleTemplateRecord,
  TemplateModule,
} from "../templates/template-record.ts";
import type { ModuleTemplateRepository } from "../templates/template-repository.ts";
import type { SeedGovernedExecutionRunsInput } from "../verification-ops/verification-ops-service.ts";
import type { EvaluationRunRecord } from "../verification-ops/verification-ops-record.ts";

export const GOVERNED_MANUSCRIPT_MAINLINE_MODULES = [
  "screening",
  "editing",
  "proofreading",
] as const satisfies readonly TemplateModule[];

export interface PrepareModuleExecutionInput {
  manuscriptId: string;
  module: TemplateModule;
  jobId: string;
  actorId: string;
  actorRole: RoleKey;
  manuscriptRepository: ManuscriptRepository;
  moduleTemplateRepository: ModuleTemplateRepository;
  knowledgeRepository: KnowledgeRepository;
  aiGatewayService: AiGatewayService;
}

export interface PreparedModuleExecution {
  manuscript: ManuscriptRecord;
  template: ModuleTemplateRecord;
  knowledgeItems: KnowledgeRecord[];
  modelSelection: ResolvedModelSelection;
}

export interface DynamicKnowledgeSelection {
  knowledgeItem: KnowledgeRecord;
  matchSource: "template_binding" | "dynamic_routing";
  matchSourceId?: string;
  matchReasons: string[];
  retrievalScore?: number;
}

export interface ActiveQualityPackageBindingContext {
  packageId: string;
  packageKind: ManuscriptQualityPackageKind;
}

interface ResolvedKnowledgeBindingMatch {
  usesBinding: boolean;
  matchReasons: string[];
  matchSourceId?: string;
  bindingPriority: number;
}

interface MatchedKnowledgeBindingReason {
  reason:
    | "template_family"
    | "module_template"
    | "journal_template"
    | "general_package"
    | "medical_package";
  sourceId: string;
  priority: number;
}

export interface ModuleExecutionResult<TJob, TAsset> {
  job: TJob;
  asset: TAsset;
  template_id: string;
  knowledge_item_ids: string[];
  model_id: string;
  execution_profile_id?: string;
  prompt_template_id?: string;
  skill_package_ids?: string[];
  snapshot_id?: string;
  agent_runtime_id?: string;
  agent_profile_id?: string;
  agent_execution_log_id?: string;
}

export function resolveModuleExecutionMode(
  executionMode?: ModuleExecutionMode,
): ModuleExecutionMode {
  return executionMode ?? "governed";
}

export interface GovernedEvaluationRunSeeder {
  seedGovernedExecutionRuns(
    actorRole: RoleKey,
    input: SeedGovernedExecutionRunsInput,
  ): Promise<EvaluationRunRecord[]>;
  executeSeededGovernedRunChecks(
    actorRole: RoleKey,
    input: {
      runId: string;
    },
  ): Promise<EvaluationRunRecord>;
}

export interface AgentExecutionEvidenceAppender {
  appendVerificationEvidence(input: {
    logId: string;
    evidenceIds: string[];
  }): Promise<unknown>;
}

export interface GovernedExecutionOrchestrationDispatcher {
  dispatchBestEffort(logId: string): Promise<unknown>;
}

export class ModuleTemplateFamilyNotConfiguredError extends Error {
  constructor(manuscriptId: string) {
    super(`Manuscript ${manuscriptId} does not have a current template family.`);
    this.name = "ModuleTemplateFamilyNotConfiguredError";
  }
}

export class PublishedModuleTemplateNotFoundError extends Error {
  constructor(templateFamilyId: string, module: string) {
    super(
      `Template family ${templateFamilyId} does not have a published ${module} template.`,
    );
    this.name = "PublishedModuleTemplateNotFoundError";
  }
}

export class ModuleManuscriptNotFoundError extends Error {
  constructor(manuscriptId: string) {
    super(`Manuscript ${manuscriptId} was not found.`);
    this.name = "ModuleManuscriptNotFoundError";
  }
}

export function selectApprovedDynamicKnowledge(
  input: {
    manuscript: ManuscriptRecord;
    module: TemplateModule;
    template: ModuleTemplateRecord;
    knowledgeItems: KnowledgeRecord[];
    retrievalPreset?: RetrievalPresetRecord;
    qualityPackageVersionIds?: string[];
    activeQualityPackages?: readonly ActiveQualityPackageBindingContext[];
  },
): DynamicKnowledgeSelection[] {
  const candidates = input.knowledgeItems
    .filter((record) => record.status === "approved")
    .filter(
      (record) =>
        record.routing.module_scope === "any" ||
        record.routing.module_scope === input.module,
    )
    .filter(
      (record) =>
        record.routing.manuscript_types === "any" ||
        record.routing.manuscript_types.includes(input.manuscript.manuscript_type),
    )
    .reduce<
      Array<{
        selection: DynamicKnowledgeSelection;
        bindingPriority: number;
      }>
    >((result, knowledgeItem) => {
      const bindingMatch = resolveKnowledgeBindingMatch({
        manuscript: input.manuscript,
        template: input.template,
        knowledgeItem,
        qualityPackageVersionIds: input.qualityPackageVersionIds,
        activeQualityPackages: input.activeQualityPackages,
      });
      if (!bindingMatch) {
        return result;
      }

      const retrievalScore = input.retrievalPreset
        ? scoreKnowledgeForPreset({
            knowledgeItem,
            retrievalPreset: input.retrievalPreset,
            bindingPriority: bindingMatch.bindingPriority,
          })
        : undefined;
      if (input.retrievalPreset && retrievalScore === undefined) {
        return result;
      }

      result.push({
        selection: {
          knowledgeItem,
          matchSource: bindingMatch.usesBinding
            ? "template_binding"
            : "dynamic_routing",
          ...(bindingMatch.matchSourceId
            ? { matchSourceId: bindingMatch.matchSourceId }
            : {}),
          matchReasons: [
            ...(knowledgeItem.routing.module_scope === input.module ? ["module"] : []),
            ...(
              knowledgeItem.routing.manuscript_types !== "any" &&
              knowledgeItem.routing.manuscript_types.includes(
                input.manuscript.manuscript_type,
              )
                ? ["manuscript_type"]
                : []
            ),
            ...(bindingMatch.usesBinding
              ? bindingMatch.matchReasons
              : ["dynamic_routing"]),
          ],
          ...(retrievalScore !== undefined ? { retrievalScore } : {}),
        },
        bindingPriority: bindingMatch.bindingPriority,
      });

      return result;
    }, []);

  if (!input.retrievalPreset) {
    return candidates
      .sort(
        (left, right) =>
          right.bindingPriority - left.bindingPriority ||
          left.selection.knowledgeItem.id.localeCompare(
            right.selection.knowledgeItem.id,
          ),
      )
      .map((candidate) => candidate.selection);
  }

  return candidates
    .sort(
      (left, right) =>
        (right.selection.retrievalScore ?? 0) - (left.selection.retrievalScore ?? 0) ||
        right.bindingPriority - left.bindingPriority ||
        left.selection.knowledgeItem.id.localeCompare(
          right.selection.knowledgeItem.id,
        ),
    )
    .slice(0, input.retrievalPreset.top_k)
    .map((candidate) => candidate.selection);
}

function resolveKnowledgeBindingMatch(input: {
  manuscript: ManuscriptRecord;
  template: ModuleTemplateRecord;
  knowledgeItem: KnowledgeRecord;
  qualityPackageVersionIds?: string[];
  activeQualityPackages?: readonly ActiveQualityPackageBindingContext[];
}): ResolvedKnowledgeBindingMatch | undefined {
  const matchedReasons: MatchedKnowledgeBindingReason[] = [];
  const templateFamilyId = input.manuscript.current_template_family_id;
  const journalTemplateId = input.manuscript.current_journal_template_id;
  const qualityPackageVersionIds = new Set(input.qualityPackageVersionIds ?? []);
  const activeQualityPackages = input.activeQualityPackages ?? [];
  const bindingTargets = input.knowledgeItem.binding_targets;

  if (hasStructuredBindingTargets(bindingTargets)) {
    if (
      !pushStructuredBindingMatch({
        targetIds: bindingTargets?.template_family_ids,
        activeId: templateFamilyId,
        reason: "template_family",
        priority: 1,
        matchedReasons,
      })
    ) {
      return undefined;
    }
    if (
      !pushStructuredBindingMatch({
        targetIds: bindingTargets?.module_template_ids,
        activeId: input.template.id,
        reason: "module_template",
        priority: 2,
        matchedReasons,
      })
    ) {
      return undefined;
    }
    if (
      !pushStructuredBindingMatch({
        targetIds: bindingTargets?.journal_template_ids,
        activeId: journalTemplateId,
        reason: "journal_template",
        priority: 3,
        matchedReasons,
      })
    ) {
      return undefined;
    }
    if (
      !pushPackageBindingMatch({
        targetIds: bindingTargets?.general_package_ids,
        activeVersionIds: qualityPackageVersionIds,
        activeQualityPackages,
        reason: "general_package",
        matchedReasons,
      })
    ) {
      return undefined;
    }
    if (
      !pushPackageBindingMatch({
        targetIds: bindingTargets?.medical_package_ids,
        activeVersionIds: qualityPackageVersionIds,
        activeQualityPackages,
        reason: "medical_package",
        matchedReasons,
      })
    ) {
      return undefined;
    }
  } else {
    const legacyTemplateBindings =
      input.knowledgeItem.template_bindings?.filter(
        (binding) => typeof binding === "string" && binding.trim().length > 0,
      ) ?? [];
    const legacyJournalTemplateId =
      input.knowledgeItem.projection_source?.projection_context?.journal_template_id;
    if (legacyJournalTemplateId) {
      if (journalTemplateId !== legacyJournalTemplateId) {
        return undefined;
      }
      matchedReasons.push({
        reason: "journal_template",
        sourceId: `journal_template:${legacyJournalTemplateId}`,
        priority: 3,
      });
    }
    if (legacyTemplateBindings.length > 0) {
      const legacyTemplateMatches = resolveLegacyTemplateBindingMatches({
        manuscript: input.manuscript,
        template: input.template,
        templateBindings: legacyTemplateBindings,
      });
      if (legacyTemplateMatches.length === 0) {
        return undefined;
      }
      matchedReasons.push(...legacyTemplateMatches);
    }
  }

  if (matchedReasons.length === 0) {
    return {
      usesBinding: false,
      matchReasons: [],
      bindingPriority: 0,
    };
  }

  const primaryMatch = matchedReasons.reduce((highest, current) =>
    current.priority > highest.priority ? current : highest,
  );

  return {
    usesBinding: true,
    matchReasons: dedupeMatchReasons(matchedReasons),
    matchSourceId: primaryMatch.sourceId,
    bindingPriority: primaryMatch.priority,
  };
}

function hasStructuredBindingTargets(
  bindingTargets: KnowledgeRecord["binding_targets"] | undefined,
): boolean {
  return Boolean(
    bindingTargets?.template_family_ids?.length ||
      bindingTargets?.module_template_ids?.length ||
      bindingTargets?.journal_template_ids?.length ||
      bindingTargets?.general_package_ids?.length ||
      bindingTargets?.medical_package_ids?.length,
  );
}

function pushStructuredBindingMatch(input: {
  targetIds: readonly string[] | undefined;
  activeId: string | undefined;
  reason: MatchedKnowledgeBindingReason["reason"];
  priority: number;
  matchedReasons: MatchedKnowledgeBindingReason[];
}): boolean {
  const targetIds = input.targetIds ?? [];
  if (targetIds.length === 0) {
    return true;
  }

  if (!input.activeId || !targetIds.includes(input.activeId)) {
    return false;
  }

  input.matchedReasons.push({
    reason: input.reason,
    sourceId: `${input.reason}:${input.activeId}`,
    priority: input.priority,
  });
  return true;
}

function pushPackageBindingMatch(input: {
  targetIds: readonly string[] | undefined;
  activeVersionIds: ReadonlySet<string>;
  activeQualityPackages: readonly ActiveQualityPackageBindingContext[];
  reason: "general_package" | "medical_package";
  matchedReasons: MatchedKnowledgeBindingReason[];
}): boolean {
  const targetIds = input.targetIds ?? [];
  if (targetIds.length === 0) {
    return true;
  }

  const exactVersionMatchId = targetIds.find((targetId) =>
    input.activeVersionIds.has(targetId),
  );
  if (exactVersionMatchId) {
    input.matchedReasons.push({
      reason: input.reason,
      sourceId: `${input.reason}:${exactVersionMatchId}`,
      priority: 5,
    });
    return true;
  }

  const expectedPackageKind =
    input.reason === "general_package"
      ? "general_style_package"
      : "medical_analyzer_package";
  if (!targetIds.includes(expectedPackageKind)) {
    return false;
  }

  const kindMatchedPackage = input.activeQualityPackages.find(
    (record) => record.packageKind === expectedPackageKind,
  );
  if (!kindMatchedPackage) {
    return false;
  }

  input.matchedReasons.push({
    reason: input.reason,
    sourceId: `${input.reason}_kind:${expectedPackageKind}:${kindMatchedPackage.packageId}`,
    priority: 4,
  });
  return true;
}

function resolveLegacyTemplateBindingMatches(input: {
  manuscript: ManuscriptRecord;
  template: ModuleTemplateRecord;
  templateBindings: readonly string[];
}): MatchedKnowledgeBindingReason[] {
  const matches: MatchedKnowledgeBindingReason[] = [];

  if (input.templateBindings.includes(input.template.id)) {
    matches.push({
      reason: "module_template",
      sourceId: `module_template:${input.template.id}`,
      priority: 2,
    });
  }

  const templateFamilyId = input.manuscript.current_template_family_id;
  if (templateFamilyId && input.templateBindings.includes(templateFamilyId)) {
    matches.push({
      reason: "template_family",
      sourceId: `template_family:${templateFamilyId}`,
      priority: 1,
    });
  }

  return matches;
}

function dedupeMatchReasons(
  matchedReasons: readonly MatchedKnowledgeBindingReason[],
): string[] {
  return [...new Set(matchedReasons.map((reason) => reason.reason))];
}

export async function prepareModuleExecution(
  input: PrepareModuleExecutionInput,
): Promise<PreparedModuleExecution> {
  const manuscript = await input.manuscriptRepository.findById(input.manuscriptId);

  if (!manuscript) {
    throw new ModuleManuscriptNotFoundError(input.manuscriptId);
  }

  if (!manuscript.current_template_family_id) {
    throw new ModuleTemplateFamilyNotConfiguredError(input.manuscriptId);
  }

  const templates =
    await input.moduleTemplateRepository.listByTemplateFamilyIdAndModule(
      manuscript.current_template_family_id,
      input.module,
    );
  const template = [...templates]
    .reverse()
    .find((record) => record.status === "published");

  if (!template) {
    throw new PublishedModuleTemplateNotFoundError(
      manuscript.current_template_family_id,
      input.module,
    );
  }

  const knowledgeItems = selectApprovedDynamicKnowledge({
    manuscript,
    module: input.module,
    template,
    knowledgeItems: await input.knowledgeRepository.listApproved(),
  }).map((selection) => selection.knowledgeItem);

  const modelSelection = await input.aiGatewayService.resolveModelSelection({
    module: input.module,
    templateFamilyId: manuscript.current_template_family_id,
    moduleTemplateId: template.id,
    taskId: input.jobId,
    actorId: input.actorId,
    actorRole: input.actorRole,
  });

  return {
    manuscript,
    template,
    knowledgeItems,
    modelSelection,
  };
}

function scoreKnowledgeForPreset(input: {
  knowledgeItem: KnowledgeRecord;
  retrievalPreset?: RetrievalPresetRecord;
  bindingPriority: number;
}): number | undefined {
  if (!input.retrievalPreset) {
    return undefined;
  }

  const sectionFilters = normalizeFilters(input.retrievalPreset.section_filters);
  const riskTagFilters = normalizeFilters(input.retrievalPreset.risk_tag_filters);
  const itemSections = normalizeFilters(input.knowledgeItem.routing.sections);
  const itemRiskTags = normalizeFilters(input.knowledgeItem.routing.risk_tags);

  if (sectionFilters.length > 0 && !hasAnyOverlap(itemSections, sectionFilters)) {
    return undefined;
  }
  if (riskTagFilters.length > 0 && !hasAnyOverlap(itemRiskTags, riskTagFilters)) {
    return undefined;
  }

  let score = 0.5 + resolveBindingPriorityBoost(input.bindingPriority);
  if (sectionFilters.length > 0) {
    score += 0.2;
  }
  if (riskTagFilters.length > 0) {
    score += 0.2;
  }

  if (
    input.retrievalPreset.min_retrieval_score !== undefined &&
    score < input.retrievalPreset.min_retrieval_score
  ) {
    return undefined;
  }

  return Number(score.toFixed(3));
}

function resolveBindingPriorityBoost(bindingPriority: number): number {
  switch (bindingPriority) {
    case 1:
      return 0.15;
    case 2:
      return 0.18;
    case 3:
      return 0.21;
    case 4:
      return 0.24;
    case 5:
      return 0.27;
    default:
      return 0;
  }
}

function normalizeFilters(values: readonly string[] | undefined): string[] {
  return values?.filter((value): value is string => typeof value === "string") ?? [];
}

function hasAnyOverlap(left: readonly string[], right: readonly string[]): boolean {
  return left.some((value) => right.includes(value));
}

export async function seedGovernedRunsForModuleExecution(input: {
  verificationOpsService: GovernedEvaluationRunSeeder;
  agentExecutionService: AgentExecutionEvidenceAppender;
  actorRole: RoleKey;
  suiteIds: string[];
  releaseCheckProfileId?: string;
  manuscriptId: string;
  sourceModule: TemplateModule;
  agentExecutionLogId: string;
  executionSnapshotId: string;
  outputAssetId: string;
}): Promise<void> {
  if (input.suiteIds.length === 0) {
    return;
  }

  const seededRuns = await input.verificationOpsService.seedGovernedExecutionRuns(
    input.actorRole,
    {
      suiteIds: input.suiteIds,
      releaseCheckProfileId: input.releaseCheckProfileId,
      governedSource: {
        source_kind: "governed_module_execution",
        manuscript_id: input.manuscriptId,
        source_module: input.sourceModule,
        agent_execution_log_id: input.agentExecutionLogId,
        execution_snapshot_id: input.executionSnapshotId,
        output_asset_id: input.outputAssetId,
      },
    },
  );

  const evidenceIds: string[] = [];
  for (const run of seededRuns) {
    const completedRun =
      await input.verificationOpsService.executeSeededGovernedRunChecks(
        input.actorRole,
        {
          runId: run.id,
        },
      );
    evidenceIds.push(...completedRun.evidence_ids);
  }

  await input.agentExecutionService.appendVerificationEvidence({
    logId: input.agentExecutionLogId,
    evidenceIds,
  });
}

export async function dispatchGovernedOrchestrationBestEffort(input: {
  orchestrationService: GovernedExecutionOrchestrationDispatcher;
  agentExecutionLogId?: string;
}): Promise<void> {
  if (!input.agentExecutionLogId) {
    return;
  }

  try {
    await input.orchestrationService.dispatchBestEffort(input.agentExecutionLogId);
  } catch {
    // Phase 10J keeps orchestration fail-open relative to the business path.
  }
}
