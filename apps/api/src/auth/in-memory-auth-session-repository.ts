import { randomUUID } from "node:crypto";
import type {
  AuthSessionRecord,
  AuthSessionRepository,
  CreateAuthSessionInput,
} from "./auth-session-repository.ts";

export class InMemoryAuthSessionRepository implements AuthSessionRepository {
  private readonly sessions = new Map<string, AuthSessionRecord>();

  async create(input: CreateAuthSessionInput): Promise<AuthSessionRecord> {
    const record: AuthSessionRecord = {
      id: randomUUID(),
      ...input,
    };
    this.sessions.set(record.id, record);
    return cloneSessionRecord(record);
  }

  async findActiveById(sessionId: string, at: Date): Promise<AuthSessionRecord | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (session.revokedAt || Date.parse(session.expiresAt) <= at.getTime()) {
      return null;
    }

    return cloneSessionRecord(session);
  }

  async revoke(sessionId: string, revokedAt: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.sessions.set(sessionId, {
      ...session,
      revokedAt,
    });
  }

  async revokeAllForUser(userId: string, revokedAt: string): Promise<void> {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId !== userId || session.revokedAt) {
        continue;
      }

      this.sessions.set(sessionId, {
        ...session,
        revokedAt,
      });
    }
  }
}

function cloneSessionRecord(record: AuthSessionRecord): AuthSessionRecord {
  return {
    ...record,
  };
}
