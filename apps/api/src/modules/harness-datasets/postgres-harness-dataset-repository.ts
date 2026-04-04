import type {
  HarnessDatasetPublicationRecord,
  HarnessGoldSetFamilyRecord,
  HarnessGoldSetItemRecord,
  HarnessGoldSetVersionRecord,
  HarnessRubricDefinitionRecord,
  HarnessRubricDimensionRecord,
} from "./harness-dataset-record.ts";
import type { HarnessDatasetRepository } from "./harness-dataset-repository.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface HarnessGoldSetFamilyRow {
  id: string;
  name: string;
  description: string | null;
  module: HarnessGoldSetFamilyRecord["scope"]["module"];
  manuscript_types:
    | HarnessGoldSetFamilyRecord["scope"]["manuscript_types"]
    | string;
  measure_focus: string;
  template_family_id: string | null;
  admin_only: boolean;
  created_at: Date;
  updated_at: Date;
}

interface HarnessGoldSetVersionRow {
  id: string;
  family_id: string;
  version_no: number;
  status: HarnessGoldSetVersionRecord["status"];
  rubric_definition_id: string | null;
  item_count: number;
  deidentification_gate_passed: boolean;
  human_review_gate_passed: boolean;
  items: HarnessGoldSetItemRecord[];
  publication_notes: string | null;
  created_by: string;
  created_at: Date;
  published_by: string | null;
  published_at: Date | null;
  archived_by: string | null;
  archived_at: Date | null;
}

interface HarnessRubricDefinitionRow {
  id: string;
  name: string;
  version_no: number;
  status: HarnessRubricDefinitionRecord["status"];
  module: HarnessRubricDefinitionRecord["scope"]["module"];
  manuscript_types:
    | HarnessRubricDefinitionRecord["scope"]["manuscript_types"]
    | string;
  scoring_dimensions: HarnessRubricDimensionRecord[];
  hard_gate_rules: string[] | string | null;
  failure_anchors: string[] | string | null;
  borderline_examples: string[] | string | null;
  judge_prompt: string | null;
  created_by: string;
  created_at: Date;
  published_by: string | null;
  published_at: Date | null;
  archived_by: string | null;
  archived_at: Date | null;
}

interface HarnessDatasetPublicationRow {
  id: string;
  gold_set_version_id: string;
  export_format: HarnessDatasetPublicationRecord["export_format"];
  status: HarnessDatasetPublicationRecord["status"];
  output_uri: string | null;
  deidentification_gate_passed: boolean;
  created_at: Date;
}

function cloneJson(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function mapGoldSetItem(record: HarnessGoldSetItemRecord): HarnessGoldSetItemRecord {
  return {
    ...record,
    risk_tags: record.risk_tags ? [...record.risk_tags] : undefined,
    expected_structured_output: cloneJson(record.expected_structured_output),
  };
}

function mapHarnessGoldSetFamilyRow(
  row: HarnessGoldSetFamilyRow,
): HarnessGoldSetFamilyRecord {
  return {
    id: row.id,
    name: row.name,
    ...(row.description != null ? { description: row.description } : {}),
    scope: {
      module: row.module,
      manuscript_types: decodeTextArray(
        row.manuscript_types,
      ) as HarnessGoldSetFamilyRecord["scope"]["manuscript_types"],
      measure_focus: row.measure_focus,
      ...(row.template_family_id != null
        ? { template_family_id: row.template_family_id }
        : {}),
    },
    admin_only: row.admin_only as true,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function mapHarnessGoldSetVersionRow(
  row: HarnessGoldSetVersionRow,
): HarnessGoldSetVersionRecord {
  return {
    id: row.id,
    family_id: row.family_id,
    version_no: row.version_no,
    status: row.status,
    ...(row.rubric_definition_id != null
      ? { rubric_definition_id: row.rubric_definition_id }
      : {}),
    item_count: row.item_count,
    deidentification_gate_passed: row.deidentification_gate_passed,
    human_review_gate_passed: row.human_review_gate_passed,
    items: row.items.map(mapGoldSetItem),
    ...(row.publication_notes != null
      ? { publication_notes: row.publication_notes }
      : {}),
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
    ...(row.published_by != null ? { published_by: row.published_by } : {}),
    ...(row.published_at != null
      ? { published_at: row.published_at.toISOString() }
      : {}),
    ...(row.archived_by != null ? { archived_by: row.archived_by } : {}),
    ...(row.archived_at != null
      ? { archived_at: row.archived_at.toISOString() }
      : {}),
  };
}

function mapHarnessRubricDefinitionRow(
  row: HarnessRubricDefinitionRow,
): HarnessRubricDefinitionRecord {
  return {
    id: row.id,
    name: row.name,
    version_no: row.version_no,
    status: row.status,
    scope: {
      module: row.module,
      manuscript_types: decodeTextArray(
        row.manuscript_types,
      ) as HarnessRubricDefinitionRecord["scope"]["manuscript_types"],
    },
    scoring_dimensions: row.scoring_dimensions.map((record) => ({ ...record })),
    hard_gate_rules: row.hard_gate_rules
      ? decodeTextArray(row.hard_gate_rules)
      : undefined,
    failure_anchors: row.failure_anchors
      ? decodeTextArray(row.failure_anchors)
      : undefined,
    borderline_examples: row.borderline_examples
      ? decodeTextArray(row.borderline_examples)
      : undefined,
    ...(row.judge_prompt != null ? { judge_prompt: row.judge_prompt } : {}),
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
    ...(row.published_by != null ? { published_by: row.published_by } : {}),
    ...(row.published_at != null
      ? { published_at: row.published_at.toISOString() }
      : {}),
    ...(row.archived_by != null ? { archived_by: row.archived_by } : {}),
    ...(row.archived_at != null
      ? { archived_at: row.archived_at.toISOString() }
      : {}),
  };
}

function mapHarnessDatasetPublicationRow(
  row: HarnessDatasetPublicationRow,
): HarnessDatasetPublicationRecord {
  return {
    id: row.id,
    gold_set_version_id: row.gold_set_version_id,
    export_format: row.export_format,
    status: row.status,
    ...(row.output_uri != null ? { output_uri: row.output_uri } : {}),
    deidentification_gate_passed: row.deidentification_gate_passed,
    created_at: row.created_at.toISOString(),
  };
}

export class PostgresHarnessDatasetRepository implements HarnessDatasetRepository {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async saveGoldSetFamily(record: HarnessGoldSetFamilyRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into harness_gold_set_families (
          id,
          name,
          description,
          module,
          manuscript_types,
          measure_focus,
          template_family_id,
          admin_only,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        on conflict (id) do update
        set
          name = excluded.name,
          description = excluded.description,
          module = excluded.module,
          manuscript_types = excluded.manuscript_types,
          measure_focus = excluded.measure_focus,
          template_family_id = excluded.template_family_id,
          admin_only = excluded.admin_only,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.name,
        record.description ?? null,
        record.scope.module,
        record.scope.manuscript_types,
        record.scope.measure_focus,
        record.scope.template_family_id ?? null,
        record.admin_only,
        record.created_at,
        record.updated_at,
      ],
    );
  }

  async findGoldSetFamilyById(
    id: string,
  ): Promise<HarnessGoldSetFamilyRecord | undefined> {
    const result = await this.dependencies.client.query<HarnessGoldSetFamilyRow>(
      `
        select
          id,
          name,
          description,
          module,
          manuscript_types,
          measure_focus,
          template_family_id,
          admin_only,
          created_at,
          updated_at
        from harness_gold_set_families
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapHarnessGoldSetFamilyRow(result.rows[0]) : undefined;
  }

  async listGoldSetFamilies(): Promise<HarnessGoldSetFamilyRecord[]> {
    const result = await this.dependencies.client.query<HarnessGoldSetFamilyRow>(
      `
        select
          id,
          name,
          description,
          module,
          manuscript_types,
          measure_focus,
          template_family_id,
          admin_only,
          created_at,
          updated_at
        from harness_gold_set_families
        order by created_at asc, id asc
      `,
    );

    return result.rows.map(mapHarnessGoldSetFamilyRow);
  }

  async saveGoldSetVersion(record: HarnessGoldSetVersionRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into harness_gold_set_versions (
          id,
          family_id,
          version_no,
          status,
          rubric_definition_id,
          item_count,
          deidentification_gate_passed,
          human_review_gate_passed,
          items,
          publication_notes,
          created_by,
          created_at,
          published_by,
          published_at,
          archived_by,
          archived_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16)
        on conflict (id) do update
        set
          family_id = excluded.family_id,
          version_no = excluded.version_no,
          status = excluded.status,
          rubric_definition_id = excluded.rubric_definition_id,
          item_count = excluded.item_count,
          deidentification_gate_passed = excluded.deidentification_gate_passed,
          human_review_gate_passed = excluded.human_review_gate_passed,
          items = excluded.items,
          publication_notes = excluded.publication_notes,
          created_by = excluded.created_by,
          created_at = excluded.created_at,
          published_by = excluded.published_by,
          published_at = excluded.published_at,
          archived_by = excluded.archived_by,
          archived_at = excluded.archived_at
      `,
      [
        record.id,
        record.family_id,
        record.version_no,
        record.status,
        record.rubric_definition_id ?? null,
        record.item_count,
        record.deidentification_gate_passed,
        record.human_review_gate_passed,
        JSON.stringify(record.items),
        record.publication_notes ?? null,
        record.created_by,
        record.created_at,
        record.published_by ?? null,
        record.published_at ?? null,
        record.archived_by ?? null,
        record.archived_at ?? null,
      ],
    );
  }

  async findGoldSetVersionById(
    id: string,
  ): Promise<HarnessGoldSetVersionRecord | undefined> {
    const result = await this.dependencies.client.query<HarnessGoldSetVersionRow>(
      `
        select
          id,
          family_id,
          version_no,
          status,
          rubric_definition_id,
          item_count,
          deidentification_gate_passed,
          human_review_gate_passed,
          items,
          publication_notes,
          created_by,
          created_at,
          published_by,
          published_at,
          archived_by,
          archived_at
        from harness_gold_set_versions
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapHarnessGoldSetVersionRow(result.rows[0]) : undefined;
  }

  async listGoldSetVersionsByFamilyId(
    familyId: string,
  ): Promise<HarnessGoldSetVersionRecord[]> {
    const result = await this.dependencies.client.query<HarnessGoldSetVersionRow>(
      `
        select
          id,
          family_id,
          version_no,
          status,
          rubric_definition_id,
          item_count,
          deidentification_gate_passed,
          human_review_gate_passed,
          items,
          publication_notes,
          created_by,
          created_at,
          published_by,
          published_at,
          archived_by,
          archived_at
        from harness_gold_set_versions
        where family_id = $1
        order by version_no asc, id asc
      `,
      [familyId],
    );

    return result.rows.map(mapHarnessGoldSetVersionRow);
  }

  async saveRubricDefinition(record: HarnessRubricDefinitionRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into harness_rubric_definitions (
          id,
          name,
          version_no,
          status,
          module,
          manuscript_types,
          scoring_dimensions,
          hard_gate_rules,
          failure_anchors,
          borderline_examples,
          judge_prompt,
          created_by,
          created_at,
          published_by,
          published_at,
          archived_by,
          archived_at
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        on conflict (id) do update
        set
          name = excluded.name,
          version_no = excluded.version_no,
          status = excluded.status,
          module = excluded.module,
          manuscript_types = excluded.manuscript_types,
          scoring_dimensions = excluded.scoring_dimensions,
          hard_gate_rules = excluded.hard_gate_rules,
          failure_anchors = excluded.failure_anchors,
          borderline_examples = excluded.borderline_examples,
          judge_prompt = excluded.judge_prompt,
          created_by = excluded.created_by,
          created_at = excluded.created_at,
          published_by = excluded.published_by,
          published_at = excluded.published_at,
          archived_by = excluded.archived_by,
          archived_at = excluded.archived_at
      `,
      [
        record.id,
        record.name,
        record.version_no,
        record.status,
        record.scope.module,
        record.scope.manuscript_types,
        JSON.stringify(record.scoring_dimensions),
        record.hard_gate_rules ?? [],
        record.failure_anchors ?? [],
        record.borderline_examples ?? [],
        record.judge_prompt ?? null,
        record.created_by,
        record.created_at,
        record.published_by ?? null,
        record.published_at ?? null,
        record.archived_by ?? null,
        record.archived_at ?? null,
      ],
    );
  }

  async findRubricDefinitionById(
    id: string,
  ): Promise<HarnessRubricDefinitionRecord | undefined> {
    const result = await this.dependencies.client.query<HarnessRubricDefinitionRow>(
      `
        select
          id,
          name,
          version_no,
          status,
          module,
          manuscript_types,
          scoring_dimensions,
          hard_gate_rules,
          failure_anchors,
          borderline_examples,
          judge_prompt,
          created_by,
          created_at,
          published_by,
          published_at,
          archived_by,
          archived_at
        from harness_rubric_definitions
        where id = $1
      `,
      [id],
    );

    return result.rows[0]
      ? mapHarnessRubricDefinitionRow(result.rows[0])
      : undefined;
  }

  async listRubricDefinitions(): Promise<HarnessRubricDefinitionRecord[]> {
    const result = await this.dependencies.client.query<HarnessRubricDefinitionRow>(
      `
        select
          id,
          name,
          version_no,
          status,
          module,
          manuscript_types,
          scoring_dimensions,
          hard_gate_rules,
          failure_anchors,
          borderline_examples,
          judge_prompt,
          created_by,
          created_at,
          published_by,
          published_at,
          archived_by,
          archived_at
        from harness_rubric_definitions
        order by name asc, version_no asc, id asc
      `,
    );

    return result.rows.map(mapHarnessRubricDefinitionRow);
  }

  async listRubricDefinitionsByName(
    name: string,
  ): Promise<HarnessRubricDefinitionRecord[]> {
    const result = await this.dependencies.client.query<HarnessRubricDefinitionRow>(
      `
        select
          id,
          name,
          version_no,
          status,
          module,
          manuscript_types,
          scoring_dimensions,
          hard_gate_rules,
          failure_anchors,
          borderline_examples,
          judge_prompt,
          created_by,
          created_at,
          published_by,
          published_at,
          archived_by,
          archived_at
        from harness_rubric_definitions
        where name = $1
        order by version_no asc, id asc
      `,
      [name],
    );

    return result.rows.map(mapHarnessRubricDefinitionRow);
  }

  async saveDatasetPublication(
    record: HarnessDatasetPublicationRecord,
  ): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into harness_dataset_publications (
          id,
          gold_set_version_id,
          export_format,
          status,
          output_uri,
          deidentification_gate_passed,
          created_at
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (id) do update
        set
          gold_set_version_id = excluded.gold_set_version_id,
          export_format = excluded.export_format,
          status = excluded.status,
          output_uri = excluded.output_uri,
          deidentification_gate_passed = excluded.deidentification_gate_passed,
          created_at = excluded.created_at
      `,
      [
        record.id,
        record.gold_set_version_id,
        record.export_format,
        record.status,
        record.output_uri ?? null,
        record.deidentification_gate_passed,
        record.created_at,
      ],
    );
  }

  async listDatasetPublicationsByVersionId(
    goldSetVersionId: string,
  ): Promise<HarnessDatasetPublicationRecord[]> {
    const result =
      await this.dependencies.client.query<HarnessDatasetPublicationRow>(
        `
          select
            id,
            gold_set_version_id,
            export_format,
            status,
            output_uri,
            deidentification_gate_passed,
            created_at
          from harness_dataset_publications
          where gold_set_version_id = $1
          order by created_at asc, id asc
        `,
        [goldSetVersionId],
      );

    return result.rows.map(mapHarnessDatasetPublicationRow);
  }
}

function decodeTextArray(value: string[] | string): string[] {
  if (Array.isArray(value)) {
    return [...value];
  }

  if (!value || value === "{}") {
    return [];
  }

  return value
    .slice(1, -1)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => item.replace(/^"(.*)"$/, "$1"));
}
