# Phase 9Q Evaluation Sample Context Handoff Design

**Date:** 2026-04-03  
**Status:** Approved for implementation under the current autonomous Phase 9 direction  
**Scope:** Make Evaluation Workbench handoffs preserve sample-level context across workbenches by carrying `reviewedCaseSnapshotId` as the primary focus key and `sampleSetItemId` as a secondary reference, without changing current asset-selection behavior.

## 1. Goal

Phase 9Q does not introduce new evaluation logic, new back-end APIs, or automatic asset matching. The goal is narrower:

- Let operators jump from Evaluation Workbench into a manuscript workbench with the exact evaluation sample context still visible.
- Preserve that same context when round-tripping back into Evaluation Workbench.
- Keep existing manuscript-only handoffs working exactly as they do today.

After this slice, an operator should be able to tell which evaluated sample they are looking at even when multiple sample-set items belong to the same manuscript.

## 2. Current Gap

The current handoff chain already carries `manuscriptId`, which is enough to auto-load the target workspace, but not enough to preserve sample-level focus:

- Evaluation Workbench can resolve `run item -> sample set item -> manuscript`.
- Linked sample actions can open the correct target workbench for the manuscript.
- Manuscript Workbench can round-trip back to Evaluation Workbench with manuscript-scoped context.

What is missing is the identity of the specific evaluated sample:

- The hash router only understands `manuscriptId` and `knowledgeItemId`.
- Evaluation handoff links drop `reviewed_case_snapshot_id` and `sampleSetItem.id`.
- The target manuscript workbench only knows which manuscript to load, not which evaluation sample the operator came from.
- When one manuscript appears multiple times in sample sets, the operator loses sample-level focus after the jump.

## 3. Options Considered

### Option A: Extend URL handoff parameters and keep workspace loading unchanged

Add `reviewedCaseSnapshotId` and `sampleSetItemId` to the existing hash contract, pass them through the host, and render them as explicit handoff context in the target workbench.

Pros:

- Smallest possible behavioral change.
- Refresh-safe and easy to verify in Playwright.
- Reuses the existing workbench-host routing pattern.
- Leaves room for future asset-matching work without committing to it now.

Cons:

- Does not auto-select or auto-recommend a more specific asset.

Recommended.

### Option B: Keep the extra context in host-only transient state

Store sample context only in React state during navigation instead of adding it to the URL.

Pros:

- Shorter URLs.

Cons:

- Refresh loses context.
- Round-trip behavior becomes harder to reason about.
- Tests become weaker because the handoff state is less observable.

Not recommended.

### Option C: Extend the URL and also auto-map snapshot context to manuscript assets

Carry the new keys and add client-side or server-assisted logic that tries to choose a closer parent/current asset automatically.

Pros:

- More opinionated operator experience.

Cons:

- Expands scope into asset-resolution rules.
- Adds ambiguity and more failure modes.
- Risks destabilizing current workspace loading behavior.

Out of scope for this slice.

## 4. Recommended Architecture

Phase 9Q should use URL-visible, workbench-agnostic handoff context:

1. Extend the hash route contract with:
   - `reviewedCaseSnapshotId`
   - `sampleSetItemId`
2. Treat `reviewedCaseSnapshotId` as the primary focus key.
3. Treat `sampleSetItemId` as a secondary reference for operator visibility and fallback context.
4. Keep `manuscriptId` as the only required input for loading the target manuscript workspace.
5. Render the handed-off sample context explicitly in the target manuscript workbench.
6. Preserve the same context when linking back from Manuscript Workbench to Evaluation Workbench.

This keeps routing concerns in the routing layer, display concerns in page components, and avoids pulling sample-resolution logic into the workbench host.

## 5. Component Changes

### 5.1 `apps/web/src/app/workbench-routing.ts`

Extend the routing contract:

- Add `reviewedCaseSnapshotId?: string`
- Add `sampleSetItemId?: string`

Update:

- `WorkbenchLocation`
- `formatWorkbenchHash()`
- `resolveWorkbenchLocation()`

Behavior:

- Continue supporting the old string shorthand for manuscript-only handoffs.
- Include the new keys only when non-empty.
- Preserve backward compatibility for every existing route.

### 5.2 `apps/web/src/app/workbench-host.tsx`

Pass the new route fields through just like `manuscriptId`:

- Store them in `routeState`
- Preserve them in `resolveInitialWorkbenchRoute()`
- Forward them to `ManuscriptWorkbenchPage`
- Forward them when calling `formatWorkbenchHash()` from host-controlled navigation

The host should not interpret these values. It only parses and forwards them.

### 5.3 `apps/web/src/features/evaluation-workbench/evaluation-workbench-page.tsx`

Unify linked-sample handoff generation behind one helper so that:

- selected run-item detail cards
- linked sample context history lists
- any future sample-level handoff entrypoints

all generate the same hash contract.

Each handoff should include:

- `manuscriptId`
- `reviewedCaseSnapshotId`
- `sampleSetItemId`

Primary behavior:

- If `reviewedCaseSnapshotId` exists, include it.
- If `sampleSetItemId` exists, include it.
- If only `manuscriptId` exists, fall back to the old manuscript-only link.

### 5.4 `apps/web/src/features/manuscript-workbench/manuscript-workbench-page.tsx`

Add two optional props:

- `prefilledReviewedCaseSnapshotId?: string`
- `prefilledSampleSetItemId?: string`

Do not change `loadPrefilledWorkbenchWorkspace()` to use them. It should continue to load only by `manuscriptId`.

Instead, render a lightweight operator-facing context card when either value is present:

- Title: `Evaluation Handoff Context`
- Fields:
  - `Manuscript`
  - `Reviewed Snapshot`
  - `Sample Set Item`
- Helper copy that explains:
  - the workspace was loaded by manuscript
  - these values identify the evaluation sample the operator came from

This card should be informative, not blocking.

### 5.5 `apps/web/src/features/manuscript-workbench/manuscript-workbench-summary.tsx`

When rendering the link back to Evaluation Workbench:

- preserve `manuscriptId`
- preserve `reviewedCaseSnapshotId` when present
- preserve `sampleSetItemId` when present

If those values are absent, keep the current manuscript-only link behavior.

## 6. Data Flow

The intended operator flow becomes:

1. An operator selects or inspects a run item in Evaluation Workbench.
2. The page resolves the linked sample set item.
3. The handoff link is built with:
   - `manuscriptId`
   - `reviewedCaseSnapshotId`
   - `sampleSetItemId`
4. Workbench Host parses the hash and forwards all values.
5. Manuscript Workbench auto-loads the workspace from `manuscriptId`.
6. Manuscript Workbench renders the handed-off sample context card.
7. If the operator jumps back to Evaluation Workbench, the same context values remain in the hash.

## 7. Fallback and Error Handling

Phase 9Q should degrade gently:

- If `reviewedCaseSnapshotId` is missing but `sampleSetItemId` exists, still allow the handoff.
- If both sample-context keys are missing, fall back to today's manuscript-only behavior.
- If the manuscript workspace loads successfully but the sample-context keys are present, always show them as informational context.
- The new keys must never block workspace loading.
- No new error state should appear just because a sample-context key cannot be used for deeper automation.

This protects the current operator workflow while still surfacing the new context.

## 8. Out of Scope

Phase 9Q does not do any of the following:

- snapshot-to-asset auto-matching
- asset auto-selection or parent-asset re-prioritization
- new API endpoints
- new persistence fields
- server-side validation of handoff context
- deeper sample-detail panels inside the manuscript workbench beyond the new context card

Those can be explored later only if the operator experience still feels insufficient after this simpler slice lands.

## 9. Verification

### 9.1 Routing Tests

Add or update unit tests so that:

- `formatWorkbenchHash()` can emit all three keys together
- `resolveWorkbenchLocation()` can parse all three keys together
- old manuscript-only and knowledge-item routes still resolve correctly

### 9.2 Evaluation Workbench Tests

Add or update tests so that:

- linked sample context links include `manuscriptId`, `reviewedCaseSnapshotId`, and `sampleSetItemId`
- selected run-item detail links use the same helper and the same route shape
- missing optional sample-context fields degrade to the correct smaller link

### 9.3 Manuscript Workbench Tests

Add or update tests so that:

- the page renders the evaluation handoff context card when the new prefill props are present
- the page remains unchanged when only `prefilledManuscriptId` is provided
- `loadPrefilledWorkbenchWorkspace()` still loads by manuscript only

### 9.4 Round-Trip Tests

Add or update tests so that:

- a manuscript workbench opened from evaluation context links back to Evaluation Workbench without dropping `reviewedCaseSnapshotId` or `sampleSetItemId`
- pages without evaluation context still link back with manuscript-only behavior

### 9.5 Playwright

Extend the browser flow to prove:

- opening a manuscript workbench from linked sample context includes all three route keys
- the target page visibly shows the evaluation handoff context
- round-tripping back to Evaluation Workbench preserves those keys
- existing manuscript-only handoffs still work

## 10. Acceptance Criteria

Phase 9Q is complete when:

- Evaluation Workbench sample-context links preserve both `reviewedCaseSnapshotId` and `sampleSetItemId`
- Manuscript Workbench shows an explicit evaluation handoff context card when those values are present
- round-trip navigation back to Evaluation Workbench does not drop the sample context
- old manuscript-only handoffs continue to work without regressions
- no new asset-selection logic or back-end dependencies are introduced
