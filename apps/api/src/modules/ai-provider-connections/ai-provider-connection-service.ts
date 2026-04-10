import { randomUUID } from "node:crypto";
import type { AuditService } from "../../audit/audit-service.ts";
import { PermissionGuard } from "../../auth/permission-guard.ts";
import type { RoleKey } from "../../users/roles.ts";
import type {
  AiProviderConnectionRecord,
  AiProviderConnectionTestStatus,
} from "./ai-provider-connection-record.ts";
import type { AiProviderConnectionRepository } from "./ai-provider-connection-repository.ts";
import { AiProviderCredentialCrypto } from "./ai-provider-credential-crypto.ts";
import type {
  AiProviderConnectivityProbe,
  AiProviderConnectivityProbeResult,
} from "./openai-chat-compatible-connectivity-probe.ts";

const MANAGE_PERMISSION = "permissions.manage";
const PHASE_ONE_COMPATIBILITY_MODE = "openai_chat_compatible";
const OPENAI_OFFICIAL_BASE_URL = "https://api.openai.com/v1";
const OPENAI_GENERIC_BASE_URL = "https://api.openai.com";
const DEEPSEEK_OFFICIAL_BASE_URL = "https://api.deepseek.com";
const QWEN_OFFICIAL_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = OPENAI_GENERIC_BASE_URL;
const MAX_ERROR_SUMMARY_LENGTH = 200;

const ALLOWED_PROVIDER_KINDS = new Set([
  "openai",
  "openai_compatible",
  "qwen",
  "deepseek",
]);

const OPENAI_ALLOWED_BASE_URLS = new Set([
  OPENAI_GENERIC_BASE_URL,
  OPENAI_OFFICIAL_BASE_URL,
]);

const DEEPSEEK_ALLOWED_BASE_URLS = new Set([
  OPENAI_GENERIC_BASE_URL,
  DEEPSEEK_OFFICIAL_BASE_URL,
  `${DEEPSEEK_OFFICIAL_BASE_URL}/v1`,
]);

export interface CreateAiProviderConnectionInput {
  id?: string;
  name: string;
  provider_kind: string;
  compatibility_mode?: string;
  base_url?: string;
  connection_metadata?: Record<string, unknown>;
  credentials?: {
    apiKey: string;
  };
  enabled?: boolean;
}

export interface UpdateAiProviderConnectionInput {
  connectionId: string;
  changes: {
    name?: string;
    base_url?: string;
    connection_metadata?: Record<string, unknown>;
    enabled?: boolean;
  };
}

export interface RotateAiProviderCredentialInput {
  connectionId: string;
  apiKey: string;
}

export interface TestAiProviderConnectionInput {
  connectionId: string;
  metadata?: Record<string, unknown>;
  status?: AiProviderConnectionTestStatus;
  errorSummary?: string;
  testedAt?: Date;
}

export interface AiProviderConnectionServiceOptions {
  repository: AiProviderConnectionRepository;
  auditService: AuditService;
  credentialCrypto: AiProviderCredentialCrypto;
  permissionGuard?: PermissionGuard;
  connectivityProbe?: AiProviderConnectivityProbe;
  now?: () => Date;
  createId?: () => string;
}

export class AiProviderConnectionNotFoundError extends Error {
  constructor(connectionId: string) {
    super(`AI provider connection "${connectionId}" was not found.`);
    this.name = "AiProviderConnectionNotFoundError";
  }
}

export class AiProviderConnectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderConnectionValidationError";
  }
}

export class AiProviderConnectionService {
  private readonly repository: AiProviderConnectionRepository;

  private readonly auditService: AuditService;

  private readonly credentialCrypto: AiProviderCredentialCrypto;

  private readonly permissionGuard: PermissionGuard;

  private readonly connectivityProbe?: AiProviderConnectivityProbe;

  private readonly now: () => Date;

  private readonly createId: () => string;

  constructor(options: AiProviderConnectionServiceOptions) {
    this.repository = options.repository;
    this.auditService = options.auditService;
    this.credentialCrypto = options.credentialCrypto;
    this.permissionGuard = options.permissionGuard ?? new PermissionGuard();
    this.connectivityProbe = options.connectivityProbe;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  listConnections(): Promise<AiProviderConnectionRecord[]> {
    return this.repository.list();
  }

  async createConnection(input: {
    actorId?: string;
    actorRole: RoleKey;
    connection: CreateAiProviderConnectionInput;
  }): Promise<AiProviderConnectionRecord> {
    this.assertAdmin(input.actorRole);

    const providerKind = normalizeProviderKind(input.connection.provider_kind);
    const record: AiProviderConnectionRecord = {
      id: normalizeOptionalString(input.connection.id) ?? this.createId(),
      name: normalizeRequiredString(input.connection.name, "connection.name"),
      provider_kind: providerKind,
      compatibility_mode: normalizeCompatibilityMode(
        input.connection.compatibility_mode,
      ),
      base_url: resolveBaseUrl({
        providerKind,
        baseUrl: input.connection.base_url,
      }),
      enabled: input.connection.enabled ?? true,
      connection_metadata: cloneConnectionMetadata(
        normalizeConnectionMetadata(input.connection.connection_metadata),
      ),
      last_test_status: "unknown",
    };

    await this.repository.save(record);

    if (input.connection.credentials?.apiKey !== undefined) {
      await this.persistCredential(record.id, input.connection.credentials.apiKey);
    }

    const created = await this.requireConnection(record.id);
    await this.recordAudit({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: "ai-provider-connection.create",
      connection: created,
      metadata: {
        credential_configured: Boolean(input.connection.credentials?.apiKey),
      },
    });

    return created;
  }

  async updateConnection(input: {
    actorId?: string;
    actorRole: RoleKey;
    update: UpdateAiProviderConnectionInput;
  }): Promise<AiProviderConnectionRecord> {
    this.assertAdmin(input.actorRole);

    const existing = await this.requireConnection(input.update.connectionId);
    const changes = input.update.changes;
    const updated: AiProviderConnectionRecord = {
      ...existing,
      name:
        changes.name === undefined
          ? existing.name
          : normalizeRequiredString(changes.name, "update.name"),
      base_url:
        changes.base_url === undefined
          ? existing.base_url
          : resolveBaseUrl({
              providerKind: existing.provider_kind,
              baseUrl: changes.base_url,
            }),
      enabled: changes.enabled ?? existing.enabled,
      connection_metadata:
        changes.connection_metadata === undefined
          ? cloneConnectionMetadata(existing.connection_metadata)
          : cloneConnectionMetadata(
              normalizeConnectionMetadata(changes.connection_metadata),
            ),
    };

    await this.repository.save(updated);

    const persisted = await this.requireConnection(existing.id);
    await this.recordAudit({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: "ai-provider-connection.update",
      connection: persisted,
    });

    return persisted;
  }

  async rotateCredential(input: {
    actorId?: string;
    actorRole: RoleKey;
    rotation: RotateAiProviderCredentialInput;
  }): Promise<AiProviderConnectionRecord> {
    this.assertAdmin(input.actorRole);
    const connection = await this.requireConnection(input.rotation.connectionId);

    await this.persistCredential(connection.id, input.rotation.apiKey);

    const updated = await this.requireConnection(connection.id);
    await this.recordAudit({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: "ai-provider-connection.rotate-credential",
      connection: updated,
    });

    return updated;
  }

  async disableConnection(input: {
    actorId?: string;
    actorRole: RoleKey;
    connectionId: string;
  }): Promise<AiProviderConnectionRecord> {
    return this.setConnectionEnabledState({
      actorId: input.actorId,
      actorRole: input.actorRole,
      connectionId: input.connectionId,
      enabled: false,
      auditAction: "ai-provider-connection.disable",
    });
  }

  async enableConnection(input: {
    actorId?: string;
    actorRole: RoleKey;
    connectionId: string;
  }): Promise<AiProviderConnectionRecord> {
    return this.setConnectionEnabledState({
      actorId: input.actorId,
      actorRole: input.actorRole,
      connectionId: input.connectionId,
      enabled: true,
      auditAction: "ai-provider-connection.enable",
    });
  }

  async testConnection(input: {
    actorId?: string;
    actorRole: RoleKey;
    test: TestAiProviderConnectionInput;
  }): Promise<AiProviderConnectionRecord> {
    this.assertAdmin(input.actorRole);

    const connection = await this.requireConnection(input.test.connectionId);
    const metadata = {
      ...(connection.connection_metadata ?? {}),
      ...(cloneConnectionMetadata(normalizeConnectionMetadata(input.test.metadata)) ??
        {}),
    };
    const testModelName = readTestModelName(metadata);

    if (!testModelName) {
      throw new AiProviderConnectionValidationError(
        "AI provider connectivity tests require connection_metadata.test_model_name.",
      );
    }

    const result =
      input.test.status !== undefined
        ? {
            status: input.test.status,
            testedAt: input.test.testedAt ?? this.now(),
            errorSummary: normalizeOptionalString(input.test.errorSummary),
          }
        : await this.runConnectivityProbe({
            connection,
            testModelName,
            metadata,
          });

    await this.repository.updateConnectionTestStatus({
      connection_id: connection.id,
      status: result.status,
      tested_at: result.testedAt,
      error_summary: result.errorSummary,
    });

    const updated = await this.requireConnection(connection.id);
    await this.recordAudit({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: "ai-provider-connection.test",
      connection: updated,
      metadata: {
        test_model_name: testModelName,
        last_test_status: result.status,
        last_error_summary: result.errorSummary,
      },
      occurredAt: result.testedAt,
    });

    return updated;
  }

  private async setConnectionEnabledState(input: {
    actorId?: string;
    actorRole: RoleKey;
    connectionId: string;
    enabled: boolean;
    auditAction: string;
  }): Promise<AiProviderConnectionRecord> {
    this.assertAdmin(input.actorRole);

    const existing = await this.requireConnection(input.connectionId);
    await this.repository.save({
      ...existing,
      enabled: input.enabled,
      connection_metadata: cloneConnectionMetadata(existing.connection_metadata),
    });

    const updated = await this.requireConnection(existing.id);
    await this.recordAudit({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.auditAction,
      connection: updated,
    });

    return updated;
  }

  private async persistCredential(connectionId: string, apiKey: string): Promise<void> {
    const normalizedApiKey = normalizeRequiredString(apiKey, "credentials.apiKey");
    const encryptedPayload = this.credentialCrypto.encrypt({
      apiKey: normalizedApiKey,
    });

    await this.repository.saveCredential({
      id: this.createId(),
      connection_id: connectionId,
      credential_ciphertext: encryptedPayload,
      credential_mask: this.credentialCrypto.maskApiKey(normalizedApiKey),
      last_rotated_at: this.now(),
    });
  }

  private async runConnectivityProbe(input: {
    connection: AiProviderConnectionRecord;
    testModelName: string;
    metadata: Record<string, unknown>;
  }): Promise<AiProviderConnectivityProbeResult> {
    const credential = await this.repository.findCredentialByConnectionId(input.connection.id);
    if (!credential) {
      return {
        status: "failed",
        testedAt: this.now(),
        errorSummary: "Connection credentials are not configured.",
      };
    }

    let apiKey: string;
    try {
      apiKey = this.credentialCrypto.decrypt(
        credential.credential_ciphertext,
      ).apiKey;
    } catch (error) {
      return {
        status: "failed",
        testedAt: this.now(),
        errorSummary: summarizeError(error),
      };
    }

    if (!this.connectivityProbe) {
      return {
        status: "failed",
        testedAt: this.now(),
        errorSummary: "Connectivity probe is unavailable in this runtime.",
      };
    }

    return this.connectivityProbe.testConnection({
      providerKind: input.connection.provider_kind,
      baseUrl: input.connection.base_url,
      apiKey,
      modelName: input.testModelName,
      connectionMetadata: cloneConnectionMetadata(input.metadata),
    });
  }

  private async requireConnection(
    connectionId: string,
  ): Promise<AiProviderConnectionRecord> {
    const connection = await this.repository.findById(connectionId);
    if (!connection) {
      throw new AiProviderConnectionNotFoundError(connectionId);
    }

    return {
      ...connection,
      connection_metadata: cloneConnectionMetadata(connection.connection_metadata),
      credential_summary: connection.credential_summary
        ? { ...connection.credential_summary }
        : undefined,
    };
  }

  private assertAdmin(role: RoleKey): void {
    this.permissionGuard.assert(role, MANAGE_PERMISSION);
  }

  private async recordAudit(input: {
    actorId?: string;
    actorRole?: RoleKey;
    action: string;
    connection: AiProviderConnectionRecord;
    metadata?: Record<string, unknown>;
    occurredAt?: Date;
  }): Promise<void> {
    await this.auditService.record({
      actorId: input.actorId,
      roleKey: input.actorRole,
      action: input.action,
      targetTable: "ai_provider_connections",
      targetId: input.connection.id,
      occurredAt: (input.occurredAt ?? this.now()).toISOString(),
      metadata: {
        provider_kind: input.connection.provider_kind,
        compatibility_mode: input.connection.compatibility_mode,
        base_url: input.connection.base_url,
        enabled: input.connection.enabled,
        credential_configured: Boolean(input.connection.credential_summary),
        ...input.metadata,
      },
    });
  }
}

export function createAiProviderConnectionService(
  options: AiProviderConnectionServiceOptions,
): AiProviderConnectionService {
  return new AiProviderConnectionService(options);
}

function normalizeProviderKind(providerKind: string): string {
  const normalized = normalizeRequiredString(providerKind, "provider_kind");
  if (!ALLOWED_PROVIDER_KINDS.has(normalized)) {
    throw new AiProviderConnectionValidationError(
      `Unsupported ai provider kind "${providerKind}".`,
    );
  }

  return normalized;
}

function normalizeCompatibilityMode(
  compatibilityMode: string | undefined,
): string {
  const normalized = normalizeOptionalString(compatibilityMode);
  if (!normalized) {
    return PHASE_ONE_COMPATIBILITY_MODE;
  }

  if (normalized !== PHASE_ONE_COMPATIBILITY_MODE) {
    throw new AiProviderConnectionValidationError(
      `Phase 1 ai provider connections must use "${PHASE_ONE_COMPATIBILITY_MODE}".`,
    );
  }

  return normalized;
}

function resolveBaseUrl(input: {
  providerKind: string;
  baseUrl?: string;
}): string {
  const normalizedBaseUrl = normalizeOptionalString(input.baseUrl);

  switch (input.providerKind) {
    case "openai":
      if (!normalizedBaseUrl || OPENAI_ALLOWED_BASE_URLS.has(normalizedBaseUrl)) {
        return OPENAI_OFFICIAL_BASE_URL;
      }

      throw new AiProviderConnectionValidationError(
        'Provider kind "openai" only supports the official OpenAI preset. Use "openai_compatible" for custom base URLs.',
      );
    case "deepseek":
      if (!normalizedBaseUrl || DEEPSEEK_ALLOWED_BASE_URLS.has(normalizedBaseUrl)) {
        return DEEPSEEK_OFFICIAL_BASE_URL;
      }

      throw new AiProviderConnectionValidationError(
        'Provider kind "deepseek" only supports the official DeepSeek preset in phase 1.',
      );
    case "qwen":
      return validateBaseUrl(normalizedBaseUrl ?? QWEN_OFFICIAL_BASE_URL);
    case "openai_compatible":
      return validateBaseUrl(
        normalizedBaseUrl ?? DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
      );
    default:
      throw new AiProviderConnectionValidationError(
        `Unsupported ai provider kind "${input.providerKind}".`,
      );
  }
}

function validateBaseUrl(baseUrl: string): string {
  const normalized = normalizeRequiredString(baseUrl, "base_url").replace(
    /\/+$/u,
    "",
  );

  try {
    const parsed = new URL(normalized);
    if (/\/chat\/completions$/u.test(parsed.pathname)) {
      throw new AiProviderConnectionValidationError(
        'base_url must not include the request path "/chat/completions".',
      );
    }

    return parsed.toString().replace(/\/+$/u, "");
  } catch (error) {
    if (error instanceof AiProviderConnectionValidationError) {
      throw error;
    }

    throw new AiProviderConnectionValidationError(
      `Invalid ai provider base_url "${baseUrl}".`,
    );
  }
}

function normalizeConnectionMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return metadata === undefined ? undefined : {};
  }

  return { ...metadata };
}

function cloneConnectionMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  return metadata ? structuredClone(metadata) : undefined;
}

function readTestModelName(
  metadata: Record<string, unknown>,
): string | undefined {
  const rawValue = metadata.test_model_name;
  return typeof rawValue === "string" && rawValue.trim().length > 0
    ? rawValue.trim()
    : undefined;
}

function normalizeRequiredString(value: string, fieldName: string): string {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new AiProviderConnectionValidationError(
      `${fieldName} must be a non-empty string.`,
    );
  }

  return normalized;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function summarizeError(error: unknown): string {
  const summary =
    error instanceof Error ? error.message : "Unknown ai provider error.";
  return summary.length <= MAX_ERROR_SUMMARY_LENGTH
    ? summary
    : `${summary.slice(0, MAX_ERROR_SUMMARY_LENGTH - 3)}...`;
}
