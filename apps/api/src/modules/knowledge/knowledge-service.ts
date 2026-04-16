import { randomUUID } from "node:crypto";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type { AgentProfileService } from "../agent-profiles/agent-profile-service.ts";
import type { AgentRuntimeService } from "../agent-runtime/agent-runtime-service.ts";
import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { AiProviderRuntimeService } from "../ai-provider-runtime/ai-provider-runtime-service.ts";
import type { ExecutionGovernanceService } from "../execution-governance/execution-governance-service.ts";
import type {
  KnowledgeRetrievalSnapshotRecord,
} from "../knowledge-retrieval/knowledge-retrieval-record.ts";
import type { KnowledgeRetrievalRepository } from "../knowledge-retrieval/knowledge-retrieval-repository.ts";
import type { KnowledgeRetrievalService } from "../knowledge-retrieval/knowledge-retrieval-service.ts";
import type { LearningCandidateRepository } from "../learning/learning-repository.ts";
import type { ManuscriptRepository } from "../manuscripts/manuscript-repository.ts";
import type { ManualReviewPolicyService } from "../manual-review-policies/manual-review-policy-service.ts";
import type { PromptSkillRegistryRepository } from "../prompt-skill-registry/prompt-skill-repository.ts";
import type { RetrievalPresetService } from "../retrieval-presets/retrieval-preset-service.ts";
import type { RuntimeBindingReadinessService } from "../runtime-bindings/runtime-binding-readiness-service.ts";
import type { RuntimeBindingService } from "../runtime-bindings/runtime-binding-service.ts";
import type { SandboxProfileService } from "../sandbox-profiles/sandbox-profile-service.ts";
import {
  resolveGovernedAgentContext,
  type GovernedAgentContext,
} from "../shared/governed-agent-context-resolver.ts";
import { requireApprovedLearningCandidate } from "../shared/learning-candidate-guard.ts";
import {
  createDirectWriteTransactionManager,
  createScopedWriteTransactionManager,
  type WriteTransactionManager,
} from "../shared/write-transaction-manager.ts";
import type { ModuleTemplateRepository } from "../templates/template-repository.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import type { ToolPermissionPolicyService } from "../tool-permission-policies/tool-permission-policy-service.ts";
import {
  InMemoryKnowledgeRepository,
  InMemoryKnowledgeReviewActionRepository,
} from "./in-memory-knowledge-repository.ts";
import {
  evaluateKnowledgeDuplicateMatches,
  mapLegacyKnowledgeRecordToDuplicateCandidate,
  selectRepresentativeRevisionForDuplicateDetection,
} from "./knowledge-duplicate-detection.ts";
import { isKnowledgeRevisionCurrentlyEffective } from "./knowledge-runtime-projection.ts";
import type {
  KnowledgeDuplicateCandidateGroupRecord,
  KnowledgeRepository,
  KnowledgeReviewActionRepository,
  SubmitKnowledgeDuplicateAcknowledgementInput,
} from "./knowledge-repository.ts";
import type {
  KnowledgeAssetRecord,
  KnowledgeContentBlockRecord,
  KnowledgeDuplicateAcknowledgementRecord,
  KnowledgeDuplicateCheckInput,
  KnowledgeDuplicateMatchRecord,
  KnowledgeRecord,
  KnowledgeRevisionBindingKind,
  KnowledgeRevisionBindingRecord,
  KnowledgeRevisionRecord,
  KnowledgeSemanticLayerRecord,
  KnowledgeReviewActionRecord,
} from "./knowledge-record.ts";

export interface CreateKnowledgeDraftInput {
  title: string;
  canonicalText: string;
  summary?: string;
  knowledgeKind: KnowledgeRecord["knowledge_kind"];
  moduleScope: KnowledgeRecord["routing"]["module_scope"];
  manuscriptTypes: KnowledgeRecord["routing"]["manuscript_types"];
  sections?: string[];
  riskTags?: string[];
  disciplineTags?: string[];
  evidenceLevel?: KnowledgeRecord["evidence_level"];
  sourceType?: KnowledgeRecord["source_type"];
  sourceLink?: string;
  aliases?: string[];
  templateBindings?: string[];
  sourceLearningCandidateId?: string;
}

export interface CreateKnowledgeDraftFromLearningCandidateInput
  extends CreateKnowledgeDraftInput {
  sourceLearningCandidateId: string;
}

export interface UpdateKnowledgeDraftInput {
  title?: string;
  canonicalText?: string;
  summary?: string;
  sections?: string[];
  riskTags?: string[];
  disciplineTags?: string[];
  aliases?: string[];
  templateBindings?: string[];
}

export interface KnowledgeRevisionBindingInput {
  bindingKind: KnowledgeRevisionBindingKind;
  bindingTargetId: string;
  bindingTargetLabel: string;
}

export interface CreateKnowledgeLibraryDraftInput extends CreateKnowledgeDraftInput {
  effectiveAt?: string;
  expiresAt?: string;
  bindings?: KnowledgeRevisionBindingInput[];
}

export interface UpdateKnowledgeRevisionDraftInput extends UpdateKnowledgeDraftInput {
  knowledgeKind?: KnowledgeRecord["knowledge_kind"];
  moduleScope?: KnowledgeRecord["routing"]["module_scope"];
  manuscriptTypes?: KnowledgeRecord["routing"]["manuscript_types"];
  evidenceLevel?: KnowledgeRecord["evidence_level"];
  sourceType?: KnowledgeRecord["source_type"];
  sourceLink?: string;
  effectiveAt?: string;
  expiresAt?: string;
  sourceLearningCandidateId?: string;
  bindings?: KnowledgeRevisionBindingInput[];
}

export interface KnowledgeContentBlockInput {
  blockType: KnowledgeContentBlockRecord["block_type"];
  orderNo: number;
  contentPayload: Record<string, unknown>;
  tableSemantics?: Record<string, unknown>;
  imageUnderstanding?: Record<string, unknown>;
}

export interface ReplaceKnowledgeRevisionContentBlocksInput {
  blocks: readonly KnowledgeContentBlockInput[];
}

export interface RegenerateKnowledgeSemanticLayerInput {
  pageSummary?: string;
  retrievalTerms?: string[];
  retrievalSnippets?: string[];
  tableSemantics?: Record<string, unknown>;
  imageUnderstanding?: Record<string, unknown>;
}

export interface ConfirmKnowledgeSemanticLayerInput
  extends RegenerateKnowledgeSemanticLayerInput {}

interface SubmitKnowledgeAcknowledgementInput
  extends SubmitKnowledgeDuplicateAcknowledgementInput {
  acknowledgedByRole?: RoleKey;
}

export interface SubmitKnowledgeForReviewInput
  extends SubmitKnowledgeAcknowledgementInput {
  knowledgeItemId: string;
}

export interface SubmitKnowledgeRevisionForReviewInput
  extends SubmitKnowledgeAcknowledgementInput {
  revisionId: string;
}

export interface KnowledgeRevisionDetailRecord extends KnowledgeRevisionRecord {
  bindings: KnowledgeRevisionBindingRecord[];
  content_blocks: KnowledgeContentBlockRecord[];
  semantic_layer?: KnowledgeSemanticLayerRecord;
}

export interface KnowledgeAssetDetailRecord {
  asset: KnowledgeAssetRecord;
  selected_revision: KnowledgeRevisionDetailRecord;
  current_approved_revision?: KnowledgeRevisionDetailRecord;
  revisions: KnowledgeRevisionDetailRecord[];
}

export interface ResolveGovernedRetrievalContextInput {
  manuscriptId: string;
  module: TemplateModule;
  actorId: string;
  actorRole: RoleKey;
  jobId?: string;
}

export interface GovernedRetrievalContextRecord {
  manuscript_id: string;
  module: TemplateModule;
  template_family_id: string;
  knowledge_item_ids: string[];
  retrieval_status: GovernedAgentContext["retrievalContext"]["status"];
  retrieval_snapshot_id?: string;
  retrieval_failure_reason?: string;
}

export interface GovernedRetrievalResolverDependencies {
  manuscriptRepository: ManuscriptRepository;
  moduleTemplateRepository: ModuleTemplateRepository;
  executionGovernanceService: ExecutionGovernanceService;
  promptSkillRegistryRepository: PromptSkillRegistryRepository;
  aiGatewayService: AiGatewayService;
  retrievalPresetService?: Pick<RetrievalPresetService, "getActivePresetForScope">;
  manualReviewPolicyService?: Pick<
    ManualReviewPolicyService,
    "getActivePolicyForScope"
  >;
  sandboxProfileService: SandboxProfileService;
  agentProfileService: AgentProfileService;
  agentRuntimeService: AgentRuntimeService;
  runtimeBindingService: RuntimeBindingService;
  runtimeBindingReadinessService?: Pick<
    RuntimeBindingReadinessService,
    "getBindingReadiness"
  >;
  aiProviderRuntimeService?: Pick<AiProviderRuntimeService, "resolveSelectionRuntime">;
  aiProviderRuntimeCutoverEnabled?: boolean;
  toolPermissionPolicyService: ToolPermissionPolicyService;
}

export interface KnowledgeServiceOptions {
  repository: KnowledgeRepository;
  reviewActionRepository: KnowledgeReviewActionRepository;
  learningCandidateRepository?: LearningCandidateRepository;
  knowledgeRetrievalRepository?: KnowledgeRetrievalRepository;
  knowledgeRetrievalService?: Pick<
    KnowledgeRetrievalService,
    "recordRetrievalSnapshot"
  >;
  governedRetrievalResolverDependencies?: GovernedRetrievalResolverDependencies;
  transactionManager?: WriteTransactionManager<KnowledgeWriteContext>;
  permissionGuard?: PermissionGuard;
  createId?: () => string;
  now?: () => Date;
}

interface KnowledgeWriteContext {
  repository: KnowledgeRepository;
  reviewActionRepository: KnowledgeReviewActionRepository;
}

type KnowledgeRevisionLifecycleStatus = KnowledgeRevisionRecord["status"];

export class KnowledgeItemNotFoundError extends Error {
  constructor(knowledgeItemId: string) {
    super(`Knowledge item ${knowledgeItemId} was not found.`);
    this.name = "KnowledgeItemNotFoundError";
  }
}

export class KnowledgeAssetNotFoundError extends Error {
  constructor(assetId: string) {
    super(`Knowledge asset ${assetId} was not found.`);
    this.name = "KnowledgeAssetNotFoundError";
  }
}

export class KnowledgeRevisionNotFoundError extends Error {
  constructor(revisionId: string) {
    super(`Knowledge revision ${revisionId} was not found.`);
    this.name = "KnowledgeRevisionNotFoundError";
  }
}

export class KnowledgeSemanticLayerNotFoundError extends Error {
  constructor(revisionId: string) {
    super(`Knowledge semantic layer for revision ${revisionId} was not found.`);
    this.name = "KnowledgeSemanticLayerNotFoundError";
  }
}

export class KnowledgeStatusTransitionError extends Error {
  constructor(knowledgeItemId: string, fromStatus: string, toStatus: string) {
    super(
      `Knowledge item ${knowledgeItemId} cannot transition from ${fromStatus} to ${toStatus}.`,
    );
    this.name = "KnowledgeStatusTransitionError";
  }
}

export class GovernedRetrievalContextDependencyError extends Error {
  constructor() {
    super("Governed retrieval context dependencies are not configured.");
    this.name = "GovernedRetrievalContextDependencyError";
  }
}

export class KnowledgeRetrievalSnapshotNotFoundError extends Error {
  constructor(snapshotId: string) {
    super(`Knowledge retrieval snapshot ${snapshotId} was not found.`);
    this.name = "KnowledgeRetrievalSnapshotNotFoundError";
  }
}

export class KnowledgeRichSpaceNotSupportedError extends Error {
  constructor() {
    super("Knowledge rich-space is not supported by the configured repository.");
    this.name = "KnowledgeRichSpaceNotSupportedError";
  }
}

export class KnowledgeContentBlockOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeContentBlockOrderError";
  }
}

type RichSpaceKnowledgeRepository = KnowledgeRepository & {
  replaceRevisionContentBlocks: NonNullable<
    KnowledgeRepository["replaceRevisionContentBlocks"]
  >;
  listContentBlocksByRevisionId: NonNullable<
    KnowledgeRepository["listContentBlocksByRevisionId"]
  >;
  saveSemanticLayer: NonNullable<KnowledgeRepository["saveSemanticLayer"]>;
  findSemanticLayerByRevisionId: NonNullable<
    KnowledgeRepository["findSemanticLayerByRevisionId"]
  >;
};

export class KnowledgeService {
  private readonly repository: KnowledgeRepository;
  private readonly reviewActionRepository: KnowledgeReviewActionRepository;
  private readonly learningCandidateRepository?: LearningCandidateRepository;
  private readonly knowledgeRetrievalRepository?: KnowledgeRetrievalRepository;
  private readonly knowledgeRetrievalService?: Pick<
    KnowledgeRetrievalService,
    "recordRetrievalSnapshot"
  >;
  private readonly governedRetrievalResolverDependencies?: GovernedRetrievalResolverDependencies;
  private readonly transactionManager: WriteTransactionManager<KnowledgeWriteContext>;
  private readonly permissionGuard: PermissionGuard;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(options: KnowledgeServiceOptions) {
    this.repository = options.repository;
    this.reviewActionRepository = options.reviewActionRepository;
    this.learningCandidateRepository = options.learningCandidateRepository;
    this.knowledgeRetrievalRepository = options.knowledgeRetrievalRepository;
    this.knowledgeRetrievalService = options.knowledgeRetrievalService;
    this.governedRetrievalResolverDependencies =
      options.governedRetrievalResolverDependencies;
    this.transactionManager =
      options.transactionManager ??
      createKnowledgeWriteTransactionManager({
        repository: this.repository,
        reviewActionRepository: this.reviewActionRepository,
      });
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.createId = options.createId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  async createDraft(input: CreateKnowledgeDraftInput): Promise<KnowledgeRecord> {
    if (!this.supportsRevisionGovernance(this.repository)) {
      const record: KnowledgeRecord = {
        id: this.createId(),
        title: input.title,
        canonical_text: input.canonicalText,
        summary: input.summary,
        knowledge_kind: input.knowledgeKind,
        status: "draft",
        routing: {
          module_scope: input.moduleScope,
          manuscript_types: input.manuscriptTypes,
          sections: input.sections,
          risk_tags: input.riskTags,
          discipline_tags: input.disciplineTags,
        },
        evidence_level: input.evidenceLevel,
        source_type: input.sourceType,
        source_link: input.sourceLink,
        aliases: input.aliases,
        template_bindings: input.templateBindings,
        ...(input.sourceLearningCandidateId
          ? {
              source_learning_candidate_id: input.sourceLearningCandidateId,
            }
          : {}),
      };

      await this.repository.save(record);
      return record;
    }

    const detail = await this.createLibraryDraft({
      ...input,
      bindings: mapTemplateBindingsToBindingInputs(input.templateBindings),
    });

    return this.projectCompatibilityRecord(detail.asset.id);
  }

  async createLibraryDraft(
    input: CreateKnowledgeLibraryDraftInput,
  ): Promise<KnowledgeAssetDetailRecord> {
    return this.transactionManager.withTransaction(
      async ({ repository }) => {
        const timestamp = this.now().toISOString();
        const assetId = this.createId();
        const revisionId = createRevisionId(assetId, 1);

        await repository.saveAsset({
          id: assetId,
          status: "active",
          current_revision_id: revisionId,
          created_at: timestamp,
          updated_at: timestamp,
        });
        await repository.saveRevision({
          id: revisionId,
          asset_id: assetId,
          revision_no: 1,
          status: "draft",
          title: input.title,
          canonical_text: input.canonicalText,
          summary: input.summary,
          knowledge_kind: input.knowledgeKind,
          routing: {
            module_scope: input.moduleScope,
            manuscript_types: input.manuscriptTypes,
            sections: input.sections,
            risk_tags: input.riskTags,
            discipline_tags: input.disciplineTags,
          },
          evidence_level: input.evidenceLevel,
          source_type: input.sourceType,
          source_link: input.sourceLink,
          effective_at: input.effectiveAt,
          expires_at: input.expiresAt,
          aliases: input.aliases,
          source_learning_candidate_id: input.sourceLearningCandidateId,
          created_at: timestamp,
          updated_at: timestamp,
        });
        await repository.replaceRevisionBindings(
          revisionId,
          buildBindingRecords(revisionId, input.bindings, timestamp),
        );

        return this.buildKnowledgeAssetDetail(assetId, revisionId, repository);
      },
    );
  }

  async createDraftFromLearningCandidate(
    actorRole: RoleKey,
    input: CreateKnowledgeDraftFromLearningCandidateInput,
  ): Promise<KnowledgeRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");
    await requireApprovedLearningCandidate(
      this.learningCandidateRepository,
      input.sourceLearningCandidateId,
    );
    return this.createDraft(input);
  }

  async createDraftRevisionFromApprovedAsset(
    assetId: string,
  ): Promise<KnowledgeAssetDetailRecord> {
    return this.transactionManager.withTransaction(
      async ({ repository }) => {
        const asset = await this.requireKnowledgeAsset(assetId, repository);
        const existingWorkingRevision = await this.findRevisionForAssetByStatuses(
          asset,
          ["draft", "pending_review"],
          repository,
        );
        if (existingWorkingRevision) {
          return this.buildKnowledgeAssetDetail(
            asset.id,
            existingWorkingRevision.id,
            repository,
          );
        }

        const approvedRevision = await this.requireApprovedRevision(asset, repository);
        const timestamp = this.now().toISOString();
        const revisionNo = Math.max(
          ...(
            await repository.listRevisionsByAssetId(asset.id)
          ).map((record) => record.revision_no),
        ) + 1;
        const nextRevisionId = createRevisionId(asset.id, revisionNo);
        const approvedBindings = await repository.listBindingsByRevisionId(
          approvedRevision.id,
        );

        await repository.saveRevision({
          ...approvedRevision,
          id: nextRevisionId,
          revision_no: revisionNo,
          status: "draft",
          based_on_revision_id: approvedRevision.id,
          created_at: timestamp,
          updated_at: timestamp,
        });
        await repository.replaceRevisionBindings(
          nextRevisionId,
          approvedBindings.map((binding, index) => ({
            id: createBindingId(nextRevisionId, index + 1),
            revision_id: nextRevisionId,
            binding_kind: binding.binding_kind,
            binding_target_id: binding.binding_target_id,
            binding_target_label: binding.binding_target_label,
            created_at: timestamp,
          })),
        );
        const richSpaceRepository = this.getRichSpaceRepository(repository);
        if (richSpaceRepository) {
          const approvedContentBlocks =
            await richSpaceRepository.listContentBlocksByRevisionId(approvedRevision.id);
          await richSpaceRepository.replaceRevisionContentBlocks(
            nextRevisionId,
            approvedContentBlocks.map((block, index) => ({
              ...block,
              id: createContentBlockId(nextRevisionId, index + 1),
              revision_id: nextRevisionId,
              created_at: timestamp,
              updated_at: timestamp,
            })),
          );

          const approvedSemanticLayer =
            await richSpaceRepository.findSemanticLayerByRevisionId(
              approvedRevision.id,
            );
          if (approvedSemanticLayer) {
            await richSpaceRepository.saveSemanticLayer({
              ...approvedSemanticLayer,
              revision_id: nextRevisionId,
              created_at: timestamp,
              updated_at: timestamp,
            });
          }
        }
        await repository.saveAsset({
          ...asset,
          current_revision_id: nextRevisionId,
          updated_at: timestamp,
        });

        return this.buildKnowledgeAssetDetail(asset.id, nextRevisionId, repository);
      },
    );
  }

  async updateRevisionDraft(
    revisionId: string,
    input: UpdateKnowledgeRevisionDraftInput,
  ): Promise<KnowledgeAssetDetailRecord> {
    return this.transactionManager.withTransaction(
      async ({ repository }) => {
        const revision = await this.requireKnowledgeRevision(revisionId, repository);
        if (revision.status !== "draft") {
          throw new KnowledgeStatusTransitionError(
            revisionId,
            revision.status,
            "draft",
          );
        }

        const timestamp = this.now().toISOString();
        await repository.saveRevision({
          ...revision,
          title: input.title ?? revision.title,
          canonical_text: input.canonicalText ?? revision.canonical_text,
          summary: input.summary ?? revision.summary,
          knowledge_kind: input.knowledgeKind ?? revision.knowledge_kind,
          routing: {
            module_scope: input.moduleScope ?? revision.routing.module_scope,
            manuscript_types:
              input.manuscriptTypes ?? revision.routing.manuscript_types,
            sections: input.sections ?? revision.routing.sections,
            risk_tags: input.riskTags ?? revision.routing.risk_tags,
            discipline_tags:
              input.disciplineTags ?? revision.routing.discipline_tags,
          },
          evidence_level: input.evidenceLevel ?? revision.evidence_level,
          source_type: input.sourceType ?? revision.source_type,
          source_link: input.sourceLink ?? revision.source_link,
          effective_at: input.effectiveAt ?? revision.effective_at,
          expires_at: input.expiresAt ?? revision.expires_at,
          aliases: input.aliases ?? revision.aliases,
          source_learning_candidate_id:
            input.sourceLearningCandidateId ?? revision.source_learning_candidate_id,
          updated_at: timestamp,
        });

        if (input.bindings !== undefined) {
          await repository.replaceRevisionBindings(
            revision.id,
            buildBindingRecords(revision.id, input.bindings, timestamp),
          );
        }

        const asset = await this.requireKnowledgeAsset(revision.asset_id, repository);
          await repository.saveAsset({
            ...asset,
            current_revision_id: revision.id,
            updated_at: timestamp,
          });
          if (this.hasRevisionDraftChanges(input)) {
            await this.markRevisionSemanticLayerStale(
              revision.id,
              repository,
              timestamp,
            );
          }

          return this.buildKnowledgeAssetDetail(
            revision.asset_id,
            revision.id,
            repository,
          );
        },
      );
    }

  async replaceRevisionContentBlocks(
    revisionId: string,
    input: ReplaceKnowledgeRevisionContentBlocksInput,
  ): Promise<KnowledgeRevisionDetailRecord> {
    return this.transactionManager.withTransaction(async ({ repository }) => {
      const revision = await this.requireKnowledgeRevision(revisionId, repository);
      if (revision.status !== "draft") {
        throw new KnowledgeStatusTransitionError(revisionId, revision.status, "draft");
      }

      const richSpaceRepository = this.requireRichSpaceRepository(repository);
      assertValidContentBlocks(input.blocks);
      const timestamp = this.now().toISOString();
      await richSpaceRepository.replaceRevisionContentBlocks(
        revision.id,
        buildContentBlockRecords(revision.id, input.blocks, timestamp),
      );

      const asset = await this.requireKnowledgeAsset(revision.asset_id, repository);
      await repository.saveAsset({
        ...asset,
        current_revision_id: revision.id,
        updated_at: timestamp,
      });
      await this.markRevisionSemanticLayerStale(revision.id, repository, timestamp);

      return this.buildKnowledgeRevisionDetail(revision.id, repository);
    });
  }

  async regenerateSemanticLayer(
    revisionId: string,
    input: RegenerateKnowledgeSemanticLayerInput,
  ): Promise<KnowledgeRevisionDetailRecord> {
    return this.transactionManager.withTransaction(async ({ repository }) => {
      const revision = await this.requireKnowledgeRevision(revisionId, repository);
      const richSpaceRepository = this.requireRichSpaceRepository(repository);
      const timestamp = this.now().toISOString();
      const existing = await richSpaceRepository.findSemanticLayerByRevisionId(
        revision.id,
      );

      await richSpaceRepository.saveSemanticLayer({
        revision_id: revision.id,
        status: "pending_confirmation",
        page_summary: input.pageSummary ?? existing?.page_summary,
        retrieval_terms: input.retrievalTerms ?? existing?.retrieval_terms,
        retrieval_snippets: input.retrievalSnippets ?? existing?.retrieval_snippets,
        table_semantics: input.tableSemantics ?? existing?.table_semantics,
        image_understanding:
          input.imageUnderstanding ?? existing?.image_understanding,
        created_at: existing?.created_at ?? timestamp,
        updated_at: timestamp,
      });

      const asset = await this.requireKnowledgeAsset(revision.asset_id, repository);
      await repository.saveAsset({
        ...asset,
        current_revision_id: revision.id,
        updated_at: timestamp,
      });

      return this.buildKnowledgeRevisionDetail(revision.id, repository);
    });
  }

  async confirmSemanticLayer(
    revisionId: string,
    input: ConfirmKnowledgeSemanticLayerInput = {},
  ): Promise<KnowledgeRevisionDetailRecord> {
    return this.transactionManager.withTransaction(async ({ repository }) => {
      const revision = await this.requireKnowledgeRevision(revisionId, repository);
      const richSpaceRepository = this.requireRichSpaceRepository(repository);
      const existing = await richSpaceRepository.findSemanticLayerByRevisionId(
        revision.id,
      );
      if (!existing) {
        throw new KnowledgeSemanticLayerNotFoundError(revision.id);
      }

      const timestamp = this.now().toISOString();
      await richSpaceRepository.saveSemanticLayer({
        revision_id: revision.id,
        status: "confirmed",
        page_summary: input.pageSummary ?? existing.page_summary,
        retrieval_terms: input.retrievalTerms ?? existing.retrieval_terms,
        retrieval_snippets: input.retrievalSnippets ?? existing.retrieval_snippets,
        table_semantics: input.tableSemantics ?? existing.table_semantics,
        image_understanding:
          input.imageUnderstanding ?? existing.image_understanding,
        created_at: existing.created_at,
        updated_at: timestamp,
      });

      const asset = await this.requireKnowledgeAsset(revision.asset_id, repository);
      await repository.saveAsset({
        ...asset,
        current_revision_id: revision.id,
        updated_at: timestamp,
      });

      return this.buildKnowledgeRevisionDetail(revision.id, repository);
    });
  }

  async submitForReview(
    knowledgeItemIdOrInput: string | SubmitKnowledgeForReviewInput,
  ): Promise<KnowledgeRecord> {
    const { knowledgeItemId, duplicateAcknowledgements, acknowledgedByRole } =
      parseKnowledgeSubmitInput(knowledgeItemIdOrInput);

    const asset = await this.findKnowledgeAssetIfSupported(knowledgeItemId);
    if (asset) {
      const revision = await this.requireRevisionForAssetByStatuses(
        asset,
        ["draft"],
      );
      const detail = await this.submitRevisionForReview({
        revisionId: revision.id,
        duplicateAcknowledgements,
        acknowledgedByRole,
      });
      return this.projectCompatibilityRecord(detail.asset.id);
    }

    return this.transactionManager.withTransaction(
      async ({ repository, reviewActionRepository }) => {
        const knowledgeItem = await this.requireKnowledgeItem(
          knowledgeItemId,
          repository,
        );

        if (knowledgeItem.status !== "draft") {
          throw new KnowledgeStatusTransitionError(
            knowledgeItemId,
            knowledgeItem.status,
            "pending_review",
          );
        }

        const updatedRecord: KnowledgeRecord = {
          ...knowledgeItem,
          status: "pending_review",
        };

        await repository.save(updatedRecord);
        await reviewActionRepository.save({
          id: this.createId(),
          knowledge_item_id: knowledgeItemId,
          action: "submitted_for_review",
          actor_role: acknowledgedByRole,
          created_at: this.now().toISOString(),
        });

        return updatedRecord;
      },
    );
  }

  async submitRevisionForReview(
    revisionIdOrInput: string | SubmitKnowledgeRevisionForReviewInput,
  ): Promise<KnowledgeAssetDetailRecord> {
    const { revisionId, duplicateAcknowledgements, acknowledgedByRole } =
      parseRevisionSubmitInput(revisionIdOrInput);

    return this.transactionManager.withTransaction(
      async ({ repository, reviewActionRepository }) => {
        const revision = await this.requireKnowledgeRevision(revisionId, repository);
        if (revision.status !== "draft") {
          throw new KnowledgeStatusTransitionError(
            revisionId,
            revision.status,
            "pending_review",
          );
        }

        const timestamp = this.now().toISOString();
        const asset = await this.requireKnowledgeAsset(revision.asset_id, repository);

        await repository.saveRevision({
          ...revision,
          status: "pending_review",
          updated_at: timestamp,
        });
        await repository.saveAsset({
          ...asset,
          current_revision_id: revision.id,
          updated_at: timestamp,
        });
        await reviewActionRepository.save({
          id: this.createId(),
          knowledge_item_id: asset.id,
          revision_id: revision.id,
          action: "submitted_for_review",
          actor_role: acknowledgedByRole,
          created_at: timestamp,
        });
        await this.persistDuplicateAcknowledgements({
          repository,
          revisionId: revision.id,
          acknowledgements: duplicateAcknowledgements,
          acknowledgedByRole,
          createdAt: timestamp,
        });

        return this.buildKnowledgeAssetDetail(asset.id, revision.id, repository);
      },
    );
  }

  async approve(
    knowledgeItemId: string,
    actorRole: RoleKey,
    reviewNote?: string,
  ): Promise<KnowledgeRecord> {
    const asset = await this.findKnowledgeAssetIfSupported(knowledgeItemId);
    if (asset) {
      const revision = await this.requireRevisionForAssetByStatuses(
        asset,
        ["pending_review"],
      );
      const detail = await this.approveRevision(revision.id, actorRole, reviewNote);
      return this.projectCompatibilityRecord(detail.asset.id);
    }

    this.permissionGuard.assert(actorRole, "knowledge.review");

    return this.transactionManager.withTransaction(
      async ({ repository, reviewActionRepository }) => {
        const knowledgeItem = await this.requireKnowledgeItem(
          knowledgeItemId,
          repository,
        );

        if (knowledgeItem.status !== "pending_review") {
          throw new KnowledgeStatusTransitionError(
            knowledgeItemId,
            knowledgeItem.status,
            "approved",
          );
        }

        const updatedRecord: KnowledgeRecord = {
          ...knowledgeItem,
          status: "approved",
        };

        await repository.save(updatedRecord);
        await reviewActionRepository.save({
          id: this.createId(),
          knowledge_item_id: knowledgeItemId,
          action: "approved",
          actor_role: actorRole,
          review_note: reviewNote,
          created_at: this.now().toISOString(),
        });

        return updatedRecord;
      },
    );
  }

  async approveRevision(
    revisionId: string,
    actorRole: RoleKey,
    reviewNote?: string,
  ): Promise<KnowledgeAssetDetailRecord> {
    this.permissionGuard.assert(actorRole, "knowledge.review");

    return this.transactionManager.withTransaction(
      async ({ repository, reviewActionRepository }) => {
        const revision = await this.requireKnowledgeRevision(revisionId, repository);
        if (revision.status !== "pending_review") {
          throw new KnowledgeStatusTransitionError(
            revisionId,
            revision.status,
            "approved",
          );
        }

        const currentTime = this.now();
        const timestamp = currentTime.toISOString();
        const asset = await this.requireKnowledgeAsset(revision.asset_id, repository);
        const priorApprovedRevision = asset.current_approved_revision_id
          ? await repository.findRevisionById(asset.current_approved_revision_id)
          : undefined;
        const approvedRevisionTakesRuntimeImmediately =
          isKnowledgeRevisionCurrentlyEffective(
            {
              status: "approved",
              effective_at: revision.effective_at,
              expires_at: revision.expires_at,
            },
            currentTime,
          );

        if (
          priorApprovedRevision &&
          priorApprovedRevision.id !== revision.id &&
          priorApprovedRevision.status === "approved" &&
          approvedRevisionTakesRuntimeImmediately
        ) {
          await repository.saveRevision({
            ...priorApprovedRevision,
            status: "superseded",
            updated_at: timestamp,
          });
        }

        await repository.saveRevision({
          ...revision,
          status: "approved",
          updated_at: timestamp,
        });
        await repository.saveAsset({
          ...asset,
          current_revision_id: revision.id,
          current_approved_revision_id: revision.id,
          updated_at: timestamp,
        });
        await reviewActionRepository.save({
          id: this.createId(),
          knowledge_item_id: asset.id,
          revision_id: revision.id,
          action: "approved",
          actor_role: actorRole,
          review_note: reviewNote,
          created_at: timestamp,
        });

        return this.buildKnowledgeAssetDetail(asset.id, revision.id, repository);
      },
    );
  }

  async reject(
    knowledgeItemId: string,
    actorRole: RoleKey,
    reviewNote?: string,
  ): Promise<KnowledgeRecord> {
    const asset = await this.findKnowledgeAssetIfSupported(knowledgeItemId);
    if (asset) {
      const revision = await this.requireRevisionForAssetByStatuses(
        asset,
        ["pending_review"],
      );
      const detail = await this.rejectRevision(revision.id, actorRole, reviewNote);
      return this.projectCompatibilityRecord(detail.asset.id);
    }

    this.permissionGuard.assert(actorRole, "knowledge.review");

    return this.transactionManager.withTransaction(
      async ({ repository, reviewActionRepository }) => {
        const knowledgeItem = await this.requireKnowledgeItem(
          knowledgeItemId,
          repository,
        );

        if (knowledgeItem.status !== "pending_review") {
          throw new KnowledgeStatusTransitionError(
            knowledgeItemId,
            knowledgeItem.status,
            "draft",
          );
        }

        const updatedRecord: KnowledgeRecord = {
          ...knowledgeItem,
          status: "draft",
        };

        await repository.save(updatedRecord);
        await reviewActionRepository.save({
          id: this.createId(),
          knowledge_item_id: knowledgeItemId,
          action: "rejected",
          actor_role: actorRole,
          review_note: reviewNote,
          created_at: this.now().toISOString(),
        });

        return updatedRecord;
      },
    );
  }

  async rejectRevision(
    revisionId: string,
    actorRole: RoleKey,
    reviewNote?: string,
  ): Promise<KnowledgeAssetDetailRecord> {
    this.permissionGuard.assert(actorRole, "knowledge.review");

    return this.transactionManager.withTransaction(
      async ({ repository, reviewActionRepository }) => {
        const revision = await this.requireKnowledgeRevision(revisionId, repository);
        if (revision.status !== "pending_review") {
          throw new KnowledgeStatusTransitionError(
            revisionId,
            revision.status,
            "draft",
          );
        }

        const timestamp = this.now().toISOString();
        const asset = await this.requireKnowledgeAsset(revision.asset_id, repository);

        await repository.saveRevision({
          ...revision,
          status: "draft",
          updated_at: timestamp,
        });
        await repository.saveAsset({
          ...asset,
          current_revision_id: revision.id,
          updated_at: timestamp,
        });
        await reviewActionRepository.save({
          id: this.createId(),
          knowledge_item_id: asset.id,
          revision_id: revision.id,
          action: "rejected",
          actor_role: actorRole,
          review_note: reviewNote,
          created_at: timestamp,
        });

        return this.buildKnowledgeAssetDetail(asset.id, revision.id, repository);
      },
    );
  }

  async updateDraft(
    knowledgeItemId: string,
    input: UpdateKnowledgeDraftInput,
  ): Promise<KnowledgeRecord> {
    const asset = await this.findKnowledgeAssetIfSupported(knowledgeItemId);
    if (asset) {
      const revision = await this.requireRevisionForAssetByStatuses(
        asset,
        ["draft"],
      );
      const detail = await this.updateRevisionDraft(revision.id, {
        ...input,
        bindings:
          input.templateBindings === undefined
            ? undefined
            : mapTemplateBindingsToBindingInputs(input.templateBindings),
      });
      return this.projectCompatibilityRecord(detail.asset.id);
    }

    const knowledgeItem = await this.requireKnowledgeItem(knowledgeItemId);

    if (knowledgeItem.status !== "draft") {
      throw new KnowledgeStatusTransitionError(
        knowledgeItemId,
        knowledgeItem.status,
        "draft",
      );
    }

    const updatedRecord: KnowledgeRecord = {
      ...knowledgeItem,
      title: input.title ?? knowledgeItem.title,
      canonical_text: input.canonicalText ?? knowledgeItem.canonical_text,
      summary: input.summary ?? knowledgeItem.summary,
      routing: {
        ...knowledgeItem.routing,
        sections: input.sections ?? knowledgeItem.routing.sections,
        risk_tags: input.riskTags ?? knowledgeItem.routing.risk_tags,
        discipline_tags:
          input.disciplineTags ?? knowledgeItem.routing.discipline_tags,
      },
      aliases: input.aliases ?? knowledgeItem.aliases,
      template_bindings: input.templateBindings ?? knowledgeItem.template_bindings,
    };

    await this.repository.save(updatedRecord);
    return updatedRecord;
  }

  async archive(
    knowledgeItemId: string,
    actorRole: RoleKey = "user",
  ): Promise<KnowledgeRecord> {
    const asset = await this.findKnowledgeAssetIfSupported(knowledgeItemId);
    if (asset) {
      return this.transactionManager.withTransaction(
        async ({ repository, reviewActionRepository }) => {
        const revisions = await repository.listRevisionsByAssetId(asset.id);
        const timestamp = this.now().toISOString();

        for (const revision of revisions) {
          if (
            revision.status === "draft" ||
            revision.status === "pending_review" ||
            revision.status === "approved"
          ) {
            await repository.saveRevision({
              ...revision,
              status: "archived",
              updated_at: timestamp,
            });
          }
        }

        await repository.saveAsset({
          ...asset,
          status: "archived",
          current_approved_revision_id: undefined,
          updated_at: timestamp,
        });
        await reviewActionRepository.save({
          id: this.createId(),
          knowledge_item_id: asset.id,
          revision_id: asset.current_revision_id,
          action: "archived",
          actor_role: actorRole,
          created_at: timestamp,
        });

        return this.projectCompatibilityRecord(asset.id, repository);
        },
      );
    }

    const knowledgeItem = await this.requireKnowledgeItem(knowledgeItemId);

    if (knowledgeItem.status === "archived") {
      return knowledgeItem;
    }

    const archivedRecord: KnowledgeRecord = {
      ...knowledgeItem,
      status: "archived",
    };

    await this.repository.save(archivedRecord);
    return archivedRecord;
  }

  async restore(
    knowledgeItemId: string,
    actorRole: RoleKey = "user",
  ): Promise<KnowledgeAssetDetailRecord | KnowledgeRecord> {
    const asset = await this.findKnowledgeAssetIfSupported(knowledgeItemId);
    if (asset) {
      return this.transactionManager.withTransaction(
        async ({ repository, reviewActionRepository }) => {
          const latestAsset = await this.requireKnowledgeAsset(asset.id, repository);
          if (latestAsset.status !== "archived") {
            return this.buildKnowledgeAssetDetail(
              latestAsset.id,
              latestAsset.current_revision_id,
              repository,
            );
          }

          const recoveryRevision = await this.findRevisionForAssetByStatuses(
            latestAsset,
            ["archived"],
            repository,
          );
          if (!recoveryRevision) {
            throw new KnowledgeRevisionNotFoundError(
              latestAsset.current_revision_id ?? latestAsset.id,
            );
          }

          const timestamp = this.now().toISOString();
          await repository.saveRevision({
            ...recoveryRevision,
            status: "draft",
            updated_at: timestamp,
          });
          await repository.saveAsset({
            ...latestAsset,
            status: "active",
            current_revision_id: recoveryRevision.id,
            current_approved_revision_id: undefined,
            updated_at: timestamp,
          });
          await reviewActionRepository.save({
            id: this.createId(),
            knowledge_item_id: latestAsset.id,
            revision_id: recoveryRevision.id,
            action: "restored",
            actor_role: actorRole,
            created_at: timestamp,
          });

          return this.buildKnowledgeAssetDetail(
            latestAsset.id,
            recoveryRevision.id,
            repository,
          );
        },
      );
    }

    const knowledgeItem = await this.requireKnowledgeItem(knowledgeItemId);
    if (knowledgeItem.status !== "archived") {
      return knowledgeItem;
    }

    const restoredRecord: KnowledgeRecord = {
      ...knowledgeItem,
      status: "draft",
    };

    await this.repository.save(restoredRecord);
    return restoredRecord;
  }

  listKnowledgeItems(): Promise<KnowledgeRecord[]> {
    return this.repository.list();
  }

  listPendingReviewItems(): Promise<KnowledgeRecord[]> {
    return this.repository.listByStatus("pending_review");
  }

  async checkDuplicates(
    input: KnowledgeDuplicateCheckInput,
  ): Promise<KnowledgeDuplicateMatchRecord[]> {
    const candidates = await this.listDuplicateCandidates();
    const excludedAssetIds = new Set(input.currentAssetId ? [input.currentAssetId] : []);
    if (input.currentRevisionId) {
      const revision = await this.repository.findRevisionById(input.currentRevisionId);
      if (revision) {
        excludedAssetIds.add(revision.asset_id);
      }
    }

    return evaluateKnowledgeDuplicateMatches(
      input,
      candidates.map((candidate) => ({
        asset: candidate.asset,
        revision: candidate.representative_revision,
        bindings: candidate.bindings,
      })),
      {
        excludedAssetIds,
        excludedRevisionIds: new Set(
          input.currentRevisionId ? [input.currentRevisionId] : [],
        ),
      },
    );
  }

  async getKnowledgeAsset(
    assetId: string,
    revisionId?: string,
  ): Promise<KnowledgeAssetDetailRecord> {
    return this.buildKnowledgeAssetDetail(assetId, revisionId);
  }

  async listReviewActions(
    knowledgeItemId: string,
  ): Promise<KnowledgeReviewActionRecord[]> {
    const asset = await this.findKnowledgeAssetIfSupported(knowledgeItemId);
    if (asset) {
      return this.reviewActionRepository.listByKnowledgeItemId(asset.id);
    }

    await this.requireKnowledgeItem(knowledgeItemId);
    return this.reviewActionRepository.listByKnowledgeItemId(knowledgeItemId);
  }

  async listReviewActionsByRevision(
    revisionId: string,
  ): Promise<KnowledgeReviewActionRecord[]> {
    await this.requireKnowledgeRevision(revisionId);
    return this.reviewActionRepository.listByRevisionId(revisionId);
  }

  async resolveGovernedRetrievalContext(
    input: ResolveGovernedRetrievalContextInput,
  ): Promise<GovernedRetrievalContextRecord> {
    this.permissionGuard.assert(input.actorRole, "permissions.manage");

    if (
      !this.governedRetrievalResolverDependencies ||
      !this.knowledgeRetrievalService
    ) {
      throw new GovernedRetrievalContextDependencyError();
    }

    const governedContext = await resolveGovernedAgentContext({
      manuscriptId: input.manuscriptId,
      module: input.module,
      jobId: input.jobId ?? this.createId(),
      actorId: input.actorId,
      actorRole: input.actorRole,
      manuscriptRepository:
        this.governedRetrievalResolverDependencies.manuscriptRepository,
      moduleTemplateRepository:
        this.governedRetrievalResolverDependencies.moduleTemplateRepository,
      executionGovernanceService:
        this.governedRetrievalResolverDependencies.executionGovernanceService,
      promptSkillRegistryRepository:
        this.governedRetrievalResolverDependencies.promptSkillRegistryRepository,
      knowledgeRepository: this.repository,
      aiGatewayService:
        this.governedRetrievalResolverDependencies.aiGatewayService,
      retrievalPresetService:
        this.governedRetrievalResolverDependencies.retrievalPresetService,
      manualReviewPolicyService:
        this.governedRetrievalResolverDependencies.manualReviewPolicyService,
      sandboxProfileService:
        this.governedRetrievalResolverDependencies.sandboxProfileService,
      agentProfileService:
        this.governedRetrievalResolverDependencies.agentProfileService,
      agentRuntimeService:
        this.governedRetrievalResolverDependencies.agentRuntimeService,
      runtimeBindingService:
        this.governedRetrievalResolverDependencies.runtimeBindingService,
      runtimeBindingReadinessService:
        this.governedRetrievalResolverDependencies.runtimeBindingReadinessService,
      aiProviderRuntimeService:
        this.governedRetrievalResolverDependencies.aiProviderRuntimeService,
      aiProviderRuntimeCutoverEnabled:
        this.governedRetrievalResolverDependencies.aiProviderRuntimeCutoverEnabled,
      toolPermissionPolicyService:
        this.governedRetrievalResolverDependencies.toolPermissionPolicyService,
      knowledgeRetrievalService: this.knowledgeRetrievalService,
    });

    return {
      manuscript_id: governedContext.manuscript.id,
      module: input.module,
      template_family_id: governedContext.executionProfile.template_family_id,
      knowledge_item_ids: governedContext.moduleContext.knowledgeSelections.map(
        (selection) => selection.knowledgeItem.id,
      ),
      retrieval_status: governedContext.retrievalContext.status,
      ...(governedContext.retrievalContext.retrieval_snapshot_id
        ? {
            retrieval_snapshot_id:
              governedContext.retrievalContext.retrieval_snapshot_id,
          }
        : {}),
      ...(governedContext.retrievalContext.failure_reason
        ? {
            retrieval_failure_reason:
              governedContext.retrievalContext.failure_reason,
          }
        : {}),
    };
  }

  async getRetrievalSnapshot(
    actorRole: RoleKey,
    snapshotId: string,
  ): Promise<KnowledgeRetrievalSnapshotRecord> {
    this.permissionGuard.assert(actorRole, "permissions.manage");

    const snapshot =
      await this.knowledgeRetrievalRepository?.findRetrievalSnapshotById(snapshotId);
    if (!snapshot) {
      throw new KnowledgeRetrievalSnapshotNotFoundError(snapshotId);
    }

    return snapshot;
  }

  private async buildKnowledgeAssetDetail(
    assetId: string,
    revisionId?: string,
    repository: KnowledgeRepository = this.repository,
  ): Promise<KnowledgeAssetDetailRecord> {
    const asset = await this.requireKnowledgeAsset(assetId, repository);
    const revisions = await repository.listRevisionsByAssetId(asset.id);
    const detailedRevisions = await Promise.all(
      revisions.map((revision) =>
        this.buildKnowledgeRevisionDetailFromRecord(revision, repository),
      ),
    );
    const selectedRevision = revisionId
      ? detailedRevisions.find((record) => record.id === revisionId)
      : undefined;

    if (revisionId && !selectedRevision) {
      throw new KnowledgeRevisionNotFoundError(revisionId);
    }

    const fallbackSelectedRevision =
      selectedRevision ??
      detailedRevisions.find((record) => record.id === asset.current_revision_id) ??
      detailedRevisions.find(
        (record) =>
          record.status === "draft" || record.status === "pending_review",
      ) ??
      detailedRevisions.find(
        (record) => record.id === asset.current_approved_revision_id,
      ) ??
      detailedRevisions[0];

    if (!fallbackSelectedRevision) {
      throw new KnowledgeAssetNotFoundError(asset.id);
    }

    const approvedRevision = asset.current_approved_revision_id
      ? detailedRevisions.find(
          (record) => record.id === asset.current_approved_revision_id,
        )
      : undefined;

    return {
      asset,
      selected_revision: fallbackSelectedRevision,
      revisions: detailedRevisions,
      ...(approvedRevision
        ? { current_approved_revision: approvedRevision }
        : {}),
    };
  }

  private async findRevisionForAssetByStatuses(
    asset: KnowledgeAssetRecord,
    statuses: readonly KnowledgeRevisionLifecycleStatus[],
    repository: KnowledgeRepository = this.repository,
  ): Promise<KnowledgeRevisionRecord | undefined> {
    const revisions = await repository.listRevisionsByAssetId(asset.id);
    const preferredIds = uniqueDefinedStrings([
      asset.current_revision_id,
      ...revisions.map((record) => record.id),
    ]);

    for (const candidateId of preferredIds) {
      const candidate = revisions.find((record) => record.id === candidateId);
      if (candidate && statuses.includes(candidate.status)) {
        return candidate;
      }
    }

    return undefined;
  }

  private async buildKnowledgeRevisionDetail(
    revisionId: string,
    repository: KnowledgeRepository = this.repository,
  ): Promise<KnowledgeRevisionDetailRecord> {
    const revision = await this.requireKnowledgeRevision(revisionId, repository);
    return this.buildKnowledgeRevisionDetailFromRecord(revision, repository);
  }

  private async buildKnowledgeRevisionDetailFromRecord(
    revision: KnowledgeRevisionRecord,
    repository: KnowledgeRepository = this.repository,
  ): Promise<KnowledgeRevisionDetailRecord> {
    const bindings = await repository.listBindingsByRevisionId(revision.id);
    const persistedContentBlocks = repository.listContentBlocksByRevisionId
      ? await repository.listContentBlocksByRevisionId(revision.id)
      : [];
    const persistedSemanticLayer = repository.findSemanticLayerByRevisionId
      ? await repository.findSemanticLayerByRevisionId(revision.id)
      : undefined;
    const contentBlocks =
      persistedContentBlocks.length > 0
        ? persistedContentBlocks
        : [buildImplicitTextContentBlock(revision)];
    const semanticLayer =
      persistedSemanticLayer ?? buildNotGeneratedSemanticLayer(revision);

    return {
      ...revision,
      bindings,
      content_blocks: contentBlocks,
      semantic_layer: semanticLayer,
    };
  }

  private async projectCompatibilityRecord(
    knowledgeItemId: string,
    repository: KnowledgeRepository = this.repository,
  ): Promise<KnowledgeRecord> {
    const record = await repository.findById(knowledgeItemId);
    if (!record) {
      throw new KnowledgeItemNotFoundError(knowledgeItemId);
    }

    return record;
  }

  private hasRevisionDraftChanges(input: UpdateKnowledgeRevisionDraftInput): boolean {
    return (
      input.title !== undefined ||
      input.canonicalText !== undefined ||
      input.summary !== undefined ||
      input.knowledgeKind !== undefined ||
      input.moduleScope !== undefined ||
      input.manuscriptTypes !== undefined ||
      input.sections !== undefined ||
      input.riskTags !== undefined ||
      input.disciplineTags !== undefined ||
      input.evidenceLevel !== undefined ||
      input.sourceType !== undefined ||
      input.sourceLink !== undefined ||
      input.effectiveAt !== undefined ||
      input.expiresAt !== undefined ||
      input.aliases !== undefined ||
      input.sourceLearningCandidateId !== undefined ||
      input.bindings !== undefined
    );
  }

  private getRichSpaceRepository(
    repository: KnowledgeRepository = this.repository,
  ): RichSpaceKnowledgeRepository | undefined {
    const candidate = repository as Partial<RichSpaceKnowledgeRepository>;
    if (
      typeof candidate.replaceRevisionContentBlocks === "function" &&
      typeof candidate.listContentBlocksByRevisionId === "function" &&
      typeof candidate.saveSemanticLayer === "function" &&
      typeof candidate.findSemanticLayerByRevisionId === "function"
    ) {
      return candidate as RichSpaceKnowledgeRepository;
    }

    return undefined;
  }

  private requireRichSpaceRepository(
    repository: KnowledgeRepository = this.repository,
  ): RichSpaceKnowledgeRepository {
    const candidate = this.getRichSpaceRepository(repository);
    if (!candidate) {
      throw new KnowledgeRichSpaceNotSupportedError();
    }

    return candidate;
  }

  private async markRevisionSemanticLayerStale(
    revisionId: string,
    repository: KnowledgeRepository,
    timestamp: string,
  ): Promise<void> {
    const richSpaceRepository = this.getRichSpaceRepository(repository);
    if (!richSpaceRepository) {
      return;
    }

    const existing = await richSpaceRepository.findSemanticLayerByRevisionId(
      revisionId,
    );
    await richSpaceRepository.saveSemanticLayer({
      revision_id: revisionId,
      status: "stale",
      page_summary: existing?.page_summary,
      retrieval_terms: existing?.retrieval_terms,
      retrieval_snippets: existing?.retrieval_snippets,
      table_semantics: existing?.table_semantics,
      image_understanding: existing?.image_understanding,
      created_at: existing?.created_at ?? timestamp,
      updated_at: timestamp,
    });
  }

  private async findKnowledgeAssetIfSupported(
    assetId: string,
    repository: KnowledgeRepository = this.repository,
  ): Promise<KnowledgeAssetRecord | undefined> {
    if (!this.supportsRevisionGovernance(repository)) {
      return undefined;
    }

    return repository.findAssetById(assetId);
  }

  private async requireKnowledgeItem(
    knowledgeItemId: string,
    repository: KnowledgeRepository = this.repository,
  ): Promise<KnowledgeRecord> {
    const knowledgeItem = await repository.findById(knowledgeItemId);

    if (!knowledgeItem) {
      throw new KnowledgeItemNotFoundError(knowledgeItemId);
    }

    return knowledgeItem;
  }

  private async requireKnowledgeAsset(
    assetId: string,
    repository: KnowledgeRepository = this.repository,
  ): Promise<KnowledgeAssetRecord> {
    const asset = await repository.findAssetById(assetId);
    if (!asset) {
      throw new KnowledgeAssetNotFoundError(assetId);
    }

    return asset;
  }

  private async requireKnowledgeRevision(
    revisionId: string,
    repository: KnowledgeRepository = this.repository,
  ): Promise<KnowledgeRevisionRecord> {
    const revision = await repository.findRevisionById(revisionId);
    if (!revision) {
      throw new KnowledgeRevisionNotFoundError(revisionId);
    }

    return revision;
  }

  private async requireApprovedRevision(
    asset: KnowledgeAssetRecord,
    repository: KnowledgeRepository = this.repository,
  ): Promise<KnowledgeRevisionRecord> {
    if (!asset.current_approved_revision_id) {
      throw new KnowledgeStatusTransitionError(asset.id, "draft", "approved");
    }

    const revision = await this.requireKnowledgeRevision(
      asset.current_approved_revision_id,
      repository,
    );
    if (revision.status !== "approved") {
      throw new KnowledgeStatusTransitionError(
        revision.id,
        revision.status,
        "approved",
      );
    }

    return revision;
  }

  private async requireRevisionForAssetByStatuses(
    asset: KnowledgeAssetRecord,
    statuses: readonly KnowledgeRevisionLifecycleStatus[],
    repository: KnowledgeRepository = this.repository,
  ): Promise<KnowledgeRevisionRecord> {
    const revision = await this.findRevisionForAssetByStatuses(
      asset,
      statuses,
      repository,
    );
    if (!revision) {
      const currentRevision = asset.current_revision_id
        ? await repository.findRevisionById(asset.current_revision_id)
        : undefined;
      throw new KnowledgeStatusTransitionError(
        asset.id,
        currentRevision?.status ?? "missing",
        statuses.join(" or "),
      );
    }

    return revision;
  }

  private supportsRevisionGovernance(
    repository: KnowledgeRepository = this.repository,
  ): boolean {
    const candidate = repository as Partial<KnowledgeRepository>;

    return (
      typeof candidate.findApprovedById === "function" &&
      typeof candidate.listApproved === "function" &&
      typeof candidate.saveAsset === "function" &&
      typeof candidate.findAssetById === "function" &&
      typeof candidate.listAssets === "function" &&
      typeof candidate.saveRevision === "function" &&
      typeof candidate.findRevisionById === "function" &&
      typeof candidate.listRevisionsByAssetId === "function" &&
      typeof candidate.listRevisionsByStatus === "function" &&
      typeof candidate.replaceRevisionBindings === "function" &&
      typeof candidate.listBindingsByRevisionId === "function"
    );
  }

  private async listDuplicateCandidates(): Promise<
    KnowledgeDuplicateCandidateGroupRecord[]
  > {
    if (this.repository.listDuplicateCheckCandidatesByAsset) {
      return this.repository.listDuplicateCheckCandidatesByAsset();
    }

    if (this.supportsRevisionGovernance(this.repository)) {
      const assets = await this.repository.listAssets();
      const groupedByAsset = await Promise.all(
        assets.map(async (asset) => {
          const revisions = await this.repository.listRevisionsByAssetId(asset.id);
          const representativeRevision =
            selectRepresentativeRevisionForDuplicateDetection(revisions, {
              preferredApprovedRevisionId: asset.current_approved_revision_id,
              preferredCurrentRevisionId: asset.current_revision_id,
            });
          if (!representativeRevision) {
            return undefined;
          }

          const bindings = await this.repository.listBindingsByRevisionId(
            representativeRevision.id,
          );
          return {
            asset,
            representative_revision: representativeRevision,
            bindings: bindings.map((binding) => binding.binding_target_id),
          } satisfies KnowledgeDuplicateCandidateGroupRecord;
        }),
      );

      return groupedByAsset
        .filter(
          (record): record is KnowledgeDuplicateCandidateGroupRecord =>
            record != null,
        )
        .sort(compareDuplicateCandidateGroupRecords);
    }

    const records = await this.repository.list();
    return records.map((record) => {
      const candidate = mapLegacyKnowledgeRecordToDuplicateCandidate(record);
      return {
        asset: candidate.asset,
        representative_revision: candidate.revision,
        bindings: [...candidate.bindings],
      };
    });
  }

  private async persistDuplicateAcknowledgements(input: {
    repository: KnowledgeRepository;
    revisionId: string;
    acknowledgements?: readonly KnowledgeDuplicateAcknowledgementRecord[];
    acknowledgedByRole?: RoleKey;
    createdAt: string;
  }): Promise<void> {
    if (!input.acknowledgements?.length) {
      return;
    }

    if (!input.repository.saveDuplicateAcknowledgement) {
      return;
    }

    const matchedAssetIds = [
      ...new Set(
        input.acknowledgements.map((record) => record.matched_asset_id),
      ),
    ];
    if (matchedAssetIds.length === 0) {
      return;
    }

    await input.repository.saveDuplicateAcknowledgement({
      id: this.createId(),
      revision_id: input.revisionId,
      matched_asset_ids: matchedAssetIds,
      highest_severity: resolveHighestDuplicateAcknowledgementSeverity(
        input.acknowledgements,
      ),
      acknowledged_by_role: input.acknowledgedByRole ?? "user",
      created_at: input.createdAt,
    });
  }
}

function createKnowledgeWriteTransactionManager(
  context: KnowledgeWriteContext,
): WriteTransactionManager<KnowledgeWriteContext> {
  if (
    context.repository instanceof InMemoryKnowledgeRepository &&
    context.reviewActionRepository instanceof
      InMemoryKnowledgeReviewActionRepository
  ) {
    return createScopedWriteTransactionManager({
      queueKey: context.repository,
      context,
      repositories: [context.repository, context.reviewActionRepository],
    });
  }

  return createDirectWriteTransactionManager(context);
}

function buildBindingRecords(
  revisionId: string,
  bindings: readonly KnowledgeRevisionBindingInput[] | undefined,
  createdAt: string,
): KnowledgeRevisionBindingRecord[] {
  return (bindings ?? []).map((binding, index) => ({
    id: createBindingId(revisionId, index + 1),
    revision_id: revisionId,
    binding_kind: binding.bindingKind,
    binding_target_id: binding.bindingTargetId,
    binding_target_label: binding.bindingTargetLabel,
    created_at: createdAt,
  }));
}

function buildContentBlockRecords(
  revisionId: string,
  blocks: readonly KnowledgeContentBlockInput[],
  timestamp: string,
): KnowledgeContentBlockRecord[] {
  return blocks.map((block, index) => ({
    id: createContentBlockId(revisionId, index + 1),
    revision_id: revisionId,
    block_type: block.blockType,
    order_no: block.orderNo,
    status: "active",
    content_payload: block.contentPayload,
    ...(block.tableSemantics ? { table_semantics: block.tableSemantics } : {}),
    ...(block.imageUnderstanding
      ? { image_understanding: block.imageUnderstanding }
      : {}),
    created_at: timestamp,
    updated_at: timestamp,
  }));
}

function createRevisionId(assetId: string, revisionNo: number): string {
  return `${assetId}-revision-${revisionNo}`;
}

function createBindingId(revisionId: string, bindingNo: number): string {
  return `${revisionId}-binding-${bindingNo}`;
}

function createContentBlockId(revisionId: string, blockNo: number): string {
  return `${revisionId}-content-block-${blockNo}`;
}

function buildImplicitTextContentBlock(
  revision: KnowledgeRevisionRecord,
): KnowledgeContentBlockRecord {
  return {
    id: `${revision.id}-implicit-text-block-1`,
    revision_id: revision.id,
    block_type: "text_block",
    order_no: 0,
    status: "active",
    content_payload: {
      text: revision.canonical_text,
    },
    created_at: revision.created_at,
    updated_at: revision.updated_at,
  };
}

function buildNotGeneratedSemanticLayer(
  revision: KnowledgeRevisionRecord,
): KnowledgeSemanticLayerRecord {
  return {
    revision_id: revision.id,
    status: "not_generated",
    created_at: revision.created_at,
    updated_at: revision.updated_at,
  };
}

function mapTemplateBindingsToBindingInputs(
  templateBindings: readonly string[] | undefined,
): KnowledgeRevisionBindingInput[] | undefined {
  return templateBindings?.map((binding) => ({
    bindingKind: "module_template",
    bindingTargetId: binding,
    bindingTargetLabel: binding,
  }));
}

function uniqueDefinedStrings(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => value != null))];
}

function assertValidContentBlocks(
  blocks: readonly KnowledgeContentBlockInput[],
): void {
  const seenOrderNos = new Set<number>();
  for (const block of blocks) {
    if (block.orderNo < 0) {
      throw new KnowledgeContentBlockOrderError(
        `Knowledge content block order_no must be >= 0; received ${block.orderNo}.`,
      );
    }
    if (seenOrderNos.has(block.orderNo)) {
      throw new KnowledgeContentBlockOrderError(
        `Knowledge content block order_no must be unique per revision; duplicate ${block.orderNo}.`,
      );
    }
    seenOrderNos.add(block.orderNo);
  }
}

function parseKnowledgeSubmitInput(
  value: string | SubmitKnowledgeForReviewInput,
): {
  knowledgeItemId: string;
  duplicateAcknowledgements?: readonly KnowledgeDuplicateAcknowledgementRecord[];
  acknowledgedByRole: RoleKey;
} {
  if (typeof value === "string") {
    return { knowledgeItemId: value, acknowledgedByRole: "user" };
  }

  return {
    knowledgeItemId: value.knowledgeItemId,
    duplicateAcknowledgements: value.duplicateAcknowledgements,
    acknowledgedByRole: value.acknowledgedByRole ?? "user",
  };
}

function parseRevisionSubmitInput(
  value: string | SubmitKnowledgeRevisionForReviewInput,
): {
  revisionId: string;
  duplicateAcknowledgements?: readonly KnowledgeDuplicateAcknowledgementRecord[];
  acknowledgedByRole: RoleKey;
} {
  if (typeof value === "string") {
    return { revisionId: value, acknowledgedByRole: "user" };
  }

  return {
    revisionId: value.revisionId,
    duplicateAcknowledgements: value.duplicateAcknowledgements,
    acknowledgedByRole: value.acknowledgedByRole ?? "user",
  };
}

function resolveHighestDuplicateAcknowledgementSeverity(
  acknowledgements: readonly KnowledgeDuplicateAcknowledgementRecord[],
): "exact" | "high" | "possible" {
  if (acknowledgements.some((record) => record.severity === "exact")) {
    return "exact";
  }
  if (acknowledgements.some((record) => record.severity === "high")) {
    return "high";
  }

  return "possible";
}

function compareDuplicateCandidateGroupRecords(
  left: KnowledgeDuplicateCandidateGroupRecord,
  right: KnowledgeDuplicateCandidateGroupRecord,
): number {
  return (
    left.asset.id.localeCompare(right.asset.id) ||
    left.representative_revision.id.localeCompare(right.representative_revision.id)
  );
}
