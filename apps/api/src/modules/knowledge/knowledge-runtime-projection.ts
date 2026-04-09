import type { KnowledgeRevisionRecord } from "./knowledge-record.ts";

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
