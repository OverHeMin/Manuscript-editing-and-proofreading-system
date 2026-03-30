import type { AuthProviderName } from "./provider.ts";

export interface AuthSessionRecord {
  id: string;
  userId: string;
  provider: AuthProviderName;
  issuedAt: string;
  expiresAt: string;
  refreshAt: string;
  ipAddress?: string;
  userAgent?: string;
  revokedAt?: string;
}

export interface CreateAuthSessionInput {
  userId: string;
  provider: AuthProviderName;
  issuedAt: string;
  expiresAt: string;
  refreshAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthSessionRepository {
  create(input: CreateAuthSessionInput): Promise<AuthSessionRecord>;
  findActiveById(sessionId: string, at: Date): Promise<AuthSessionRecord | null>;
  revoke(sessionId: string, revokedAt: string): Promise<void>;
}
