import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RulePackageUploadIntake } from "../src/features/template-governance/rule-package-upload-intake.tsx";

test("rule-package upload intake renders original and edited file pickers plus start action", () => {
  const markup = renderToStaticMarkup(
    React.createElement(RulePackageUploadIntake, {
      originalFileName: "原稿.docx",
      editedFileName: "编后稿.docx",
      canStart: true,
      isBusy: false,
      onOriginalFileSelect: () => undefined,
      onEditedFileSelect: () => undefined,
      onStart: () => undefined,
    }),
  );

  assert.match(markup, /上传原稿/);
  assert.match(markup, /上传编后稿/);
  assert.match(markup, /开始识别/);
  assert.match(markup, /原稿.docx/);
  assert.match(markup, /编后稿.docx/);
});
