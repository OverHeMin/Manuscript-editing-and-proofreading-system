import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TemplateGovernanceContentModuleForm } from "../src/features/template-governance/index.ts";

test("medical specialized package form uses package language in create mode", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceContentModuleForm ledgerKind="medical_specialized" mode="create" />,
  );

  assert.match(markup, /\u65b0\u5efa\u533b\u5b66\u4e13\u7528\u5305/u);
  assert.match(markup, /\u4fdd\u5b58\u89c4\u5219\u5305\u8349\u7a3f/u);
  assert.match(markup, /\u5305\u540d\u79f0/u);
  assert.doesNotMatch(markup, /\u65b0\u5efa\u533b\u5b66\u4e13\u7528\u6a21\u5757/u);
});

test("package form uses unified rule-package language in edit mode", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceContentModuleForm ledgerKind="general" mode="edit" />,
  );

  assert.match(markup, /\u7f16\u8f91\u89c4\u5219\u5305/u);
  assert.match(markup, /\u4fdd\u5b58\u89c4\u5219\u5305\u4fee\u6539/u);
  assert.match(markup, /\u5728\u540c\u4e00\u5f20\u8868\u5355\u91cc\u5b8c\u6210\u89c4\u5219\u5305\u5f55\u5165/u);
  assert.doesNotMatch(markup, /\u7f16\u8f91\u901a\u7528\u6a21\u5757/u);
});
