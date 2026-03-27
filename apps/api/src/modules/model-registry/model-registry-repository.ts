import type {
  ModelRegistryRecord,
  ModelRoutingPolicyRecord,
} from "./model-record.ts";

export interface ModelRegistryRepository {
  save(record: ModelRegistryRecord): Promise<void>;
  findById(id: string): Promise<ModelRegistryRecord | undefined>;
  findByProviderModelVersion(
    provider: ModelRegistryRecord["provider"],
    modelName: string,
    modelVersion: string,
  ): Promise<ModelRegistryRecord | undefined>;
  list(): Promise<ModelRegistryRecord[]>;
}

export interface ModelRoutingPolicyRepository {
  get(): Promise<ModelRoutingPolicyRecord>;
  save(record: ModelRoutingPolicyRecord): Promise<void>;
}
