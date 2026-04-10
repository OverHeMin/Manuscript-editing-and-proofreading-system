import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const MASTER_KEY_ENV = "AI_PROVIDER_MASTER_KEY";

export interface AiProviderCredentialPayload {
  apiKey: string;
}

export class AiProviderCredentialCrypto {
  private readonly masterKey: Buffer;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.masterKey = readMasterKey(env);
  }

  encrypt(payload: AiProviderCredentialPayload): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.masterKey, iv);
    const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      "v1",
      toBase64Url(iv),
      toBase64Url(authTag),
      toBase64Url(ciphertext),
    ].join(":");
  }

  decrypt(serializedPayload: string): AiProviderCredentialPayload {
    const [version, ivValue, authTagValue, ciphertextValue] =
      serializedPayload.split(":");

    if (
      version !== "v1" ||
      !ivValue ||
      !authTagValue ||
      !ciphertextValue
    ) {
      throw new Error("Invalid ai provider credential payload format.");
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      this.masterKey,
      fromBase64Url(ivValue),
    );
    decipher.setAuthTag(fromBase64Url(authTagValue));
    const plaintext = Buffer.concat([
      decipher.update(fromBase64Url(ciphertextValue)),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(plaintext) as Partial<AiProviderCredentialPayload>;

    if (typeof parsed.apiKey !== "string" || parsed.apiKey.length === 0) {
      throw new Error("Invalid ai provider credential payload contents.");
    }

    return { apiKey: parsed.apiKey };
  }

  maskApiKey(apiKey: string): string {
    if (apiKey.length <= 4) {
      return `***${apiKey}`;
    }

    const prefix = apiKey.slice(0, Math.min(3, apiKey.length));
    const suffix = apiKey.slice(-4);
    return `${prefix}***${suffix}`;
  }
}

function readMasterKey(env: NodeJS.ProcessEnv): Buffer {
  const encoded = env[MASTER_KEY_ENV];
  if (!encoded) {
    throw new Error(
      `${MASTER_KEY_ENV} must be set to a 32-byte random secret encoded for env-safe transport.`,
    );
  }

  const normalized = normalizeBase64Url(encoded);
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(normalized)) {
    throw new Error(
      `${MASTER_KEY_ENV} must be a base64 or base64url-encoded 32-byte secret.`,
    );
  }

  const decoded = Buffer.from(normalized, "base64");
  if (decoded.byteLength !== 32) {
    throw new Error(
      `${MASTER_KEY_ENV} must decode to exactly 32 bytes.`,
    );
  }

  return decoded;
}

function toBase64Url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(normalizeBase64Url(value), "base64");
}

function normalizeBase64Url(value: string): string {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const remainder = normalized.length % 4;
  if (remainder === 0) {
    return normalized;
  }

  return `${normalized}${"=".repeat(4 - remainder)}`;
}
