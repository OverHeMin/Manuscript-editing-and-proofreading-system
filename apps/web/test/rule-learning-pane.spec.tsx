import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RuleLearningPane } from "../src/features/template-governance/rule-learning-pane.tsx";

test("rule learning pane reframes manuscript context as a governed evidence handoff", () => {
  const markup = renderToStaticMarkup(
    <RuleLearningPane
      prefilledManuscriptId="manuscript-proof-1"
      prefilledReviewedCaseSnapshotId="snapshot-proof-1"
      initialCandidates={[]}
      initialReviewItems={[]}
    />,
  );

  assert.match(markup, /\u56de\u6d41\u6765\u6e90\u7a3f\u4ef6\uff1amanuscript-proof-1/u);
  assert.match(markup, /\u590d\u6838\u5feb\u7167\uff1asnapshot-proof-1/u);
  assert.match(
    markup,
    /\u5f53\u524d\u7edf\u4e00\u590d\u6838\u4f1a\u6cbf\u7528\u8fd9\u6761\u6cbb\u7406\u8bc1\u636e\u94fe\uff0c\u7ee7\u7eed\u5904\u7406\u5df2\u53d1\u73b0\u6b8b\u5dee\u3001Harness \u590d\u9a8c\u3001\u5019\u9009\u8def\u7531\u4e0e\u89c4\u5219\u5199\u56de\u3002/u,
  );
});
