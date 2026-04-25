# 2026-04-25 Manuscript Harness, Deep Proofreading, and Production Governance Design

## 1. Purpose

This design defines the next required product layer for the medical manuscript system.

The goal is not to redesign the existing system. The goal is to build on the current V1 foundation:

- manuscript workbench
- screening, editing, and proofreading module execution
- governed runtime binding
- execution snapshots
- knowledge hit logs
- review items
- rule center
- knowledge library
- quality packages
- Harness / evaluation workbench
- verification ops

The required outcome is a stable closed loop:

1. every AI-assisted manuscript task is controlled and inspectable through Harness evidence
2. proofreading performs real deep residual review after governed rules, knowledge, packages, prompts, and skills are loaded
3. the system runs persistently and fails honestly, with restart-safe state and reviewable recovery paths

## 2. Non-Negotiable Requirements

### 2.1 Harness Controls Every AI Work Item

For every manuscript and every module run, the operator must be able to see:

- what the system expected AI to check
- what AI actually checked
- which rules, knowledge items, quality packages, prompts, skills, models, and policies were active
- which expected checks were hit
- which expected checks were not hit
- which items were skipped and why
- which findings were false positives
- which findings were missed and added by humans
- which findings should be routed back into the rule center or knowledge library

Harness is a system-level quality control layer. It is not a proofreading-only feature and not a local checklist inside one module.

### 2.2 Deep Proofreading Is Required

Proofreading must not be a single lightweight residual scan.

The correct proofreading order is:

1. resolve governed runtime context
2. load rule center context
3. load knowledge library context
4. load general and medical quality packages
5. load prompt templates and skill packages
6. load model routing, retrieval preset, execution profile, tool policy, sandbox, agent profile, and manual review policy
7. run rule, knowledge, package, and structured checks
8. run five-pass AI deep residual proofreading
9. merge, dedupe, classify risk, and route to human review
10. record all work in Harness evidence

The residual AI layer remains residual. It fills gaps after governed context has already done its work.

### 2.3 Production Quality Closure Is Required

The system must be stable enough for internal testing:

- migrations are visible and applied before persistent test runs
- provider and model routing failures are explicit
- jobs do not pretend success after AI or persistence failures
- each pass stores durable input, output, status, model, and error evidence
- interrupted work can be resumed or retried
- human review state survives restart
- final assets, AI reports, snapshots, review items, and Harness evidence are traceable

## 3. Current System Baseline

### 3.1 Existing Module Boundaries

The current system has three distinct business lanes:

- screening
- editing
- proofreading

The workbench may suggest moving from screening to editing and from editing to proofreading, but the modules are separate execution lanes.

Current execution routes include:

- `POST /api/v1/modules/screening/run`
- `POST /api/v1/modules/editing/run`
- `POST /api/v1/modules/proofreading/draft`
- `POST /api/v1/modules/proofreading/finalize`
- `POST /api/v1/modules/proofreading/publish-human-final`

### 3.2 Existing Governed Runtime Context

The governed execution path already resolves:

- active runtime binding
- execution profile
- prompt template
- skill packages
- quality package version IDs
- model routing
- retrieval preset
- manual review policy
- runtime binding readiness
- tool permission policy
- sandbox profile
- agent runtime
- agent profile
- verification expectations

This design must reuse that structure.

### 3.3 Existing Evidence and Harness Foundations

The current foundation already includes:

- execution snapshots
- knowledge hit logs
- review items
- governed hits
- verification ops
- Harness datasets
- Harness integrations
- Harness control plane
- evaluation workbench
- knowledge evidence packages
- table full-fidelity snapshots
- rule activation metrics

The missing product layer is a manuscript-level Harness matrix that aggregates these existing sources for each manuscript and module.

## 4. Target Product Shape

### 4.1 Entry Point

Do not place the Harness matrix inside the hidden manuscript overview card.

Add a visible button in the manuscript workbench action area:

- `查看 Harness 质量矩阵`
- English fallback: `View Harness Quality Matrix`

The same button should be available from screening, editing, and proofreading workbench modes.

The button opens a dedicated page:

- hash route: `/#manuscript-harness?manuscriptId=<id>`

The page is manuscript-scoped, not module-scoped.

### 4.2 Manuscript Harness Matrix Page

The page contains one manuscript-level summary and three module panels:

1. screening
2. editing
3. proofreading

Each module panel displays:

- latest run status
- latest snapshot ID
- execution mode
- model and model source
- runtime binding
- execution profile
- prompt template
- skill packages
- quality packages
- retrieval preset
- manual review policy
- rule set and resolved rules
- knowledge hits
- expected checks
- actual hits
- not-hit expected checks
- skipped checks
- false positives
- human-added misses
- rule or knowledge writeback candidates

If a module has not run, its panel must show:

- `尚未执行`
- no snapshot
- no hit/miss matrix

It must not silently hide the module.

### 4.3 Harness Matrix Item States

Each matrix item must have one of these states:

- `expected_not_run`: expected but module run has not happened
- `not_applicable`: checked and not applicable to this manuscript
- `checked_pass`: checked and no problem found
- `hit_correct`: hit and accepted by human or validation
- `hit_pending_review`: hit but not yet reviewed
- `hit_false_positive`: hit but rejected as false positive
- `missed_should_hit`: human or gold sample says AI should have found it
- `manual_added`: human added after AI missed it
- `skipped_by_policy`: skipped because policy says not to run
- `skipped_missing_evidence`: skipped because required evidence is missing
- `failed`: attempted but failed

The page must separate:

- expected coverage
- actual AI output
- human judgment
- writeback opportunity

### 4.4 Harness Matrix State Derivation

Matrix states must be derived from auditable facts. The page must not infer quality from display text alone.

The MVP state derivation rules are:

| State | Primary source | Derivation rule |
| --- | --- | --- |
| `expected_not_run` | manuscript module history / execution snapshots | The module has expected checks from template, runtime binding, rule set, or package context, but no snapshot exists for that module. |
| `not_applicable` | check result / rule result / pass output | The check was evaluated and explicitly marked not applicable to the manuscript context. |
| `checked_pass` | rule result / quality result / pass output | The check was evaluated, no issue was found, and no manual reviewer later marked it as missed. |
| `hit_pending_review` | AI finding / governed hit / residual issue | AI produced a finding, but no human or validation decision has accepted or rejected it. |
| `hit_correct` | review item / governed hit decision / validation result | A finding was accepted by human review or validated by a gold sample / verification result. |
| `hit_false_positive` | review item decision | A finding was rejected as false positive, evidence-only archive, or not applicable after review. |
| `missed_should_hit` | human-added issue / gold sample / reviewed case | A human or gold sample says the item should have been found, but no matching AI/rule/package hit exists. |
| `manual_added` | review item / proofreading confirmation / learning candidate | A human added an issue that was not present in the AI output. |
| `skipped_by_policy` | runtime binding / manual review policy / rule execution posture | The check was intentionally skipped because policy or execution posture disallowed automatic handling. |
| `skipped_missing_evidence` | rule skip reason / table patch result / quality package evidence gap | The check required evidence that was missing, incomplete, non-authoritative, or unavailable. |
| `failed` | job status / pass status / adapter execution | The check or pass attempted execution but ended in a failed state. |

State precedence must be deterministic:

1. `failed`
2. `missed_should_hit`
3. `hit_false_positive`
4. `hit_correct`
5. `hit_pending_review`
6. `manual_added`
7. `skipped_missing_evidence`
8. `skipped_by_policy`
9. `checked_pass`
10. `not_applicable`
11. `expected_not_run`

The backend should own this derivation. The frontend should render matrix states returned by the API instead of recomputing them from many independent APIs.

### 4.5 Manuscript Harness Matrix Aggregation API

Add one manuscript-scoped aggregation API:

- `GET /api/v1/manuscripts/:manuscriptId/harness-matrix`

The API returns:

- manuscript identity
- one panel for each module: screening, editing, proofreading
- latest run summary per module
- latest snapshot per module
- expected matrix items
- actual hit items
- state-derived matrix items
- review decisions
- writeback candidates
- source references for every matrix item

Each matrix item must include:

- stable item ID
- module
- category: rule, knowledge, quality_package, prompt_skill, model_runtime, proofreading_pass, human_review, verification
- source kind
- source ID
- display title
- state
- severity
- evidence quote or summary when available
- linked snapshot ID
- linked review item ID when available
- linked rule ID / knowledge item ID / package ID when available
- skip or failure reason when available

The API should first be read-only. Mutating actions should continue to use existing review item, learning governance, rule center, and knowledge library APIs.

## 5. Harness Coverage Sources

Harness expected checks are not invented by the page. They come from existing governed context:

### 5.1 Rule Center

Source:

- resolved editorial rules
- rule set
- rule execution mode
- rule action
- structured action
- confidence policy
- evidence package IDs
- target model block IDs

Harness role:

- show which rules were active
- show which rules hit
- show which rules did not hit
- show which rules were skipped
- show why a rule was skipped

### 5.2 Knowledge Library

Source:

- approved runtime knowledge
- confirmed semantic layer
- knowledge bindings
- knowledge hit logs
- knowledge evidence packages

Harness role:

- show which knowledge items were selected
- show why they were selected
- show whether AI used them in findings
- show knowledge expected but not used when applicable evidence exists

### 5.3 Quality Packages

Source:

- quality package versions bound by runtime binding
- package kind
- package manifest
- target scopes

Harness role:

- show active general package checks
- show active medical package checks
- show package-derived expected checks
- show package findings and missing findings

### 5.4 Prompt and Skill Packages

Source:

- prompt template ID and version
- skill package IDs and versions
- execution profile

Harness role:

- show which prompt and skills controlled the AI work
- show which deep proofreading pass used which prompt or skill
- show if a required skill package was missing

### 5.5 Model and Runtime Governance

Source:

- model routing decision
- fallback chain
- AI provider runtime selection
- runtime binding readiness
- tool permission policy
- sandbox profile
- agent runtime
- agent profile

Harness role:

- prove which model actually ran
- show fallback or provider warnings
- show whether tool permissions affected execution
- prevent hidden runtime changes from being mistaken as quality changes

### 5.6 Human Review and Learning

Source:

- review items
- governed hits
- residual issues
- human decisions
- learning candidates
- rule candidates
- knowledge candidates

Harness role:

- mark false positives
- mark missed issues
- create rule center writeback candidates
- create knowledge library writeback candidates
- create Harness dataset candidates

## 6. Deep Proofreading Design

### 6.1 Proofreading Execution Order

Proofreading must first build full governed context:

1. runtime binding
2. rules
3. knowledge
4. quality packages
5. prompt template
6. skill packages
7. model routing
8. retrieval preset
9. execution profile
10. manual review policy
11. tool permission policy
12. sandbox / runtime / agent profile
13. verification expectations

Only after that should the AI residual deep proofreading start.

### 6.2 Five-Pass Deep Proofreading

Deep proofreading consists of five AI passes.

#### Pass 1: Language and Basic Proofreading

Checks:

- typos
- wrong characters
- awkward sentences
- punctuation
- repeated wording
- terminology consistency

Output:

- structured findings
- location anchors
- evidence quote
- suggested action

#### Pass 2: Format and Journal Requirements

Checks:

- title format
- abstract structure
- keywords
- heading hierarchy
- reference format
- unit style
- statistical symbol style
- table and figure labels

This pass must explicitly consume rule center and general quality package context.

#### Pass 3: Medical Content and Logic

Checks:

- study population
- inclusion and exclusion criteria
- intervention description
- medical terminology
- conclusion strength
- clinical reasoning risk
- guideline or evidence mismatch

This pass must explicitly consume medical package and knowledge library context.

#### Pass 4: Statistics, Numbers, and Table Consistency

Checks:

- sample size consistency
- group totals
- P value expression
- χ² and t test expression
- table versus body consistency
- abstract versus result consistency
- conclusion versus result consistency

This pass must consume structured document and table evidence when available.

#### Pass 5: Residual Synthesis, Dedupe, and Risk Ranking

Checks:

- issues not covered by prior passes
- duplicate issue merging
- severity calibration
- manual review requirement
- route-to-rule or route-to-knowledge recommendations

This is the final residual analysis pass.

It must not erase earlier pass evidence. It can merge and classify, but the original pass findings remain inspectable.

### 6.3 Deep Proofreading Persistence

Each pass must persist:

- pass ID
- pass kind
- input context digest
- active rule IDs
- active knowledge IDs
- active quality package IDs
- prompt template ID
- skill package IDs
- model ID
- started time
- finished time
- status
- output JSON
- error summary
- retry count

If one pass fails, the proofreading job must not pretend to be complete.

## 7. Production Quality Closure

### 7.1 Persistent Job State

Module jobs must support durable sub-step state:

- queued
- running
- context_resolved
- checks_running
- pass_running
- pass_completed
- awaiting_human_review
- failed_retryable
- failed_blocking
- completed

The system must distinguish:

- business completion
- orchestration completion
- review completion
- export completion

### 7.2 Failure Behavior

Required failure rules:

- missing migration blocks persistent test claims
- missing provider credential blocks AI execution
- model route resolution failure blocks AI execution
- failed pass blocks final completion unless manually waived
- missing required evidence blocks automatic editing or check completion
- failed writeback does not erase successful business execution

### 7.3 Recovery

The system must support:

- retry a failed pass
- resume a partially completed proofreading run
- reopen human review
- regenerate Harness matrix from snapshots
- re-run Harness evaluation after rules or knowledge change

### 7.4 Inner-Test Readiness Checklist

Before internal testing:

- database migration doctor reports no pending migrations
- API health endpoint passes
- web app starts
- upload root is writable
- Qwen or configured provider test passes
- model routing resolves for screening, editing, and proofreading
- runtime bindings are active for target manuscript type
- rule sets required by governed execution are active or published
- knowledge semantic layers intended for runtime use are confirmed
- Harness matrix page opens for a manuscript with and without module runs
- one real manuscript can run proofreading deep-pass MVP without data loss

## 8. MVP Implementation Scope

### 8.1 Three-Phase Delivery

This design must not be implemented as one large unbounded change. It should be delivered in three phases.

#### Phase 1: Read-Only Manuscript Harness Matrix

Goal:

- make AI control visible for each manuscript and module without changing execution behavior

Build:

1. manuscript workbench button
2. dedicated manuscript Harness matrix route
3. read-only backend matrix aggregation service
4. latest snapshot aggregation for screening, editing, proofreading
5. rule, knowledge, quality package, prompt, skill, model, runtime, review item summary
6. state derivation for existing facts
7. empty-state handling for modules that have not run

Do not build in Phase 1:

- new deep proofreading execution
- new writeback automation
- automatic fine-tuning
- new gold sample judgment automation

Acceptance:

- a real manuscript can open the matrix page
- all three module panels are visible
- executed modules show evidence
- non-executed modules show `尚未执行`
- matrix states are derived by backend rules

#### Phase 2: Five-Pass Deep Proofreading and Residual Persistence

Goal:

- replace lightweight residual scanning with auditable five-pass deep proofreading

Build:

1. proofreading pass model, preferably `proofreading_pass_runs`
2. five pass runner
3. per-pass input/output/status/model/error persistence
4. retry and resume for failed pass
5. residual synthesis pass
6. Harness matrix integration for pass coverage

Acceptance:

- one real manuscript creates five pass records
- each pass has structured output
- failures do not pretend completion
- restart does not lose pass results
- final proofreading report keeps pass evidence traceable

#### Phase 3: Full Quality Closure and Learning Feedback

Goal:

- make misses, false positives, and writeback candidates drive quality improvement

Build:

1. matrix-driven review actions
2. false-positive and missed-issue workflow
3. rule candidate and knowledge candidate handoff
4. Harness dataset candidate creation from matrix items
5. verification result comparison after rule or knowledge changes
6. production readiness panel for persistent internal testing

Acceptance:

- humans can mark false positives and misses from matrix context
- accepted misses can route to rule or knowledge candidates
- next run can compare against previous matrix states
- readiness checks prevent false “stable” claims

### 8.2 Build First

First implementation should build the smallest complete loop:

1. manuscript workbench button
2. dedicated manuscript Harness matrix page
3. backend aggregation API for manuscript Harness matrix
4. backend matrix state derivation service
5. latest snapshot and review item integration
6. visible empty states for non-run modules
7. then proofreading five-pass record model
8. then deep proofreading MVP using existing proofreading draft pipeline
9. then health/readiness checks for persistent internal testing

### 8.3 Do Not Build First

Do not start with:

- full visual redesign
- new standalone Harness product replacing existing evaluation workbench
- automatic fine-tuning
- full vector retrieval rebuild
- automatic rule publication
- automatic medical fact correction
- 8-user concurrent deep proofreading load testing

## 9. Acceptance Criteria

### 9.1 Harness Matrix Acceptance

For a manuscript with at least one module run:

- the page opens from the manuscript workbench button
- all three module panels are visible
- run modules show latest snapshot evidence
- non-run modules show `尚未执行`
- rules, knowledge, packages, prompt, skills, model, and policies are visible when present
- hit, miss, skipped, and manual-review states are visible
- review decisions update matrix states

### 9.2 Deep Proofreading Acceptance

For one real manuscript:

- proofreading resolves governed context
- five pass records are created
- each pass returns structured JSON
- residual synthesis keeps original pass evidence
- final report includes grouped issues
- human review can confirm, reject, or add misses
- Harness matrix shows pass coverage
- restart does not lose pass output

### 9.3 Production Closure Acceptance

For persistent local runtime:

- pending migrations are visible before run
- provider failure is explicit
- model routing failure is explicit
- pass failure is retryable or blocking with clear state
- no failed AI execution is marked as completed
- final asset export remains traceable to source snapshot and review decisions

## 10. Open Decisions

These decisions should be made before implementation:

1. whether pass-level persistence starts inside job payload or a new `proofreading_pass_runs` table
2. whether the Harness matrix API reads only latest snapshots or supports historical comparison from day one
3. whether `missed_should_hit` is human-only in MVP or can also come from gold samples
4. whether deep proofreading MVP uses one model for all five passes or supports per-pass model routing

Recommended defaults:

1. use a dedicated table if implementation time allows; otherwise start with job payload and migrate later
2. show latest snapshot first; add history later
3. human-only misses in MVP
4. one model for all five passes in MVP, while recording pass kind for future routing
