import test from "node:test";
import assert from "node:assert/strict";
import { BcryptPasswordHasher } from "../../src/auth/password-hasher.ts";

test("password hasher creates bcrypt digests that verify the original password", async () => {
  const hasher = new BcryptPasswordHasher({ rounds: 4 });
  const plainTextPassword = "Medical-System-Password-123";

  const digest = await hasher.hash(plainTextPassword);

  assert.notEqual(digest, plainTextPassword);
  assert.match(digest, /^\$2[aby]\$/);
  assert.equal(await hasher.verify(plainTextPassword, digest), true);
  assert.equal(await hasher.verify("wrong-password", digest), false);
});
