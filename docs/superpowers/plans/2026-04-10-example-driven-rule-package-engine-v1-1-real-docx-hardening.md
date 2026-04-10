# Example-Driven Rule Package Engine V1.1 Real DOCX Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the V1 backend so the real `原稿.docx + 已编辑.docx` pair can serve as the primary gold case for rule-package recognition, without starting V2 UI or publish-flow work.

**Architecture:** Keep the existing V1 layered rule-package engine, but strengthen the layers closest to real data: DOCX extraction output, no-heading-style section fallback, block semantic normalization, and committed real-snapshot fixtures. The result should be a V1.1 that still returns the same six package kinds, but now does so against real manuscript structure instead of mostly synthetic fixtures.

**Tech Stack:** TypeScript, Python worker (`python-docx`/OOXML parser), Node `node:test`, `pytest`, `tsx`, `pnpm`.

---

## File Structure

### New files

- `apps/worker-py/tests/document_pipeline/test_extract_docx_structure.py`
  - CLI-level regression tests for UTF-8 JSON emission and Windows-console-safe output.
- `apps/api/test/editorial-rules/fixtures/real-docx-rule-package-gold-case.ts`
  - Checked-in sanitized snapshot fixture derived from `原稿.docx + 已编辑.docx`, so tests do not depend on the desktop files.

### Modified files

- `apps/worker-py/src/document_pipeline/extract_docx_structure.py`
  - Force UTF-8 JSON output and avoid console encoding crashes on Windows.
- `apps/worker-py/src/document_pipeline/parse_docx.py`
  - Add fallback section detection for numbered/plain-text headings when Word heading styles are absent.
- `apps/worker-py/tests/document_pipeline/test_parse_docx.py`
  - Add parser regressions for no-style numbered headings and front-matter-heavy real-world structures.
- `apps/api/src/modules/editorial-rules/example-document-snapshot-adapter.ts`
  - Normalize raw paragraph blocks from real DOCX into stable semantic roles for front matter, abstract, keywords, references, and likely headings.
- `apps/api/src/modules/editorial-rules/example-pair-diff-service.ts`
  - Tighten heuristics against real DOCX text noise: full-width punctuation, special spaces, dashes, and front-matter false positives.
- `apps/api/test/document-pipeline/document-structure.spec.ts`
  - Cover API-facing structure expectations when sections are recovered by fallback logic.
- `apps/api/test/editorial-rules/fixtures/example-rule-package-fixtures.ts`
  - Switch the primary gold-case builder to the committed real-snapshot fixture while keeping synthetic mini-cases.
- `apps/api/test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`
  - Re-anchor the gold-case assertions to the real DOCX-derived fixture.
- `docs/superpowers/specs/2026-04-10-example-driven-rule-package-engine-design.md`
  - Note that V1.1 adds real-DOCX hardening before any V2 work.

### Test commands

- Worker parser focused:
  - `python -m pytest apps/worker-py/tests/document_pipeline/test_parse_docx.py -q`
  - `python -m pytest apps/worker-py/tests/document_pipeline/test_extract_docx_structure.py -q`
- API focused:
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/document-pipeline/document-structure.spec.ts`
  - `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`
- Checkpoint:
  - `pnpm --filter @medical/api test -- editorial-rules`

---

### Task 1: Make DOCX extraction safe for real Windows output

**Files:**
- Create: `apps/worker-py/tests/document_pipeline/test_extract_docx_structure.py`
- Modify: `apps/worker-py/src/document_pipeline/extract_docx_structure.py`
- Test: `apps/worker-py/tests/document_pipeline/test_extract_docx_structure.py`

- [ ] **Step 1: Write a failing CLI regression test for UTF-8 JSON output**

```python
def test_extract_docx_structure_emits_utf8_json_without_console_crash(tmp_path):
    docx_path = build_docx_with_full_width_and_zero_width_chars(tmp_path)

    completed = subprocess.run(
        [sys.executable, str(SCRIPT_PATH), "--source-path", str(docx_path)],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )

    assert completed.returncode == 0
    payload = json.loads(completed.stdout)
    assert payload["status"] == "ready"
```

- [ ] **Step 2: Run the test to verify it fails for the current console encoding reason**

Run: `python -m pytest apps/worker-py/tests/document_pipeline/test_extract_docx_structure.py -q`
Expected: FAIL because the script still writes through the platform default encoding.

- [ ] **Step 3: Update the CLI to force UTF-8 output**

```python
def emit_json(payload: dict) -> None:
    text = json.dumps(payload, ensure_ascii=False)
    sys.stdout.buffer.write(text.encode("utf-8"))
    sys.stdout.buffer.write(b"\n")
```

- [ ] **Step 4: Re-run the focused worker test**

Run: `python -m pytest apps/worker-py/tests/document_pipeline/test_extract_docx_structure.py -q`
Expected: PASS.

- [ ] **Step 5: Commit the CLI hardening**

```bash
git add apps/worker-py/src/document_pipeline/extract_docx_structure.py apps/worker-py/tests/document_pipeline/test_extract_docx_structure.py
git commit -m "fix: harden docx structure cli utf8 output"
```

### Task 2: Recover sections when real DOCX files have no heading styles

**Files:**
- Modify: `apps/worker-py/src/document_pipeline/parse_docx.py`
- Modify: `apps/worker-py/tests/document_pipeline/test_parse_docx.py`
- Modify: `apps/api/test/document-pipeline/document-structure.spec.ts`
- Test: `apps/worker-py/tests/document_pipeline/test_parse_docx.py`

- [ ] **Step 1: Write a failing parser test for numbered headings without Word styles**

```python
def test_document_xml_recovers_sections_from_numbered_plain_paragraphs():
    result = extract_structure_from_document_xml(document_xml_with_plain_numbered_headings())

    assert result["status"] == "ready"
    assert [section["heading"] for section in result["sections"]] == [
        "1 资料与方法",
        "1.1 一般资料",
        "2 结果",
    ]
```

- [ ] **Step 2: Add an API-side failing test that the fallback sections are preserved end-to-end**

```ts
test("docx structure extraction preserves fallback-recovered numbered sections", async () => {
  const structure = await structureService.extract(...);
  assert.deepEqual(structure.sections.map((section) => section.heading), [
    "1 资料与方法",
    "1.1 一般资料",
    "2 结果",
  ]);
});
```

- [ ] **Step 3: Run the parser and API structure tests**

Run:

```bash
python -m pytest apps/worker-py/tests/document_pipeline/test_parse_docx.py -q
pnpm --filter @medical/api exec node --import tsx --test ./test/document-pipeline/document-structure.spec.ts
```

Expected: FAIL because fallback section recovery does not exist yet.

- [ ] **Step 4: Implement narrow fallback section inference**

```python
if not sections and looks_like_numbered_heading(text):
    sections.append(
        {
            "order": len(sections) + 1,
            "heading": text,
            "level": infer_numbered_heading_level(text),
            "paragraph_index": paragraph_index,
        }
    )
```

- [ ] **Step 5: Re-run the focused parser and API tests**

Run:

```bash
python -m pytest apps/worker-py/tests/document_pipeline/test_parse_docx.py -q
pnpm --filter @medical/api exec node --import tsx --test ./test/document-pipeline/document-structure.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the fallback section recovery**

```bash
git add apps/worker-py/src/document_pipeline/parse_docx.py apps/worker-py/tests/document_pipeline/test_parse_docx.py apps/api/test/document-pipeline/document-structure.spec.ts
git commit -m "feat: recover numbered sections from real docx paragraphs"
```

### Task 3: Capture a committed real gold-case fixture from the two sample DOCX files

**Files:**
- Create: `apps/api/test/editorial-rules/fixtures/real-docx-rule-package-gold-case.ts`
- Modify: `apps/api/test/editorial-rules/fixtures/example-rule-package-fixtures.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`

- [ ] **Step 1: Write a failing test that expects the primary gold case to come from a committed real snapshot**

```ts
test("real gold case fixture includes front matter, abstract, references, and five tables from the sample pair", () => {
  const fixture = buildRealDocxGoldCase();

  assert.equal(fixture.original.tables.length, 5);
  assert.equal(fixture.edited.tables.length, 5);
  assert.ok(fixture.original.blocks.some((block) => block.text.includes("第一作者")));
  assert.ok(fixture.edited.blocks.some((block) => block.text.includes("［作者简介］")));
});
```

- [ ] **Step 2: Run the gold-case spec to confirm it fails because the committed real fixture does not exist yet**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Create the committed sanitized fixture**

```ts
export function buildRealDocxGoldCase(): ExamplePairUploadInput {
  return {
    context: {
      manuscript_type: "clinical_study",
      module: "editing",
      journal_key: "sample-journal",
    },
    original: { ...capturedOriginalSnapshot },
    edited: { ...capturedEditedSnapshot },
  };
}
```

- [ ] **Step 4: Switch `buildRealSampleFixture()` to delegate to the real DOCX gold-case fixture**

```ts
export function buildRealSampleFixture(): ExamplePairUploadInput {
  return buildRealDocxGoldCase();
}
```

- [ ] **Step 5: Re-run the gold-case spec**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`
Expected: PASS or narrower downstream failures that now reflect real-data heuristics.

- [ ] **Step 6: Commit the real fixture**

```bash
git add apps/api/test/editorial-rules/fixtures/real-docx-rule-package-gold-case.ts apps/api/test/editorial-rules/fixtures/example-rule-package-fixtures.ts
git commit -m "test: add real docx gold case fixture"
```

### Task 4: Tighten semantic-role normalization and diff heuristics against the real pair

**Files:**
- Modify: `apps/api/src/modules/editorial-rules/example-document-snapshot-adapter.ts`
- Modify: `apps/api/src/modules/editorial-rules/example-pair-diff-service.ts`
- Modify: `apps/api/test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`

- [ ] **Step 1: Add a failing regression that the real pair still produces the same six package kinds**

```ts
test("real docx gold case still resolves to the six supported package kinds", async () => {
  const response = await api.generateRulePackageCandidates({
    input: buildRealSampleFixture(),
  });

  assert.deepEqual(
    response.body.map((candidate) => candidate.package_kind),
    [
      "front_matter",
      "abstract_keywords",
      "heading_hierarchy",
      "numeric_statistics",
      "three_line_table",
      "reference",
    ],
  );
});
```

- [ ] **Step 2: Add a failing regression for front-matter false-positive protection**

```ts
test("real front matter numbering does not get misclassified as heading hierarchy", async () => {
  const response = await api.generateRulePackageCandidates({
    input: buildMiniFrontMatterFixture(),
  });

  assert.deepEqual(response.body.map((candidate) => candidate.package_kind), [
    "front_matter",
  ]);
});
```

- [ ] **Step 3: Run the gold-case spec**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`
Expected: FAIL if the real pair exposes new false positives or misses.

- [ ] **Step 4: Narrow the adapter and diff service around real manuscript cues**

```ts
if (text.startsWith("［作者简介］") || text.startsWith("第一作者")) {
  semantic_role = "author_bio";
}

if (text.startsWith("［摘") || text.startsWith("【摘要】")) {
  semantic_role = "abstract_heading";
}

if (section_key === "front_matter") {
  suppressHeadingPatternFallback = true;
}
```

- [ ] **Step 5: Re-run the gold-case spec**

Run: `pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`
Expected: PASS with the real pair still resolving stably.

- [ ] **Step 6: Commit the heuristic hardening**

```bash
git add apps/api/src/modules/editorial-rules/example-document-snapshot-adapter.ts apps/api/src/modules/editorial-rules/example-pair-diff-service.ts apps/api/test/editorial-rules/editorial-rule-package-gold-cases.spec.ts
git commit -m "fix: harden rule package heuristics for real docx samples"
```

### Task 5: Re-verify V1 against the real gold case and explicitly defer V2

**Files:**
- Modify: `docs/superpowers/specs/2026-04-10-example-driven-rule-package-engine-design.md`
- Test: `apps/api/test/editorial-rules/editorial-rule-package-authoring.spec.ts`
- Test: `apps/api/test/editorial-rules/editorial-rule-package-gold-cases.spec.ts`

- [ ] **Step 1: Update the design/spec wording**

```md
V1.1 hardening added:
- real DOCX-derived committed gold case
- fallback section recovery when heading styles are absent
- UTF-8-safe DOCX extraction output

Still deferred:
- semantic card editing UI
- compile-to-editorial_rule
- publish/review flow
- knowledge projection
```

- [ ] **Step 2: Run the authoring and gold-case rule-package tests**

Run:

```bash
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-authoring.spec.ts
pnpm --filter @medical/api exec node --import tsx --test ./test/editorial-rules/editorial-rule-package-gold-cases.spec.ts
pnpm --filter @medical/api test -- editorial-rules
```

Expected: PASS.

- [ ] **Step 3: Run the worker parser checkpoint**

Run:

```bash
python -m pytest apps/worker-py/tests/document_pipeline/test_parse_docx.py -q
python -m pytest apps/worker-py/tests/document_pipeline/test_extract_docx_structure.py -q
```

Expected: PASS.

- [ ] **Step 4: Commit the V1.1 checkpoint**

```bash
git add docs/superpowers/specs/2026-04-10-example-driven-rule-package-engine-design.md apps/worker-py/src/document_pipeline apps/worker-py/tests/document_pipeline apps/api/src/modules/editorial-rules apps/api/test/editorial-rules apps/api/test/document-pipeline
git commit -m "feat: harden rule package engine against real docx samples"
```

---

## Definition of Done

- The real `原稿.docx + 已编辑.docx` pair can be extracted without console-encoding crashes.
- The committed gold-case fixture is derived from the real sample pair, so repo tests no longer depend on desktop files.
- Real DOCX paragraphs without heading styles can still recover numbered section structure.
- The rule-package engine still returns the same six package kinds on the real pair.
- Front-matter numbering does not regress into heading false positives.
- V2 remains explicitly deferred until V1.1 is green on the real sample pair.

## Deferred Follow-Up

- V2 semantic confirmation cards
- V2 advanced authoring drawer
- compile confirmed package to runtime `editorial_rule`
- publish/review workflow
- knowledge projection
