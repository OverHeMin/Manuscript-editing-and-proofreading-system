import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { InMemoryAuditService } from "../audit/audit-service.ts";
import {
  AuthService,
  type AuthSession,
  type LoginInput,
} from "../auth/auth-service.ts";
import { InMemoryLoginAttemptStore } from "../auth/login-attempt-store.ts";
import { LocalAuthenticationProvider } from "../auth/local-auth-provider.ts";
import { BcryptPasswordHasher } from "../auth/password-hasher.ts";
import { InMemoryUserRepository } from "../users/in-memory-user-repository.ts";
import type { UserRecord } from "../users/user.ts";

export const DEMO_HTTP_SESSION_COOKIE_NAME = "medsys_demo_session";

const DEMO_PASSWORD_HASH =
  "$2b$10$H4DZZv8KueEgqk1cjSAanewEhIoXTuGm2ixzaupe6QwfpA3Vr7HpW";

const DEMO_USER_SEEDS: readonly UserRecord[] = [
  {
    id: "dev-admin",
    username: "dev.admin",
    displayName: "Admin",
    role: "admin",
    passwordHash: DEMO_PASSWORD_HASH,
  },
  {
    id: "dev-screener",
    username: "dev.screener",
    displayName: "Screener",
    role: "screener",
    passwordHash: DEMO_PASSWORD_HASH,
  },
  {
    id: "dev-editor",
    username: "dev.editor",
    displayName: "Editor",
    role: "editor",
    passwordHash: DEMO_PASSWORD_HASH,
  },
  {
    id: "dev-proofreader",
    username: "dev.proofreader",
    displayName: "Proofreader",
    role: "proofreader",
    passwordHash: DEMO_PASSWORD_HASH,
  },
  {
    id: "dev-knowledge-reviewer",
    username: "dev.knowledge-reviewer",
    displayName: "Knowledge Reviewer",
    role: "knowledge_reviewer",
    passwordHash: DEMO_PASSWORD_HASH,
  },
  {
    id: "dev-user",
    username: "dev.user",
    displayName: "User",
    role: "user",
    passwordHash: DEMO_PASSWORD_HASH,
  },
] as const;

export interface HttpAuthenticatedSession extends AuthSession {
  sessionId: string;
}

export interface HttpAuthRuntime {
  authenticateLocal(input: LoginInput): Promise<HttpAuthenticatedSession>;
  requireSession(req: IncomingMessage): Promise<HttpAuthenticatedSession>;
  createSessionCookieHeader(session: HttpAuthenticatedSession): string;
}

export type DemoHttpAuthenticatedSession = HttpAuthenticatedSession;
export type DemoHttpAuthRuntime = HttpAuthRuntime;

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required for this API route.");
    this.name = "AuthenticationRequiredError";
  }
}

interface StoredDemoHttpSession {
  readonly session: AuthSession;
  readonly expiresAtMs: number;
}

class InMemoryDemoHttpSessionStore {
  private readonly sessions = new Map<string, StoredDemoHttpSession>();

  constructor(private readonly now: () => Date) {}

  create(session: AuthSession): DemoHttpAuthenticatedSession {
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      session,
      expiresAtMs: Date.parse(session.expiresAt),
    });

    return {
      sessionId,
      ...session,
    };
  }

  find(sessionId: string): DemoHttpAuthenticatedSession | null {
    const storedSession = this.sessions.get(sessionId);
    if (!storedSession) {
      return null;
    }

    if (storedSession.expiresAtMs <= this.now().getTime()) {
      this.sessions.delete(sessionId);
      return null;
    }

    return {
      sessionId,
      ...storedSession.session,
    };
  }
}

export function createDemoHttpAuthRuntime(
  now: () => Date = () => new Date(),
): DemoHttpAuthRuntime {
  const userRepository = new InMemoryUserRepository();
  for (const user of DEMO_USER_SEEDS) {
    void userRepository.save(user);
  }

  const authService = new AuthService({
    userRepository,
    passwordHasher: new BcryptPasswordHasher(),
    auditService: new InMemoryAuditService(),
    loginAttemptStore: new InMemoryLoginAttemptStore(),
    now,
  });
  const sessionStore = new InMemoryDemoHttpSessionStore(now);
  const authProvider = new LocalAuthenticationProvider(authService);

  return {
    async authenticateLocal(input: LoginInput): Promise<DemoHttpAuthenticatedSession> {
      const session = await authProvider.authenticate(input);
      return sessionStore.create(session);
    },

    async requireSession(req: IncomingMessage): Promise<DemoHttpAuthenticatedSession> {
      const cookieHeader = req.headers.cookie;
      const sessionId = readCookie(cookieHeader, DEMO_HTTP_SESSION_COOKIE_NAME);
      if (!sessionId) {
        throw new AuthenticationRequiredError();
      }

      const session = sessionStore.find(sessionId);
      if (!session) {
        throw new AuthenticationRequiredError();
      }

      return session;
    },

    createSessionCookieHeader(session: DemoHttpAuthenticatedSession): string {
      const maxAgeSeconds = Math.max(
        0,
        Math.floor((Date.parse(session.expiresAt) - Date.parse(session.issuedAt)) / 1000),
      );

      return serializeCookie(DEMO_HTTP_SESSION_COOKIE_NAME, session.sessionId, {
        httpOnly: true,
        sameSite: "Lax",
        path: "/",
        maxAgeSeconds,
      });
    },
  };
}

export function readCookie(
  cookieHeader: string | string[] | undefined,
  cookieName: string,
): string | null {
  const rawCookieHeader = Array.isArray(cookieHeader)
    ? cookieHeader.join("; ")
    : cookieHeader ?? "";
  if (rawCookieHeader.trim().length === 0) {
    return null;
  }

  for (const rawPair of rawCookieHeader.split(";")) {
    const [name, ...valueParts] = rawPair.trim().split("=");
    if (name === cookieName) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

export function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    sameSite?: "Lax" | "Strict" | "None";
    path?: string;
    maxAgeSeconds?: number;
    secure?: boolean;
  },
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.path) {
    parts.push(`Path=${options.path}`);
  }
  if (options.maxAgeSeconds != null) {
    parts.push(`Max-Age=${options.maxAgeSeconds}`);
  }
  if (options.httpOnly) {
    parts.push("HttpOnly");
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }
  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}
