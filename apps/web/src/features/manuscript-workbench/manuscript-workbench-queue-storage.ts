import type { ManuscriptWorkbenchMode } from "./manuscript-workbench-controller.ts";
import type { ManuscriptWorkbenchQueueItem } from "./manuscript-workbench-queue-pane.tsx";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoredManuscriptWorkbenchQueue {
  version: 1;
  mode: Exclude<ManuscriptWorkbenchMode, "submission">;
  items: ManuscriptWorkbenchQueueItem[];
}

export function buildManuscriptWorkbenchQueueStorageKey(
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): string {
  return `manuscript-workbench.queue.${mode}.v1`;
}

export function loadManuscriptWorkbenchQueueItems(
  storage: StorageLike,
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
): ManuscriptWorkbenchQueueItem[] {
  const raw = storage.getItem(buildManuscriptWorkbenchQueueStorageKey(mode));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredManuscriptWorkbenchQueue>;
    if (parsed.version !== 1 || parsed.mode !== mode || !Array.isArray(parsed.items)) {
      return [];
    }

    return parsed.items.filter(isManuscriptWorkbenchQueueItem);
  } catch {
    return [];
  }
}

export function saveManuscriptWorkbenchQueueItems(
  storage: StorageLike,
  mode: Exclude<ManuscriptWorkbenchMode, "submission">,
  items: ManuscriptWorkbenchQueueItem[],
): void {
  const payload: StoredManuscriptWorkbenchQueue = {
    version: 1,
    mode,
    items,
  };
  storage.setItem(
    buildManuscriptWorkbenchQueueStorageKey(mode),
    JSON.stringify(payload),
  );
}

function isManuscriptWorkbenchQueueItem(
  value: unknown,
): value is ManuscriptWorkbenchQueueItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Partial<ManuscriptWorkbenchQueueItem>;
  return (
    typeof item.manuscriptId === "string" &&
    typeof item.title === "string" &&
    typeof item.manuscriptTypeLabel === "string" &&
    typeof item.statusLabel === "string" &&
    typeof item.activityLabel === "string" &&
    (item.queueScope === "batch" || item.queueScope === "recent") &&
    (item.queueStatus === "pending" ||
      item.queueStatus === "in_progress" ||
      item.queueStatus === "completed" ||
      item.queueStatus === "failed") &&
    typeof item.isActive === "boolean"
  );
}
