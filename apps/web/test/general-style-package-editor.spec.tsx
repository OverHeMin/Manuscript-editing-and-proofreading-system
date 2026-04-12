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
