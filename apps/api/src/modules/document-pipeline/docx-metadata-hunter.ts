import type {
  EditingMetadataCandidate,
  EditingMetadataCandidateEvidence,
  EditingMetadataCandidateRecommendedAction,
  EditingMetadataSourceZone,
} from "@medical/contracts";

export interface RawDocxBlockRecord {
  kind: string;
  text?: string;
  heading?: string;
  caption?: string | null;
  table_index?: number;
  source_zone?: EditingMetadataSourceZone | "body";
  source_locator?: string;
  semantic_role?: string;
  confidence?: number;
}

export function normalizeRawDocxBlock(value: unknown): RawDocxBlockRecord | undefined {
  const record = isRecord(value) ? value : undefined;
  if (!record || typeof record.kind !== "string") {
    return undefined;
  }

  return {
    kind: record.kind,
    text: readOptionalString(record.text),
    heading: readOptionalString(record.heading),
    caption: readOptionalString(record.caption) ?? null,
    table_index:
      typeof record.table_index === "number" && Number.isFinite(record.table_index)
        ? record.table_index
        : undefined,
    source_zone: normalizeSourceZone(record.source_zone),
    source_locator: readOptionalString(record.source_locator),
    semantic_role: readOptionalString(record.semantic_role),
    confidence: readOptionalNumber(record.confidence),
  };
}

export function buildMetadataCandidatesFromBlocks(value: unknown): EditingMetadataCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const merged = new Map<string, EditingMetadataCandidate>();

  value.forEach((entry) => {
    const block = normalizeRawDocxBlock(entry);
    if (!block) {
      return;
    }

    const blockText = resolveBlockText(block);
    const sourceZone = normalizeSourceZone(block.source_zone);
    const sourceLocator = block.source_locator ?? `unknown:${merged.size + 1}`;
    if (!blockText || !sourceZone || sourceZone === "body") {
      return;
    }

    const candidates = inferCandidatesFromBlock({
      text: blockText,
      sourceZone,
      sourceLocator,
    });
    candidates.forEach((candidate) => {
      const mergeKey = `${candidate.slot_key}::${candidate.normalized_text}`;
      const existing = merged.get(mergeKey);
      if (!existing) {
        merged.set(mergeKey, candidate);
        return;
      }

      const evidences = mergeCandidateEvidence(existing, candidate);
      merged.set(mergeKey, {
        ...existing,
        confidence: Math.max(existing.confidence, candidate.confidence),
        recommended_action:
          existing.recommended_action === "manual_review" ||
          candidate.recommended_action === "manual_review"
            ? "manual_review"
            : existing.recommended_action === "move_to_target" ||
                candidate.recommended_action === "move_to_target"
              ? "move_to_target"
              : "auto_place_candidate",
        evidences,
      });
    });
  });

  return [...merged.values()].sort((left, right) => {
    const confidenceDiff = right.confidence - left.confidence;
    if (Math.abs(confidenceDiff) > Number.EPSILON) {
      return confidenceDiff;
    }
    return left.candidate_id.localeCompare(right.candidate_id);
  });
}

function inferCandidatesFromBlock(input: {
  text: string;
  sourceZone: EditingMetadataSourceZone;
  sourceLocator: string;
}): EditingMetadataCandidate[] {
  const candidates: EditingMetadataCandidate[] = [];
  const classificationPieces = splitClassificationAndDocumentCode(input.text);
  if (classificationPieces.classificationCode) {
    candidates.push(
      createCandidate({
        slotKey: "classification_code",
        semanticRole: "classification_code",
        rawText: classificationPieces.classificationCode,
        sourceZone: input.sourceZone,
        sourceLocator: input.sourceLocator,
        confidence: 0.99,
      }),
    );
  }
  if (classificationPieces.documentCode) {
    candidates.push(
      createCandidate({
        slotKey: "document_code",
        semanticRole: "document_code",
        rawText: classificationPieces.documentCode,
        sourceZone: input.sourceZone,
        sourceLocator: input.sourceLocator,
        confidence: 0.99,
      }),
    );
  }

  const labeledCandidates = [
    extractLabeledCandidate(input, "author_bio", "author_bio", [
      /作者简介[:：]\s*(.+)$/u,
      /作者信息[:：]\s*(.+)$/u,
    ]),
    extractLabeledCandidate(
      input,
      "corresponding_author_bio",
      "corresponding_author_bio",
      [/(?:通信|通讯)作者(?:简介)?[:：]\s*(.+)$/u],
    ),
    extractLabeledCandidate(input, "funding_statement", "funding_statement", [
      /(?:基金项目|基金资助|资助项目)[:：]\s*(.+)$/u,
      /基金[:：]\s*(.+)$/u,
    ]),
  ].filter((candidate): candidate is EditingMetadataCandidate => Boolean(candidate));
  candidates.push(...labeledCandidates);

  if (isLikelyAuthorLine(input.text, input.sourceZone)) {
    candidates.push(
      createCandidate({
        slotKey: "author_line",
        semanticRole: "author_line",
        rawText: input.text,
        sourceZone: input.sourceZone,
        sourceLocator: input.sourceLocator,
        confidence: 0.84,
      }),
    );
  }

  if (isLikelyAffiliationLine(input.text, input.sourceZone)) {
    candidates.push(
      createCandidate({
        slotKey: "affiliation_line",
        semanticRole: "affiliation_line",
        rawText: input.text,
        sourceZone: input.sourceZone,
        sourceLocator: input.sourceLocator,
        confidence: 0.88,
      }),
    );
  }

  return candidates;
}

function createCandidate(input: {
  slotKey: string;
  semanticRole: string;
  rawText: string;
  sourceZone: EditingMetadataSourceZone;
  sourceLocator: string;
  confidence: number;
}): EditingMetadataCandidate {
  const rawText = input.rawText.trim();
  const normalizedText = normalizeCandidateText(rawText);
  const evidence: EditingMetadataCandidateEvidence = {
    source_zone: input.sourceZone,
    source_locator: input.sourceLocator,
  };

  return {
    candidate_id: `${input.slotKey}:${input.sourceLocator}:${normalizedText}`,
    slot_key: input.slotKey,
    raw_text: rawText,
    normalized_text: normalizedText,
    source_zone: input.sourceZone,
    source_locator: input.sourceLocator,
    semantic_role: input.semanticRole,
    confidence: input.confidence,
    recommended_action: recommendAction(input.sourceZone, input.confidence),
    evidences: [evidence],
  };
}

function extractLabeledCandidate(
  input: {
    text: string;
    sourceZone: EditingMetadataSourceZone;
    sourceLocator: string;
  },
  slotKey: string,
  semanticRole: string,
  patterns: RegExp[],
): EditingMetadataCandidate | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(input.text);
    const value = match?.[1]?.trim();
    if (!value) {
      continue;
    }

    return createCandidate({
      slotKey,
      semanticRole,
      rawText: value,
      sourceZone: input.sourceZone,
      sourceLocator: input.sourceLocator,
      confidence: 0.97,
    });
  }

  return undefined;
}

function splitClassificationAndDocumentCode(text: string): {
  classificationCode?: string;
  documentCode?: string;
} {
  const classificationMatch =
    /中图分类号[:：]?\s*(.+?)(?=(?:文献标志码|文献标识码|$))/u.exec(text);
  const documentMatch =
    /(?:文献标志码|文献标识码)[:：]\s*([A-Za-z])\b/u.exec(text) ??
    /(?:文献标志码|文献标识码)\s*([A-Za-z])\b/u.exec(text);

  return {
    classificationCode: classificationMatch?.[1]?.trim().replace(/[；;，,]+$/u, ""),
    documentCode: documentMatch?.[1]?.trim(),
  };
}

function isLikelyAuthorLine(
  text: string,
  sourceZone: EditingMetadataSourceZone,
): boolean {
  if (sourceZone !== "title_area" && sourceZone !== "front_matter") {
    return false;
  }

  const trimmed = text.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > 80 ||
    trimmed.includes("：") ||
    trimmed.includes(":") ||
    looksLikeInstitution(trimmed)
  ) {
    return false;
  }

  return /^[\p{Script=Han}A-Za-z·,\s1-9*†‡]+$/u.test(trimmed) && /[,\s、]/u.test(trimmed);
}

function isLikelyAffiliationLine(
  text: string,
  sourceZone: EditingMetadataSourceZone,
): boolean {
  if (sourceZone !== "title_area" && sourceZone !== "front_matter") {
    return false;
  }

  return looksLikeInstitution(text.trim());
}

function looksLikeInstitution(text: string): boolean {
  if (text.length === 0 || text.length > 160) {
    return false;
  }

  return /(医院|大学|学院|研究所|中心|实验室|department|hospital|university|college|institute)/iu.test(
    text,
  );
}

function recommendAction(
  sourceZone: EditingMetadataSourceZone,
  confidence: number,
): EditingMetadataCandidateRecommendedAction {
  if (sourceZone === "header" || sourceZone === "footer") {
    return "manual_review";
  }

  if (confidence >= 0.95) {
    return "auto_place_candidate";
  }

  if (confidence >= 0.8) {
    return "move_to_target";
  }

  return "manual_review";
}

function mergeCandidateEvidence(
  left: EditingMetadataCandidate,
  right: EditingMetadataCandidate,
): EditingMetadataCandidateEvidence[] {
  const seen = new Set<string>();
  const evidences = [...(left.evidences ?? []), ...(right.evidences ?? [])];
  return evidences.filter((entry) => {
    const key = `${entry.source_zone}:${entry.source_locator}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function resolveBlockText(block: RawDocxBlockRecord): string | undefined {
  if (block.kind === "heading") {
    return block.heading ?? block.text;
  }

  if (block.kind === "table") {
    return block.caption ?? undefined;
  }

  return block.text;
}

function normalizeCandidateText(value: string): string {
  return value.trim().replaceAll(/\s+/gu, " ").toLowerCase();
}

function normalizeSourceZone(
  value: unknown,
): EditingMetadataSourceZone | "body" | undefined {
  return value === "front_matter" ||
    value === "title_area" ||
    value === "abstract_neighborhood" ||
    value === "header" ||
    value === "footer" ||
    value === "document_tail" ||
    value === "suspicious_nearby_paragraph" ||
    value === "body"
    ? value
    : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
