import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TemplateGovernanceV2Shell } from "../src/features/template-governance/template-governance-v2-shell.tsx";

test("rule center V2 shell renders a unified workbench structure", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceV2Shell
      activeSection="rules"
      activePanel="none"
      counts={{
        dashboard: 0,
        rules: 12,
        templates: 4,
        packages: 6,
        extraction: 2,
        "ai-intake": 0,
        recovery: 3,
        release: 1,
        advanced: 0,
      }}
      onCommand={() => undefined}
      onSectionChange={() => undefined}
    >
      <div data-testid="center-work-area">规则台账</div>
    </TemplateGovernanceV2Shell>,
  );

  assert.match(markup, /rule-center-v2/u);
  assert.match(markup, /rule-center-v2__rail/u);
  assert.match(markup, /rule-center-v2__work-area/u);
  assert.match(markup, /rule-center-v2__detail-panel/u);
  assert.match(markup, /data-command="new-rule"/u);
  assert.match(markup, /data-command="new-ai-rule"/u);
  assert.match(markup, /data-command="import-extraction"/u);
  assert.match(markup, /data-command="review-candidates"/u);
  assert.match(markup, /data-command="release-check"/u);
  assert.match(markup, /\u65b0\u5efa\u89c4\u5219/u);
  assert.match(markup, /\u65b0\u5efa AI \u89c4\u5219\u8349\u7a3f/u);
  assert.doesNotMatch(markup, /template-governance-overview-page/u);
});
