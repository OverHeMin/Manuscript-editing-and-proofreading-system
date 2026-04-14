import {
  assistKnowledgeRevisionSemanticLayer,
  confirmKnowledgeSemanticLayer,
  createKnowledgeLibraryDraft,
  regenerateKnowledgeSemanticLayer,
  replaceKnowledgeRevisionContentBlocks,
  updateKnowledgeRevisionDraft,
  type KnowledgeLibraryHttpClient,
} from "../knowledge-library/knowledge-library-api.ts";
import type {
  CreateKnowledgeLibraryDraftInput,
  KnowledgeAssetDetailViewModel,
  KnowledgeContentBlockViewModel,
  KnowledgeLibrarySemanticAssistSuggestionViewModel,
  KnowledgeRevisionViewModel,
  KnowledgeSemanticLayerInput,
  KnowledgeSemanticLayerViewModel,
  UpdateKnowledgeLibraryDraftInput,
} from "../knowledge-library/types.ts";
import type { KnowledgeSourceType } from "../knowledge/index.ts";
import type { ManuscriptModule, ManuscriptType } from "../manuscripts/types.ts";

export interface RuleWizardEntryFormState {
  title: string;
  moduleScope: ManuscriptModule | "any";
  manuscriptTypes: string;
  sourceType: KnowledgeSourceType;
  contributor: string;
  ruleBody: string;
  positiveExample: string;
  negativeExample: string;
  imageEvidence: string;
  sourceBasis: string;
  advancedTagsExpanded: boolean;
  sections: string;
  riskTags: string;
  packageHints: string;
  candidateOnly: boolean;
  conflictNotes: string;
}

export interface SaveRuleWizardEntryDraftInput {
  form: RuleWizardEntryFormState;
  draftAssetId?: string;
  draftRevisionId?: string;
}

export interface SaveRuleWizardEntryDraftResult {
  detail: KnowledgeAssetDetailViewModel;
  draftAssetId: string;
  draftRevisionId: string;
}

export type RuleWizardSemanticRuleType =
  | "terminology_consistency"
  | "format_normalization"
  | "content_requirement"
  | "citation_requirement"
  | "other";

export type RuleWizardSemanticRiskLevel = "low" | "medium" | "high";

export interface RuleWizardSemanticViewModel {
  semanticLayer?: KnowledgeSemanticLayerViewModel;
  ruleType: RuleWizardSemanticRuleType;
  riskLevel: RuleWizardSemanticRiskLevel;
  moduleScope: ManuscriptModule | "any";
  manuscriptTypes: string;
  semanticSummary: string;
  retrievalTerms: string;
  retrievalSnippets: string;
  suggestedPackage: string;
  applicableScenario: string;
  triggerExplanation: string;
  inapplicableConditions: string;
  evidencePreview: string[];
  confidenceScore: number;
  confidenceLabel: string;
  warnings: string[];
}

export interface RuleWizardConfirmFormState {
  ruleType: RuleWizardSemanticRuleType;
  riskLevel: RuleWizardSemanticRiskLevel;
  moduleScope: ManuscriptModule | "any";
  manuscriptTypes: string;
  semanticSummary: string;
  retrievalTerms: string;
  retrievalSnippets: string;
}

export interface RegenerateRuleWizardSemanticResult {
  revision: KnowledgeRevisionViewModel;
  suggestion: KnowledgeLibrarySemanticAssistSuggestionViewModel;
  semanticViewModel: RuleWizardSemanticViewModel;
}

export interface ConfirmRuleWizardSemanticResult {
  detail: KnowledgeAssetDetailViewModel;
  semanticViewModel: RuleWizardSemanticViewModel;
}

export function createRuleWizardEntryFormState(
  input: Partial<RuleWizardEntryFormState> = {},
): RuleWizardEntryFormState {
  return {
    title: input.title ?? "",
    moduleScope: input.moduleScope ?? "editing",
    manuscriptTypes: input.manuscriptTypes ?? "clinical_study",
    sourceType: input.sourceType ?? "guideline",
    contributor: input.contributor ?? "",
    ruleBody: input.ruleBody ?? "",
    positiveExample: input.positiveExample ?? "",
    negativeExample: input.negativeExample ?? "",
    imageEvidence: input.imageEvidence ?? "",
    sourceBasis: input.sourceBasis ?? "",
    advancedTagsExpanded: input.advancedTagsExpanded ?? false,
    sections: input.sections ?? "",
    riskTags: input.riskTags ?? "",
    packageHints: input.packageHints ?? "",
    candidateOnly: input.candidateOnly ?? false,
    conflictNotes: input.conflictNotes ?? "",
  };
}

export function createRuleDraftInput(
  form: RuleWizardEntryFormState,
): CreateKnowledgeLibraryDraftInput {
  return {
    title: form.title.trim(),
    canonicalText: form.ruleBody.trim(),
    knowledgeKind: "rule",
    moduleScope: form.moduleScope,
    manuscriptTypes: parseRuleWizardManuscriptTypes(form.manuscriptTypes),
    ...(form.sourceType ? { sourceType: form.sourceType } : {}),
    ...(toOptionalStringArray(form.sections) ? { sections: toOptionalStringArray(form.sections) } : {}),
    ...(toOptionalStringArray(form.riskTags) ? { riskTags: toOptionalStringArray(form.riskTags) } : {}),
  };
}

export function createRuleDraftUpdateInput(
  form: RuleWizardEntryFormState,
): UpdateKnowledgeLibraryDraftInput {
  return createRuleDraftInput(form);
}

export function createRuleWizardSemanticViewModel(input: {
  form: RuleWizardEntryFormState;
  revision?: KnowledgeRevisionViewModel;
  suggestion?: KnowledgeLibrarySemanticAssistSuggestionViewModel;
}): RuleWizardSemanticViewModel {
  const semanticLayer = resolveRuleWizardSemanticLayer(input);
  const suggestedFieldPatch = input.suggestion?.suggestedFieldPatch;
  const moduleScope =
    suggestedFieldPatch?.moduleScope ??
    input.revision?.routing.module_scope ??
    input.form.moduleScope;
  const manuscriptTypes = formatRuleWizardManuscriptTypes(
    suggestedFieldPatch?.manuscriptTypes ??
      input.revision?.routing.manuscript_types ??
      parseRuleWizardManuscriptTypes(input.form.manuscriptTypes),
  );
  const riskLevel = resolveRuleWizardRiskLevel(input, suggestedFieldPatch?.riskTags);
  const ruleType = resolveRuleWizardRuleType(input);
  const semanticSummary =
    semanticLayer?.page_summary?.trim() ||
    suggestedFieldPatch?.summary?.trim() ||
    input.revision?.summary?.trim() ||
    input.form.ruleBody.trim();
  const retrievalTerms = joinCommaSeparated(
    semanticLayer?.retrieval_terms ?? deriveRuleWizardRetrievalTerms(input.form),
  );
  const retrievalSnippets = joinLineSeparated(
    semanticLayer?.retrieval_snippets ?? deriveRuleWizardRetrievalSnippets(input.form),
  );
  const evidencePreview = collectRuleWizardEvidencePreview(input.form, semanticLayer);
  const confidenceScore = resolveRuleWizardConfidenceScore(input.form);

  return {
    semanticLayer,
    ruleType,
    riskLevel,
    moduleScope,
    manuscriptTypes,
    semanticSummary,
    retrievalTerms,
    retrievalSnippets,
    suggestedPackage: resolveRuleWizardSuggestedPackage(input.form, ruleType),
    applicableScenario: formatRuleWizardApplicableScenario(moduleScope, manuscriptTypes),
    triggerExplanation: semanticLayer?.retrieval_terms?.length
      ? `AI 基于检索词“${joinCommaSeparated(semanticLayer.retrieval_terms)}”识别该规则。`
      : "AI 主要根据规则正文、示例和来源依据抽取语义结论。",
    inapplicableConditions:
      input.form.conflictNotes.trim() || "当前未补充明确的不适用条件。",
    evidencePreview,
    confidenceScore,
    confidenceLabel: formatRuleWizardConfidenceLabel(confidenceScore),
    warnings: input.suggestion?.warnings ?? [],
  };
}

export function createRuleWizardConfirmFormState(input: {
  form: RuleWizardEntryFormState;
  revision?: KnowledgeRevisionViewModel;
  suggestion?: KnowledgeLibrarySemanticAssistSuggestionViewModel;
}): RuleWizardConfirmFormState {
  const semanticViewModel = createRuleWizardSemanticViewModel(input);

  return {
    ruleType: semanticViewModel.ruleType,
    riskLevel: semanticViewModel.riskLevel,
    moduleScope: semanticViewModel.moduleScope,
    manuscriptTypes: semanticViewModel.manuscriptTypes,
    semanticSummary: semanticViewModel.semanticSummary,
    retrievalTerms: semanticViewModel.retrievalTerms,
    retrievalSnippets: semanticViewModel.retrievalSnippets,
  };
}

export function confirmSemanticLayerInput(
  form: RuleWizardConfirmFormState,
): KnowledgeSemanticLayerInput {
  return {
    pageSummary: form.semanticSummary.trim(),
    retrievalTerms: splitCommaSeparated(form.retrievalTerms),
    ...(splitLineSeparated(form.retrievalSnippets)
      ? { retrievalSnippets: splitLineSeparated(form.retrievalSnippets) }
      : {}),
  };
}

export function createRuleWizardSemanticDraftUpdateInput(
  form: RuleWizardConfirmFormState,
): UpdateKnowledgeLibraryDraftInput {
  return {
    summary: form.semanticSummary.trim() || undefined,
    moduleScope: form.moduleScope,
    manuscriptTypes: parseRuleWizardManuscriptTypes(form.manuscriptTypes),
    riskTags: [form.ruleType, form.riskLevel],
  };
}

export async function regenerateRuleWizardSemanticLayer(
  client: KnowledgeLibraryHttpClient,
  revisionId: string,
  form: RuleWizardEntryFormState,
): Promise<RegenerateRuleWizardSemanticResult> {
  const revision = (
    await regenerateKnowledgeSemanticLayer(client, revisionId, {
      pageSummary: form.ruleBody.trim() || undefined,
      retrievalTerms: deriveRuleWizardRetrievalTerms(form),
      retrievalSnippets: deriveRuleWizardRetrievalSnippets(form),
    })
  ).body;
  const suggestion = (
    await assistKnowledgeRevisionSemanticLayer(client, revisionId, {
      instructionText:
        "请为规则中心整理可直接确认的语义摘要、检索词和元数据修正建议，只保留高频治理维度。",
      targetScopes: ["semantic_layer", "metadata_patch"],
    })
  ).body;

  return {
    revision,
    suggestion,
    semanticViewModel: createRuleWizardSemanticViewModel({
      form,
      revision,
      suggestion,
    }),
  };
}

export async function confirmRuleWizardSemanticLayer(
  client: KnowledgeLibraryHttpClient,
  revisionId: string,
  entryForm: RuleWizardEntryFormState,
  form: RuleWizardConfirmFormState,
): Promise<ConfirmRuleWizardSemanticResult> {
  const detail = (
    await updateKnowledgeRevisionDraft(
      client,
      revisionId,
      createRuleWizardSemanticDraftUpdateInput(form),
    )
  ).body;
  const confirmedRevision = (
    await confirmKnowledgeSemanticLayer(client, revisionId, confirmSemanticLayerInput(form))
  ).body;
  const selectedRevision =
    detail.selected_revision.id === confirmedRevision.id
      ? confirmedRevision
      : detail.selected_revision;

  return {
    detail: {
      ...detail,
      selected_revision: selectedRevision,
      revisions: detail.revisions.map((revision) =>
        revision.id === confirmedRevision.id ? confirmedRevision : revision,
      ),
    },
    semanticViewModel: createRuleWizardSemanticViewModel({
      form: entryForm,
      revision: confirmedRevision,
      suggestion: {
        suggestedSemanticLayer: confirmSemanticLayerInput(form),
        suggestedFieldPatch: createRuleWizardSemanticDraftUpdateInput(form),
        warnings: [],
      },
    }),
  };
}

export function createRuleDraftContentBlocks(
  form: RuleWizardEntryFormState,
  revisionId: string,
): KnowledgeContentBlockViewModel[] {
  const blockDrafts = [
    form.ruleBody.trim().length > 0
      ? createTextBlock(revisionId, 0, "规则正文", form.ruleBody)
      : null,
    form.positiveExample.trim().length > 0
      ? createTextBlock(revisionId, 1, "正例示例", form.positiveExample)
      : null,
    form.negativeExample.trim().length > 0
      ? createTextBlock(revisionId, 2, "反例示例", form.negativeExample)
      : null,
    form.imageEvidence.trim().length > 0
      ? createImageBlock(revisionId, 3, form.imageEvidence)
      : null,
    form.sourceBasis.trim().length > 0
      ? createTextBlock(revisionId, 4, "来源依据", form.sourceBasis)
      : null,
  ];

  return blockDrafts.filter(
    (block): block is KnowledgeContentBlockViewModel => block != null,
  );
}

export async function saveRuleWizardEntryDraft(
  client: KnowledgeLibraryHttpClient,
  input: SaveRuleWizardEntryDraftInput,
): Promise<SaveRuleWizardEntryDraftResult> {
  const detail =
    input.draftRevisionId == null
      ? (
          await createKnowledgeLibraryDraft(client, createRuleDraftInput(input.form))
        ).body
      : (
          await updateKnowledgeRevisionDraft(
            client,
            input.draftRevisionId,
            createRuleDraftUpdateInput(input.form),
          )
        ).body;
  const draftRevisionId = detail.selected_revision.id;
  const nextRevision = (
    await replaceKnowledgeRevisionContentBlocks(client, draftRevisionId, {
      blocks: createRuleDraftContentBlocks(input.form, draftRevisionId),
    })
  ).body;

  return {
    detail: {
      ...detail,
      selected_revision: nextRevision,
      revisions: detail.revisions.map((revision) =>
        revision.id === nextRevision.id ? nextRevision : revision,
      ),
    },
    draftAssetId: detail.asset.id,
    draftRevisionId,
  };
}

function createTextBlock(
  revisionId: string,
  orderNo: number,
  label: string,
  text: string,
): KnowledgeContentBlockViewModel {
  return {
    id: `rule-entry-${orderNo + 1}`,
    revision_id: revisionId,
    block_type: "text_block",
    order_no: orderNo,
    status: "active",
    content_payload: {
      label,
      text: text.trim(),
    },
  };
}

function createImageBlock(
  revisionId: string,
  orderNo: number,
  note: string,
): KnowledgeContentBlockViewModel {
  return {
    id: `rule-entry-${orderNo + 1}`,
    revision_id: revisionId,
    block_type: "image_block",
    order_no: orderNo,
    status: "active",
    content_payload: {
      label: "图片 / 图表 / 截图",
      note: note.trim(),
    },
  };
}

function parseRuleWizardManuscriptTypes(value: string): ManuscriptType[] | "any" {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === "any") {
    return "any";
  }

  return trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is ManuscriptType => entry.length > 0);
}

function toOptionalStringArray(value: string): string[] | undefined {
  const normalized = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function resolveRuleWizardSemanticLayer(input: {
  form: RuleWizardEntryFormState;
  revision?: KnowledgeRevisionViewModel;
  suggestion?: KnowledgeLibrarySemanticAssistSuggestionViewModel;
}): KnowledgeSemanticLayerViewModel | undefined {
  const revisionSemanticLayer = input.revision?.semantic_layer;
  const suggestedSemanticLayer = input.suggestion?.suggestedSemanticLayer;

  if (!revisionSemanticLayer && !suggestedSemanticLayer) {
    return undefined;
  }

  return {
    revision_id: input.revision?.id ?? "pending-semantic-layer",
    status: revisionSemanticLayer?.status ?? "pending_confirmation",
    page_summary:
      suggestedSemanticLayer?.pageSummary ?? revisionSemanticLayer?.page_summary,
    retrieval_terms:
      suggestedSemanticLayer?.retrievalTerms ?? revisionSemanticLayer?.retrieval_terms,
    retrieval_snippets:
      suggestedSemanticLayer?.retrievalSnippets ??
      revisionSemanticLayer?.retrieval_snippets,
    table_semantics:
      suggestedSemanticLayer?.tableSemantics ?? revisionSemanticLayer?.table_semantics,
    image_understanding:
      suggestedSemanticLayer?.imageUnderstanding ??
      revisionSemanticLayer?.image_understanding,
  };
}

function resolveRuleWizardRuleType(input: {
  form: RuleWizardEntryFormState;
  revision?: KnowledgeRevisionViewModel;
  suggestion?: KnowledgeLibrarySemanticAssistSuggestionViewModel;
}): RuleWizardSemanticRuleType {
  const joinedText = [
    input.form.title,
    input.form.ruleBody,
    input.form.packageHints,
    input.suggestion?.suggestedFieldPatch?.summary,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  if (/term|terminology|术语|缩略|名词/u.test(joinedText)) {
    return "terminology_consistency";
  }

  if (/format|style|排版|格式|标题/u.test(joinedText)) {
    return "format_normalization";
  }

  if (/citation|reference|引用|参考文献/u.test(joinedText)) {
    return "citation_requirement";
  }

  if (/content|summary|内容|缺失|完整/u.test(joinedText)) {
    return "content_requirement";
  }

  return "other";
}

function resolveRuleWizardRiskLevel(
  input: {
    form: RuleWizardEntryFormState;
    revision?: KnowledgeRevisionViewModel;
  },
  suggestedRiskTags?: string[],
): RuleWizardSemanticRiskLevel {
  const riskTags = [
    ...(suggestedRiskTags ?? []),
    ...(input.revision?.routing.risk_tags ?? []),
    ...(toOptionalStringArray(input.form.riskTags) ?? []),
  ].join(" ");

  if (/high|critical|严重|高/u.test(riskTags) || /必须|不得/u.test(input.form.ruleBody)) {
    return "high";
  }

  if (/low|轻/u.test(riskTags)) {
    return "low";
  }

  return "medium";
}

function deriveRuleWizardRetrievalTerms(form: RuleWizardEntryFormState): string[] {
  const inferredTerms = [
    form.title.trim(),
    ...(toOptionalStringArray(form.riskTags) ?? []),
    ...(toOptionalStringArray(form.packageHints) ?? []),
  ].filter((value) => value.length > 0);

  return inferredTerms.length > 0 ? inferredTerms : ["规则治理", "语义确认"];
}

function deriveRuleWizardRetrievalSnippets(form: RuleWizardEntryFormState): string[] {
  const snippets = [
    form.ruleBody.trim(),
    form.positiveExample.trim(),
    form.sourceBasis.trim(),
  ].filter((value) => value.length > 0);

  return snippets.length > 0 ? snippets : ["等待补充可供 AI 识别的正文或示例。"];
}

function collectRuleWizardEvidencePreview(
  form: RuleWizardEntryFormState,
  semanticLayer?: KnowledgeSemanticLayerViewModel,
): string[] {
  const evidence = [
    form.ruleBody.trim(),
    form.positiveExample.trim(),
    form.negativeExample.trim(),
    form.sourceBasis.trim(),
    ...(semanticLayer?.retrieval_snippets ?? []),
  ].filter((value) => value.length > 0);

  return evidence.slice(0, 4);
}

function resolveRuleWizardConfidenceScore(form: RuleWizardEntryFormState): number {
  const evidenceCount = [
    form.ruleBody,
    form.positiveExample,
    form.negativeExample,
    form.imageEvidence,
    form.sourceBasis,
  ].filter((value) => value.trim().length > 0).length;

  if (evidenceCount >= 4) {
    return 0.91;
  }

  if (evidenceCount >= 2) {
    return 0.78;
  }

  return 0.56;
}

function resolveRuleWizardSuggestedPackage(
  form: RuleWizardEntryFormState,
  ruleType: RuleWizardSemanticRuleType,
): string {
  if (form.packageHints.trim().length > 0) {
    return form.packageHints.trim();
  }

  if (ruleType === "terminology_consistency") {
    return "医学专业校对包";
  }

  return "通用校对包";
}

function formatRuleWizardApplicableScenario(
  moduleScope: ManuscriptModule | "any",
  manuscriptTypes: string,
): string {
  const moduleLabel =
    moduleScope === "any"
      ? "全部模块"
      : moduleScope === "screening"
        ? "初筛"
        : moduleScope === "proofreading"
          ? "校对"
          : "编辑";
  const manuscriptLabel = manuscriptTypes.trim().length > 0 ? manuscriptTypes : "any";

  return `${moduleLabel} / ${manuscriptLabel}`;
}

function formatRuleWizardConfidenceLabel(score: number): string {
  if (score >= 0.85) {
    return "高可信";
  }

  if (score >= 0.7) {
    return "中可信";
  }

  return "低可信";
}

function formatRuleWizardManuscriptTypes(
  manuscriptTypes: ManuscriptType[] | "any",
): string {
  return manuscriptTypes === "any" ? "any" : manuscriptTypes.join(", ");
}

function joinCommaSeparated(value: string[] | undefined): string {
  return value?.join(", ") ?? "";
}

function joinLineSeparated(value: string[] | undefined): string {
  return value?.join("\n") ?? "";
}

function splitCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function splitLineSeparated(value: string): string[] | undefined {
  const normalized = value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return normalized.length > 0 ? normalized : undefined;
}
