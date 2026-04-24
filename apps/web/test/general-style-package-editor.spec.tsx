import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildGeneralStylePackageManifest,
  GeneralStylePackageEditor,
  parseGeneralStylePackageManifestDraft,
} from "../src/features/admin-governance/general-style-package-editor.tsx";
import { ManuscriptQualityPackagesSection } from "../src/features/admin-governance/manuscript-quality-packages-section.tsx";

test("general style package editor round-trips structured medical research style fields", () => {
  const manifest = buildGeneralStylePackageManifest({
    abstractRequiredLabels: "objective, methods, results, conclusion",
    strongClaims: "prove, guarantee",
    cautiousClaims: "suggest, may",
    abstractPosture: "objective, methods, results, conclusion",
    resultsPosture: "measured, observed, compared",
    conclusionPosture: "suggest, may, support",
    genreWordingSuspicions: "news report, experience sharing",
    sectionExpectationMissingSeverity: "medium",
    sectionExpectationMissingAction: "suggest_fix",
    resultConclusionJumpSeverity: "high",
    resultConclusionJumpAction: "manual_review",
    toneOverclaimSeverity: "medium",
    toneOverclaimAction: "suggest_fix",
    genreWordingSuspicionSeverity: "medium",
    genreWordingSuspicionAction: "suggest_fix",
  });
  const draft = parseGeneralStylePackageManifestDraft(manifest);

  assert.deepEqual(manifest.section_expectations.abstract.required_labels, [
    "objective",
    "methods",
    "results",
    "conclusion",
  ]);
  assert.equal(manifest.issue_policy.result_conclusion_jump.action, "manual_review");
  assert.equal(draft.strongClaims, "prove, guarantee");
  assert.equal(draft.conclusionPosture, "suggest, may, support");
});

test("general style package editor renders structured fields for operators", () => {
  const html = renderToStaticMarkup(
    <GeneralStylePackageEditor
      manifest={buildGeneralStylePackageManifest({
        abstractRequiredLabels: "objective, methods, results, conclusion",
        strongClaims: "prove, guarantee",
        cautiousClaims: "suggest, may",
        abstractPosture: "objective, methods, results, conclusion",
        resultsPosture: "measured, observed, compared",
        conclusionPosture: "suggest, may, support",
        genreWordingSuspicions: "news report, experience sharing",
        sectionExpectationMissingSeverity: "medium",
        sectionExpectationMissingAction: "suggest_fix",
        resultConclusionJumpSeverity: "high",
        resultConclusionJumpAction: "manual_review",
        toneOverclaimSeverity: "medium",
        toneOverclaimAction: "suggest_fix",
        genreWordingSuspicionSeverity: "medium",
        genreWordingSuspicionAction: "suggest_fix",
      })}
      onChange={() => undefined}
    />,
  );

  assert.match(html, /Abstract Required Labels/);
  assert.match(html, /Strong Claims/);
  assert.match(html, /Result \/ Conclusion Jump/);
  assert.match(html, /Genre Wording Suspicions/);
});

test("general style package editor localizes the harness surface copy", () => {
  const html = renderToStaticMarkup(
    <GeneralStylePackageEditor
      surface="harness"
      manifest={buildGeneralStylePackageManifest({
        abstractRequiredLabels: "objective, methods, results, conclusion",
        strongClaims: "prove, guarantee",
        cautiousClaims: "suggest, may",
        abstractPosture: "objective, methods, results, conclusion",
        resultsPosture: "measured, observed, compared",
        conclusionPosture: "suggest, may, support",
        genreWordingSuspicions: "news report, experience sharing",
        sectionExpectationMissingSeverity: "medium",
        sectionExpectationMissingAction: "suggest_fix",
        resultConclusionJumpSeverity: "high",
        resultConclusionJumpAction: "manual_review",
        toneOverclaimSeverity: "medium",
        toneOverclaimAction: "suggest_fix",
        genreWordingSuspicionSeverity: "medium",
        genreWordingSuspicionAction: "suggest_fix",
      })}
      onChange={() => undefined}
    />,
  );

  assert.match(html, /结构化风格规则/u);
  assert.match(html, /摘要必备标签/u);
  assert.match(html, /措辞过强/u);
  assert.match(html, /结果\/结论跳跃/u);
  assert.match(html, /可疑文风词/u);
  assert.doesNotMatch(html, /Structured Style Rules/u);
});

test("manuscript quality packages section renders the structured general style editor by default", () => {
  const html = renderToStaticMarkup(
    <ManuscriptQualityPackagesSection
      packages={[]}
      isMutating={false}
      onCreateDraft={async () => undefined}
      onPublishVersion={async () => undefined}
    />,
  );

  assert.match(html, /Abstract Required Labels/);
  assert.match(html, /Advanced JSON/);
  assert.match(html, /Create Draft Package Version/);
});

test("manuscript quality packages section uses Chinese-first copy on the harness surface", () => {
  const html = renderToStaticMarkup(
    <ManuscriptQualityPackagesSection
      packages={[]}
      isMutating={false}
      surface="harness"
      onCreateDraft={async () => undefined}
      onPublishVersion={async () => undefined}
    />,
  );

  assert.match(html, /质量包治理/u);
  assert.match(html, /质量包清单/u);
  assert.match(html, /结构化风格规则/u);
  assert.match(html, /高级 JSON/u);
  assert.match(html, /创建草稿质量包版本/u);
});
