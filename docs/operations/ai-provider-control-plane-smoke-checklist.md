# AI Provider Control Plane Smoke Checklist

This checklist is for internal-trial operators validating the Phase 2 AI provider control plane on the persistent backend.

## Preconditions

- Start the persistent API and web workbench.
- Use an `admin` account.
- Set `AI_PROVIDER_MASTER_KEY` before starting the persistent API.
- Keep `AI_PROVIDER_RUNTIME_CUTOVER=false` unless every active model has already been backfilled with a managed provider connection.
- Prepare three working API keys:
  - Qwen
  - DeepSeek
  - OpenAI

## Step 1: Create Three Provider Connections

Open `System Settings -> AI Providers` and create these connections:

1. Qwen
   - Connection name: `Qwen Production`
   - Provider kind: `qwen`
   - Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
   - Test model: an enabled Qwen chat model such as `qwen-max`
2. DeepSeek
   - Connection name: `DeepSeek Production`
   - Provider kind: `deepseek`
   - Base URL: `https://api.deepseek.com`
   - Test model: an enabled DeepSeek chat model such as `deepseek-chat`
3. OpenAI
   - Connection name: `OpenAI Production`
   - Provider kind: `openai`
   - Base URL: leave blank so the official preset is used
   - Test model: an enabled OpenAI chat model in your account

Pass criteria:

- The connection list shows all three rows.
- Each row shows the expected provider kind.
- No plaintext API key is shown after save.

## Step 2: Rotate Credentials And Verify Masking

For each connection:

1. Open the connection detail panel.
2. Rotate the API key once.
3. Confirm the masked key is updated.
4. Confirm the credential version increases after rotation.

Pass criteria:

- Only masked credential text is visible.
- The previous plaintext key is never returned to the browser.

## Step 3: Run Connectivity Tests

For each connection, click `Test` once after rotation.

Pass criteria:

- `last_test_status` changes from `unknown` to `passed`.
- `last_test_at` is populated.
- `last_error_summary` stays empty for successful tests.

If a test fails, record the provider response and stop the smoke run until the credential, model name, or base URL is corrected.

## Step 4: Bind Three Models To Three Connections

Open `Admin Governance`.

Create three model entries and bind one connection per model:

1. Screening model bound to `Qwen Production`
2. Editing model bound to `DeepSeek Production`
3. Proofreading model bound to `OpenAI Production`

Suggested example names:

- `qwen-max`
- `deepseek-chat`
- your enabled OpenAI chat model

Pass criteria:

- Each created model row shows the expected `Provider Connection`.
- Each created model row shows the expected `Connection Kind`.

## Step 5: Assign Mixed Module Routing

In `Legacy Fallback Defaults`, assign:

- `screening` -> the Qwen-bound model
- `editing` -> the DeepSeek-bound model
- `proofreading` -> the OpenAI-bound model

Save the routing policy.

Pass criteria:

- The saved defaults remain visible after refresh.
- No module falls back to an unexpected provider connection.

## Step 6: Inspect Execution Preview

For each module (`screening`, `editing`, `proofreading`):

1. Select a real template family.
2. Run `Preview Execution Bundle`.
3. Check these fields in the preview:
   - `Resolved Model`
   - `Provider Connection`
   - `Compatibility Mode`
   - `Provider Readiness`
   - `Preview Warnings`

Pass criteria:

- Each module resolves to the intended provider connection.
- `Compatibility Mode` is `openai_chat_compatible` for Qwen, DeepSeek, and OpenAI in this phase.
- `Provider Readiness` does not show structural errors such as missing connection or missing credential.

## Step 7: Verify Fallback Chain Output

The current web workbench shows fallback chain output in the preview, but fallback binding may still need one API-assisted setup step.

If no existing model already has a fallback configured, create or update one model through the API with `fallbackModelId`, then rerun preview:

```bash
curl -X POST http://127.0.0.1:3001/api/v1/model-registry \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session-cookie>" \
  -d '{
    "actorRole": "admin",
    "provider": "openai",
    "modelName": "qwen-primary-with-fallback",
    "modelVersion": "2026-04-10",
    "allowedModules": ["editing"],
    "isProdAllowed": true,
    "connectionId": "<primary-connection-id>",
    "fallbackModelId": "<fallback-model-id>"
  }'
```

Then point one module default to that primary model and rerun preview.

Pass criteria:

- `Fallback Chain` is not `none`.
- The preview shows the expected fallback model ID sequence.

## Record The Smoke Result

Record:

- date and operator
- API base URL and web base URL
- created connection IDs
- created model IDs
- routing policy snapshot
- preview screenshots or copied result blocks
- any provider failures and their error summaries

The smoke run is complete only when all seven steps pass on the persistent backend without any undocumented operator guesswork.
