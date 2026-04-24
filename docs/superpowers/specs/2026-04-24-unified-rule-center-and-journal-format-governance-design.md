# 2026-04-24 Unified Rule Center And Journal Format Governance Design

**Date**

2026-04-24

**Status**

Written after design approval in conversation. Awaiting written review before implementation.

**Goal**

Turn the current rule-center direction into one governed format-and-decision system that:

- serves `screening`, `proofreading`, and `editing` from one rule source
- keeps `knowledge library`, `rule center`, and `journal template` responsibilities distinct
- replaces AI-guess-heavy intake with deterministic evidence capture plus reviewed AI drafting
- supports high-fidelity journal-format governance, especially table formatting and symbol handling
- makes bindings visible, operable, and truly effective at runtime

In one sentence:

The system should stop behaving like several loosely-related ledgers and become one enforceable governance chain from format evidence to reviewed rule to runtime effect.

## User-Approved Baseline

The approved baseline for this design is:

`规则中心不是校对专用后台，而是全流程稿件治理中心。`

The following decisions are locked:

- rule center must serve `screening`, `proofreading`, `editing`, and `knowledge library`
- editing must only normalize format and must not change article meaning, data, or medical conclusions
- table governance must support both rule intake and runtime manuscript checking
- the preferred direction is an exact-capture clipboard intake flow for Word/WPS tables plus DOCX runtime truth
- knowledge library must follow the same deterministic evidence-first approach and must not let AI guess freely
- image-based replacement of symbols such as `χ²` is treated as an object-type problem, not a normal text-style case
- binding buttons and runtime binding effectiveness must be treated as first-class design scope, not deferred cleanup
- visible `通用包` must map to real runtime package kind `general_style_package`
- visible `医用包` must map to real runtime package kind `medical_analyzer_package`
- package-scoped runtime activation must be resolved from active runtime binding quality-package context, not from template-family guesswork

## Why This Design Is Needed

The repository already contains meaningful governed pieces, but they are split across concepts that do not yet form one reliable operator workflow.

### What already works

- module runtime can resolve journal-layer rule overrides on top of base rule sets
- table DOCX parsing already produces semantic and coarse style snapshots
- table rules already support semantic targeting and controlled patch planning
- rule wizard already provides real selection UI for package-like rule placement, template-family binding, and linked knowledge selection

### What is still broken

- journal template profiles are too thin to represent a complete journal format target by themselves
- knowledge bindings exist as types, but the main knowledge UI still relies on raw text entry instead of real selection controls
- runtime knowledge selection still mostly treats bindings as flattened template ids instead of preserving binding kind semantics
- current “general package / medical package” UX is mixed with content-module concepts and is not yet clearly aligned with the real runtime package model the user expects
- table intake currently does not yet preserve the full rich Word formatting detail required by the approved product direction

The result is a false sense of governance:

- some parts are governed
- some parts are only stored
- some parts are visible but not really usable
- some parts are usable but not surfaced correctly

This design exists to close that gap.

## Product Principle

### 1. One source, different execution posture

Rules should be authored once, but each module consumes them differently:

- `screening` turns rule hits into decision support
- `proofreading` turns rule hits into issue explanation and correction guidance
- `editing` turns only safe, format-only rule hits into controlled document changes

### 2. Evidence before AI

AI may draft, summarize, and explain, but it must not be the first or final source of truth for journal formatting requirements.

### 3. Format governance is not prompt governance

Prompt templates may frame task behavior, but precise journal formatting must live in structured rules plus structured evidence, not inside long prompt prose.

### 4. Bindings must be real

If the UI shows that a rule or knowledge item is bound to a journal template, package, or template family, that binding must be:

- selectable with real controls
- inspectable after save
- preserved in runtime state
- observable in why-this-fired explanations

### 5. Editing is the strictest module

Editing gets the strongest guardrails because bad automatic formatting can create disaster-level output. If a rule even slightly risks changing content, it must degrade to inspect-only or explicit confirmation.

### 6. Supported-path exactness, not best effort

For the formally supported table-intake path, the requirement is exact capture of key formatting facts, not approximate capture.

That means:

- the supported intake path must be explicitly narrowed
- key style fields must be fully reconstructed before rule or knowledge drafting can proceed
- if key formatting facts are missing, the intake must fail closed
- AI must not invent missing formatting facts

## Scope

### In Scope

- redesign rule center around governed rule intake, ledger, review, and runtime effect
- define the role boundary between journal templates, knowledge library, and rule center
- add deterministic evidence capture for text, tables, visual symbols, and a future-phase equation-object extension
- add an exact-capture Word/WPS clipboard intake design for table evidence
- align runtime manuscript checking to the same evidence model through DOCX parsing
- extend the same governed model across screening, proofreading, and editing
- redesign bindings so journal-template, package, and template-family scope are all real UI and real runtime inputs
- define end-to-end verification for “bound here, effective here”

### Out Of Scope

- immediate full implementation of all rich Word style extraction
- perfect support for every clipboard source in every OS/browser/editor combination
- broad automatic table reconstruction in the first delivery
- changing article meaning, scientific content, or clinical conclusions in editing

## 1. System Roles

### 1.1 Journal templates

Journal templates choose the active target journal or scenario for a manuscript. They are selection and overlay scope objects, not the full executable formatting source.

Journal templates answer:

- which journal target is active
- which journal-layer overrides should load
- which journal-scoped knowledge and evidence should become relevant

Journal templates should not be treated as the place where all formatting requirements are manually described in free text.

Journal templates also do not replace runtime quality-package context. Journal selection and package activation are different axes and must stay separate in both UI and runtime logic.

### 1.2 Knowledge library

The knowledge library stores evidence, examples, and interpretation basis.

It answers:

- why a formatting or decision rule exists
- what the official or learned example looks like
- what correct and incorrect evidence look like

Knowledge is not the direct editing engine. It supports authoring, explanation, human review, and retrieval.

### 1.3 Rule center

The rule center is the executable layer.

It answers:

- what to check
- what to classify
- what to explain
- what may be changed automatically
- what must stay inspect-only

In practice:

- journal template selects the target
- knowledge library provides the basis
- rule center turns that basis into runtime action

For package-scoped governance, the rule center must bind against real runtime package kinds rather than content-module lookalikes.

## 2. Unified Governance Model

The final system should operate as one four-surface governance model:

- `screening`
- `proofreading`
- `editing`
- `knowledge library`

### 2.1 Screening

Screening does not edit manuscripts. It uses rule hits plus knowledge evidence to produce:

- issue identification
- risk grading
- return / accept / reject recommendations

Rules used by screening must be able to carry decision metadata such as:

- whether screening should consider the rule
- severity for screening
- recommended action
- hard-stop behavior
- decision-comment template

### 2.2 Proofreading

Proofreading focuses on:

- issue discovery
- precise location
- explanation
- suggested correction
- manual review routing where needed

It may rely on the same rules as editing, but it consumes them in explain-first posture rather than auto-apply-first posture.

### 2.3 Editing

Editing is responsible for format normalization only.

Locked editing rule:

`Do not change article content; only normalize it into the selected journal format.`

Editing may safely act on:

- heading formatting
- punctuation format
- unit presentation
- reference formatting
- table caption and note placement
- three-line-table compliance
- allowed italic, bold, superscript, and alignment normalization

Editing must not auto-act on anything that risks altering meaning, values, or interpretation.

### 2.4 Knowledge library

Knowledge items become the structured evidence layer behind all three modules. They must be attachable to journal scope and package scope, not only to template-family scope.

## 3. Deterministic Evidence Snapshots

The system should adopt one unified evidence-first intake model across rule center and knowledge library.

### 3.1 Snapshot types

The minimum first-version snapshot model is:

- `text_snapshot`
- `table_style_snapshot`
- `visual_symbol_snapshot`
- `equation_object_snapshot` as a future-phase structured extension

### 3.2 Table style snapshot

`table_style_snapshot` must support both intake and runtime checking.

It should capture:

- row and column structure
- merged cells
- caption text and caption position
- note text and note position
- header depth
- stub columns
- unit markers
- statistical footnotes
- top, header, bottom, and vertical border profile
- alignment profile
- cell-level and run-level style information for supported intake documents
- font, italic, bold, superscript, and subscript signals for supported intake documents

### 3.3 Visual symbol snapshot

`visual_symbol_snapshot` exists to handle cases where authors use images to represent symbols or formula fragments.

It should capture:

- source kind
- normalized candidate symbol
- confidence
- local context
- nearby text
- review state

Its purpose is:

- explain likely content
- support review
- trigger object-type rules

It is not used to silently bless image-based symbol substitution as valid text.

## 4. High-Fidelity Table Intake

### 4.1 Chosen direction

The approved direction is not “simple paste plus AI guess”. It is:

- exact-capture clipboard intake for Word/WPS table intake
- deterministic parsing before AI drafting
- DOCX-based truth checking at manuscript runtime
- fail-closed behavior whenever critical formatting facts cannot be fully reconstructed

### 4.2 Intake behavior

The rule-intake and knowledge-intake table surface should become a dedicated rich paste workspace that:

- reads `text/html`
- reads `text/plain`
- reads `rtf` when the browser exposes it
- reconstructs table structure deterministically
- extracts style hints before any AI step
- blocks formal rule or runtime-eligible knowledge publication when key style facts are incomplete

The first supported primary environment should be explicitly narrowed to:

- Windows
- Chrome or Edge
- Word or WPS to browser paste

Inside this supported path, the product requirement is exact capture of the approved key formatting fields. Outside this path, the feature may fall back to non-authoritative evidence intake, but it must not pretend that the capture is exact.

### 4.3 Runtime truth path

Manuscript runtime checking should continue to trust parsed DOCX structure and style more than clipboard intake. Intake solves authoritative rule and knowledge authoring inside the supported path. DOCX parsing solves governed runtime truth.

## 5. Image-As-Symbol Handling

This behavior requires a separate design posture.

### 5.1 Locked rule

When an author uses an image instead of an editable symbol or formula fragment, the system should first classify that as an object-type issue.

Default policy:

`image replacing a required text or formula object is wrong by default`

### 5.2 Why this matters

Once the source object is an image, normal text-style checks are not trustworthy. The system may still infer “this likely represents `χ²`”, but that does not make it valid typography.

### 5.3 Runtime consequence

For such cases:

- screening may treat it as a format or submission-quality issue
- proofreading should explain the object-type violation
- editing should not silently replace it unless a future explicit safe pathway is introduced

## 6. The Journal Template / Knowledge / Rule Triangle

This triangle is valid and should become the main design model.

### 6.1 Journal template responsibility

Journal template means:

- target journal selection
- journal-specific overlay scope

It does not mean:

- a giant free-text format spec
- the primary storage place for executable formatting detail

### 6.2 Knowledge responsibility

Knowledge means:

- source basis
- correct examples
- incorrect examples
- official sample evidence
- style and symbol evidence snapshots

Knowledge may be journal-scoped, package-scoped, family-scoped, or template-scoped.

### 6.3 Rule responsibility

Rules mean:

- exact condition
- exact scope
- exact module posture
- exact action grade
- exact runtime effect

This is where executable journal formatting lives.

### 6.4 Why the triangle currently does not fully work

Repository-grounded gaps must be treated as design scope:

- rule wizard currently binds to package-like containers and template families, but not to journal templates directly
- knowledge library supports journal/package binding in types, but the main UI still uses raw text entry instead of real binding controls
- runtime knowledge selection still behaves largely as flattened template binding, not as full binding-kind-aware resolution
- current rule-wizard package options are sourced from content-module ledgers, which is not yet the same thing as the real runtime quality-package mental model the user expects

Therefore the triangle is conceptually correct, but operationally incomplete.

## 7. Binding Authenticity And Runtime Effectiveness

This section is a hard requirement, not a polish item.

### 7.1 Problem statement

Bindings currently exist in data types and some screens, but that is not enough. A governed system fails if operators cannot confidently answer:

- what is this bound to
- why is it active here
- why is it not active there

### 7.2 Required binding targets

Both rule center and knowledge library must support real UI binding controls for:

- `template_family`
- `module_template`
- `journal_template`
- `general_package`
- `medical_package`
- linked `knowledge_item` where relevant

Visible operator copy may still use `通用包` and `医用包`, but their underlying runtime identities must be:

- `通用包` -> `general_style_package`
- `医用包` -> `medical_analyzer_package`

The rule-center package selector must therefore load from the real runtime quality-package inventory or from a strict compatibility projection of that inventory. It must not continue to use unrelated content-module ledgers as the package source of truth.

### 7.3 Required UI behavior

The UI must provide real, inspectable controls rather than raw text input.

That means:

- searchable selectors
- current binding chips or rows
- add and remove actions
- visible effective-scope summary
- conflict or overlap warnings

### 7.4 Required runtime behavior

Runtime must preserve both:

- `binding_kind`
- `binding_target_id`

It is not acceptable to flatten all bindings into a plain list of ids and then lose kind semantics.

The selection layer for screening, proofreading, and editing must be able to resolve:

- family-scoped knowledge
- module-template-scoped knowledge
- journal-template-scoped knowledge
- general-package-scoped knowledge
- medical-package-scoped knowledge

Package-scoped resolution must be driven by active runtime binding quality-package context. The authoritative runtime source is the set of active bound quality packages resolved for the current execution scope.

That means:

- package-scoped rules and knowledge are active only when the current execution scope resolves the corresponding quality package kind or package version
- journal-template selection alone must not implicitly activate package-scoped content
- template-family scope alone must not implicitly activate package-scoped content
- the runtime layer must be able to explain which active quality package caused package-scoped activation

### 7.5 Required explanation behavior

Any surfaced rule hit or retrieved knowledge item must be explainable with a visible source chain such as:

- active because of journal template
- active because runtime binding includes `general_style_package`
- active because runtime binding includes `medical_analyzer_package`
- active because of template family fallback
- active because linked from a directly bound knowledge item

## 8. Rule Release Model

Rules should move through:

- `draft`
- `pending_review`
- `published`
- `runtime active`

### 8.1 Minimum publish gate

A rule cannot publish unless it has:

- package or journal placement
- module applicability
- object type
- structured fields, not only prose
- at least one supporting evidence snapshot
- execution posture
- auto-apply permission level

For table-format rules authored from clipboard evidence, publication also requires:

- complete key-format capture for the supported intake path
- no missing mandatory style fields
- no AI-filled formatting placeholders

### 8.2 Execution posture

At minimum:

- `inspect_only`
- `confirm_then_apply`
- `safe_auto_apply`
- `forbidden_auto_apply`

Editing defaults must be stricter than proofreading defaults.

## 9. Knowledge Release Model

Knowledge should move through:

- `draft`
- `pending_review`
- `approved`
- `runtime eligible`

### 9.1 Two knowledge classes

The system should distinguish:

- reference knowledge
- runtime-eligible governed knowledge

Reference knowledge may remain explanatory. Runtime-eligible knowledge must meet stronger structure and binding requirements.

### 9.2 Knowledge is not free text only

For journal-format work, knowledge should be able to include:

- official requirement text
- sample table snapshots
- sample visual-symbol evidence
- correct and incorrect formatting pairs
- journal-specific examples for references, captions, notes, and typography

For runtime-eligible table-format knowledge authored from clipboard evidence, incomplete key-format extraction must block approval.

## 10. Module-Specific Runtime Behavior

### 10.1 Screening

Consumes:

- rule hits
- knowledge evidence
- severity metadata

Produces:

- accept / revise / reject support
- decision comments
- explicit rationale

### 10.2 Proofreading

Consumes:

- rule hits
- knowledge evidence
- location anchors

Produces:

- issue list
- explanation
- suggested fix
- manual-review routing

### 10.3 Editing

Consumes:

- only the subset of rules allowed for format normalization
- precise anchors and deterministic evidence

Produces:

- controlled format-only output changes
- explicit skipped reasons where safety is not high enough

## 11. Interaction Model

### 11.1 Rule intake

The primary rule-center flow should be:

- intake evidence
- inspect extracted facts
- let AI draft the rule from extracted facts
- review structured fields
- bind to package, journal, and family as needed
- submit for review

### 11.2 Knowledge intake

The primary knowledge flow should mirror the same pattern:

- intake evidence
- inspect extracted facts
- let AI draft summary and tags
- review evidence and bindings
- approve for reference or runtime eligibility

### 11.3 Journal-specific authoring

For journal-specific work, the operator should be able to start from a selected journal template and then create:

- journal-scoped knowledge
- journal-scoped rule
- package-scoped supporting knowledge

without leaving the main governed rule flow.

This does not mean journal-template binding replaces package binding. Journal scope selects the target journal. Package scope selects which active runtime package family contributes package-level governance at execution time.

## 12. Verification And Acceptance

This design is not complete unless the following end-to-end checks are part of implementation acceptance.

### 12.1 Binding authenticity checks

- create a knowledge item through real binding controls for one journal template
- create a rule through real binding controls for the same journal template
- verify both are visibly bound after save
- switch the manuscript journal template and verify activation changes accordingly

### 12.2 Package-effect checks

- bind one rule and one knowledge item to a general package
- bind one rule and one knowledge item to a medical package
- verify module runtime picks the correct package-scoped content only when the active runtime binding resolves the corresponding quality package
- verify UI can explain why each item is active
- verify changing only journal template does not silently activate package-scoped content when the runtime binding package context is unchanged
- verify changing the active runtime binding package context changes package-scoped activation even when the journal template stays the same

### 12.3 Table-governance checks

- paste a Word/WPS table into rule intake and verify structured extraction appears before AI drafting
- confirm that critical fields such as caption position, border profile, italic markers, and run-level style facts are fully inspectable
- verify that missing key formatting facts cause intake failure rather than guessed completion
- run the same journal rule on a manuscript DOCX and verify the runtime hit uses the same underlying snapshot vocabulary

### 12.4 Image-symbol checks

- add image evidence for a symbol replacement case
- verify the system classifies it as an object-type issue
- verify it does not silently pass as valid text formatting

## 13. Phased Delivery

### Phase 1: Governance foundation

- simplify rule-center scope to intake, ledger, review, and runtime effect
- establish role boundaries across journal templates, knowledge, and rules
- add binding-center design and real binding controls
- preserve binding kind semantics in runtime selection

### Phase 2: High-fidelity intake

- add heavy clipboard intake workspace for tables
- add richer table style snapshot extraction
- add visual symbol snapshot intake
- align knowledge and rule intake on the same evidence model

### Phase 3: Runtime integration

- wire journal-template, package, and family bindings into screening, proofreading, and editing
- expose why-this-fired explanations in UI
- tighten editing auto-apply gates

### Phase 4: Safe formatting automation

- permit only deterministic, high-confidence format actions
- keep complex style reconstruction inspect-first until proven stable

## 14. Non-Goals For The First Implementation Plan

The first implementation plan should explicitly avoid:

- pretending all clipboard environments are equally supported
- allowing AI-generated prose to publish as executable rules without structured confirmation
- making knowledge bindings look real before runtime can honor them
- enabling broad automatic table reconstruction from day one
- silently converting image-based symbol evidence into accepted formatted text

## 15. Final Decision

The approved strategic direction is:

`journal template selects the target, knowledge carries the basis, rule center executes the policy, and bindings must be real from UI through runtime.`

The design should therefore be implemented as a governed format-and-decision platform, not as a cosmetic rule-center cleanup.
