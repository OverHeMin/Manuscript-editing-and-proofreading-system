import {
  assistKnowledgeRevisionSemanticLayer,
  confirmKnowledgeSemanticLayer,
  createKnowledgeDraftRevision,
  createKnowledgeLibraryDraft,
  listKnowledgeLibraryAssets,
  submitKnowledgeRevisionForReview,
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
  KnowledgeRevisionBindingInput,
  KnowledgeRevisionViewModel,
  KnowledgeSemanticLayerInput,
  KnowledgeSemanticLayerViewModel,
  UpdateKnowledgeLibraryDraftInput,
} from "../knowledge-library/types.ts";
import {
  listJournalTemplateProfilesByTemplateFamilyId,
  listTemplateFamilies,
} from "../templates/index.ts";
import type { KnowledgeSourceType } from "../knowledge/index.ts";
import type { ManuscriptModule, ManuscriptType } from "../manuscripts/types.ts";
import {
  EDITORIAL_MANUSCRIPT_TYPE_OPTIONS,
  formatEditorialManuscriptTypeLabel,
} from "../shared/editorial-taxonomy.ts";
import {
  listManuscriptQualityPackages,
} from "../manuscript-quality-packages/manuscript-quality-packages-api.ts";
import type {
  ManuscriptQualityPackageKind,
  ManuscriptQualityPackageViewModel,
} from "../manuscript-quality-packages/types.ts";
import {
  formatQualityPackageBindingDisplayLabel,
  formatQualityPackageExactBindingLabel,
  formatQualityPackageKindBindingLabel,
  isQualityPackageKindBindingId,
} from "../manuscript-quality-packages/binding-kind-options.ts";

type RuleWizardStructuredManuscriptTypes = ManuscriptType[] | "any";
type RuleWizardStringListInput = readonly string[] | string;
const ruleWizardManuscriptTypeOptions: readonly ManuscriptType[] =
  EDITORIAL_MANUSCRIPT_TYPE_OPTIONS;

export interface RuleWizardEntryFormState {
  title: string;
  moduleScope: ManuscriptModule | "any";
  manuscriptTypes: RuleWizardStructuredManuscriptTypes;
  sourceType: KnowledgeSourceType;
  contributor: string;
  ruleBody: string;
  positiveExample: string;
  negativeExample: string;
  imageEvidence: string;
  sourceBasis: string;
  advancedTagsExpanded: boolean;
  sections: string[];
  riskTags: string[];
  packageHints: string[];
  candidateOnly: boolean;
  conflictNotes: string;
  supplementalBlocks?: KnowledgeContentBlockViewModel[];
}

export interface RuleWizardEntryFormStateInput {
  title?: string;
  moduleScope?: ManuscriptModule | "any";
  manuscriptTypes?: RuleWizardStructuredManuscriptTypes | string;
  sourceType?: KnowledgeSourceType;
  contributor?: string;
  ruleBody?: string;
  positiveExample?: string;
  negativeExample?: string;
  imageEvidence?: string;
  sourceBasis?: string;
  advancedTagsExpanded?: boolean;
  sections?: RuleWizardStringListInput;
  riskTags?: RuleWizardStringListInput;
  packageHints?: RuleWizardStringListInput;
  candidateOnly?: boolean;
  conflictNotes?: string;
  supplementalBlocks?: readonly KnowledgeContentBlockViewModel[];
}

export interface SaveRuleWizardEntryDraftInput {
  form: RuleWizardEntryFormStateInput;
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
  manuscriptTypes: RuleWizardStructuredManuscriptTypes;
  semanticSummary: string;
  retrievalTerms: string[];
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
  manuscriptTypes: RuleWizardStructuredManuscriptTypes;
  semanticSummary: string;
  retrievalTerms: string[];
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

export interface RuleWizardBindingOption {
  id: string;
  label: string;
}

export interface RuleWizardKnowledgeItemOption extends RuleWizardBindingOption {
  knowledgeKind: Exclude<CreateKnowledgeLibraryDraftInput["knowledgeKind"], "rule">;
  status: KnowledgeRevisionViewModel["status"];
  moduleScope: ManuscriptModule | "any";
  manuscriptTypes: RuleWizardStructuredManuscriptTypes;
}

export interface RuleWizardTemplateFamilyOption {
  id: string;
  name: string;
  manuscriptType: ManuscriptType;
}

export interface RuleWizardJournalTemplateOption extends RuleWizardBindingOption {
  familyId: string;
  familyName: string;
  journalKey: string;
}

export interface RuleWizardBindingOptions {
  generalPackages: RuleWizardBindingOption[];
  medicalPackages: RuleWizardBindingOption[];
  templateFamilies: RuleWizardTemplateFamilyOption[];
  journalTemplates: RuleWizardJournalTemplateOption[];
  knowledgeItems: RuleWizardKnowledgeItemOption[];
}

export interface RuleWizardBindingFormState {
  selectedPackageKind: "general_package" | "medical_package";
  selectedPackageId: string;
  selectedPackageLabel: string;
  reuseStrategy: "reuse_existing" | "new_binding";
  selectedTemplateFamilies: Array<{
    id: string;
    name: string;
  }>;
  selectedJournalTemplates: Array<{
    id: string;
    name: string;
  }>;
  selectedKnowledgeItems: Array<{
    id: string;
    title: string;
  }>;
}

export type RuleWizardReleaseAction = "save_draft" | "submit_review" | "publish_now";

export interface RuleWizardPublishFormState {
  releaseAction: RuleWizardReleaseAction;
  reviewNote: string;
}

export interface RuleWizardBindingDraftResult {
  detail: KnowledgeAssetDetailViewModel;
  bindingInputs: KnowledgeRevisionBindingInput[];
}

export interface RuleWizardEvidenceGateItem {
  blockId: string;
  blockType: KnowledgeContentBlockViewModel["block_type"];
  orderNo: number;
  title: string;
  statusLabel: string;
  detail: string;
  blocking: boolean;
}

export interface RuleWizardEvidenceGateSummary {
  itemCount: number;
  readyItemCount: number;
  blockingItemCount: number;
  items: RuleWizardEvidenceGateItem[];
  hasBlockingIssues: boolean;
  blockingMessage: string | null;
}

export function createRuleWizardEntryFormState(
  input: RuleWizardEntryFormStateInput = {},
): RuleWizardEntryFormState {
  return {
    title: input.title ?? "",
    moduleScope: input.moduleScope ?? "editing",
    manuscriptTypes: normalizeRuleWizardManuscriptTypes(
      input.manuscriptTypes ?? "clinical_study",
    ),
    sourceType: input.sourceType ?? "guideline",
    contributor: input.contributor ?? "",
    ruleBody: input.ruleBody ?? "",
    positiveExample: input.positiveExample ?? "",
    negativeExample: input.negativeExample ?? "",
    imageEvidence: input.imageEvidence ?? "",
    sourceBasis: input.sourceBasis ?? "",
    advancedTagsExpanded: input.advancedTagsExpanded ?? false,
    sections: normalizeRuleWizardStringList(input.sections),
    riskTags: normalizeRuleWizardStringList(input.riskTags),
    packageHints: normalizeRuleWizardStringList(input.packageHints),
    candidateOnly: input.candidateOnly ?? false,
    conflictNotes: input.conflictNotes ?? "",
    supplementalBlocks: normalizeSupplementalBlocks(
      input.supplementalBlocks ?? [],
      "draft-revision",
      0,
    ),
  };
}

export function createRuleDraftInput(
  form: RuleWizardEntryFormStateInput,
): CreateKnowledgeLibraryDraftInput {
  const normalizedForm = createRuleWizardEntryFormState(form);

  return {
    title: normalizedForm.title.trim(),
    canonicalText: normalizedForm.ruleBody.trim(),
    knowledgeKind: "rule",
    moduleScope: normalizedForm.moduleScope,
    manuscriptTypes: normalizedForm.manuscriptTypes,
    ...(normalizedForm.sourceType ? { sourceType: normalizedForm.sourceType } : {}),
    ...(toOptionalStringArray(normalizedForm.sections)
      ? { sections: toOptionalStringArray(normalizedForm.sections) }
      : {}),
    ...(toOptionalStringArray(normalizedForm.riskTags)
      ? { riskTags: toOptionalStringArray(normalizedForm.riskTags) }
      : {}),
  };
}

export function createRuleDraftUpdateInput(
  form: RuleWizardEntryFormStateInput,
): UpdateKnowledgeLibraryDraftInput {
  return createRuleDraftInput(form);
}

export function createRuleWizardSemanticViewModel(input: {
  form: RuleWizardEntryFormState | RuleWizardEntryFormStateInput;
  revision?: KnowledgeRevisionViewModel;
  suggestion?: KnowledgeLibrarySemanticAssistSuggestionViewModel;
}): RuleWizardSemanticViewModel {
  const normalizedForm = createRuleWizardEntryFormState(input.form);
  const semanticLayer = resolveRuleWizardSemanticLayer(input);
  const suggestedFieldPatch = input.suggestion?.suggestedFieldPatch;
  const moduleScope =
    suggestedFieldPatch?.moduleScope ??
    input.revision?.routing.module_scope ??
    normalizedForm.moduleScope;
  const normalizedManuscriptTypes = normalizeRuleWizardManuscriptTypes(
    suggestedFieldPatch?.manuscriptTypes ??
      input.revision?.routing.manuscript_types ??
      normalizedForm.manuscriptTypes,
  );
  const riskLevel = resolveRuleWizardRiskLevel(input, suggestedFieldPatch?.riskTags);
  const ruleType = resolveRuleWizardRuleType(input);
  const semanticSummary =
    semanticLayer?.page_summary?.trim() ||
    suggestedFieldPatch?.summary?.trim() ||
    input.revision?.summary?.trim() ||
    normalizedForm.ruleBody.trim();
  const retrievalTerms =
    semanticLayer?.retrieval_terms ?? deriveRuleWizardRetrievalTerms(normalizedForm);
  const retrievalSnippets = joinLineSeparated(
    semanticLayer?.retrieval_snippets ?? deriveRuleWizardRetrievalSnippets(normalizedForm),
  );
  const evidencePreview = collectRuleWizardEvidencePreview(normalizedForm, semanticLayer);
  const confidenceScore = resolveRuleWizardConfidenceScore(normalizedForm);

  return {
    semanticLayer,
    ruleType,
    riskLevel,
    moduleScope,
    manuscriptTypes: normalizedManuscriptTypes,
    semanticSummary,
    retrievalTerms,
    retrievalSnippets,
    suggestedPackage: resolveRuleWizardSuggestedPackage(normalizedForm, ruleType),
    applicableScenario: formatRuleWizardApplicableScenario(
      moduleScope,
      normalizedManuscriptTypes,
    ),
    triggerExplanation: semanticLayer?.retrieval_terms?.length
      ? `AI 基于检索词“${joinCommaSeparated(semanticLayer.retrieval_terms)}”识别该规则。`
      : "AI 主要根据规则正文、示例和来源依据抽取语义结论。",
    inapplicableConditions:
      normalizedForm.conflictNotes.trim() || "当前未补充明确的不适用条件。",
    evidencePreview,
    confidenceScore,
    confidenceLabel: formatRuleWizardConfidenceLabel(confidenceScore),
    warnings: input.suggestion?.warnings ?? [],
  };
}

export function createRuleWizardConfirmFormState(input: {
  form: RuleWizardEntryFormState | RuleWizardEntryFormStateInput;
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
    retrievalTerms: [...semanticViewModel.retrievalTerms],
    retrievalSnippets: semanticViewModel.retrievalSnippets,
  };
}

export function createRuleWizardBindingFormState(input: {
  semanticViewModel?: RuleWizardSemanticViewModel;
  options?: RuleWizardBindingOptions;
  detail?: Pick<KnowledgeAssetDetailViewModel, "selected_revision">;
} = {}): RuleWizardBindingFormState {
  const packageKind =
    input.semanticViewModel?.suggestedPackage.includes("医学") ||
    input.semanticViewModel?.ruleType === "terminology_consistency"
      ? "medical_package"
      : "general_package";
  const detailBindings = input.detail?.selected_revision.bindings ?? [];
  const selectedPackageBinding = detailBindings.find(
    (binding) =>
      binding.binding_kind === "general_package" ||
      binding.binding_kind === "medical_package",
  );
  const resolvedPackageKind =
    selectedPackageBinding?.binding_kind === "medical_package"
      ? "medical_package"
      : selectedPackageBinding?.binding_kind === "general_package"
        ? "general_package"
        : packageKind;
  const packageOptions =
    resolvedPackageKind === "medical_package"
      ? input.options?.medicalPackages ?? []
      : input.options?.generalPackages ?? [];
  const selectedPackage = pickDefaultRuleWizardPackageOption(packageOptions);
  const selectedTemplateFamilies = detailBindings
    .filter((binding) => binding.binding_kind === "template_family")
    .map((binding) => ({
      id: binding.binding_target_id,
      name: binding.binding_target_label,
    }));
  const selectedJournalTemplates = detailBindings
    .filter((binding) => binding.binding_kind === "journal_template")
    .map((binding) => {
      const matched =
        input.options?.journalTemplates.find((item) => item.id === binding.binding_target_id) ??
        null;
      return {
        id: binding.binding_target_id,
        name: matched?.label ?? binding.binding_target_label,
      };
    });
  const selectedKnowledgeItems = detailBindings
    .filter((binding) => binding.binding_kind === "knowledge_item")
    .map((binding) => {
      const matched =
        input.options?.knowledgeItems.find((item) => item.id === binding.binding_target_id) ??
        null;
      return {
        id: binding.binding_target_id,
        title: matched?.label ?? binding.binding_target_label,
      };
    });

  if (
    selectedPackageBinding ||
    selectedTemplateFamilies.length > 0 ||
    selectedJournalTemplates.length > 0 ||
    selectedKnowledgeItems.length > 0
  ) {
    return {
      selectedPackageKind: resolvedPackageKind,
      selectedPackageId:
        selectedPackageBinding?.binding_target_id ?? selectedPackage?.id ?? "",
      selectedPackageLabel:
        selectedPackageBinding == null
          ? selectedPackage?.label ?? ""
          : formatQualityPackageBindingDisplayLabel({
              bindingKind: resolvedPackageKind,
              bindingTargetId: selectedPackageBinding.binding_target_id,
              bindingTargetLabel: selectedPackageBinding.binding_target_label,
            }),
      reuseStrategy: selectedPackageBinding ? "reuse_existing" : "new_binding",
      selectedTemplateFamilies:
        selectedTemplateFamilies.length > 0
          ? selectedTemplateFamilies
          : deriveDefaultTemplateFamilies(
              input.options?.templateFamilies ?? [],
              input.semanticViewModel?.manuscriptTypes,
            ),
      selectedJournalTemplates,
      selectedKnowledgeItems,
    };
  }

  return {
    selectedPackageKind: resolvedPackageKind,
    selectedPackageId: selectedPackage?.id ?? "",
    selectedPackageLabel: selectedPackage?.label ?? "",
    reuseStrategy:
      resolvedPackageKind === "medical_package" ? "reuse_existing" : "new_binding",
    selectedTemplateFamilies: deriveDefaultTemplateFamilies(
      input.options?.templateFamilies ?? [],
      input.semanticViewModel?.manuscriptTypes,
    ),
    selectedJournalTemplates: [],
    selectedKnowledgeItems: [],
  };
}

export function createRuleWizardPublishFormState(
  input: Partial<RuleWizardPublishFormState> = {},
): RuleWizardPublishFormState {
  return {
    releaseAction: input.releaseAction ?? "submit_review",
    reviewNote: input.reviewNote ?? "",
  };
}

export function createRuleWizardBindingInputs(
  form: RuleWizardBindingFormState,
): KnowledgeRevisionBindingInput[] {
  const bindings: KnowledgeRevisionBindingInput[] = [];

  if (form.selectedPackageId.trim().length > 0 && form.selectedPackageLabel.trim().length > 0) {
    bindings.push({
      bindingKind: form.selectedPackageKind,
      bindingTargetId: form.selectedPackageId.trim(),
      bindingTargetLabel: formatQualityPackageBindingDisplayLabel({
        bindingKind: form.selectedPackageKind,
        bindingTargetId: form.selectedPackageId.trim(),
        bindingTargetLabel: form.selectedPackageLabel.trim(),
      }),
    });
  }

  return bindings
    .concat(
      form.selectedTemplateFamilies
        .filter(
          (family) => family.id.trim().length > 0 && family.name.trim().length > 0,
        )
        .map((family) => ({
          bindingKind: "template_family" as const,
          bindingTargetId: family.id.trim(),
          bindingTargetLabel: family.name.trim(),
        })),
    )
    .concat(
      (form.selectedJournalTemplates ?? [])
        .filter(
          (template) => template.id.trim().length > 0 && template.name.trim().length > 0,
        )
        .map((template) => ({
          bindingKind: "journal_template" as const,
          bindingTargetId: template.id.trim(),
          bindingTargetLabel: template.name.trim(),
        })),
    )
    .concat(
      (form.selectedKnowledgeItems ?? [])
        .filter(
          (item) => item.id.trim().length > 0 && item.title.trim().length > 0,
        )
        .map((item) => ({
          bindingKind: "knowledge_item" as const,
          bindingTargetId: item.id.trim(),
          bindingTargetLabel: item.title.trim(),
        })),
    );
}

export function confirmSemanticLayerInput(
  form: RuleWizardConfirmFormState,
): KnowledgeSemanticLayerInput {
  return {
    pageSummary: form.semanticSummary.trim(),
    retrievalTerms: normalizeRuleWizardStringList(form.retrievalTerms),
    ...(splitLineSeparated(form.retrievalSnippets)
      ? { retrievalSnippets: splitLineSeparated(form.retrievalSnippets) }
      : {}),
  };
}

export function createRuleWizardEvidenceGateSummary(input: {
  blocks?: readonly KnowledgeContentBlockViewModel[];
  releaseAction: RuleWizardReleaseAction;
}): RuleWizardEvidenceGateSummary {
  const items = (input.blocks ?? []).flatMap((block) =>
    createRuleWizardEvidenceGateItems(block, input.releaseAction),
  );
  const blockingItems = items.filter((item) => item.blocking);
  const actionLabel = formatRuleWizardReleaseActionLabel(input.releaseAction);

  return {
    itemCount: items.length,
    readyItemCount: items.length - blockingItems.length,
    blockingItemCount: blockingItems.length,
    items,
    hasBlockingIssues: blockingItems.length > 0,
    blockingMessage:
      input.releaseAction === "save_draft" || blockingItems.length === 0
        ? null
        : blockingItems.length === 1
          ? `${blockingItems[0]?.title}未满足${actionLabel}条件：${blockingItems[0]?.detail}`
          : `当前有 ${blockingItems.length} 条高精度证据未满足${actionLabel}条件：${blockingItems
              .map((item) => item.title)
              .join("、")}`,
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
  form: RuleWizardEntryFormState | RuleWizardEntryFormStateInput,
): Promise<RegenerateRuleWizardSemanticResult> {
  const normalizedForm = createRuleWizardEntryFormState(form);
  const revision = (
    await regenerateKnowledgeSemanticLayer(client, revisionId, {
      pageSummary: normalizedForm.ruleBody.trim() || undefined,
      retrievalTerms: deriveRuleWizardRetrievalTerms(normalizedForm),
      retrievalSnippets: deriveRuleWizardRetrievalSnippets(normalizedForm),
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
      form: normalizedForm,
      revision,
      suggestion,
    }),
  };
}

export async function confirmRuleWizardSemanticLayer(
  client: KnowledgeLibraryHttpClient,
  revisionId: string,
  entryForm: RuleWizardEntryFormState | RuleWizardEntryFormStateInput,
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
      form: createRuleWizardEntryFormState(entryForm),
      revision: confirmedRevision,
      suggestion: {
        suggestedSemanticLayer: confirmSemanticLayerInput(form),
        suggestedFieldPatch: createRuleWizardSemanticDraftUpdateInput(form),
        warnings: [],
      },
    }),
  };
}

export async function loadRuleWizardBindingOptions(
  client: KnowledgeLibraryHttpClient,
): Promise<RuleWizardBindingOptions> {
  const [generalPackages, medicalPackages, templateFamilies, knowledgeItems] = await Promise.all([
    listManuscriptQualityPackages(client, {
      packageKind: "general_style_package",
      status: "published",
    }),
    listManuscriptQualityPackages(client, {
      packageKind: "medical_analyzer_package",
      status: "published",
    }),
    listTemplateFamilies(client),
    listKnowledgeLibraryAssets(client),
  ]);
  const availableTemplateFamilies = templateFamilies.body.filter(
    (family) => family.status !== "archived",
  );
  const journalTemplatesByFamily = await Promise.all(
    availableTemplateFamilies.map(async (family) => ({
      family,
      templates: (
        await listJournalTemplateProfilesByTemplateFamilyId(client, family.id)
      ).body.filter((template) => template.status === "active"),
    })),
  );

  return {
    generalPackages: createRuleWizardQualityPackageOptions(
      "general_style_package",
      generalPackages.body,
    ),
    medicalPackages: createRuleWizardQualityPackageOptions(
      "medical_analyzer_package",
      medicalPackages.body,
    ),
    templateFamilies: availableTemplateFamilies.map((family) => ({
      id: family.id,
      name: family.name,
      manuscriptType: family.manuscript_type,
    })),
    journalTemplates: journalTemplatesByFamily.flatMap(({ family, templates }) =>
      templates.map((template) => ({
        id: template.id,
        label: template.journal_name,
        familyId: family.id,
        familyName: family.name,
        journalKey: template.journal_key,
      })),
    ),
    knowledgeItems: knowledgeItems.body.items
      .filter((item) => item.status === "approved" && item.knowledge_kind !== "rule")
      .map((item) => ({
        id: item.asset_id,
        label: item.title,
        knowledgeKind: item.knowledge_kind as RuleWizardKnowledgeItemOption["knowledgeKind"],
        status: item.status,
        moduleScope: item.module_scope,
        manuscriptTypes: item.manuscript_types,
      })),
  };
}

function isRuleWizardCompatibleQualityPackage(
  record: ManuscriptQualityPackageViewModel,
): boolean {
  if (record.package_kind === "general_style_package") {
    return record.target_scopes.every((scope) => scope === "general_proofreading");
  }

  if (record.package_kind === "medical_analyzer_package") {
    return record.target_scopes.every((scope) => scope === "medical_specialized");
  }

  return false;
}

function formatRuleWizardQualityPackageLabel(
  record: ManuscriptQualityPackageViewModel,
): string {
  return formatQualityPackageExactBindingLabel({
    packageName: record.package_name,
    version: record.version,
    packageKind: record.package_kind,
  });
}

function createRuleWizardQualityPackageOptions(
  packageKind: ManuscriptQualityPackageKind,
  records: readonly ManuscriptQualityPackageViewModel[],
): RuleWizardBindingOption[] {
  const exactPackages = records
    .filter((record) => isRuleWizardCompatibleQualityPackage(record))
    .map((record) => ({
      id: record.id,
      label: formatRuleWizardQualityPackageLabel(record),
    }));

  return exactPackages.concat({
    id: packageKind,
    label: formatQualityPackageKindBindingLabel(packageKind),
  });
}

function pickDefaultRuleWizardPackageOption(
  options: readonly RuleWizardBindingOption[],
): RuleWizardBindingOption | undefined {
  return (
    options.find((option) => !isQualityPackageKindBindingId(option.id)) ?? options[0]
  );
}

export async function saveRuleWizardBindingDraft(
  client: KnowledgeLibraryHttpClient,
  revisionId: string,
  form: RuleWizardBindingFormState,
): Promise<RuleWizardBindingDraftResult> {
  const bindingInputs = createRuleWizardBindingInputs(form);
  const detail = (
    await updateKnowledgeRevisionDraft(client, revisionId, {
      bindings: bindingInputs,
    })
  ).body;

  return {
    detail,
    bindingInputs,
  };
}

export async function submitRuleWizardRevisionForReview(
  client: KnowledgeLibraryHttpClient,
  revisionId: string,
): Promise<KnowledgeAssetDetailViewModel> {
  return (await submitKnowledgeRevisionForReview(client, revisionId)).body;
}

export async function publishRuleWizardRevision(
  client: KnowledgeLibraryHttpClient,
  revisionId: string,
  reviewNote?: string,
): Promise<KnowledgeAssetDetailViewModel> {
  return (
    await client.request<KnowledgeAssetDetailViewModel>({
      method: "POST",
      url: `/api/v1/knowledge/revisions/${revisionId}/approve`,
      body: {
        actorRole: "admin",
        reviewNote,
      },
    })
  ).body;
}

function createLegacyRuleDraftContentBlocks(
  form: RuleWizardEntryFormState | RuleWizardEntryFormStateInput,
  revisionId: string,
): KnowledgeContentBlockViewModel[] {
  const normalizedForm = createRuleWizardEntryFormState(form);
  const blockDrafts = [
    normalizedForm.ruleBody.trim().length > 0
      ? createTextBlock(revisionId, 0, "规则正文", normalizedForm.ruleBody)
      : null,
    normalizedForm.positiveExample.trim().length > 0
      ? createTextBlock(revisionId, 1, "正例示例", normalizedForm.positiveExample)
      : null,
    normalizedForm.negativeExample.trim().length > 0
      ? createTextBlock(revisionId, 2, "反例示例", normalizedForm.negativeExample)
      : null,
    normalizedForm.imageEvidence.trim().length > 0
      ? createImageBlock(revisionId, 3, normalizedForm.imageEvidence)
      : null,
    normalizedForm.sourceBasis.trim().length > 0
      ? createTextBlock(revisionId, 4, "来源依据", normalizedForm.sourceBasis)
      : null,
  ];

  return blockDrafts.filter(
    (block): block is KnowledgeContentBlockViewModel => block != null,
  );
}

async function saveLegacyRuleWizardEntryDraft(
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

export function createRuleDraftContentBlocks(
  form: RuleWizardEntryFormState | RuleWizardEntryFormStateInput,
  revisionId: string,
): KnowledgeContentBlockViewModel[] {
  const normalizedForm = createRuleWizardEntryFormState(form);
  const blockDrafts: KnowledgeContentBlockViewModel[] = [];

  if (normalizedForm.ruleBody.trim().length > 0) {
    blockDrafts.push(
      createTextBlock(revisionId, blockDrafts.length, "规则正文", normalizedForm.ruleBody),
    );
  }

  if (normalizedForm.positiveExample.trim().length > 0) {
    blockDrafts.push(
      createTextBlock(
        revisionId,
        blockDrafts.length,
        "正例示例",
        normalizedForm.positiveExample,
      ),
    );
  }

  if (normalizedForm.negativeExample.trim().length > 0) {
    blockDrafts.push(
      createTextBlock(
        revisionId,
        blockDrafts.length,
        "反例示例",
        normalizedForm.negativeExample,
      ),
    );
  }

  if (normalizedForm.sourceBasis.trim().length > 0) {
    blockDrafts.push(
      createTextBlock(
        revisionId,
        blockDrafts.length,
        "来源依据",
        normalizedForm.sourceBasis,
      ),
    );
  }

  if (normalizedForm.imageEvidence.trim().length > 0) {
    blockDrafts.push(
      createImageBlock(revisionId, blockDrafts.length, normalizedForm.imageEvidence),
    );
  }

  return blockDrafts.concat(
    normalizeSupplementalBlocks(
      normalizedForm.supplementalBlocks ?? [],
      revisionId,
      blockDrafts.length,
    ),
  );
}

export function createRuleWizardEntryFormStateFromDetail(
  detail: KnowledgeAssetDetailViewModel,
): RuleWizardEntryFormState {
  const selectedRevision = detail.selected_revision;
  const recognizedText = {
    ruleBody: selectedRevision.canonical_text,
    positiveExample: "",
    negativeExample: "",
    imageEvidence: "",
    sourceBasis: "",
  };
  const supplementalBlocks: KnowledgeContentBlockViewModel[] = [];

  for (const block of [...selectedRevision.content_blocks].sort((left, right) => left.order_no - right.order_no)) {
    if (block.block_type === "text_block") {
      const label =
        typeof block.content_payload.label === "string"
          ? block.content_payload.label.trim()
          : "";
      const text =
        typeof block.content_payload.text === "string"
          ? block.content_payload.text
          : "";

      if (assignRecognizedTextBlock(recognizedText, label, text)) {
        continue;
      }

      if (label.length === 0 && recognizedText.ruleBody.trim().length === 0 && text.trim().length > 0) {
        recognizedText.ruleBody = text;
        continue;
      }
    }

    if (isLegacyImageEvidenceBlock(block)) {
      recognizedText.imageEvidence =
        typeof block.content_payload.note === "string"
          ? block.content_payload.note
          : recognizedText.imageEvidence;
      continue;
    }

    supplementalBlocks.push(block);
  }

  const packageHints = selectedRevision.bindings
    .filter(
      (binding) =>
        binding.binding_kind === "general_package" ||
        binding.binding_kind === "medical_package",
    )
    .map((binding) => binding.binding_target_label);

  return createRuleWizardEntryFormState({
    title: selectedRevision.title,
    moduleScope: selectedRevision.routing.module_scope,
    manuscriptTypes: selectedRevision.routing.manuscript_types,
    sourceType: selectedRevision.source_type ?? "guideline",
    contributor:
      selectedRevision.contributor_label ?? detail.asset.contributor_label ?? "",
    ruleBody: recognizedText.ruleBody,
    positiveExample: recognizedText.positiveExample,
    negativeExample: recognizedText.negativeExample,
    imageEvidence: recognizedText.imageEvidence,
    sourceBasis: recognizedText.sourceBasis,
    advancedTagsExpanded:
      Boolean(selectedRevision.routing.sections?.length) ||
      Boolean(selectedRevision.routing.risk_tags?.length) ||
      packageHints.length > 0,
    sections: selectedRevision.routing.sections ?? [],
    riskTags: selectedRevision.routing.risk_tags ?? [],
    packageHints,
    candidateOnly: false,
    conflictNotes: "",
    supplementalBlocks,
  });
}

export async function saveRuleWizardEntryDraft(
  client: KnowledgeLibraryHttpClient,
  input: SaveRuleWizardEntryDraftInput,
): Promise<SaveRuleWizardEntryDraftResult> {
  const detail =
    input.draftRevisionId == null
      ? input.draftAssetId
        ? (
            await createKnowledgeDraftRevision(client, input.draftAssetId)
          ).body
        : (
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
  const updatedDetail =
    input.draftRevisionId == null
      ? (
          await updateKnowledgeRevisionDraft(
            client,
            draftRevisionId,
            createRuleDraftUpdateInput(input.form),
          )
        ).body
      : detail;
  const nextRevision = (
    await replaceKnowledgeRevisionContentBlocks(client, draftRevisionId, {
      blocks: createRuleDraftContentBlocks(input.form, draftRevisionId),
    })
  ).body;

  return {
    detail: {
      ...updatedDetail,
      selected_revision: nextRevision,
      revisions: updatedDetail.revisions.map((revision) =>
        revision.id === nextRevision.id ? nextRevision : revision,
      ),
    },
    draftAssetId: updatedDetail.asset.id,
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

function normalizeSupplementalBlocks(
  blocks: readonly KnowledgeContentBlockViewModel[],
  revisionId: string,
  startOrderNo: number,
): KnowledgeContentBlockViewModel[] {
  return blocks.map((block, index) => ({
    ...block,
    revision_id: revisionId,
    order_no: startOrderNo + index,
  }));
}

function assignRecognizedTextBlock(
  state: {
    ruleBody: string;
    positiveExample: string;
    negativeExample: string;
    imageEvidence: string;
    sourceBasis: string;
  },
  label: string,
  text: string,
): boolean {
  switch (label) {
    case "规则正文":
      state.ruleBody = text;
      return true;
    case "正例示例":
      state.positiveExample = text;
      return true;
    case "反例示例":
      state.negativeExample = text;
      return true;
    case "来源依据":
      state.sourceBasis = text;
      return true;
    default:
      return false;
  }
}

function isLegacyImageEvidenceBlock(block: KnowledgeContentBlockViewModel): boolean {
  if (block.block_type !== "image_block") {
    return false;
  }

  return (
    typeof block.content_payload.note === "string" &&
    typeof block.content_payload.storage_key !== "string" &&
    typeof block.content_payload.upload_id !== "string" &&
    typeof block.content_payload.file_name !== "string"
  );
}

function normalizeRuleWizardManuscriptTypes(
  value: RuleWizardStructuredManuscriptTypes | string,
): RuleWizardStructuredManuscriptTypes {
  if (value === "any") {
    return "any";
  }

  const rawValues = Array.isArray(value) ? value : splitCommaSeparated(value);
  if (
    !Array.isArray(value) &&
    (value.trim().length === 0 || value.trim().toLowerCase() === "any")
  ) {
    return "any";
  }

  const normalized = [...new Set(rawValues.map((entry) => entry.trim()))].filter(
    (entry): entry is ManuscriptType =>
      ruleWizardManuscriptTypeOptions.includes(entry as ManuscriptType),
  );

  return normalized.length > 0 ? normalized : "any";
}

function normalizeRuleWizardStringList(value: RuleWizardStringListInput | undefined): string[] {
  if (value == null) {
    return [];
  }

  const rawValues = typeof value === "string" ? splitCommaSeparated(value) : [...value];

  return rawValues
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseRuleWizardManuscriptTypes(
  value: RuleWizardStructuredManuscriptTypes | string,
): ManuscriptType[] | "any" {
  return normalizeRuleWizardManuscriptTypes(value);
}

function toOptionalStringArray(
  value: RuleWizardStringListInput | undefined,
): string[] | undefined {
  const normalized = normalizeRuleWizardStringList(value);
  return normalized.length > 0 ? normalized : undefined;
}

function resolveRuleWizardSemanticLayer(input: {
  form: RuleWizardEntryFormState | RuleWizardEntryFormStateInput;
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
  form: RuleWizardEntryFormState | RuleWizardEntryFormStateInput;
  revision?: KnowledgeRevisionViewModel;
  suggestion?: KnowledgeLibrarySemanticAssistSuggestionViewModel;
}): RuleWizardSemanticRuleType {
  const normalizedForm = createRuleWizardEntryFormState(input.form);
  const joinedText = [
    normalizedForm.title,
    normalizedForm.ruleBody,
    joinCommaSeparated(normalizedForm.packageHints),
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
    form: RuleWizardEntryFormState | RuleWizardEntryFormStateInput;
    revision?: KnowledgeRevisionViewModel;
  },
  suggestedRiskTags?: string[],
): RuleWizardSemanticRiskLevel {
  const normalizedForm = createRuleWizardEntryFormState(input.form);
  const riskTags = [
    ...(suggestedRiskTags ?? []),
    ...(input.revision?.routing.risk_tags ?? []),
    ...normalizedForm.riskTags,
  ].join(" ");

  if (/high|critical|严重|高/u.test(riskTags) || /必须|不得/u.test(normalizedForm.ruleBody)) {
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
    ...form.riskTags,
    ...form.packageHints,
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
    ...(form.supplementalBlocks ?? [])
      .map((block) => {
        if (block.block_type === "text_block") {
          return typeof block.content_payload.text === "string"
            ? block.content_payload.text.trim()
            : "";
        }

        if (block.block_type === "image_block") {
          return typeof block.content_payload.caption === "string"
            ? block.content_payload.caption.trim()
            : "";
        }

        if (block.block_type === "table_block") {
          return Array.isArray(block.content_payload.rows) ? "表格证据" : "";
        }

        return "";
      })
      .filter((value) => value.length > 0),
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
    ...(form.supplementalBlocks ?? []).map((block) => block.block_type),
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
  if (form.packageHints.length > 0) {
    return joinCommaSeparated(form.packageHints);
  }

  if (ruleType === "terminology_consistency") {
    return "医学专业校对包";
  }

  return "通用校对包";
}

function formatRuleWizardApplicableScenario(
  moduleScope: ManuscriptModule | "any",
  manuscriptTypes: RuleWizardStructuredManuscriptTypes,
): string {
  const moduleLabel =
    moduleScope === "any"
      ? "全部模块"
      : moduleScope === "screening"
        ? "初筛"
        : moduleScope === "proofreading"
          ? "校对"
          : "编辑";
  const manuscriptLabel = formatRuleWizardManuscriptTypes(manuscriptTypes);

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
  return manuscriptTypes === "any"
    ? "全部 / 任意"
    : manuscriptTypes.map((type) => formatEditorialManuscriptTypeLabel(type)).join("、");
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

function deriveDefaultTemplateFamilies(
  options: RuleWizardTemplateFamilyOption[],
  manuscriptTypes: RuleWizardStructuredManuscriptTypes | undefined,
): Array<{ id: string; name: string }> {
  const normalizedTypes =
    manuscriptTypes == null || manuscriptTypes === "any" ? [] : manuscriptTypes;
  const matchedFamily =
    normalizedTypes.length === 0
      ? options[0]
      : options.find((option) => normalizedTypes.includes(option.manuscriptType));

  if (!matchedFamily) {
    return [];
  }

  return [
    {
      id: matchedFamily.id,
      name: matchedFamily.name,
    },
  ];
}

function createRuleWizardEvidenceGateItems(
  block: KnowledgeContentBlockViewModel,
  releaseAction: RuleWizardReleaseAction,
): RuleWizardEvidenceGateItem[] {
  if (block.block_type === "table_block") {
    const item = createRuleWizardTableEvidenceGateItem(block, releaseAction);
    return item ? [item] : [];
  }

  if (block.block_type === "image_block") {
    const item = createRuleWizardImageEvidenceGateItem(block, releaseAction);
    return item ? [item] : [];
  }

  return [];
}

function createRuleWizardTableEvidenceGateItem(
  block: KnowledgeContentBlockViewModel,
  releaseAction: RuleWizardReleaseAction,
): RuleWizardEvidenceGateItem | null {
  if (!requiresRuleWizardTableEvidenceGate(block)) {
    return null;
  }

  const tableSemantics = asRuleWizardOptionalRecord(block.table_semantics);
  const payload = asRuleWizardOptionalRecord(block.content_payload) ?? {};
  const exactCaptureAuthoritative =
    readRuleWizardRecordBoolean(tableSemantics, "exact_capture_authoritative") === true;
  const failureCodes = uniqueRuleWizardStrings([
    ...readRuleWizardRecordStringArray(tableSemantics, "exact_capture_failure_codes"),
    ...readRuleWizardRecordStringArray(payload, "exact_capture_failure_codes"),
  ]);
  const hasFailureMetadata =
    hasRuleWizardRecordKey(tableSemantics, "exact_capture_failure_codes") ||
    hasRuleWizardRecordKey(payload, "exact_capture_failure_codes");
  const isReady =
    exactCaptureAuthoritative || (hasFailureMetadata && failureCodes.length === 0);
  const blocking = releaseAction !== "save_draft" && !isReady;
  const statusLabel = blocking
    ? releaseAction === "publish_now"
      ? "阻断直接发布"
      : "阻断提交审核"
    : releaseAction === "save_draft"
      ? "草稿可保存"
      : releaseAction === "publish_now"
        ? "可直接发布"
        : "可提交审核";
  const detail =
    failureCodes.length > 0
      ? failureCodes.map(formatRuleWizardTableFailureCodeLabel).join(" / ")
      : isReady
        ? "已满足权威 exact-capture。"
        : "缺少 exact-capture 确认。";

  return {
    blockId: block.id,
    blockType: block.block_type,
    orderNo: block.order_no,
    title: `表格块 #${block.order_no + 1}`,
    statusLabel,
    detail:
      releaseAction === "save_draft" && !isReady
        ? `当前可先存草稿，正式提交前仍需补齐：${detail}`
        : detail,
    blocking,
  };
}

function createRuleWizardImageEvidenceGateItem(
  block: KnowledgeContentBlockViewModel,
  releaseAction: RuleWizardReleaseAction,
): RuleWizardEvidenceGateItem | null {
  if (!requiresRuleWizardVisualSymbolEvidenceGate(block)) {
    return null;
  }

  const payload = asRuleWizardOptionalRecord(block.content_payload) ?? {};
  const understanding = asRuleWizardOptionalRecord(block.image_understanding);
  const failures = collectRuleWizardImageEvidenceFailures(
    payload,
    understanding,
    releaseAction,
  );
  const blocking = releaseAction !== "save_draft" && failures.length > 0;
  const statusLabel = blocking
    ? releaseAction === "publish_now"
      ? "阻断直接发布"
      : "阻断提交审核"
    : releaseAction === "save_draft"
      ? "草稿可保存"
      : releaseAction === "publish_now"
        ? "可直接发布"
        : "可提交审核";
  const detail =
    failures.length > 0
      ? failures.join(" / ")
      : releaseAction === "publish_now"
        ? "视觉符号证据已确认，可直接发布。"
        : "视觉符号证据已结构化，可提交审核。";

  return {
    blockId: block.id,
    blockType: block.block_type,
    orderNo: block.order_no,
    title: `图片块 #${block.order_no + 1}`,
    statusLabel,
    detail:
      releaseAction === "save_draft" && failures.length > 0
        ? `当前可先存草稿，正式提交前仍需补齐：${detail}`
        : detail,
    blocking,
  };
}

function requiresRuleWizardTableEvidenceGate(
  block: KnowledgeContentBlockViewModel,
): boolean {
  if (block.block_type !== "table_block") {
    return false;
  }

  const payload = asRuleWizardOptionalRecord(block.content_payload);
  const tableSemantics = asRuleWizardOptionalRecord(block.table_semantics);

  return (
    hasRuleWizardRecordKey(payload, "capture_mode") ||
    hasRuleWizardRecordKey(payload, "capture_environment") ||
    hasRuleWizardRecordKey(payload, "source_application") ||
    hasRuleWizardRecordKey(payload, "exact_capture_failure_codes") ||
    hasRuleWizardRecordKey(tableSemantics, "capture_mode") ||
    hasRuleWizardRecordKey(tableSemantics, "exact_capture_authoritative") ||
    hasRuleWizardRecordKey(tableSemantics, "exact_capture_failure_codes")
  );
}

function requiresRuleWizardVisualSymbolEvidenceGate(
  block: KnowledgeContentBlockViewModel,
): boolean {
  if (block.block_type !== "image_block") {
    return false;
  }

  const payload = asRuleWizardOptionalRecord(block.content_payload);
  const understanding = asRuleWizardOptionalRecord(block.image_understanding);
  const sourceKind =
    readRuleWizardRecordString(understanding, "source_kind") ||
    readRuleWizardRecordString(payload, "source_kind");

  return (
    readRuleWizardRecordString(understanding, "snapshot_type") === "visual_symbol_snapshot" ||
    isRuleWizardStructuredVisualSymbolSourceKind(sourceKind)
  );
}

function collectRuleWizardImageEvidenceFailures(
  payload: Record<string, unknown>,
  understanding: Record<string, unknown> | undefined,
  releaseAction: RuleWizardReleaseAction,
): string[] {
  if (!understanding) {
    return ["缺少结构化视觉符号证据"];
  }

  const failures: string[] = [];
  const snapshotType = readRuleWizardRecordString(understanding, "snapshot_type");
  const sourceKind =
    readRuleWizardRecordString(understanding, "source_kind") ||
    readRuleWizardRecordString(payload, "source_kind");
  const reviewState = readRuleWizardRecordString(understanding, "review_state");
  const localContext = readRuleWizardRecordString(understanding, "local_context");
  const nearbyText = readRuleWizardRecordString(understanding, "nearby_text");
  const imageId =
    readRuleWizardRecordString(understanding, "image_id") ||
    readRuleWizardRecordString(payload, "upload_id") ||
    readRuleWizardRecordString(payload, "storage_key") ||
    readRuleWizardRecordString(payload, "file_name");

  if (snapshotType !== "visual_symbol_snapshot") {
    failures.push("未标记为视觉符号快照");
  }
  if (!isRuleWizardStructuredVisualSymbolSourceKind(sourceKind)) {
    failures.push("证据类型未确认");
  }
  if (imageId.length === 0) {
    failures.push("缺少图片文件");
  }
  if (localContext.length === 0 && nearbyText.length === 0) {
    failures.push("缺少局部上下文或邻近文本");
  }
  if (releaseAction === "publish_now") {
    if (reviewState !== "confirmed") {
      failures.push("审核状态未确认");
    }
  } else if (
    releaseAction === "submit_review" &&
    reviewState !== "pending_review" &&
    reviewState !== "confirmed"
  ) {
    failures.push("审核状态无效");
  }

  return failures;
}

function isRuleWizardStructuredVisualSymbolSourceKind(value: string): boolean {
  return (
    value === "inline_symbol_image" ||
    value === "equation_fragment_image" ||
    value === "table_embedded_symbol"
  );
}

function formatRuleWizardReleaseActionLabel(value: RuleWizardReleaseAction): string {
  switch (value) {
    case "publish_now":
      return "直接发布";
    case "submit_review":
      return "提交审核";
    case "save_draft":
    default:
      return "保存草稿";
  }
}

function formatRuleWizardTableFailureCodeLabel(value: string): string {
  switch (value) {
    case "unsupported_capture_environment":
      return "不在受支持的 exact-capture 环境";
    case "missing_required_clipboard_flavor":
      return "缺少 HTML 剪贴板";
    case "table_structure_incomplete":
      return "表格结构不完整";
    case "merged_cell_map_incomplete":
      return "合并单元格信息不完整";
    case "caption_or_note_position_unknown":
      return "表题或表注位置不明确";
    case "border_profile_incomplete":
      return "边框轮廓不完整";
    case "alignment_profile_incomplete":
      return "对齐轮廓不完整";
    case "run_style_incomplete":
      return "字形强调信息不完整";
    case "exact_capture_not_authoritative":
      return "不是权威 exact-capture";
    default:
      return value;
  }
}

function asRuleWizardOptionalRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function hasRuleWizardRecordKey(
  value: Record<string, unknown> | undefined,
  key: string,
): boolean {
  return value != null && Object.prototype.hasOwnProperty.call(value, key);
}

function readRuleWizardRecordString(
  value: Record<string, unknown> | undefined,
  key: string,
): string {
  const candidate = value?.[key];
  return typeof candidate === "string" ? candidate : "";
}

function readRuleWizardRecordBoolean(
  value: Record<string, unknown> | undefined,
  key: string,
): boolean | undefined {
  const candidate = value?.[key];
  return typeof candidate === "boolean" ? candidate : undefined;
}

function readRuleWizardRecordStringArray(
  value: Record<string, unknown> | undefined,
  key: string,
): string[] {
  const candidate = value?.[key];
  return Array.isArray(candidate)
    ? candidate.filter((item): item is string => typeof item === "string")
    : [];
}

function uniqueRuleWizardStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}
