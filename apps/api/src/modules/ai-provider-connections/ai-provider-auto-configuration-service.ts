import type { RoleKey } from "../../users/roles.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import type { ModelRegistryRecord } from "../model-registry/model-record.ts";
import { ModelRegistryService } from "../model-registry/model-registry-service.ts";
import type { AiProviderConnectionRecord } from "./ai-provider-connection-record.ts";
import { AiProviderConnectionService } from "./ai-provider-connection-service.ts";
import type {
  AiProviderConnectivityProbeResult,
  AiProviderModelDiscoveryResult,
} from "./openai-chat-compatible-connectivity-probe.ts";

const DEFAULT_ALLOWED_MODULES: TemplateModule[] = [
  "screening",
  "editing",
  "proofreading",
];
const DEFAULT_TEST_MODEL_NAME = "gpt-4o-mini";

export interface ConfigureAiProviderFromApiKeyInput {
  actorId?: string;
  actorRole: RoleKey;
  apiKey: string;
  providerKind?: string;
  baseUrl?: string;
  connectionName?: string;
}

export interface ConfigureAiProviderFromApiKeyResult {
  connection: AiProviderConnectionRecord;
  test: AiProviderConnectivityProbeResult;
  discovery: AiProviderModelDiscoveryResult;
  registeredModels: ModelRegistryRecord[];
}

export interface AiProviderAutoConfigurationServiceOptions {
  connectionService: AiProviderConnectionService;
  modelRegistryService: ModelRegistryService;
}

export class AiProviderAutoConfigurationService {
  private readonly connectionService: AiProviderConnectionService;
  private readonly modelRegistryService: ModelRegistryService;

  constructor(options: AiProviderAutoConfigurationServiceOptions) {
    this.connectionService = options.connectionService;
    this.modelRegistryService = options.modelRegistryService;
  }

  async configureFromApiKey(
    input: ConfigureAiProviderFromApiKeyInput,
  ): Promise<ConfigureAiProviderFromApiKeyResult> {
    const providerKind = input.providerKind ?? "openai_compatible";
    const connection = await this.connectionService.createConnection({
      actorId: input.actorId,
      actorRole: input.actorRole,
      connection: {
        name: input.connectionName ?? buildDefaultConnectionName(providerKind),
        provider_kind: providerKind,
        base_url: input.baseUrl,
        connection_metadata: {
          test_model_name: defaultTestModelNameForProvider(providerKind),
        },
        credentials: {
          apiKey: input.apiKey,
        },
        enabled: true,
      },
    });

    const discovery = await this.connectionService.discoverModels({
      actorId: input.actorId,
      actorRole: input.actorRole,
      connectionId: connection.id,
    });
    const selectedModelName =
      discovery.models[0]?.id ?? defaultTestModelNameForProvider(providerKind);
    const testedConnection = await this.connectionService.testConnection({
      actorId: input.actorId,
      actorRole: input.actorRole,
      test: {
        connectionId: connection.id,
        metadata: {
          test_model_name: selectedModelName,
        },
      },
    });
    const test: AiProviderConnectivityProbeResult = {
      status: testedConnection.last_test_status ?? "unknown",
      testedAt: testedConnection.last_test_at ?? new Date(),
      errorSummary: testedConnection.last_error_summary,
    };

    if (test.status !== "passed" || discovery.status !== "passed") {
      return {
        connection: testedConnection,
        test,
        discovery,
        registeredModels: [],
      };
    }

    const registeredModels = await this.registerModels({
      actorRole: input.actorRole,
      providerKind,
      connectionId: connection.id,
      modelNames: discovery.models.map((model) => model.id),
    });

    return {
      connection: testedConnection,
      test,
      discovery,
      registeredModels,
    };
  }

  private async registerModels(input: {
    actorRole: RoleKey;
    providerKind: string;
    connectionId: string;
    modelNames: string[];
  }): Promise<ModelRegistryRecord[]> {
    const provider = mapProviderKindToModelProvider(input.providerKind);
    const createdModels: ModelRegistryRecord[] = [];

    for (const modelName of input.modelNames) {
      try {
        createdModels.push(
          await this.modelRegistryService.createModelEntry(input.actorRole, {
            provider,
            modelName,
            allowedModules: DEFAULT_ALLOWED_MODULES,
            isProdAllowed: true,
            connectionId: input.connectionId,
          }),
        );
      } catch (error) {
        if (!isDuplicateModelError(error)) {
          throw error;
        }
      }
    }

    if (createdModels.length > 1) {
      const fallbackModelId = createdModels[1]?.id;
      createdModels[0] = await this.modelRegistryService.updateModelEntry(
        createdModels[0].id,
        input.actorRole,
        {
          fallbackModelId,
        },
      );
    }

    return createdModels;
  }
}

function defaultTestModelNameForProvider(providerKind: string): string {
  switch (providerKind) {
    case "deepseek":
      return "deepseek-v4-flash";
    case "qwen":
      return "qwen-plus";
    default:
      return DEFAULT_TEST_MODEL_NAME;
  }
}

function buildDefaultConnectionName(providerKind: string): string {
  switch (providerKind) {
    case "openai":
      return "OpenAI Auto";
    case "qwen":
      return "Qwen Auto";
    case "deepseek":
      return "DeepSeek Auto";
    default:
      return "OpenAI Compatible Auto";
  }
}

function mapProviderKindToModelProvider(
  providerKind: string,
): ModelRegistryRecord["provider"] {
  switch (providerKind) {
    case "openai":
      return "openai";
    case "qwen":
      return "qwen";
    case "deepseek":
      return "deepseek";
    default:
      return "other";
  }
}

function isDuplicateModelError(error: unknown): boolean {
  return error instanceof Error && error.name === "DuplicateModelRegistryEntryError";
}
