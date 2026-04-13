import test from "node:test";
import assert from "node:assert/strict";
import {
  formatWorkbenchHash,
  resolveWorkbenchLocation,
} from "../src/app/workbench-routing.ts";

test("workbench routing parses templateGovernanceView ledgers", () => {
  const route = resolveWorkbenchLocation(
<<<<<<< HEAD
    "#template-governance?templateGovernanceView=journal-template-ledger",
  );

  assert.equal(route.workbenchId, "template-governance");
  assert.equal(route.templateGovernanceView, "journal-template-ledger");
=======
    "#template-governance?templateGovernanceView=extraction-ledger",
  );

  assert.equal(route.workbenchId, "template-governance");
  assert.equal(route.templateGovernanceView, "extraction-ledger");
>>>>>>> origin/main
});

test("formatWorkbenchHash preserves the requested rule-center subpage", () => {
  const hash = formatWorkbenchHash("template-governance", {
<<<<<<< HEAD
    templateGovernanceView: "medical-package-ledger",
  });

  assert.match(hash, /templateGovernanceView=medical-package-ledger/u);
=======
    templateGovernanceView: "medical-module-ledger",
  });

  assert.match(hash, /templateGovernanceView=medical-module-ledger/u);
>>>>>>> origin/main
});
