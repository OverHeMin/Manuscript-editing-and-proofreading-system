import type {
  ResidualHarnessValidationStatus,
  ResidualIssueStatus,
} from "@medical/contracts";
import { calculateResidualConfidenceBand } from "./residual-confidence.ts";
import {
  buildProofreadingResidualHints,
  type ProofreadingResidualSourceBlock,
} from "./proofreading-residual-adapter.ts";
import type { ResidualIssueRecord } from "./residual-learning-record.ts";
import type { ResidualIssueRepository } from "./residual-learning-repository.ts";
import { routeResidualIssue } from "./residual-routing.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { ManuscriptQualityIssue } from "@medical/contracts";
import type {
  CreateResidualGovernedLearningCandidateInput,
  LearningService,
} from "../learning/learning-service.ts";
import type { LearningCandidateRecord } from "../learning/learning-record.ts";
import type { RoleKey } from "../../users/roles.ts";

export interface ObserveProofreadingResidualsInput {
  manuscriptId: string;
  manuscriptType: ManuscriptType;
  executionSnapshotId: string;
  jobId?: string;
  agentExecutionLogId?: string;
  outputAssetId?: string;
  executionProfileId?: string;
  runtimeBindingId?: string;
  promptTemplateId?: string;
  knownRuleIds: string[];
  knownKnowledgeItemIds: string[];
  qualityIssues?: ManuscriptQualityIssue[];
  sourceBlocks: ProofreadingResidualSourceBlock[];
}

export interface ResidualLearningServiceOptions {
  residualIssueRepository: ResidualIssueRepository;
  learningService?: Pick<
    LearningService,
    "createResidualGovernedLearningCandidate"
  >;
  createId?: () => string;
  now?: () => Date;
}

export interface RecordResidualHarnessValidationInput {
  issueId: string;
  runId: string;
  outcome: "passed" | "failed";
}

export interface CreateLearningCandidateFromResidualIssueInput {
  issueId: string;
  requestedBy: string;
  requestedByRole?: RoleKey;
  title?: string;
  proposalText?: string;
}

export class ResidualIssueNotFoundError extends Error {
  constructor(issueId: string) {
    super(`Residual issue ${issueId} was not found.`);
    this.name = "ResidualIssueNotFoundError";
  }
}

export class ResidualLearningServiceDependencyRequiredError extends Error {
  constructor(dependency: string) {
    super(`Residual learning service requires ${dependency} for this operation.`);
    this.name = "ResidualLearningServiceDependencyRequiredError";
  }
}

export class ResidualIssueSourceAssetRequiredError extends Error {
  constructor(issueId: string) {
    super(`Residual issue ${issueId} requires a source asset for this operation.`);
    this.name = "ResidualIssueSourceAssetRequiredError";
  }
}

export class ResidualIssueCandidateRouteNotSupportedError extends Error {
  constructor(issueId: string, route: ResidualIssueRecord["recommended_route"]) {
    super(`Residual issue ${issueId} cannot create a learning candidate from route ${route}.`);
    this.name = "ResidualIssueCandidateRouteNotSupportedError";
  }
}

export class ResidualIssueNotReadyForCandidateCreationError extends Error {
  constructor(issueId: string) {
    super(`Residual issue ${issueId} is not ready to create a learning candidate.`);
    this.name = "ResidualIssueNotReadyForCandidateCreationError";
  }
}

export class ResidualLearningService {
  private readonly residualIssueRepository: ResidualIssueRepository;
  private readonly learningService?: Pick<
    LearningService,
    "createResidualGovernedLearningCandidate"
  >;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: ResidualLearningServiceOptions) {
    this.residualIssueRepository = options.residualIssueRepository;
    this.learningService = options.learningService;
    this.createId = options.createId ?? crypto.randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  listIssues(): Promise<ResidualIssueRecord[]> {
    return this.residualIssueRepository.list();
  }

  async getIssue(issueId: string): Promise<ResidualIssueRecord> {
    return this.requireIssue(issueId);
  }

  async observeProofreadingResiduals(
    input: ObserveProofreadingResidualsInput,
  ): Promise<ResidualIssueRecord[]> {
    const normalizedHints = buildProofreadingResidualHints({
      knownRuleIds: input.knownRuleIds,
      knownKnowledgeItemIds: input.knownKnowledgeItemIds,
      qualityIssues: input.qualityIssues,
      sourceBlocks: input.sourceBlocks,
    });
    const existingIssues = await this.residualIssueRepository.list();
    const timestamp = this.now().toISOString();
    const createdIssues: ResidualIssueRecord[] = [];

    for (const hint of normalizedHints) {
      const recurrenceCount =
        1 +
        existingIssues.filter(
          (issue) => issue.novelty_key === hint.novelty_key,
        ).length;
      const recommendedRoute = routeResidualIssue({
        issueType: hint.issue_type,
        riskLevel: hint.risk_level,
      });
      const harnessValidationStatus =
        recommendedRoute === "manual_only" || recommendedRoute === "evidence_only"
          ? "not_required"
          : "queued";
      const status = deriveResidualStatus(
        recommendedRoute,
        harnessValidationStatus,
      );

      const record: ResidualIssueRecord = {
        id: this.createId(),
        module: "proofreading",
        manuscript_id: input.manuscriptId,
        manuscript_type: input.manuscriptType,
        execution_snapshot_id: input.executionSnapshotId,
        issue_type: hint.issue_type,
        source_stage: hint.source_stage,
        excerpt: hint.excerpt,
        suggestion: hint.suggestion,
        rationale: hint.rationale,
        novelty_key: hint.novelty_key,
        recurrence_count: recurrenceCount,
        system_confidence_band: calculateResidualConfidenceBand({
          modelConfidence: hint.model_confidence,
          recurrenceCount,
          riskLevel: hint.risk_level,
          recommendedRoute,
          harnessValidationStatus,
        }),
        risk_level: hint.risk_level,
        recommended_route: recommendedRoute,
        status,
        harness_validation_status: harnessValidationStatus,
        created_at: timestamp,
        updated_at: timestamp,
        ...(input.jobId ? { job_id: input.jobId } : {}),
        ...(input.agentExecutionLogId
          ? { agent_execution_log_id: input.agentExecutionLogId }
          : {}),
        ...(input.outputAssetId ? { output_asset_id: input.outputAssetId } : {}),
        ...(input.executionProfileId
          ? { execution_profile_id: input.executionProfileId }
          : {}),
        ...(input.runtimeBindingId
          ? { runtime_binding_id: input.runtimeBindingId }
          : {}),
        ...(input.promptTemplateId
          ? { prompt_template_id: input.promptTemplateId }
          : {}),
        ...(hint.location ? { location: hint.location } : {}),
        ...(hint.model_confidence != null
          ? { model_confidence: hint.model_confidence }
          : {}),
        ...(hint.related_rule_ids
          ? { related_rule_ids: hint.related_rule_ids }
          : {}),
        ...(hint.related_knowledge_item_ids
          ? { related_knowledge_item_ids: hint.related_knowledge_item_ids }
          : {}),
        ...(hint.related_quality_issue_ids
          ? { related_quality_issue_ids: hint.related_quality_issue_ids }
          : {}),
      };

      await this.residualIssueRepository.save(record);
      createdIssues.push(record);
      existingIssues.push(record);
    }

    return createdIssues;
  }

  async recordHarnessValidationResult(
    input: RecordResidualHarnessValidationInput,
  ): Promise<ResidualIssueRecord> {
    const existing = await this.requireIssue(input.issueId);

    const harnessValidationStatus: ResidualHarnessValidationStatus =
      input.outcome === "passed" ? "passed" : "failed";
    const updatedAt = this.now().toISOString();
    const updated: ResidualIssueRecord = {
      ...existing,
      harness_validation_status: harnessValidationStatus,
      harness_run_id: input.runId,
      system_confidence_band: calculateResidualConfidenceBand({
        modelConfidence: existing.model_confidence,
        recurrenceCount: existing.recurrence_count,
        riskLevel: existing.risk_level,
        recommendedRoute: existing.recommended_route,
        harnessValidationStatus,
      }),
      status: deriveValidatedResidualStatus({
        recommendedRoute: existing.recommended_route,
        outcome: input.outcome,
      }),
      updated_at: updatedAt,
    };

    await this.residualIssueRepository.save(updated);
    return updated;
  }

  async createLearningCandidateFromIssue(
    input: CreateLearningCandidateFromResidualIssueInput,
  ): Promise<LearningCandidateRecord> {
    if (!this.learningService) {
      throw new ResidualLearningServiceDependencyRequiredError("learningService");
    }

    const issue = await this.requireIssue(input.issueId);
    if (
      issue.harness_validation_status !== "passed" ||
      issue.status !== "candidate_ready"
    ) {
      throw new ResidualIssueNotReadyForCandidateCreationError(input.issueId);
    }
    if (!issue.output_asset_id) {
      throw new ResidualIssueSourceAssetRequiredError(input.issueId);
    }

    const candidate =
      await this.learningService.createResidualGovernedLearningCandidate({
        ...buildResidualCandidateInput({
          issue,
          title: input.title,
          proposalText: input.proposalText,
        }),
        requestedBy: input.requestedBy,
        requestedByRole: input.requestedByRole,
        governedSource: {
          sourceKind: "residual_issue",
          residualIssueId: issue.id,
          snapshotId: issue.execution_snapshot_id,
          sourceAssetId: issue.output_asset_id,
        },
      });

    const updatedIssue: ResidualIssueRecord = {
      ...issue,
      learning_candidate_id: candidate.id,
      status: "candidate_created",
      updated_at: this.now().toISOString(),
    };
    await this.residualIssueRepository.save(updatedIssue);

    return candidate;
  }

  private async requireIssue(issueId: string): Promise<ResidualIssueRecord> {
    const issue = await this.residualIssueRepository.findById(issueId);
    if (!issue) {
      throw new ResidualIssueNotFoundError(issueId);
    }

    return issue;
  }
}

function deriveResidualStatus(
  recommendedRoute: ResidualIssueRecord["recommended_route"],
  harnessValidationStatus: ResidualHarnessValidationStatus,
): ResidualIssueStatus {
  if (recommendedRoute === "manual_only") {
    return "manual_only";
  }

  if (recommendedRoute === "evidence_only") {
    return "evidence_only";
  }

  return harnessValidationStatus === "queued"
    ? "validation_pending"
    : "observed";
}

function deriveValidatedResidualStatus(input: {
  recommendedRoute: ResidualIssueRecord["recommended_route"];
  outcome: "passed" | "failed";
}): ResidualIssueStatus {
  if (input.recommendedRoute === "manual_only") {
    return "manual_only";
  }

  if (input.recommendedRoute === "evidence_only") {
    return "evidence_only";
  }

  return input.outcome === "passed"
    ? "candidate_ready"
    : "validation_failed";
}

function buildResidualCandidateInput(input: {
  issue: ResidualIssueRecord;
  title?: string;
  proposalText?: string;
}): Omit<
  CreateResidualGovernedLearningCandidateInput,
  "requestedBy" | "requestedByRole" | "governedSource"
> {
  return {
    type: mapResidualRouteToCandidateType(
      input.issue.id,
      input.issue.recommended_route,
    ),
    module: input.issue.module,
    manuscriptType: input.issue.manuscript_type,
    title: input.title ?? defaultResidualCandidateTitle(input.issue),
    proposalText:
      input.proposalText ?? defaultResidualCandidateProposalText(input.issue),
  };
}

function mapResidualRouteToCandidateType(
  issueId: string,
  route: ResidualIssueRecord["recommended_route"],
): LearningCandidateRecord["type"] {
  switch (route) {
    case "rule_candidate":
      return "rule_candidate";
    case "knowledge_candidate":
      return "knowledge_candidate";
    case "prompt_template_candidate":
      return "prompt_optimization_candidate";
    default:
      throw new ResidualIssueCandidateRouteNotSupportedError(issueId, route);
  }
}

function defaultResidualCandidateTitle(issue: ResidualIssueRecord): string {
  return `Residual ${issue.issue_type} candidate`;
}

function defaultResidualCandidateProposalText(issue: ResidualIssueRecord): string {
  return (
    issue.rationale?.trim() ||
    issue.suggestion?.trim() ||
    issue.excerpt?.trim() ||
    issue.issue_type
  );
}
