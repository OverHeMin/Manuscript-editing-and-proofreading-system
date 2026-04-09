import type {
  KnowledgeAssetRecord,
  KnowledgeDuplicateCheckInput,
  KnowledgeDuplicateMatchRecord,
  KnowledgeDuplicateReason,
  KnowledgeDuplicateSeverity,
  KnowledgeRevisionRecord,
  KnowledgeRevisionStatus,
  KnowledgeRoutingRecord,
} from "./knowledge-record.ts";

export interface KnowledgeDuplicateCandidateRecord {
  asset: KnowledgeAssetRecord;
  revision: KnowledgeRevisionRecord;
  bindings: readonly string[];
}

interface DuplicateMatchSignals {
  reasons: KnowledgeDuplicateReason[];
  score: number;
  severity: KnowledgeDuplicateSeverity | undefined;
}

interface EvaluateDuplicateOptions {
  excludedAssetIds?: ReadonlySet<string>;
  excludedRevisionIds?: ReadonlySet<string>;
}

const DUPLICATE_SEVERITY_ORDER: Record<KnowledgeDuplicateSeverity, number> = {
  exact: 0,
  high: 1,
  possible: 2,
};

export function normalizeKnowledgeDuplicateText(value: string): string {
  return normalizeWhitespaceAndPunctuation(convertFullWidthToHalfWidth(value)).toLowerCase();
}

export function evaluateKnowledgeDuplicateMatches(
  input: KnowledgeDuplicateCheckInput,
  candidates: readonly KnowledgeDuplicateCandidateRecord[],
  options: EvaluateDuplicateOptions = {},
): KnowledgeDuplicateMatchRecord[] {
  const excludedAssetIds = options.excludedAssetIds ?? new Set<string>();
  const excludedRevisionIds = options.excludedRevisionIds ?? new Set<string>();

  const matches: KnowledgeDuplicateMatchRecord[] = [];
  for (const candidate of candidates) {
    if (
      excludedAssetIds.has(candidate.asset.id) ||
      excludedRevisionIds.has(candidate.revision.id)
    ) {
      continue;
    }

    const signals = scoreKnowledgeDuplicateCandidate(input, candidate);
    if (!signals.severity) {
      continue;
    }

    matches.push({
      severity: signals.severity,
      score: roundScore(signals.score),
      matched_asset_id: candidate.asset.id,
      matched_revision_id: candidate.revision.id,
      matched_title: candidate.revision.title,
      matched_status: candidate.revision.status,
      ...(candidate.revision.summary != null
        ? { matched_summary: candidate.revision.summary }
        : {}),
      reasons: signals.reasons,
    });
  }

  return matches.sort(compareDuplicateMatches);
}

export function selectRepresentativeRevisionForDuplicateDetection(
  revisions: readonly KnowledgeRevisionRecord[],
  options: {
    preferredApprovedRevisionId?: string;
    preferredCurrentRevisionId?: string;
  } = {},
): KnowledgeRevisionRecord | undefined {
  if (revisions.length === 0) {
    return undefined;
  }

  if (options.preferredApprovedRevisionId) {
    const preferredApproved = revisions.find(
      (revision) =>
        revision.id === options.preferredApprovedRevisionId &&
        revision.status === "approved",
    );
    if (preferredApproved) {
      return preferredApproved;
    }
  }

  const approvedRevision =
    revisions.find((revision) => revision.status === "approved") ?? undefined;
  if (approvedRevision) {
    return approvedRevision;
  }

  if (options.preferredCurrentRevisionId) {
    const preferredCurrent = revisions.find(
      (revision) =>
        revision.id === options.preferredCurrentRevisionId &&
        isWorkingRevisionStatus(revision.status),
    );
    if (preferredCurrent) {
      return preferredCurrent;
    }
  }

  const workingRevision =
    revisions.find((revision) => isWorkingRevisionStatus(revision.status)) ??
    undefined;
  return workingRevision ?? revisions[0];
}

export function mapLegacyKnowledgeRecordToDuplicateCandidate(
  record: {
    id: string;
    title: string;
    canonical_text: string;
    summary?: string;
    knowledge_kind: KnowledgeRevisionRecord["knowledge_kind"];
    status:
      | "draft"
      | "pending_review"
      | "approved"
      | "deprecated"
      | "superseded"
      | "archived";
    routing: KnowledgeRoutingRecord;
    evidence_level?: KnowledgeRevisionRecord["evidence_level"];
    source_type?: KnowledgeRevisionRecord["source_type"];
    source_link?: KnowledgeRevisionRecord["source_link"];
    aliases?: string[];
    template_bindings?: string[];
    source_learning_candidate_id?: string;
    projection_source?: KnowledgeRevisionRecord["projection_source"];
  },
): KnowledgeDuplicateCandidateRecord {
  return {
    asset: {
      id: record.id,
      status: record.status === "archived" ? "archived" : "active",
      current_revision_id: record.id,
      current_approved_revision_id:
        record.status === "approved" ? record.id : undefined,
      created_at: "",
      updated_at: "",
    },
    revision: {
      id: record.id,
      asset_id: record.id,
      revision_no: 1,
      status: mapLegacyStatusToRevisionStatus(record.status),
      title: record.title,
      canonical_text: record.canonical_text,
      summary: record.summary,
      knowledge_kind: record.knowledge_kind,
      routing: record.routing,
      evidence_level: record.evidence_level,
      source_type: record.source_type,
      source_link: record.source_link,
      aliases: record.aliases,
      source_learning_candidate_id: record.source_learning_candidate_id,
      projection_source: record.projection_source,
      created_at: "",
      updated_at: "",
    },
    bindings: [...(record.template_bindings ?? [])],
  };
}

function scoreKnowledgeDuplicateCandidate(
  input: KnowledgeDuplicateCheckInput,
  candidate: KnowledgeDuplicateCandidateRecord,
): DuplicateMatchSignals {
  const reasons: KnowledgeDuplicateReason[] = [];
  let score = 0;

  const canonicalSimilarity = calculateTextOverlapSimilarity(
    input.canonicalText,
    candidate.revision.canonical_text,
  );
  if (canonicalSimilarity >= 0.999) {
    reasons.push("canonical_text_exact_match");
    score += 90;
  } else if (canonicalSimilarity >= 0.45) {
    reasons.push("canonical_text_high_overlap");
    score += 50 * canonicalSimilarity;
  }

  const titleSimilarity = calculateTextOverlapSimilarity(
    input.title,
    candidate.revision.title,
  );
  if (titleSimilarity >= 0.999) {
    reasons.push("title_exact_match");
    score += 40;
  } else if (titleSimilarity >= 0.55) {
    reasons.push("title_high_similarity");
    score += 28 * titleSimilarity;
  }

  const aliasSimilarity = calculateListOverlapSimilarity(
    input.aliases ?? [],
    candidate.revision.aliases ?? [],
  );
  if (aliasSimilarity > 0) {
    reasons.push("alias_overlap");
    score += 12 * aliasSimilarity;
  }

  if (input.knowledgeKind === candidate.revision.knowledge_kind) {
    reasons.push("same_knowledge_kind");
    score += 8;
  }

  if (
    hasModuleScopeOverlap(input.moduleScope, candidate.revision.routing.module_scope)
  ) {
    reasons.push("same_module_scope");
    score += 10;
  }

  if (
    hasManuscriptTypeOverlap(
      input.manuscriptTypes,
      candidate.revision.routing.manuscript_types,
    )
  ) {
    reasons.push("manuscript_type_overlap");
    score += 10;
  }

  if (hasListOverlap(input.bindings ?? [], candidate.bindings)) {
    reasons.push("binding_overlap");
    score += 8;
  }

  let severity: KnowledgeDuplicateSeverity | undefined;
  if (reasons.includes("canonical_text_exact_match")) {
    severity = "exact";
  } else if (
    score >= 40 &&
    (reasons.includes("canonical_text_high_overlap") ||
      reasons.includes("title_exact_match") ||
      reasons.includes("title_high_similarity")) &&
    (reasons.includes("same_module_scope") ||
      reasons.includes("manuscript_type_overlap") ||
      reasons.includes("binding_overlap") ||
      reasons.includes("same_knowledge_kind"))
  ) {
    severity = "high";
  } else if (score >= 22) {
    severity = "possible";
  }

  return {
    reasons,
    score,
    severity,
  };
}

function compareDuplicateMatches(
  left: KnowledgeDuplicateMatchRecord,
  right: KnowledgeDuplicateMatchRecord,
): number {
  return (
    DUPLICATE_SEVERITY_ORDER[left.severity] -
      DUPLICATE_SEVERITY_ORDER[right.severity] ||
    right.score - left.score ||
    left.matched_asset_id.localeCompare(right.matched_asset_id) ||
    left.matched_revision_id.localeCompare(right.matched_revision_id)
  );
}

function mapLegacyStatusToRevisionStatus(
  status:
    | "draft"
    | "pending_review"
    | "approved"
    | "deprecated"
    | "superseded"
    | "archived",
): KnowledgeRevisionStatus {
  if (status === "deprecated") {
    return "superseded";
  }
  if (status === "superseded") {
    return "superseded";
  }

  return status;
}

function isWorkingRevisionStatus(status: KnowledgeRevisionStatus): boolean {
  return status === "draft" || status === "pending_review";
}

function convertFullWidthToHalfWidth(value: string): string {
  return [...value]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code === 0x3000) {
        return " ";
      }
      if (code >= 0xff01 && code <= 0xff5e) {
        return String.fromCharCode(code - 0xfee0);
      }

      return char;
    })
    .join("");
}

function normalizeWhitespaceAndPunctuation(value: string): string {
  return value
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateTextOverlapSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeKnowledgeDuplicateText(left);
  const normalizedRight = normalizeKnowledgeDuplicateText(right);
  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }
  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  const leftTokens = buildOverlapTokens(normalizedLeft);
  const rightTokens = buildOverlapTokens(normalizedRight);
  return calculateSetOverlapSimilarity(leftTokens, rightTokens);
}

function calculateListOverlapSimilarity(
  left: readonly string[],
  right: readonly string[],
): number {
  const leftSet = new Set(
    left.map(normalizeKnowledgeDuplicateText).filter((value) => value.length > 0),
  );
  const rightSet = new Set(
    right
      .map(normalizeKnowledgeDuplicateText)
      .filter((value) => value.length > 0),
  );

  return calculateSetOverlapSimilarity(leftSet, rightSet);
}

function hasListOverlap(left: readonly string[], right: readonly string[]): boolean {
  if (left.length === 0 || right.length === 0) {
    return false;
  }

  const rightSet = new Set(
    right.map(normalizeKnowledgeDuplicateText).filter((value) => value.length > 0),
  );
  for (const value of left) {
    const normalized = normalizeKnowledgeDuplicateText(value);
    if (normalized && rightSet.has(normalized)) {
      return true;
    }
  }

  return false;
}

function hasModuleScopeOverlap(
  left: KnowledgeDuplicateCheckInput["moduleScope"],
  right: KnowledgeRoutingRecord["module_scope"],
): boolean {
  return left === "any" || right === "any" || left === right;
}

function hasManuscriptTypeOverlap(
  left: KnowledgeDuplicateCheckInput["manuscriptTypes"],
  right: KnowledgeRoutingRecord["manuscript_types"],
): boolean {
  if (left === "any" || right === "any") {
    return true;
  }

  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

function buildOverlapTokens(value: string): Set<string> {
  const compact = value.replace(/\s+/g, "");
  const words = value.split(" ").filter((token) => token.length > 1);
  const grams = compact.length < 2 ? [compact] : collectNgrams(compact, 2);

  return new Set([...words, ...grams].filter((token) => token.length > 0));
}

function collectNgrams(value: string, n: number): string[] {
  if (value.length < n) {
    return [value];
  }

  const grams: string[] = [];
  for (let index = 0; index <= value.length - n; index += 1) {
    grams.push(value.slice(index, index + n));
  }

  return grams;
}

function calculateSetOverlapSimilarity(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  if (intersection === 0) {
    return 0;
  }

  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}
