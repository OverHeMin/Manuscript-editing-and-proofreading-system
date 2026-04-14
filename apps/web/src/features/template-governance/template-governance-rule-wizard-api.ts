import {
  createKnowledgeLibraryDraft,
  replaceKnowledgeRevisionContentBlocks,
  updateKnowledgeRevisionDraft,
  type KnowledgeLibraryHttpClient,
} from "../knowledge-library/knowledge-library-api.ts";
import type {
  CreateKnowledgeLibraryDraftInput,
  KnowledgeAssetDetailViewModel,
  KnowledgeContentBlockViewModel,
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
