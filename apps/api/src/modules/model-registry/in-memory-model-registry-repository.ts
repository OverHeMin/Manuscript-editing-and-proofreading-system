import type {
  ModelRegistryRecord,
  ModelRoutingPolicyRecord,
} from "./model-record.ts";
import type {
  ModelRegistryRepository,
  ModelRoutingPolicyRepository,
} from "./model-registry-repository.ts";

function cloneModelRegistryRecord(record: ModelRegistryRecord): ModelRegistryRecord {
  return {
    ...record,
    allowed_modules: [...record.allowed_modules],
    cost_profile: record.cost_profile ? { ...record.cost_profile } : undefined,
    rate_limit: record.rate_limit ? { ...record.rate_limit } : undefined,
    ...(record.connection_id ? { connection_id: record.connection_id } : {}),
  };
}

function cloneRoutingPolicyRecord(
  record: ModelRoutingPolicyRecord,
): ModelRoutingPolicyRecord {
  return {
    system_default_model_id: record.system_default_model_id,
    module_defaults: { ...record.module_defaults },
    template_overrides: { ...record.template_overrides },
  };
}

function compareModels(left: ModelRegistryRecord, right: ModelRegistryRecord): number {
  if (left.provider !== right.provider) {
    return left.provider.localeCompare(right.provider);
  }

  if (left.model_name !== right.model_name) {
    return left.model_name.localeCompare(right.model_name);
  }

  if (left.model_version !== right.model_version) {
    return left.model_version.localeCompare(right.model_version);
  }

  return left.id.localeCompare(right.id);
}

export class InMemoryModelRegistryRepository implements ModelRegistryRepository {
  private readonly records = new Map<string, ModelRegistryRecord>();

  async save(record: ModelRegistryRecord): Promise<void> {
    this.records.set(record.id, cloneModelRegistryRecord(record));
  }

  async findById(id: string): Promise<ModelRegistryRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneModelRegistryRecord(record) : undefined;
  }

  async findByProviderModelVersion(
    provider: ModelRegistryRecord["provider"],
    modelName: string,
    modelVersion: string,
  ): Promise<ModelRegistryRecord | undefined> {
    for (const record of this.records.values()) {
      if (
        record.provider === provider &&
        record.model_name === modelName &&
        record.model_version === modelVersion
      ) {
        return cloneModelRegistryRecord(record);
      }
    }

    return undefined;
  }

  async list(): Promise<ModelRegistryRecord[]> {
    return [...this.records.values()]
      .sort(compareModels)
      .map(cloneModelRegistryRecord);
  }
}

export class InMemoryModelRoutingPolicyRepository
  implements ModelRoutingPolicyRepository
{
  private record: ModelRoutingPolicyRecord = {
    system_default_model_id: undefined,
    module_defaults: {},
    template_overrides: {},
  };

  async get(): Promise<ModelRoutingPolicyRecord> {
    return cloneRoutingPolicyRecord(this.record);
  }

  async save(record: ModelRoutingPolicyRecord): Promise<void> {
    this.record = cloneRoutingPolicyRecord(record);
  }
}
