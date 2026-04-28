import type {
  HumanReviewBackflowAttemptRecord,
  HumanReviewDiffRecord,
  ListHumanReviewDiffItemsFilter,
} from "./human-review-record.ts";
import type {
  HumanReviewDiffItemPatch,
  HumanReviewRepository,
} from "./human-review-repository.ts";

function cloneDiffItem(record: HumanReviewDiffRecord): HumanReviewDiffRecord {
  return {
    ...record,
    governance_intents: { ...record.governance_intents },
    ...(record.complexity_flags
      ? { complexity_flags: [...record.complexity_flags] }
      : {}),
    ...(record.location ? { location: { ...record.location } } : {}),
  };
}

function cloneBackflowAttempt(
  record: HumanReviewBackflowAttemptRecord,
): HumanReviewBackflowAttemptRecord {
  return { ...record };
}

function compareDiffItems(
  left: HumanReviewDiffRecord,
  right: HumanReviewDiffRecord,
): number {
  if (left.created_at !== right.created_at) {
    return left.created_at.localeCompare(right.created_at);
  }

  return left.id.localeCompare(right.id);
}

function compareBackflowAttempts(
  left: HumanReviewBackflowAttemptRecord,
  right: HumanReviewBackflowAttemptRecord,
): number {
  if (left.created_at !== right.created_at) {
    return left.created_at.localeCompare(right.created_at);
  }

  return left.id.localeCompare(right.id);
}

function matchesDiffFilter(
  record: HumanReviewDiffRecord,
  filter?: ListHumanReviewDiffItemsFilter,
): boolean {
  if (!filter) {
    return true;
  }

  return (
    (filter.manuscriptId === undefined ||
      record.manuscript_id === filter.manuscriptId) &&
    (filter.module === undefined || record.module === filter.module) &&
    (filter.workingAssetId === undefined ||
      record.working_asset_id === filter.workingAssetId) &&
    (filter.finalAssetId === undefined ||
      record.final_asset_id === filter.finalAssetId) &&
    (filter.status === undefined || record.status === filter.status)
  );
}

export class InMemoryHumanReviewRepository implements HumanReviewRepository {
  private readonly diffItems = new Map<string, HumanReviewDiffRecord>();
  private readonly backflowAttempts = new Map<
    string,
    HumanReviewBackflowAttemptRecord
  >();

  async saveDiffItem(record: HumanReviewDiffRecord): Promise<void> {
    this.diffItems.set(record.id, cloneDiffItem(record));
  }

  async saveDiffItems(records: readonly HumanReviewDiffRecord[]): Promise<void> {
    for (const record of records) {
      await this.saveDiffItem(record);
    }
  }

  async findDiffItemById(
    id: string,
  ): Promise<HumanReviewDiffRecord | undefined> {
    const record = this.diffItems.get(id);
    return record ? cloneDiffItem(record) : undefined;
  }

  async listDiffItems(
    filter?: ListHumanReviewDiffItemsFilter,
  ): Promise<HumanReviewDiffRecord[]> {
    return [...this.diffItems.values()]
      .filter((record) => matchesDiffFilter(record, filter))
      .sort(compareDiffItems)
      .map(cloneDiffItem);
  }

  async updateDiffItem(
    id: string,
    patch: HumanReviewDiffItemPatch,
  ): Promise<HumanReviewDiffRecord | undefined> {
    const current = this.diffItems.get(id);
    if (!current) {
      return undefined;
    }

    const updated = cloneDiffItem({ ...current, ...patch });
    this.diffItems.set(id, updated);
    return cloneDiffItem(updated);
  }

  async saveBackflowAttempt(
    record: HumanReviewBackflowAttemptRecord,
  ): Promise<void> {
    this.backflowAttempts.set(record.id, cloneBackflowAttempt(record));
  }

  async findBackflowAttemptById(
    id: string,
  ): Promise<HumanReviewBackflowAttemptRecord | undefined> {
    const record = this.backflowAttempts.get(id);
    return record ? cloneBackflowAttempt(record) : undefined;
  }

  async listBackflowAttemptsByDiffItemId(
    diffItemId: string,
  ): Promise<HumanReviewBackflowAttemptRecord[]> {
    return [...this.backflowAttempts.values()]
      .filter((record) => record.diff_item_id === diffItemId)
      .sort(compareBackflowAttempts)
      .map(cloneBackflowAttempt);
  }
}
