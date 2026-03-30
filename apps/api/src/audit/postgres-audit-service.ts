import type { AuditRecordInput } from "./audit-record.ts";
import type { AuditService } from "./audit-service.ts";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

export class PostgresAuditService implements AuditService {
  constructor(private readonly dependencies: { client: QueryableClient }) {}

  async record(entry: AuditRecordInput): Promise<void> {
    await this.dependencies.client.query(
      `
        insert into audit_logs (
          actor_id,
          role_key,
          action,
          target_table,
          target_id,
          metadata,
          ip_address,
          user_agent,
          created_at
        )
        values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
      `,
      [
        entry.actorId ?? null,
        entry.roleKey ?? null,
        entry.action,
        entry.targetTable ?? null,
        entry.targetId ?? null,
        JSON.stringify(entry.metadata ?? {}),
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
        entry.occurredAt,
      ],
    );
  }
}
