import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { AiProviderCredentialCrypto } from "../../src/modules/ai-provider-connections/index.ts";

test("ai provider credential crypto encrypts and decrypts payloads with a valid master key", () => {
  const crypto = new AiProviderCredentialCrypto({
    AI_PROVIDER_MASTER_KEY: randomBytes(32).toString("base64url"),
  });

  const encrypted = crypto.encrypt({ apiKey: "sk-test-1234a562" });
  const decrypted = crypto.decrypt(encrypted);

  assert.notEqual(encrypted, "sk-test-1234a562");
  assert.deepEqual(decrypted, { apiKey: "sk-test-1234a562" });
});

test("ai provider credential crypto rejects missing or invalid master keys", () => {
  assert.throws(
    () => new AiProviderCredentialCrypto({}),
    /AI_PROVIDER_MASTER_KEY must be set/i,
  );
  assert.throws(
    () =>
      new AiProviderCredentialCrypto({
        AI_PROVIDER_MASTER_KEY: "not-valid!!!",
      }),
    /base64 or base64url-encoded 32-byte secret/i,
  );
  assert.throws(
    () =>
      new AiProviderCredentialCrypto({
        AI_PROVIDER_MASTER_KEY: Buffer.from("too-short", "utf8").toString("base64url"),
      }),
    /must decode to exactly 32 bytes/i,
  );
});

test("ai provider credential crypto rejects tampered ciphertext", () => {
  const crypto = new AiProviderCredentialCrypto({
    AI_PROVIDER_MASTER_KEY: randomBytes(32).toString("base64url"),
  });

  const encrypted = crypto.encrypt({ apiKey: "sk-test-1234a562" });
  const parts = encrypted.split(":");
  assert.equal(parts.length, 4);
  parts[3] = `${parts[3]?.slice(0, -1)}A`;

  assert.throws(
    () => crypto.decrypt(parts.join(":")),
  );
});

test("ai provider credential crypto masks short and long api keys", () => {
  const crypto = new AiProviderCredentialCrypto({
    AI_PROVIDER_MASTER_KEY: randomBytes(32).toString("base64url"),
  });

  assert.equal(crypto.maskApiKey("abcd"), "***abcd");
  assert.equal(crypto.maskApiKey("sk-test-1234a562"), "sk-***a562");
});
