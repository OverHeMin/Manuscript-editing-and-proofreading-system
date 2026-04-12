import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildMedicalAnalyzerPackageManifest,
  MedicalAnalyzerPackageEditor,
  parseMedicalAnalyzerPackageManifestDraft,
} from "../src/features/admin-governance/medical-analyzer-package-editor.tsx";

test("medical analyzer package editor round-trips governed analyzer fields", () => {
  const manifest = buildMedicalAnalyzerPackageManifest({
    indicators: "ALT | alanine aminotransferase | U/L",
    unitRanges: "ALT | U/L | 0 | 40",
    prePostTemplates: "before treatment|after treatment, baseline|follow-up",
    groupComparisonTemplates: "treatment group|control group",
    percentMax: "100",
    unitRangeConflictSeverity: "medium",
    unitRangeConflictAction: "suggest_fix",
    significanceMismatchSeverity: "high",
    significanceMismatchAction: "manual_review",
    tableTextDirectionSeverity: "medium",
    tableTextDirectionAction: "suggest_fix",
    numericConsistencyEnabled: true,
    medicalLogicEnabled: true,
    tableTextConsistencyEnabled: true,
  });
  const draft = parseMedicalAnalyzerPackageManifestDraft(manifest);

  assert.deepEqual(manifest.indicator_dictionary.ALT.aliases, [
    "alanine aminotransferase",
  ]);
  assert.equal(manifest.indicator_dictionary.ALT.default_unit, "U/L");
  assert.equal(manifest.unit_ranges.ALT[0].max, 40);
  assert.equal(manifest.issue_policy.unit_range_conflict.action, "suggest_fix");
  assert.equal(
    manifest.issue_policy.table_text_direction_conflict.severity,
    "medium",
  );
  assert.equal(draft.unitRanges, "ALT | U/L | 0 | 40");
  assert.equal(draft.percentMax, "100");
});

test("medical analyzer package editor renders structured governed fields for operators", () => {
  const html = renderToStaticMarkup(
    <MedicalAnalyzerPackageEditor
      manifest={buildMedicalAnalyzerPackageManifest({
        indicators: "ALT | alanine aminotransferase | U/L",
        unitRanges: "ALT | U/L | 0 | 40",
        prePostTemplates: "before treatment|after treatment",
        groupComparisonTemplates: "treatment group|control group",
        percentMax: "100",
        unitRangeConflictSeverity: "medium",
        unitRangeConflictAction: "suggest_fix",
        significanceMismatchSeverity: "high",
        significanceMismatchAction: "manual_review",
        tableTextDirectionSeverity: "medium",
        tableTextDirectionAction: "suggest_fix",
        numericConsistencyEnabled: true,
        medicalLogicEnabled: true,
        tableTextConsistencyEnabled: true,
      })}
      onChange={() => undefined}
    />,
  );

  assert.match(html, /Indicator Dictionary/);
  assert.match(html, /Unit Ranges/);
  assert.match(html, /Unit Range Conflict/);
  assert.match(html, /Analyzer Toggles/);
});
