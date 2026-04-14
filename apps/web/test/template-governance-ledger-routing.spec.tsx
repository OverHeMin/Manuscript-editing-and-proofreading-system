import test from "node:test";
import assert from "node:assert/strict";
import {
  formatWorkbenchHash,
  resolveWorkbenchLocation,
} from "../src/app/workbench-routing.ts";

test("workbench routing parses templateGovernanceView ledgers", () => {
  const route = resolveWorkbenchLocation(
    "#template-governance?templateGovernanceView=journal-template-ledger",
  );

  assert.equal(route.workbenchId, "template-governance");
  assert.equal(route.templateGovernanceView, "journal-template-ledger");
});

test("formatWorkbenchHash preserves the requested rule-center subpage", () => {
  const hash = formatWorkbenchHash("template-governance", {
    templateGovernanceView: "medical-package-ledger",
  });

  assert.match(hash, /templateGovernanceView=medical-package-ledger/u);
});

test("formatWorkbenchHash preserves rule-ledger view", () => {
  const hash = formatWorkbenchHash("template-governance", {
    templateGovernanceView: "rule-ledger" as never,
  });
  const route = resolveWorkbenchLocation(hash);

  assert.match(hash, /templateGovernanceView=rule-ledger/u);
  assert.equal(route.workbenchId, "template-governance");
  assert.equal(route.templateGovernanceView, "rule-ledger");
});
