import type {
  KnowledgeRecord,
  KnowledgeRevisionBindingRecord,
  KnowledgeRevisionRecord,
  KnowledgeSemanticLayerRecord,
} from "./knowledge-record.ts";

function parseTimestamp(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function isKnowledgeRevisionCurrentlyEffective(
  revision: Pick<
    KnowledgeRevisionRecord,
    "status" | "effective_at" | "expires_at"
  >,
  now: Date = new Date(),
): boolean {
  if (revision.status !== "approved") {
    return false;
  }

  const nowTime = now.getTime();
  const effectiveAt = parseTimestamp(revision.effective_at);
  if (effectiveAt != null && effectiveAt > nowTime) {
    return false;
  }

  const expiresAt = parseTimestamp(revision.expires_at);
  if (expiresAt != null && expiresAt <= nowTime) {
    return false;
  }

  return true;
}

export function selectRuntimeApprovedKnowledgeRevision<T extends Pick<
  KnowledgeRevisionRecord,
  "id" | "status" | "effective_at" | "expires_at"
>>(
  revisions: readonly T[],
  input: {
    preferredRevisionId?: string;
    now?: Date;
  } = {},
): T | undefined {
  const activeApprovedRevisions = revisions.filter((revision) =>
    isKnowledgeRevisionCurrentlyEffective(revision, input.now),
  );

  if (activeApprovedRevisions.length === 0) {
    return undefined;
  }

  return (
    activeApprovedRevisions.find(
      (revision) => revision.id === input.preferredRevisionId,
    ) ?? activeApprovedRevisions[0]
  );
}

export function projectRuntimeKnowledgeRecord(input: {
  revision: KnowledgeRevisionRecord;
  bindings: readonly KnowledgeRevisionBindingRecord[];
  semanticLayer?: KnowledgeSemanticLayerRecord;
}): KnowledgeRecord {
  const semanticSummary =
    input.semanticLayer?.status === "confirmed"
      ? normalizeSemanticText(input.semanticLayer.page_summary)
      : undefined;
  const semanticRetrievalText = buildSemanticRetrievalText(input.semanticLayer);

  return {
    id: input.revision.asset_id,
    title: input.revision.title,
    canonical_text: semanticRetrievalText ?? input.revision.canonical_text,
    knowledge_kind: input.revision.knowledge_kind,
    status: input.revision.status,
    routing: {
      manuscript_types:
        input.revision.routing.manuscript_types === "any"
          ? "any"
          : [...input.revision.routing.manuscript_types],
      module_scope: input.revision.routing.module_scope,
      ...(input.revision.routing.sections
        ? { sections: [...input.revision.routing.sections] }
        : {}),
      ...(input.revision.routing.risk_tags
        ? { risk_tags: [...input.revision.routing.risk_tags] }
        : {}),
      ...(input.revision.routing.discipline_tags
        ? { discipline_tags: [...input.revision.routing.discipline_tags] }
        : {}),
    },
    ...(semanticSummary != null
      ? { summary: semanticSummary }
      : input.revision.summary != null
        ? { summary: input.revision.summary }
        : {}),
    ...(input.revision.evidence_level != null
      ? { evidence_level: input.revision.evidence_level }
      : {}),
    ...(input.revision.source_type != null
      ? { source_type: input.revision.source_type }
      : {}),
    ...(input.revision.source_link != null
      ? { source_link: input.revision.source_link }
      : {}),
    ...(input.revision.aliases ? { aliases: [...input.revision.aliases] } : {}),
    ...(input.bindings.length > 0
      ? {
          template_bindings: input.bindings.map(
            (binding) => binding.binding_target_id,
          ),
        }
      : {}),
    ...(input.revision.source_learning_candidate_id != null
      ? { source_learning_candidate_id: input.revision.source_learning_candidate_id }
      : {}),
    ...(input.revision.projection_source != null
      ? {
          projection_source: JSON.parse(
            JSON.stringify(input.revision.projection_source),
          ) as NonNullable<KnowledgeRecord["projection_source"]>,
        }
      : {}),
  };
}

export function buildSemanticRetrievalText(
  semanticLayer: KnowledgeSemanticLayerRecord | undefined,
): string | undefined {
  if (!semanticLayer || semanticLayer.status !== "confirmed") {
    return undefined;
  }

  const parts = dedupePreserveOrder([
    normalizeSemanticText(semanticLayer.page_summary),
    ...normalizeSemanticTexts(semanticLayer.retrieval_terms),
    ...normalizeSemanticTexts(semanticLayer.retrieval_snippets),
    ...collectSemanticPayloadTexts(semanticLayer.table_semantics),
    ...collectSemanticPayloadTexts(semanticLayer.image_understanding),
  ]);

  return parts.length > 0 ? parts.join("\n") : undefined;
}

function collectSemanticPayloadTexts(value: unknown): string[] {
  if (typeof value === "string") {
    const normalized = normalizeSemanticText(value);
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return dedupePreserveOrder(value.flatMap((entry) => collectSemanticPayloadTexts(entry)));
  }

  if (value && typeof value === "object") {
    return dedupePreserveOrder(
      Object.values(value).flatMap((entry) => collectSemanticPayloadTexts(entry)),
    );
  }

  return [];
}

function normalizeSemanticTexts(values: readonly string[] | undefined): string[] {
  return dedupePreserveOrder(values?.map((value) => normalizeSemanticText(value)) ?? []);
}

function normalizeSemanticText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function dedupePreserveOrder(values: readonly (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}
