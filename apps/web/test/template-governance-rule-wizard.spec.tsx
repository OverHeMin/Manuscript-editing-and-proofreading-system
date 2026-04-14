import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const {
  TemplateGovernanceRuleWizard,
} = await import("../src/features/template-governance/template-governance-rule-wizard.tsx");

test("rule wizard shell renders shared step navigation and closeout actions", () => {
  const Wizard = TemplateGovernanceRuleWizard as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Wizard
      state={{
        mode: "create",
        step: "entry",
        dirty: true,
      }}
    />,
  );

  assert.match(markup, /下一步：AI 识别语义层/u);
  assert.match(markup, /保存草稿/u);
  assert.match(markup, /完成并返回规则中心/u);
});
