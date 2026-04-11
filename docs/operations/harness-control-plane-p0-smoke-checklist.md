# Harness Control Plane P0 Smoke Checklist

This checklist is for operators validating that Harness is a real control plane for governed AI execution, not a read-only parameter surface.

## Preconditions

- Start the API and web workbench for the target environment.
- Use an `admin` account.
- Make sure the target scope already has an active execution profile, runtime binding, routing version, retrieval preset, and manual review policy.
- Prepare one alternate candidate set for the same scope so the diff is visible:
  - execution profile
  - runtime binding
  - routing version
  - retrieval preset
  - manual review policy

## Step 1: Open The Harness Scope

Open `Admin Governance` and confirm the page heading is `Harness Control Plane`.

In `Environment Editor`:

1. Select the target `Module`.
2. Confirm the `Manuscript Type` and target family are the intended live scope.
3. Record the current `Active Environment` values.

Pass criteria:

- The active card shows the live five-part governed environment for that scope.
- `Retrieval Preset` and `Manual Review Policy` are present as first-class selectable governed objects.

## Step 2: Preview A Candidate Environment

In `Environment Editor`:

1. Select the candidate execution profile, runtime binding, routing version, retrieval preset, and manual review policy.
2. Click `Preview Candidate Environment`.
3. Review `Candidate Preview` and `Diff`.

Pass criteria:

- The preview returns the exact candidate IDs you selected.
- The diff lists every changed governed object.
- The page does not activate anything yet.

## Step 3: Launch A Candidate-Bound Quality Run

In `Quality Lab`:

1. Choose the evaluation suite for the same module.
2. Click `Launch Candidate Run`.
3. Record the returned run ID.

Pass criteria:

- The latest candidate run is created from the control plane.
- The run is explicitly bound to the candidate environment rather than the active environment.
- Evidence collection stays in `Quality Lab` and does not itself change production.

## Step 4: Activate The Candidate

In `Activation Gate`:

1. Enter an operator reason.
2. Click `Activate Candidate Environment`.
3. Wait for the scope to reload.

Pass criteria:

- `Active Environment` now shows the candidate IDs.
- The preview is cleared after activation.
- The change is limited to the selected scope.

## Step 5: Prove New Work Resolves To The New Environment

Start a brand-new manuscript task for the same scope after activation. Use any supported entry point that creates a fresh governed run, such as a new editing or proofreading execution for that template family.

Record the execution evidence or resolution snapshot for that new task.

Pass criteria:

- The new task resolves to the newly activated execution profile.
- The new task resolves to the newly activated runtime binding and routing version.
- The new task resolves to the newly activated retrieval preset.
- The new task resolves to the newly activated manual review policy.
- Quality behavior changes accordingly, for example:
  - retrieval coverage follows the promoted preset
  - manual-review staging follows the promoted policy

This is the core proof that Harness is changing the live AI working environment rather than displaying unused configuration.

## Step 6: Roll Back The Scope

In `Activation Gate`:

1. Click `Roll Back Scope`.
2. Wait for the scope to reload.
3. Start one more new task for the same scope.

Pass criteria:

- `Active Environment` returns to the prior approved state.
- The next new task resolves to the rolled-back retrieval preset and manual review policy.
- Other scopes remain unchanged throughout activation and rollback.

## Record The Smoke Result

Record:

- date and operator
- target scope
- active five-part environment before activation
- candidate five-part environment
- candidate run ID and evidence link
- proof that a new post-activation task used the promoted environment
- proof that a new post-rollback task used the restored environment
- any scope-isolation issues or mismatched governed IDs

The smoke run is complete only when all six steps pass without relying on undocumented operator guesswork.
