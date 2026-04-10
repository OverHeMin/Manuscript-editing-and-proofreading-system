import type {
  RulePackageDraftViewModel,
  RulePackagePreviewViewModel,
  RulePackageWorkspaceSourceInputViewModel,
} from "../editorial-rules/index.ts";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StoredRulePackageDraft {
  version: 1;
  source: RulePackageWorkspaceSourceInputViewModel;
  selectedPackageId: string | null;
  editableDraftById: Record<string, RulePackageDraftViewModel>;
  previewById: Record<string, RulePackagePreviewViewModel | undefined>;
  savedAt: string;
}

export function buildRulePackageDraftStorageKey(
  source: RulePackageWorkspaceSourceInputViewModel,
): string {
  return `rule-package-workspace-draft::${source.sourceKind}::${readRulePackageSourceIdentity(source)}`;
}

export function saveRulePackageDraft(
  storage: StorageLike,
  draft: StoredRulePackageDraft,
): void {
  storage.setItem(
    buildRulePackageDraftStorageKey(draft.source),
    JSON.stringify(draft),
  );
}

export function loadRulePackageDraft(
  storage: StorageLike,
  source: RulePackageWorkspaceSourceInputViewModel,
): StoredRulePackageDraft | null {
  const raw = storage.getItem(buildRulePackageDraftStorageKey(source));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredRulePackageDraft>;
    if (parsed.version !== 1 || !parsed.source || !isSameRulePackageSource(parsed.source, source)) {
      return null;
    }

    return {
      version: 1,
      source,
      selectedPackageId:
        typeof parsed.selectedPackageId === "string" || parsed.selectedPackageId === null
          ? parsed.selectedPackageId
          : null,
      editableDraftById:
        isRecord(parsed.editableDraftById) ? parsed.editableDraftById : {},
      previewById: isRecord(parsed.previewById) ? parsed.previewById : {},
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
    };
  } catch {
    return null;
  }
}

function readRulePackageSourceIdentity(
  source: RulePackageWorkspaceSourceInputViewModel,
): string {
  return source.sourceKind === "reviewed_case"
    ? source.reviewedCaseSnapshotId
    : source.exampleSourceSessionId;
}

function isSameRulePackageSource(
  left: RulePackageWorkspaceSourceInputViewModel,
  right: RulePackageWorkspaceSourceInputViewModel,
): boolean {
  return (
    left.sourceKind === right.sourceKind &&
    readRulePackageSourceIdentity(left) === readRulePackageSourceIdentity(right)
  );
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}
