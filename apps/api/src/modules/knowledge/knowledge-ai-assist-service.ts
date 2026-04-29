import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AiGatewayService } from "../ai-gateway/ai-gateway-service.ts";
import type { AiProviderRuntimeService } from "../ai-provider-runtime/ai-provider-runtime-service.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { ConfirmedAiTablePackage } from "../table-evidence/table-evidence-record.ts";
import type { TableEvidenceService } from "../table-evidence/table-evidence-service.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import type { KnowledgeRepository } from "./knowledge-repository.ts";
import type {
  KnowledgeContentBlockRecord,
  KnowledgeKind,
  KnowledgeRevisionRecord,
  KnowledgeSemanticLayerRecord,
  KnowledgeSourceType,
} from "./knowledge-record.ts";
import {
  KnowledgeRevisionNotFoundError,
  type CreateKnowledgeLibraryDraftInput,
  type RegenerateKnowledgeSemanticLayerInput,
  type UpdateKnowledgeRevisionDraftInput,
} from "./knowledge-service.ts";

export interface KnowledgeAiIntakeSuggestionInput {
  sourceText: string;
  sourceLabel?: string;
  sourceLink?: string;
  operatorHints?: string;
}

export interface KnowledgeAiIntakeSuggestionRecord {
  suggestedDraft: CreateKnowledgeLibraryDraftInput;
  suggestedContentBlocks: KnowledgeContentBlockRecord[];
  suggestedSemanticLayer?: KnowledgeSemanticLayerRecord;
  warnings: string[];
}

export interface KnowledgeSemanticAssistInput {
  revisionId: string;
  instructionText: string;
  targetScopes?: string[];
}

export interface KnowledgeSemanticAssistSuggestionRecord {
  suggestedSemanticLayer: RegenerateKnowledgeSemanticLayerInput;
  suggestedFieldPatch?: UpdateKnowledgeRevisionDraftInput;
  warnings: string[];
}

export interface KnowledgeAiAssistGenerator {
  createIntakeSuggestion(
    input: KnowledgeAiIntakeSuggestionInput,
  ): Promise<KnowledgeAiIntakeSuggestionRecord>;
  assistSemanticLayer(input: {
    revision: KnowledgeRevisionRecord;
    contentBlocks: KnowledgeContentBlockRecord[];
    semanticLayer?: KnowledgeSemanticLayerRecord;
    instructionText: string;
    targetScopes?: string[];
    confirmedTablePackages?: ConfirmedAiTablePackage[];
    tableEvidenceInstruction?: string;
  }): Promise<KnowledgeSemanticAssistSuggestionRecord>;
}

export interface KnowledgeAiAssistServiceOptions {
  repository: Pick<
    KnowledgeRepository,
    | "findRevisionById"
    | "listContentBlocksByRevisionId"
    | "findSemanticLayerByRevisionId"
    | "listAssets"
  >;
  generator?: KnowledgeAiAssistGenerator;
  tableEvidenceService?: Pick<
    TableEvidenceService,
    "assertConfirmedRevision" | "resolveConfirmedPackagesForTarget"
  >;
}

export interface OpenAiKnowledgeAiAssistGeneratorOptions {
  aiGatewayService: Pick<AiGatewayService, "resolveModelSelection">;
  aiProviderRuntimeService: Pick<AiProviderRuntimeService, "resolveSelectionRuntime">;
  uploadRootDir?: string;
  maxInlineImageBytes?: number;
  maxInlineImageCount?: number;
  fetch?: typeof fetch;
}

interface AssistRequestContent {
  userContent: string | OpenAiChatMessageContentPart[];
  warnings: string[];
}

const TABLE_EVIDENCE_INSTRUCTION =
  "Use confirmed_table_packages as authoritative table evidence. Do not collapse U+002D, U+2013, U+2014, U+2212, U+3000, U+00A0, tabs, line breaks, or paragraph boundaries. Use run styles for superscript and subscript.";

type OpenAiChatMessageContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image_url";
      image_url: {
        url: string;
      };
    };

export class KnowledgeAiAssistUnavailableError extends Error {
  constructor(message = "Knowledge AI assist is unavailable.") {
    super(message);
    this.name = "KnowledgeAiAssistUnavailableError";
  }
}

export class KnowledgeAiAssistService {
  private readonly repository: KnowledgeAiAssistServiceOptions["repository"];

  private readonly generator?: KnowledgeAiAssistGenerator;

  private readonly tableEvidenceService?: Pick<
    TableEvidenceService,
    "assertConfirmedRevision" | "resolveConfirmedPackagesForTarget"
  >;

  constructor(options: KnowledgeAiAssistServiceOptions) {
    this.repository = options.repository;
    this.generator = options.generator;
    this.tableEvidenceService = options.tableEvidenceService;
  }

  async createIntakeSuggestion(
    input: KnowledgeAiIntakeSuggestionInput,
  ): Promise<KnowledgeAiIntakeSuggestionRecord> {
    return this.requireGenerator().createIntakeSuggestion(input);
  }

  async assistSemanticLayer(
    input: KnowledgeSemanticAssistInput,
  ): Promise<KnowledgeSemanticAssistSuggestionRecord> {
    const revision = await this.repository.findRevisionById(input.revisionId);
    if (!revision) {
      throw new KnowledgeRevisionNotFoundError(input.revisionId);
    }

    const contentBlocks = this.repository.listContentBlocksByRevisionId
      ? await this.repository.listContentBlocksByRevisionId(input.revisionId)
      : [];
    const semanticLayer = this.repository.findSemanticLayerByRevisionId
      ? await this.repository.findSemanticLayerByRevisionId(input.revisionId)
      : undefined;
    const confirmedTablePackages = this.tableEvidenceService
      ? await this.tableEvidenceService.resolveConfirmedPackagesForTarget(
          "knowledge_revision",
          input.revisionId,
        )
      : [];

    return this.requireGenerator().assistSemanticLayer({
      revision,
      contentBlocks,
      semanticLayer,
      instructionText: input.instructionText,
      targetScopes: input.targetScopes,
      confirmedTablePackages,
      tableEvidenceInstruction: TABLE_EVIDENCE_INSTRUCTION,
    });
  }

  private requireGenerator(): KnowledgeAiAssistGenerator {
    if (!this.generator) {
      throw new KnowledgeAiAssistUnavailableError();
    }

    return this.generator;
  }
}

export class OpenAiKnowledgeAiAssistGenerator
  implements KnowledgeAiAssistGenerator
{
  private readonly uploadRootDir?: string;

  private readonly maxInlineImageBytes: number;

  private readonly maxInlineImageCount: number;

  private readonly aiGatewayService: Pick<AiGatewayService, "resolveModelSelection">;

  private readonly aiProviderRuntimeService: Pick<
    AiProviderRuntimeService,
    "resolveSelectionRuntime"
  >;

  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAiKnowledgeAiAssistGeneratorOptions) {
    this.aiGatewayService = options.aiGatewayService;
    this.aiProviderRuntimeService = options.aiProviderRuntimeService;
    this.uploadRootDir = options.uploadRootDir
      ? path.resolve(options.uploadRootDir)
      : undefined;
    this.maxInlineImageBytes =
      options.maxInlineImageBytes ?? 5 * 1024 * 1024;
    this.maxInlineImageCount = options.maxInlineImageCount ?? 3;
    this.fetchImpl = options.fetch ?? fetch;
  }

  async createIntakeSuggestion(
    input: KnowledgeAiIntakeSuggestionInput,
  ): Promise<KnowledgeAiIntakeSuggestionRecord> {
    const payload = await this.requestJson({
      module: "editing",
      systemPrompt:
        "You are a medical knowledge-library authoring assistant. Return JSON only.",
      userPayload: {
        task: "knowledge_ai_intake",
        contract: {
          suggestedDraft: {
            title: "string",
            canonicalText: "string",
            summary: "string?",
            knowledgeKind: "rule|case_pattern|checklist|prompt_snippet|reference|other",
            moduleScope: "screening|editing|proofreading|manual|learning|any",
            manuscriptTypes: ["clinical_study|review|..."] ,
            sections: ["string"],
            riskTags: ["string"],
            disciplineTags: ["string"],
            aliases: ["string"],
            sourceType: "paper|guideline|book|website|internal_case|other",
            sourceLink: "string?",
          },
          suggestedContentBlocks: [
            {
              blockType: "text_block|table_block|image_block",
              contentPayload: {},
              tableSemantics: {},
              imageUnderstanding: {},
            },
          ],
          suggestedSemanticLayer: {
            pageSummary: "string",
            retrievalTerms: ["string"],
            retrievalSnippets: ["string"],
          },
          warnings: ["string"],
        },
        sourceText: input.sourceText,
        sourceLabel: input.sourceLabel,
        sourceLink: input.sourceLink,
        operatorHints: input.operatorHints,
      },
    });

    return normalizeIntakeSuggestion(payload);
  }

  async assistSemanticLayer(input: {
    revision: KnowledgeRevisionRecord;
    contentBlocks: KnowledgeContentBlockRecord[];
    semanticLayer?: KnowledgeSemanticLayerRecord;
    instructionText: string;
    targetScopes?: string[];
    confirmedTablePackages?: ConfirmedAiTablePackage[];
    tableEvidenceInstruction?: string;
  }): Promise<KnowledgeSemanticAssistSuggestionRecord> {
    const userPayload = {
      task: "knowledge_semantic_assist",
      contract: {
        suggestedSemanticLayer: {
          pageSummary: "string",
          retrievalTerms: ["string"],
          retrievalSnippets: ["string"],
          tableSemantics: {},
          imageUnderstanding: {},
        },
        suggestedFieldPatch: {
          summary: "string?",
          aliases: ["string"],
          sections: ["string"],
          riskTags: ["string"],
          disciplineTags: ["string"],
        },
        warnings: ["string"],
      },
      instructionText: input.instructionText,
      targetScopes: input.targetScopes,
      confirmed_table_packages: input.confirmedTablePackages ?? [],
      table_evidence_instruction:
        input.tableEvidenceInstruction ?? TABLE_EVIDENCE_INSTRUCTION,
      revision: {
        title: input.revision.title,
        canonicalText: input.revision.canonical_text,
        summary: input.revision.summary,
        knowledgeKind: input.revision.knowledge_kind,
        moduleScope: input.revision.routing.module_scope,
        manuscriptTypes: input.revision.routing.manuscript_types,
        sections: input.revision.routing.sections,
        aliases: input.revision.aliases,
      },
      semanticLayer: input.semanticLayer
        ? {
            pageSummary: input.semanticLayer.page_summary,
            retrievalTerms: input.semanticLayer.retrieval_terms,
            retrievalSnippets: input.semanticLayer.retrieval_snippets,
          }
        : undefined,
      contentBlocks: input.contentBlocks.map((block) => ({
        blockType: block.block_type,
        contentPayload: block.content_payload,
        tableSemantics: block.table_semantics,
        imageUnderstanding: block.image_understanding,
      })),
    };
    const requestContent = await this.buildAssistRequestContent({
      userPayload,
      contentBlocks: input.contentBlocks,
    });
    const payload = await this.requestJson({
      module: resolveKnowledgeAiModule(input.revision.routing.module_scope),
      systemPrompt:
        "You are a medical knowledge semantic assistant. Return JSON only and keep title ownership with the operator.",
      userPayload,
      userContent: requestContent.userContent,
    });
    const normalized = normalizeSemanticSuggestion(payload);
    return requestContent.warnings.length > 0
      ? {
          ...normalized,
          warnings: [...requestContent.warnings, ...normalized.warnings],
        }
      : normalized;
  }

  private async requestJson(input: {
    module: TemplateModule;
    systemPrompt: string;
    userPayload: Record<string, unknown>;
    userContent?: string | OpenAiChatMessageContentPart[];
  }): Promise<Record<string, unknown>> {
    const selection = await this.aiGatewayService.resolveModelSelection({
      module: input.module,
    });
    const runtime = await this.aiProviderRuntimeService.resolveSelectionRuntime(
      selection,
    );

    const response = await this.fetchImpl(runtime.primary.request_url, {
      method: "POST",
      headers: runtime.primary.headers,
      body: JSON.stringify({
        model: runtime.primary.model_name,
        messages: [
          { role: "system", content: input.systemPrompt },
          {
            role: "user",
            content: input.userContent ?? JSON.stringify(input.userPayload),
          },
        ],
        temperature: 0.2,
        response_format: {
          type: "json_object",
        },
      }),
    });

    if (!response.ok) {
      throw new KnowledgeAiAssistUnavailableError(
        `Knowledge AI assist request failed with status ${response.status}.`,
      );
    }

    const body = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | Array<{ type?: string; text?: string }>;
        };
      }>;
    };
    const content = extractOpenAiCompatibleContent(body);

    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      return parsed;
    } catch (error) {
      throw new KnowledgeAiAssistUnavailableError(
        error instanceof Error
          ? `Knowledge AI assist returned invalid JSON: ${error.message}`
          : "Knowledge AI assist returned invalid JSON.",
      );
    }
  }

  private async buildAssistRequestContent(input: {
    userPayload: Record<string, unknown>;
    contentBlocks: KnowledgeContentBlockRecord[];
  }): Promise<AssistRequestContent> {
    const imageBlocks = input.contentBlocks.filter(
      (block) => block.block_type === "image_block",
    );
    if (imageBlocks.length === 0) {
      return {
        userContent: JSON.stringify(input.userPayload),
        warnings: [],
      };
    }

    if (!this.uploadRootDir) {
      return {
        userContent: JSON.stringify(input.userPayload),
        warnings: ["存在图片附件，但当前运行时未配置图片物料目录，AI 仅参考了文件元数据与图注。"],
      };
    }

    const parts: OpenAiChatMessageContentPart[] = [
      {
        type: "text",
        text: JSON.stringify(input.userPayload),
      },
    ];
    const warnings: string[] = [];
    let inlinedImageCount = 0;

    for (const [index, block] of imageBlocks.entries()) {
      if (inlinedImageCount >= this.maxInlineImageCount) {
        warnings.push(
          `图片附件超过 ${this.maxInlineImageCount} 张时会截断，本次仅送审前 ${this.maxInlineImageCount} 张图片。`,
        );
        break;
      }

      const imageReference = await this.inlineImageBlock(block);
      if (!imageReference) {
        warnings.push(
          `图片附件 ${formatImageAttachmentLabel(block, index)} 未能作为视觉输入送入 AI，本次仅参考了文件元数据与图注。`,
        );
        continue;
      }

      parts.push({
        type: "text",
        text: `Attachment image ${index + 1}: ${imageReference.label}`,
      });
      parts.push({
        type: "image_url",
        image_url: {
          url: imageReference.dataUrl,
        },
      });
      inlinedImageCount += 1;
    }

    return {
      userContent: parts,
      warnings,
    };
  }

  private async inlineImageBlock(
    block: KnowledgeContentBlockRecord,
  ): Promise<{ dataUrl: string; label: string } | null> {
    if (!this.uploadRootDir) {
      return null;
    }

    const storageKey =
      typeof block.content_payload.storage_key === "string"
        ? block.content_payload.storage_key.trim()
        : "";
    const mimeType =
      typeof block.content_payload.mime_type === "string"
        ? block.content_payload.mime_type.trim()
        : "";
    if (!storageKey || !mimeType.startsWith("image/")) {
      return null;
    }

    let absolutePath: string;
    try {
      absolutePath = resolveStoragePath(this.uploadRootDir, storageKey);
    } catch {
      return null;
    }
    let bytes: Buffer;
    try {
      bytes = await readFile(absolutePath);
    } catch {
      return null;
    }

    if (bytes.byteLength > this.maxInlineImageBytes) {
      return null;
    }

    return {
      dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
      label: formatImageAttachmentLabel(block),
    };
  }
}

function resolveStoragePath(rootDir: string, storageKey: string): string {
  const normalizedSegments = storageKey
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  const absolutePath = path.resolve(rootDir, ...normalizedSegments);
  const relativePath = path.relative(rootDir, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new KnowledgeAiAssistUnavailableError(
      `Knowledge image attachment escaped the upload root: "${storageKey}".`,
    );
  }

  return absolutePath;
}

function formatImageAttachmentLabel(
  block: KnowledgeContentBlockRecord,
  index?: number,
): string {
  const fileName =
    typeof block.content_payload.file_name === "string"
      ? block.content_payload.file_name.trim()
      : "";
  const caption =
    typeof block.content_payload.caption === "string"
      ? block.content_payload.caption.trim()
      : "";
  const fallbackLabel = `image-${(index ?? 0) + 1}`;

  return [fileName || fallbackLabel, caption].filter(Boolean).join(" | ");
}

function normalizeIntakeSuggestion(
  payload: Record<string, unknown>,
): KnowledgeAiIntakeSuggestionRecord {
  const suggestedDraft = asRecord(payload.suggestedDraft);
  const suggestedSemanticLayer = asRecord(payload.suggestedSemanticLayer);

  return {
    suggestedDraft: {
      title: toStringValue(suggestedDraft.title),
      canonicalText: toStringValue(suggestedDraft.canonicalText),
      knowledgeKind: normalizeKnowledgeKind(suggestedDraft.knowledgeKind),
      moduleScope: normalizeModuleScope(suggestedDraft.moduleScope),
      manuscriptTypes: normalizeManuscriptTypes(suggestedDraft.manuscriptTypes),
      ...(toOptionalString(suggestedDraft.summary)
        ? { summary: toOptionalString(suggestedDraft.summary) }
        : {}),
      ...(toStringArray(suggestedDraft.sections).length > 0
        ? { sections: toStringArray(suggestedDraft.sections) }
        : {}),
      ...(toStringArray(suggestedDraft.riskTags).length > 0
        ? { riskTags: toStringArray(suggestedDraft.riskTags) }
        : {}),
      ...(toStringArray(suggestedDraft.disciplineTags).length > 0
        ? { disciplineTags: toStringArray(suggestedDraft.disciplineTags) }
        : {}),
      ...(toStringArray(suggestedDraft.aliases).length > 0
        ? { aliases: toStringArray(suggestedDraft.aliases) }
        : {}),
      ...(toOptionalString(suggestedDraft.sourceLink)
        ? { sourceLink: toOptionalString(suggestedDraft.sourceLink) }
        : {}),
      ...(normalizeSourceType(suggestedDraft.sourceType)
        ? { sourceType: normalizeSourceType(suggestedDraft.sourceType) }
        : {}),
    },
    suggestedContentBlocks: normalizeSuggestedContentBlocks(payload.suggestedContentBlocks),
    ...(Object.keys(suggestedSemanticLayer).length > 0
      ? {
          suggestedSemanticLayer: {
            revision_id: "suggested-draft",
            status: "pending_confirmation",
            page_summary: toOptionalString(suggestedSemanticLayer.pageSummary),
            retrieval_terms: toStringArray(suggestedSemanticLayer.retrievalTerms),
            retrieval_snippets: toStringArray(
              suggestedSemanticLayer.retrievalSnippets,
            ),
            ...(isRecord(suggestedSemanticLayer.tableSemantics)
              ? { table_semantics: suggestedSemanticLayer.tableSemantics }
              : {}),
            ...(isRecord(suggestedSemanticLayer.imageUnderstanding)
              ? { image_understanding: suggestedSemanticLayer.imageUnderstanding }
              : {}),
            created_at: "",
            updated_at: "",
          },
        }
      : {}),
    warnings: toStringArray(payload.warnings),
  };
}

function normalizeSemanticSuggestion(
  payload: Record<string, unknown>,
): KnowledgeSemanticAssistSuggestionRecord {
  const suggestedSemanticLayer = asRecord(payload.suggestedSemanticLayer);
  const suggestedFieldPatch = asRecord(payload.suggestedFieldPatch);

  return {
    suggestedSemanticLayer: {
      pageSummary: toOptionalString(suggestedSemanticLayer.pageSummary),
      retrievalTerms: toStringArray(suggestedSemanticLayer.retrievalTerms),
      retrievalSnippets: toStringArray(suggestedSemanticLayer.retrievalSnippets),
      ...(isRecord(suggestedSemanticLayer.tableSemantics)
        ? { tableSemantics: suggestedSemanticLayer.tableSemantics }
        : {}),
      ...(isRecord(suggestedSemanticLayer.imageUnderstanding)
        ? { imageUnderstanding: suggestedSemanticLayer.imageUnderstanding }
        : {}),
    },
    ...(Object.keys(suggestedFieldPatch).length > 0
      ? {
          suggestedFieldPatch: {
            ...(toOptionalString(suggestedFieldPatch.summary)
              ? { summary: toOptionalString(suggestedFieldPatch.summary) }
              : {}),
            ...(toStringArray(suggestedFieldPatch.aliases).length > 0
              ? { aliases: toStringArray(suggestedFieldPatch.aliases) }
              : {}),
            ...(toStringArray(suggestedFieldPatch.sections).length > 0
              ? { sections: toStringArray(suggestedFieldPatch.sections) }
              : {}),
            ...(toStringArray(suggestedFieldPatch.riskTags).length > 0
              ? { riskTags: toStringArray(suggestedFieldPatch.riskTags) }
              : {}),
            ...(toStringArray(suggestedFieldPatch.disciplineTags).length > 0
              ? { disciplineTags: toStringArray(suggestedFieldPatch.disciplineTags) }
              : {}),
          },
        }
      : {}),
    warnings: toStringArray(payload.warnings),
  };
}

function normalizeSuggestedContentBlocks(
  value: unknown,
): KnowledgeContentBlockRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry, index) => {
    const record = asRecord(entry);
    return {
      id: `suggested-block-${index + 1}`,
      revision_id: "suggested-draft",
      block_type: normalizeContentBlockType(record.blockType),
      order_no: index,
      status: "active",
      content_payload: isRecord(record.contentPayload) ? record.contentPayload : {},
      ...(isRecord(record.tableSemantics)
        ? { table_semantics: record.tableSemantics }
        : {}),
      ...(isRecord(record.imageUnderstanding)
        ? { image_understanding: record.imageUnderstanding }
        : {}),
      created_at: "",
      updated_at: "",
    };
  });
}

function extractOpenAiCompatibleContent(input: {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}): string {
  const messageContent = input.choices?.[0]?.message?.content;
  if (typeof messageContent === "string") {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("");
  }

  throw new KnowledgeAiAssistUnavailableError(
    "Knowledge AI assist response did not include message content.",
  );
}

function resolveKnowledgeAiModule(moduleScope: string): TemplateModule {
  if (
    moduleScope === "screening" ||
    moduleScope === "editing" ||
    moduleScope === "proofreading"
  ) {
    return moduleScope;
  }

  return "editing";
}

function normalizeModuleScope(value: unknown): CreateKnowledgeLibraryDraftInput["moduleScope"] {
  if (
    value === "screening" ||
    value === "editing" ||
    value === "proofreading" ||
    value === "manual" ||
    value === "learning" ||
    value === "any"
  ) {
    return value;
  }

  return "any";
}

function normalizeKnowledgeKind(value: unknown): KnowledgeKind {
  if (
    value === "rule" ||
    value === "case_pattern" ||
    value === "checklist" ||
    value === "prompt_snippet" ||
    value === "reference" ||
    value === "other"
  ) {
    return value;
  }

  return "rule";
}

function normalizeSourceType(value: unknown): KnowledgeSourceType | undefined {
  if (
    value === "paper" ||
    value === "guideline" ||
    value === "book" ||
    value === "website" ||
    value === "internal_case" ||
    value === "other"
  ) {
    return value;
  }

  return undefined;
}

function normalizeManuscriptTypes(
  value: unknown,
): CreateKnowledgeLibraryDraftInput["manuscriptTypes"] {
  const normalized = toStringArray(value).filter(
    (entry): entry is ManuscriptType => manuscriptTypeSet.has(entry as ManuscriptType),
  );
  return normalized.length > 0 ? normalized : "any";
}

const manuscriptTypeSet = new Set<ManuscriptType>([
  "clinical_study",
  "review",
  "systematic_review",
  "meta_analysis",
  "case_report",
  "guideline_interpretation",
  "expert_consensus",
  "diagnostic_study",
  "basic_research",
  "nursing_study",
  "methodology_paper",
  "brief_report",
  "other",
]);

function normalizeContentBlockType(
  value: unknown,
): KnowledgeContentBlockRecord["block_type"] {
  if (value === "table_block" || value === "image_block") {
    return value;
  }

  return "text_block";
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}
