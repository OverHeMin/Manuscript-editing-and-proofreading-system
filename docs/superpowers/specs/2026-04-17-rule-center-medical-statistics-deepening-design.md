# 2026-04-17 Rule Center Medical Statistics Deepening Design

**Date**

2026-04-17

**Status**

Approved in conversation as the continuation of the existing `规则中心 / 医学专用包 / AI 语义层` direction.

**Goal**

Land the missing governed medical-statistics layer so the system can do three things at the same time:

- let operators maintain medical statistical rules in `规则中心`
- let `医学专用包` expose the important adjustable thresholds and aliases
- let the Python medical analyzer actually use those settings for deterministic checks instead of only showing form fields

This pass is specifically about closing the gap the user identified between the earlier design intent and the current shipped behavior.

## 0.1 Closure Note

During implementation review, one architectural distinction became important and is now explicit in the shipped design:

- `瑙勫垯涓績` 里的 `medical_specialized content module` stores package-level governance summary, guidance, and examples
- `admin-governance` 里的 `medical_analyzer_package` stores the worker-facing structured analyzer manifest, including aliases, thresholds, toggles, and issue policy

Because these are different models, the rule-center package detail page must not pretend it is rendering live analyzer-manifest state when it is only holding content-module data.

The accepted shipped behavior is therefore:

- the package detail page first shows `当前包已声明的统计治理要点`, derived from the selected package's own `summary / guidance`
- the page may separately show `平台当前支持的医学统计校验能力` for medical-statistics packages, clearly labeled as platform capability rather than current-package configuration

This resolves the misleading static-summary problem without inventing a fake one-to-one mapping between the two package models.

## 1. Current Gap Summary

The repository already has a real `medical_specialized` analyzer, a governed `medical_analyzer_package` schema, and a rule-center authoring flow.

The missing parts are concentrated in three places:

1. the governed medical package schema is still shallow and does not yet describe diagnostic-statistics or regression-statistics behavior clearly
2. the worker can already detect basic `P value / CI / table-text` conflicts, but it does not yet treat `AUC / sensitivity / specificity / beta / SE` as first-class governed checks
3. the rule-center statistical rule form is still too generic for operators to understand what is actually being checked and what evidence is required

## 2. Final Product Decisions

### 2.1 One governed source of truth

This pass keeps one source of truth for medical statistical governance:

- `医学专用包` owns governed thresholds, aliases, derivation terms, and issue policy
- the Python analyzer reads that governed package at runtime
- `规则中心` exposes the same governed concepts in an operator-friendly way

The browser may expose configurable thresholds and aliases, but it must not expose raw parser code or freeform engine logic.

### 2.2 Add governed diagnostic-statistics configuration

The medical analyzer package must grow a new governed block for diagnostic metrics.

This block should support at least:

- `AUC`
- `sensitivity`
- `specificity`

The governed data must allow:

- accepted aliases for each metric
- configurable min/max range expectations
- configurable confusion-matrix aliases for `TP / FP / FN / TN`
- issue-policy control for diagnostic mismatches

### 2.3 Add governed regression-statistics configuration

The medical analyzer package must also grow a new governed block for regression-style statistics.

This block should support at least:

- `beta`
- `SE`
- `P value`
- `95% CI`
- `OR / RR / HR`

The governed data must allow:

- accepted aliases for each field
- the default confidence level used for deterministic recheck
- issue-policy control for regression inconsistencies

### 2.4 Add governed analyzer toggles

The package toggle layer must gain explicit switches for:

- `diagnostic_metric_consistency`
- `regression_consistency`
- `statistical_recheck`

This keeps the new checks deployable in a controlled way instead of forcing them on in every environment immediately.

### 2.5 Add governed issue-policy keys

The issue-policy layer must become rich enough to separately control the new categories of findings.

This pass should add policy keys for at least:

- `diagnostic_metric_out_of_range`
- `diagnostic_metric_mismatch`
- `auc_confidence_interval_conflict`
- `regression_coefficient_conflict`
- `statistical_information_incomplete`

These keys must be usable from both the governed package editor and the worker runtime.

### 2.6 Deterministic worker behavior boundary

The worker should be more capable, but still conservative.

The approved behavior is:

- if enough numeric evidence exists, the worker should re-calculate and compare
- if enough evidence does not exist, the worker should not invent results
- when the data is incomplete but suspicious, the worker should emit an explainable `manual_review` finding instead of pretending certainty

In this pass, deterministic recheck should include:

- `AUC` range validation and `CI low <= CI high` validation
- `AUC` confidence-interval boundary validation within governed min/max
- `sensitivity` and `specificity` recalculation when `TP / FP / FN / TN` can be read from text or table rows
- `beta / SE / 95% CI` consistency checking using the governed confidence level

### 2.7 Rule-center operator model

The rule center must stop presenting statistical rules as only a generic text pattern.

The statistical authoring model should expose operator-meaningful fields such as:

- metric family
- supported metrics
- required companion evidence
- recalculation policy
- inconsistency handling summary

The rule center should also expose package detail summaries that make the medical package explainable:

- current package declared governance points from package summary/guidance
- platform-supported diagnostic metrics
- platform-supported regression metrics
- recalculation capability
- issue-policy posture

### 2.8 AI semantic layer stays editable

The current direction remains valid:

- the operator can write the rule/package content
- AI semantic understanding can generate or normalize structured meaning
- the operator can modify the AI semantic output before final submission

This pass must preserve that posture for the richer statistical fields instead of bypassing it.

## 3. Out Of Scope Boundary

This pass should not try to turn the browser into a full statistics IDE.

The following remain repo-owned or later-phase work:

- new OCR engines
- freeform parser scripting in the browser
- full statistical-method theorem proving
- advanced calibration curves, NRI/IDI, decision-curve analysis, or publication-grade model validation suites

The target here is governed, explainable, high-value deterministic checking for the metrics the user explicitly asked about.

## 4. Acceptance Criteria

This design is satisfied only if all of the following become true:

1. operators can create or edit a medical analyzer package that clearly governs `AUC / sensitivity / specificity / beta / SE`
2. the worker emits real findings for diagnostic and regression inconsistencies when enough evidence exists
3. the worker emits clear `manual_review` findings when the evidence is insufficient but the claim is suspicious
4. the rule-center statistical authoring flow shows richer operator-facing parameters instead of only a generic expression pattern
5. package detail surfaces make the new governed statistical behavior visible without forcing operators into raw JSON
6. all new behavior is covered by focused API, web, and Python tests

## 5. Implementation Direction

The implementation should be done in this order:

1. extend the governed medical package schema and editor
2. extend the Python runtime and worker checks behind governed toggles and policies
3. extend the rule-center statistical authoring and package-detail visibility
4. verify the new checks with targeted tests before broad regression runs

This order is mandatory because UI-only support would create another visible/runtime mismatch, which is the exact problem this pass is intended to fix.
