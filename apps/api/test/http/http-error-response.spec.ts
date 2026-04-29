import test from "node:test";
import assert from "node:assert/strict";
import { mapErrorToHttpResponse } from "../../src/http/api-http-server.ts";
import { AiProviderRuntimeConfigurationError } from "../../src/modules/ai-provider-runtime/index.ts";
import { KnowledgeRevisionReviewGateError } from "../../src/modules/knowledge/index.ts";
import { ModuleTemplateFamilyNotConfiguredError } from "../../src/modules/shared/module-run-support.ts";

test("ai provider credential failures map to an actionable service-unavailable response", () => {
  const [status, body] = mapErrorToHttpResponse(
    new AiProviderRuntimeConfigurationError(
      "credential_invalid",
      "Unsupported state or unable to authenticate data",
      {
        connectionId: "connection-qwen",
        modelId: "model-qwen",
      },
    ),
  );

  assert.equal(status, 503);
  assert.deepEqual(body, {
    error: "ai_provider_configuration_error",
    code: "credential_invalid",
    message:
      "AI provider credentials are invalid. Rotate the credential in system settings and try again.",
  });
});

test("missing template family failures map to an actionable state conflict response", () => {
  const [status, body] = mapErrorToHttpResponse(
    new ModuleTemplateFamilyNotConfiguredError("manuscript-123"),
  );

  assert.equal(status, 409);
  assert.deepEqual(body, {
    error: "manuscript_template_not_configured",
    code: "template_family_required",
    message:
      "Template family is not configured for this manuscript. Apply a template family before governed execution.",
  });
});

test("knowledge review gate failures map to structured invalid_request details", () => {
  const [status, body] = mapErrorToHttpResponse(
    new KnowledgeRevisionReviewGateError("revision-1", "approve", [
      {
        code: "table_evidence_revision_not_confirmed",
        message: "Table evidence block #0 revision rev-pending is not confirmed",
        block_id: "block-1",
        revision_id: "rev-pending",
      },
    ]),
  );

  assert.equal(status, 400);
  assert.deepEqual(body, {
    error: "invalid_request",
    message:
      "Knowledge revision revision-1 cannot be approved: Table evidence block #0 revision rev-pending is not confirmed.",
    revisionId: "revision-1",
    phase: "approve",
    failures: [
      {
        code: "table_evidence_revision_not_confirmed",
        message: "Table evidence block #0 revision rev-pending is not confirmed",
        block_id: "block-1",
        revision_id: "rev-pending",
      },
    ],
  });
});
