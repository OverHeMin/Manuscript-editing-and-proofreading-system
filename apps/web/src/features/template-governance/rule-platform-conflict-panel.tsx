import type { EditorialRuleViewModel } from "../editorial-rules/types.ts";
import {
  serializeRuleAuthoringDraft,
} from "./rule-authoring-serialization.ts";
import type { RuleAuthoringDraft } from "./rule-authoring-types.ts";

type RulePlatformConflictKind = "override" | "merge" | "exclusive_conflict";

interface RulePlatformConflictItem {
  kind: RulePlatformConflictKind;
  ruleId: string;
  reason: string;
  manualReviewRequired: boolean;
}

export interface RulePlatformConflictPanelProps {
  overview: {
    rules: readonly EditorialRuleViewModel[];
    selectedRuleSetId?: string | null;
    selectedJournalTemplateId?: string | null;
  } | null;
  draft: RuleAuthoringDraft;
}

export function RulePlatformConflictPanel({
  overview,
  draft,
}: RulePlatformConflictPanelProps) {
  const conflicts = buildRulePlatformConflictItems(overview, draft);

  return (
    <article className="template-governance-card" data-rule-conflict-panel="field">
      <div className="template-governance-panel-header">
        <div>
          <h3>规则冲突预判</h3>
          <p>基于当前草稿与同工作台规则做启发式分类，提前暴露 override、merge 与 exclusive conflict。</p>
        </div>
      </div>

      {conflicts.length > 0 ? (
        <div className="template-governance-stack">
          {conflicts.map((conflict) => (
            <article
              key={`${conflict.kind}-${conflict.ruleId}`}
              className="template-governance-card"
              data-conflict-kind={conflict.kind}
              data-conflict-manual-review={String(conflict.manualReviewRequired)}
            >
              <strong>{conflict.kind}</strong>
              <small>{conflict.ruleId}</small>
              <p>{conflict.reason}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="template-governance-empty">
          当前草稿附近没有发现需要重点处理的冲突候选，现有规则更像是可并行共存。
        </p>
      )}
    </article>
  );
}

function buildRulePlatformConflictItems(
  overview: RulePlatformConflictPanelProps["overview"],
  draft: RuleAuthoringDraft,
): RulePlatformConflictItem[] {
  if (!overview?.rules.length) {
    return [];
  }

  const serializedDraft = serializeRuleAuthoringDraft(draft);
  const draftRuleObject = serializedDraft.ruleObject ?? draft.ruleObject;
  const draftCoverageKey = createCoverageKey(
    draftRuleObject,
    serializedDraft.selector ?? {},
    serializedDraft.trigger,
  );
  const draftTargetKey = deriveConflictTargetKey(
    draftRuleObject,
    serializedDraft.selector ?? {},
    serializedDraft.trigger,
  );
  const draftOutput = deriveActionOutput(serializedDraft.action);
  const draftManualReviewRequired = requiresManualReview(draft);

  const items = overview.rules
    .map((rule) => {
      const ruleCoverageKey = createCoverageKey(
        rule.rule_object,
        rule.selector ?? {},
        rule.trigger,
      );
      const ruleTargetKey = deriveConflictTargetKey(
        rule.rule_object,
        rule.selector ?? {},
        rule.trigger,
      );
      const ruleOutput = deriveActionOutput(rule.action);

      if (
        ruleCoverageKey === draftCoverageKey &&
        ruleOutput === draftOutput &&
        isRuleLikelySameLayer(rule, overview, draft)
      ) {
        return null;
      }

      if (
        ruleCoverageKey === draftCoverageKey &&
        draft.journalTemplateId?.trim().length &&
        !isRuleLikelyJournalScoped(rule, overview)
      ) {
        return {
          kind: "override" as const,
          ruleId: rule.id,
          reason:
            `草稿与规则 ${rule.id} 命中了相同 coverage key；当前草稿处于期刊加层，会覆盖基础层定义。`,
          manualReviewRequired: draftManualReviewRequired,
        };
      }

      if (
        draftTargetKey &&
        ruleTargetKey &&
        draftTargetKey === ruleTargetKey &&
        draftOutput &&
        ruleOutput &&
        draftOutput !== ruleOutput
      ) {
        return {
          kind: "exclusive_conflict" as const,
          ruleId: rule.id,
          reason:
            `草稿与规则 ${rule.id} 会落在同一目标，但输出结果不一致，发布前需要人工定夺。`,
          manualReviewRequired: true,
        };
      }

      return {
        kind: "merge" as const,
        ruleId: rule.id,
        reason:
          `草稿与规则 ${rule.id} 没有命中排他条件，更适合作为可并行合并的治理组合。`,
        manualReviewRequired: draftManualReviewRequired,
      };
    })
    .filter((item): item is RulePlatformConflictItem => item !== null);

  return items.sort(compareConflictItems);
}

function compareConflictItems(
  left: RulePlatformConflictItem,
  right: RulePlatformConflictItem,
): number {
  return getConflictPriority(left.kind) - getConflictPriority(right.kind);
}

function getConflictPriority(kind: RulePlatformConflictKind): number {
  switch (kind) {
    case "exclusive_conflict":
      return 0;
    case "override":
      return 1;
    case "merge":
    default:
      return 2;
  }
}

function requiresManualReview(draft: RuleAuthoringDraft): boolean {
  return (
    draft.executionMode === "inspect" ||
    draft.executionMode === "apply_and_inspect" ||
    draft.confidencePolicy === "manual_only" ||
    draft.confidencePolicy === "high_confidence_only"
  );
}

function isRuleLikelyJournalScoped(
  rule: EditorialRuleViewModel,
  overview: NonNullable<RulePlatformConflictPanelProps["overview"]>,
): boolean {
  return (
    overview.selectedJournalTemplateId != null &&
    rule.rule_set_id === overview.selectedRuleSetId
  );
}

function isRuleLikelySameLayer(
  rule: EditorialRuleViewModel,
  overview: NonNullable<RulePlatformConflictPanelProps["overview"]>,
  draft: RuleAuthoringDraft,
): boolean {
  const draftIsJournal = draft.journalTemplateId != null;
  return draftIsJournal
    ? isRuleLikelyJournalScoped(rule, overview)
    : !isRuleLikelyJournalScoped(rule, overview);
}

function createCoverageKey(
  ruleObject: string,
  selector: Record<string, unknown>,
  trigger: Record<string, unknown>,
): string {
  return [
    ruleObject,
    stableSerialize(selector),
    stableSerialize(trigger),
  ].join("::");
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([leftKey], [rightKey]) => leftKey.localeCompare(rightKey),
  );
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
    .join(",")}}`;
}

function deriveConflictTargetKey(
  ruleObject: string,
  selector: Record<string, unknown>,
  trigger: Record<string, unknown>,
): string | undefined {
  const semanticTarget =
    typeof selector["semantic_target"] === "string"
      ? selector["semantic_target"]
      : undefined;
  const headerPath = Array.isArray(selector["header_path_includes"])
    ? selector["header_path_includes"].filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];

  if (semanticTarget) {
    return [
      "table",
      semanticTarget,
      headerPath.join(" > "),
      typeof selector["row_key"] === "string" ? selector["row_key"] : "",
      typeof selector["column_key"] === "string" ? selector["column_key"] : "",
    ].join("::");
  }

  if (typeof trigger["text"] === "string" && trigger["text"].trim().length > 0) {
    return `text::${ruleObject}::${trigger["text"]}`;
  }

  return undefined;
}

function deriveActionOutput(action: Record<string, unknown>): string | undefined {
  return typeof action["to"] === "string" ? action["to"] : undefined;
}
