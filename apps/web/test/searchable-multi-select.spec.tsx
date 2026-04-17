import assert from "node:assert/strict";
import test from "node:test";

const searchableMultiSelectModule = await import(
  "../src/lib/searchable-multi-select.tsx"
);

const { filterSearchableMultiSelectOptions } = searchableMultiSelectModule;

test("searchable multi select filters options by label, keywords, and meta text", () => {
  const options = [
    {
      value: "clinical_study",
      label: "临床研究",
      keywords: ["clinical study", "trial"],
    },
    {
      value: "tables",
      label: "表格",
      keywords: ["table", "table proofreading"],
      meta: "章节标签",
    },
    {
      value: "knowledge-1",
      label: "表格校对依据",
      meta: "reference / approved",
    },
  ];

  assert.deepEqual(
    filterSearchableMultiSelectOptions(options, "clinical").map((option) => option.value),
    ["clinical_study"],
  );
  assert.deepEqual(
    filterSearchableMultiSelectOptions(options, "章节").map((option) => option.value),
    ["tables"],
  );
  assert.deepEqual(
    filterSearchableMultiSelectOptions(options, "approved").map((option) => option.value),
    ["knowledge-1"],
  );
  assert.equal(filterSearchableMultiSelectOptions(options, "   ").length, 3);
});
