import test from "node:test";
import assert from "node:assert/strict";

import {
  tableEvidenceCharacterClasses,
  tableEvidenceSnapshotStatuses,
} from "../../src/modules/document-pipeline/table-evidence-record.ts";

test("runtime table evidence uses fidelity statuses", () => {
  assert.deepEqual(tableEvidenceSnapshotStatuses, [
    "complete",
    "partial",
    "unsupported",
    "failed",
  ]);
});

test("runtime table evidence keeps medically relevant character classes distinct", () => {
  assert.ok(tableEvidenceCharacterClasses.includes("half_space"));
  assert.ok(tableEvidenceCharacterClasses.includes("full_space"));
  assert.ok(tableEvidenceCharacterClasses.includes("nbsp"));
  assert.ok(tableEvidenceCharacterClasses.includes("tab"));
  assert.ok(tableEvidenceCharacterClasses.includes("en_dash"));
  assert.ok(tableEvidenceCharacterClasses.includes("em_dash"));
  assert.ok(tableEvidenceCharacterClasses.includes("hyphen"));
  assert.ok(tableEvidenceCharacterClasses.includes("minus"));
});
