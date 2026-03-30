import type { IncomingMessage } from "node:http";
import { PostgresAuditService } from "../audit/postgres-audit-service.ts";
import { AuthService, type LoginInput } from "../auth/auth-service.ts";
import { LocalAuthenticationProvider } from "../auth/local-auth-provider.ts";
import { BcryptPasswordHasher } from "../auth/password-hasher.ts";
import { PostgresAuthSessionRepository } from "../auth/postgres-auth-session-repository.ts";
import { PostgresLoginAttemptStore } from "../auth/postgres-login-attempt-store.ts";
import { PostgresUserRepository } from "../users/postgres-user-repository.ts";
import {
  AuthenticationRequiredError,
  readCookie,
  serializeCookie,
  type HttpAuthenticatedSession,
  type HttpAuthRuntime,
} from "./demo-auth-runtime.ts";

export const PERSISTENT_HTTP_SESSION_COOKIE_NAME = "medsys_session";

type QueryableClient = {
  query: <TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
};

export interface CreatePersistentHttpAuthRuntimeOptions {
  client: QueryableClient;
  now?: () => Date;
  secureCookies?: boolean;
}

export function createPersistentHttpAuthRuntime(
  options: CreatePersistentHttpAuthRuntimeOptions,
): HttpAuthRuntime {
  const now = options.now ?? (() => new Date());
  const userRepository = new PostgresUserRepository({
    client: options.client,
  });
  const authService = new AuthService({
    userRepository,
    passwordHasher: new BcryptPasswordHasher(),
    auditService: new PostgresAuditService({
      client: options.client,
    }),
    loginAttemptStore: new PostgresLoginAttemptStore({
      client: options.client,
    }),
    now,
  });
  const authProvider = new LocalAuthenticationProvider(authService);
  const sessionRepository = new PostgresAuthSessionRepository({
    client: options.client,
  });

  return {
    async authenticateLocal(input: LoginInput): Promise<HttpAuthenticatedSession> {
      const session = await authProvider.authenticate(input);
      const persistentSession = await sessionRepository.create({
        userId: session.user.id,
        provider: session.provider,
        issuedAt: session.issuedAt,
        expiresAt: session.expiresAt,
        refreshAt: session.refreshAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });

      return {
        sessionId: persistentSession.id,
        ...session,
      };
    },

    async requireSession(req: IncomingMessage): Promise<HttpAuthenticatedSession> {
      const sessionId = readCookie(
        req.headers.cookie,
        PERSISTENT_HTTP_SESSION_COOKIE_NAME,
      );
      if (!sessionId) {
        throw new AuthenticationRequiredError();
      }

      const sessionRecord = await sessionRepository.findActiveById(sessionId, now());
      if (!sessionRecord) {
        throw new AuthenticationRequiredError();
      }

      const user = await userRepository.findById(sessionRecord.userId);
      if (!user) {
        throw new AuthenticationRequiredError();
      }

      return {
        sessionId: sessionRecord.id,
        provider: sessionRecord.provider,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
        issuedAt: sessionRecord.issuedAt,
        expiresAt: sessionRecord.expiresAt,
        refreshAt: sessionRecord.refreshAt,
      };
    },

    createSessionCookieHeader(session: HttpAuthenticatedSession): string {
      const maxAgeSeconds = Math.max(
        0,
        Math.floor((Date.parse(session.expiresAt) - Date.parse(session.issuedAt)) / 1000),
      );

      return serializeCookie(
        PERSISTENT_HTTP_SESSION_COOKIE_NAME,
        session.sessionId,
        {
          httpOnly: true,
          sameSite: "Lax",
          path: "/",
          maxAgeSeconds,
          secure: options.secureCookies ?? false,
        },
      );
    },
  };
}
