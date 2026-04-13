import test from "node:test";
import assert from "node:assert/strict";
import {
  formatWorkbenchHash,
  resolveWorkbenchLocation,
} from "../src/app/workbench-routing.ts";

test("workbench routing parses templateGovernanceView ledgers", () => {
  const route = resolveWorkbenchLocation(
    "#template-governance?templateGovernanceView=extraction-ledger",
  );

  assert.equal(route.workbenchId, "template-governance");
  assert.equal(route.templateGovernanceView, "extraction-ledger");
});

test("formatWorkbenchHash preserves the requested rule-center subpage", () => {
  const hash = formatWorkbenchHash("template-governance", {
    templateGovernanceView: "medical-module-ledger",
  });

  assert.match(hash, /templateGovernanceView=medical-module-ledger/u);
});
