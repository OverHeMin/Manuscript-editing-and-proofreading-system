import assert from "node:assert/strict";
import test from "node:test";
import {
  buildManuscriptWorkbenchQueueStorageKey,
  loadManuscriptWorkbenchQueueItems,
  saveManuscriptWorkbenchQueueItems,
} from "../src/features/manuscript-workbench/manuscript-workbench-queue-storage.ts";
import type { ManuscriptWorkbenchQueueItem } from "../src/features/manuscript-workbench/manuscript-workbench-queue-pane.tsx";

function createMemoryStorage() {
  const map = new Map<string, string>();

  return {
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

function createQueueItem(
  manuscriptId: string,
  title: string,
): ManuscriptWorkbenchQueueItem {
  return {
    manuscriptId,
    title,
    manuscriptTypeLabel: "临床研究",
    statusLabel: "待处理",
    activityLabel: "等待执行",
    queueScope: "recent",
    queueStatus: "pending",
    isActive: false,
  };
}

test("manuscript workbench queue storage keeps each module independent", () => {
  const storage = createMemoryStorage();

  saveManuscriptWorkbenchQueueItems(storage, "screening", [
    createQueueItem("screening-manuscript-1", "初筛稿件一"),
  ]);
  saveManuscriptWorkbenchQueueItems(storage, "proofreading", [
    createQueueItem("proofreading-manuscript-1", "校对稿件一"),
  ]);

  assert.notEqual(
    buildManuscriptWorkbenchQueueStorageKey("screening"),
    buildManuscriptWorkbenchQueueStorageKey("proofreading"),
  );
  assert.deepEqual(
    loadManuscriptWorkbenchQueueItems(storage, "screening").map(
      (item) => item.manuscriptId,
    ),
    ["screening-manuscript-1"],
  );
  assert.deepEqual(
    loadManuscriptWorkbenchQueueItems(storage, "proofreading").map(
      (item) => item.manuscriptId,
    ),
    ["proofreading-manuscript-1"],
  );
  assert.deepEqual(loadManuscriptWorkbenchQueueItems(storage, "editing"), []);
});

test("manuscript workbench queue storage ignores corrupt local data", () => {
  const storage = createMemoryStorage();
  storage.setItem(
    buildManuscriptWorkbenchQueueStorageKey("editing"),
    "{not valid json",
  );

  assert.deepEqual(loadManuscriptWorkbenchQueueItems(storage, "editing"), []);
});
