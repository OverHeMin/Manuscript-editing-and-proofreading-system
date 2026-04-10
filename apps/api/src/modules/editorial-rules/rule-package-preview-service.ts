import type {
  RuleEvidenceExample,
  RulePackageDraft,
  RulePackagePreview,
  RulePackagePreviewInput,
} from "@medical/contracts";

export class RulePackagePreviewService {
  buildPreview(input: RulePackagePreviewInput): RulePackagePreview {
    const hits = buildHits(input.packageDraft, input.sampleText);
    const misses = buildMisses(input.packageDraft, hits);

    return {
      hit_summary: `命中 ${hits.length} 处，未命中 ${misses.length} 处。`,
      hits,
      misses,
      decision: {
        automation_posture: input.packageDraft.automation_posture,
        needs_human_review: input.packageDraft.automation_posture !== "safe_auto",
        reason: buildDecisionReason(input.packageDraft, hits.length),
      },
    };
  }
}

function buildHits(candidate: RulePackageDraft, sampleText: string) {
  const hits = [
    ...collectEvidenceHits(candidate.cards.evidence.examples, sampleText),
    ...candidate.cards.ai_understanding.hit_objects
      .filter((target) => target.trim().length > 0 && sampleText.includes(target))
      .map((target) => ({
        target,
        matched_text: target,
        reason: `样本文本包含规则关注对象“${target}”。`,
      })),
  ];

  return dedupePreviewEntries(hits);
}

function buildMisses(
  candidate: RulePackageDraft,
  hits: Array<{ target: string; matched_text?: string; reason: string }>,
) {
  const misses = candidate.cards.exclusions.not_applicable_when.map((boundary) => ({
    target: candidate.package_kind,
    reason: `当前样本文本未触发不适用边界：${boundary}`,
  }));

  if (hits.length === 0) {
    misses.unshift({
      target: candidate.package_kind,
      reason: `样本文本未命中 ${candidate.title} 的核心语义对象。`,
    });
  }

  return dedupePreviewEntries(misses);
}

function collectEvidenceHits(
  examples: RuleEvidenceExample[],
  sampleText: string,
) {
  return examples.flatMap((example) => {
    const matchedSnippet = [example.before, example.after].find(
      (value) => value.trim().length > 0 && sampleText.includes(value),
    );
    if (!matchedSnippet) {
      return [];
    }

    return [
      {
        target: "evidence_example",
        matched_text: matchedSnippet,
        reason:
          example.note ??
          "样本文本命中了该规则包在示例中呈现的前后改写模式。",
      },
    ];
  });
}

function buildDecisionReason(
  candidate: RulePackageDraft,
  hitCount: number,
): string {
  if (candidate.automation_posture === "safe_auto") {
    return `${candidate.title} 命中 ${hitCount} 处，且属于低风险规范化，可走 safe_auto。`;
  }

  if (candidate.automation_posture === "inspect_only") {
    return `${candidate.title} 即使命中，也只允许 inspect_only，需人工复核。`;
  }

  return `${candidate.title} 命中后可辅助执行，但仍需 guarded_auto 护栏。`;
}

function dedupePreviewEntries<T extends { target: string; reason: string }>(
  entries: T[],
): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const entry of entries) {
    const key = `${entry.target}::${entry.reason}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(entry);
  }

  return deduped;
}
