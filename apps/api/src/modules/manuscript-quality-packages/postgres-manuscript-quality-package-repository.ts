import type {
  ManuscriptQualityPackageKind,
  ManuscriptQualityScope,
} from "@medical/contracts";
import type {
  ListManuscriptQualityPackagesByScopeInput,
  ManuscriptQualityPackageRepository,
} from "./manuscript-quality-package-repository.ts";
import type { ManuscriptQualityPackageRecord } from "./manuscript-quality-package-record.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

interface ManuscriptQualityPackageRow {
  id: string;
  package_name: string;
  package_kind: ManuscriptQualityPackageRecord["package_kind"];
  target_scopes: string[] | string;
  version: number;
  status: ManuscriptQualityPackageRecord["status"];
  manifest: Record<string, unknown> | string;
}

function normalizeScopes(
  scopes: readonly ManuscriptQualityScope[],
): ManuscriptQualityScope[] {
  return [...scopes].sort((left, right) => left.localeCompare(right));
}

export class PostgresManuscriptQualityPackageRepository
  implements ManuscriptQualityPackageRepository
{
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async save(record: ManuscriptQualityPackageRecord): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into manuscript_quality_package_versions (
          id,
          package_name,
          package_kind,
          target_scopes,
          version,
          status,
          manifest
        )
        values (
          $1,
          $2,
          $3,
          $4::text[],
          $5,
          $6,
          $7::jsonb
        )
        on conflict (id) do update
        set
          package_name = excluded.package_name,
          package_kind = excluded.package_kind,
          target_scopes = excluded.target_scopes,
          version = excluded.version,
          status = excluded.status,
          manifest = excluded.manifest,
          updated_at = now()
      `,
      [
        record.id,
        record.package_name,
        record.package_kind,
        normalizeScopes(record.target_scopes),
        record.version,
        record.status,
        JSON.stringify(record.manifest),
      ],
    );
  }

  async findById(id: string): Promise<ManuscriptQualityPackageRecord | undefined> {
    const result = await this.dependencies.client.query<ManuscriptQualityPackageRow>(
      `
        select
          id,
          package_name,
          package_kind,
          target_scopes,
          version,
          status,
          manifest
        from manuscript_quality_package_versions
        where id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async list(): Promise<ManuscriptQualityPackageRecord[]> {
    const result = await this.dependencies.client.query<ManuscriptQualityPackageRow>(
      `
        select
          id,
          package_name,
          package_kind,
          target_scopes,
          version,
          status,
          manifest
        from manuscript_quality_package_versions
        order by package_kind asc, package_name asc, version asc, id asc
      `,
    );

    return result.rows.map(mapRow);
  }

  async listByScope(
    input: ListManuscriptQualityPackagesByScopeInput,
  ): Promise<ManuscriptQualityPackageRecord[]> {
    const result = await this.dependencies.client.query<ManuscriptQualityPackageRow>(
      `
        select
          id,
          package_name,
          package_kind,
          target_scopes,
          version,
          status,
          manifest
        from manuscript_quality_package_versions
        where ($1::text is null or package_kind = $1)
          and ($2::text is null or package_name = $2)
          and ($3::text is null or target_scopes @> array[$3]::text[])
          and ($4::text is null or status = $4)
        order by package_kind asc, package_name asc, version asc, id asc
      `,
      [
        input.packageKind ?? null,
        input.packageName ?? null,
        input.targetScope ?? null,
        input.status ?? null,
      ],
    );

    return result.rows.map(mapRow);
  }

  async reserveNextVersion(
    packageKind: ManuscriptQualityPackageKind,
    packageName: string,
    targetScopes: ManuscriptQualityScope[],
  ): Promise<number> {
    const normalizedScopes = normalizeScopes(targetScopes);

    await this.dependencies.client.query(
      `
        select pg_advisory_xact_lock(hashtext($1))
      `,
      [
        `manuscript-quality-package-version:${packageKind}:${packageName}:${normalizedScopes.join("|")}`,
      ],
    );

    const result = await this.dependencies.client.query<{ next_version: number }>(
      `
        select coalesce(max(version), 0) + 1 as next_version
        from manuscript_quality_package_versions
        where package_kind = $1
          and package_name = $2
          and target_scopes = $3::text[]
      `,
      [packageKind, packageName, normalizedScopes],
    );

    return Number(result.rows[0]?.next_version ?? 1);
  }
}

function mapRow(row: ManuscriptQualityPackageRow): ManuscriptQualityPackageRecord {
  return {
    id: row.id,
    package_name: row.package_name,
    package_kind: row.package_kind,
    target_scopes: decodeTextArray(row.target_scopes) as ManuscriptQualityScope[],
    version: Number(row.version),
    status: row.status,
    manifest:
      typeof row.manifest === "string"
        ? (JSON.parse(row.manifest) as Record<string, unknown>)
        : structuredClone(row.manifest),
  };
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
