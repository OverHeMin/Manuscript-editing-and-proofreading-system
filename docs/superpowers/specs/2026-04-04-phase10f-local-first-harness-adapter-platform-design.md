# Phase 10F Local-First Harness Adapter Platform Design

**Date:** 2026-04-04  
**Status:** Approved for planning under the current Phase 10 roadmap  
**Scope:** Build a local-first harness adapter platform for self-hosted tracing, local prompt evaluation, local judge-reliability runs, and tool boundary hardening so harness tooling remains optional, replaceable, and unable to destabilize the manuscript execution path.

## 1. Goal

Phase 10F is not the phase that makes the system autonomous.

Its job is to make harness tooling safe to use at scale inside this repository:

- self-hosted trace ingestion
- local Promptfoo runs
- local simple-evals style runs
- local judge-reliability calibration
- explicit fail-open adapter boundaries

In one sentence:

`Phase 10F` should turn harness tools into governed optional adapters rather than hidden dependencies inside the main runtime.

## 2. Why This Phase Exists

By the time Phase 10D and 10E exist, the repository can have:

- governed gold data
- local retrieval-quality runs
- bounded evaluation evidence

What still remains risky is tool coupling:

- tracing tools can become an accidental production dependency
- local eval runners can drift in output shape
- judge outputs can be trusted without calibration
- adapter code can leak raw manuscript content beyond intended boundaries

Phase 10F exists to prevent that class of platform debt.

## 3. Recommended Option

### Option A: Direct SDK integration per tool

Pros:

- fast to start

Cons:

- highest coupling
- hardest to replace
- easiest way to let tooling leak into business logic

Not recommended.

### Option B: Dedicated adapter platform with fail-open contracts

Pros:

- aligns with the repository's adapter-based runtime direction
- keeps tools replaceable
- lets local/self-hosted deployments vary without touching business modules

Cons:

- adds an integration layer to maintain

Recommended.

### Option C: External orchestrator owns harness execution

Pros:

- can keep the application thinner

Cons:

- conflicts with the current local-first, repository-owned posture
- weakens auditability and portability

Out of scope.

## 4. Hard Boundaries

### 4.1 Fail-open always

If a harness adapter fails, the manuscript execution path must continue unless the operator explicitly launched a harness run.

### 4.2 Self-hosted and local-first

This phase may support:

- self-hosted Langfuse OSS
- local Promptfoo runs
- local simple-evals style runners

It must not require any cloud control plane.

### 4.3 No raw-manuscript default export

Adapters should default to:

- redacted or bounded excerpts
- structured metadata
- ids and provenance references

Raw manuscript export must be explicit and governed.

### 4.4 Judge scores are advisory

Judge and calibration results may create evidence and recommendations.
They do not directly alter routing policy or publication state.

### 4.5 Tooling remains replaceable

The adapter contract must be stable enough that swapping Promptfoo, Langfuse, or local judge runners does not force a redesign of the main system.

## 5. Core Objects

### 5.1 Harness Adapter

A governed adapter definition describing:

- adapter kind
- execution mode
- feature flags
- redaction profile
- result envelope version

### 5.2 Harness Execution

A durable local record describing:

- which adapter ran
- which dataset or run input it consumed
- where result artifacts were written
- whether the run degraded or failed

### 5.3 Trace Envelope

A normalized, redacted payload for self-hosted trace sinks such as Langfuse OSS.

### 5.4 Judge Calibration Batch

A governed batch of examples used to compare:

- human rubric outcomes
- automated judge outcomes

## 6. Tool Direction

Phase 10F should explicitly target:

- `Promptfoo`
- `Langfuse OSS (self-hosted only)`
- local simple-evals style runners
- local judge-reliability runners

It should keep:

- `LangSmith`
- `Braintrust`
- cloud tracing and eval platforms

out of the primary path in this phase.

## 7. Manual Work That Remains Human

Even after Phase 10F lands, these remain human-owned:

- deciding whether judge disagreement reflects rubric problems or model problems
- approving any routing or publication change informed by harness evidence
- deciding when a redaction profile is too weak for a given workflow

## 8. Related Capability Lane

This phase advances:

- `Agent Runtime / Portable Skills Deepening`

It builds on:

- `Phase 10D` governed gold data
- `Phase 10E` retrieval-quality harnesses
