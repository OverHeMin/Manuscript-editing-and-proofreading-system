import type { RoleKey } from "../../users/roles.ts";
import type { TemplateModule } from "../templates/template-record.ts";
import type { ModelRegistryRecord } from "../model-registry/model-record.ts";
import type { ModelRegistryService } from "../model-registry/model-registry-service.ts";
import type { ModelRoutingGovernanceService } from "../model-routing-governance/model-routing-governance-service.ts";
import type { AiProviderConnectionRecord } from "./ai-provider-connection-record.ts";
import type { AiProviderConnectionService } from "./ai-provider-connection-service.ts";

const ROUTABLE_MODULES: TemplateModule[] = [
  "screening",
  "editing",
  "proofreading",
];

export interface DiscoveredAiProviderModel {
  id: string;
  name: string;
  contextWindow?: number;
  supportsJsonMode?: boolean;
}

export interface AiProviderModelDiscoveryClient {
  discoverModels(input: {
    provider: string;
    baseUrl: string;
    apiKey: string;
  }): Promise<DiscoveredAiProviderModel[]>;
}

export interface AiProviderAutoConfigurationInput {
  actorId?: string;
  actorRole: RoleKey;
  provider: string;
  baseUrl?: string;
  apiKey: string;
  defaultModel: string;
  moduleRoutes?: Partial<Record<TemplateModule, string>>;
  discoverModels?: boolean;
}

export interface AiProviderAutoConfigurationResult {
  connection: AiProviderConnectionRecord;
  models: ModelRegistryRecord[];
  discovery: {
    status: "disabled" | "discovered" | "fallback";
    models: DiscoveredAiProviderModel[];
    errorSummary?: string;
  };
}

export interface AiProviderAutoConfigurationServiceOptions {
  aiProviderConnectionService: AiProviderConnectionService;
  modelRegistryService: ModelRegistryService;
  modelRoutingGovernanceService: ModelRoutingGovernanceService;
  discoveryClient?: AiProviderModelDiscoveryClient;
}

export class AiProviderAutoConfigurationService {
  private readonly aiProviderConnectionService: AiProviderConnectionService;
  private readonly modelRegistryService: ModelRegistryService;
  private readonly modelRoutingGovernanceService: ModelRoutingGovernanceService;
  private readonly discoveryClient?: AiProviderModelDiscoveryClient;

  constructor(options: AiProviderAutoConfigurationServiceOptions) {
    this.aiProviderConnectionService = options.aiProviderConnectionService;
    this.modelRegistryService = options.modelRegistryService;
    this.modelRoutingGovernanceService = options.modelRoutingGovernanceService;
    this.discoveryClient = options.discoveryClient;
  }

  async configure(
    input: AiProviderAutoConfigurationInput,
  ): Promise<AiProviderAutoConfigurationResult> {
    const connection = await this.aiProviderConnectionService.createConnection({
      actorId: input.actorId,
      actorRole: input.actorRole,
      connection: {
        name: createConnectionName(input.provider),
        provider_kind: input.provider,
        base_url: input.baseUrl,
        enabled: true,
        connection_metadata: {
          test_model_name: input.defaultModel,
        },
        credentials: {
          apiKey: input.apiKey,
        },
      },
    });

    const discovery = await this.discoverModels({
      provider: input.provider,
      baseUrl: connection.base_url,
      apiKey: input.apiKey,
      defaultModel: input.defaultModel,
      enabled: input.discoverModels ?? false,
    });

    const requestedModels = buildRequestedModelUsage({
      defaultModel: input.defaultModel,
      moduleRoutes: input.moduleRoutes,
    });
    const discoveredByName = new Map(
      discovery.models.map((model) => [model.name, model]),
    );
    const createdModels: ModelRegistryRecord[] = [];

    for (const [modelName, allowedModules] of requestedModels.entries()) {
      const discoveredModel = discoveredByName.get(modelName);
      createdModels.push(
        await this.modelRegistryService.createModelEntry(input.actorRole, {
          provider: normalizeRegistryProvider(input.provider),
          modelName,
          modelVersion: discoveredModel?.id === modelName ? "" : discoveredModel?.id,
          allowedModules,
          isProdAllowed: true,
          connectionId: connection.id,
        }),
      );
    }

    const createdModelByName = new Map(
      createdModels.map((model) => [model.model_name, model]),
    );

    for (const moduleKey of ROUTABLE_MODULES) {
      const modelName = input.moduleRoutes?.[moduleKey];
      if (!modelName) {
        continue;
      }

      const model = createdModelByName.get(modelName);
      if (!model) {
        continue;
      }

      await this.modelRoutingGovernanceService.saveSystemSettingsModuleDefault(
        input.actorRole,
        {
          moduleKey,
          primaryModelId: model.id,
        },
      );
    }

    return {
      connection,
      models: createdModels,
      discovery,
    };
  }

  private async discoverModels(input: {
    provider: string;
    baseUrl: string;
    apiKey: string;
    defaultModel: string;
    enabled: boolean;
  }): Promise<AiProviderAutoConfigurationResult["discovery"]> {
    if (!input.enabled || !this.discoveryClient) {
      return {
        status: "disabled",
        models: [
          {
            id: input.defaultModel,
            name: input.defaultModel,
          },
        ],
      };
    }

    try {
      const models = await this.discoveryClient.discoverModels({
        provider: input.provider,
        baseUrl: input.baseUrl,
        apiKey: input.apiKey,
      });

      return {
        status: "discovered",
        models: models.length
          ? models.map(cloneDiscoveredModel)
          : [
              {
                id: input.defaultModel,
                name: input.defaultModel,
              },
            ],
      };
    } catch (error) {
      return {
        status: "fallback",
        models: [
          {
            id: input.defaultModel,
            name: input.defaultModel,
          },
        ],
        errorSummary:
          error instanceof Error ? error.message : "Model discovery failed.",
      };
    }
  }
}

function buildRequestedModelUsage(input: {
  defaultModel: string;
  moduleRoutes?: Partial<Record<TemplateModule, string>>;
}): Map<string, TemplateModule[]> {
  const usage = new Map<string, Set<TemplateModule>>();
  const hasExplicitRoutes = ROUTABLE_MODULES.some(
    (moduleName) => input.moduleRoutes?.[moduleName],
  );

  for (const moduleName of ROUTABLE_MODULES) {
    const modelName = hasExplicitRoutes
      ? input.moduleRoutes?.[moduleName]
      : input.defaultModel;
    if (!modelName) {
      continue;
    }
    if (!usage.has(modelName)) {
      usage.set(modelName, new Set());
    }
    usage.get(modelName)?.add(moduleName);
  }

  return new Map(
    [...usage.entries()].map(([modelName, modules]) => [
      modelName,
      ROUTABLE_MODULES.filter((moduleName) => modules.has(moduleName)),
    ]),
  );
}

function createConnectionName(provider: string): string {
  return `${provider.trim()} auto configuration`;
}

function normalizeRegistryProvider(provider: string): ModelRegistryRecord["provider"] {
  switch (provider) {
    case "openai":
    case "qwen":
    case "deepseek":
      return provider;
    default:
      return "other";
  }
}

function cloneDiscoveredModel(
  model: DiscoveredAiProviderModel,
): DiscoveredAiProviderModel {
  return {
    id: model.id,
    name: model.name,
    ...(model.contextWindow !== undefined
      ? { contextWindow: model.contextWindow }
      : {}),
    ...(model.supportsJsonMode !== undefined
      ? { supportsJsonMode: model.supportsJsonMode }
      : {}),
  };
}
