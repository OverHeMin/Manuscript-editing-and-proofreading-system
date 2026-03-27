import type { RoleKey } from "../users/roles.ts";

export interface AuditRecordInput {
  actorId?: string;
  roleKey?: RoleKey;
  action: string;
  targetTable?: string;
  targetId?: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditRecord extends AuditRecordInput {
  metadata?: Record<string, unknown>;
}
