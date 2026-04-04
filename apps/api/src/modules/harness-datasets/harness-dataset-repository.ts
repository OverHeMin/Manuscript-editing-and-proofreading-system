import type {
  HarnessDatasetPublicationRecord,
  HarnessGoldSetFamilyRecord,
  HarnessGoldSetVersionRecord,
  HarnessRubricDefinitionRecord,
} from "./harness-dataset-record.ts";

export interface HarnessDatasetRepository {
  saveGoldSetFamily(record: HarnessGoldSetFamilyRecord): Promise<void>;
  findGoldSetFamilyById(id: string): Promise<HarnessGoldSetFamilyRecord | undefined>;
  listGoldSetFamilies(): Promise<HarnessGoldSetFamilyRecord[]>;

  saveGoldSetVersion(record: HarnessGoldSetVersionRecord): Promise<void>;
  findGoldSetVersionById(
    id: string,
  ): Promise<HarnessGoldSetVersionRecord | undefined>;
  listGoldSetVersionsByFamilyId(
    familyId: string,
  ): Promise<HarnessGoldSetVersionRecord[]>;

  saveRubricDefinition(record: HarnessRubricDefinitionRecord): Promise<void>;
  findRubricDefinitionById(
    id: string,
  ): Promise<HarnessRubricDefinitionRecord | undefined>;
  listRubricDefinitions(): Promise<HarnessRubricDefinitionRecord[]>;
  listRubricDefinitionsByName(name: string): Promise<HarnessRubricDefinitionRecord[]>;

  saveDatasetPublication(record: HarnessDatasetPublicationRecord): Promise<void>;
  listDatasetPublicationsByVersionId(
    goldSetVersionId: string,
  ): Promise<HarnessDatasetPublicationRecord[]>;
}
