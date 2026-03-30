import {
  AUTH_ROLES,
  buildAuthSessionViewModel,
  type AuthRole,
  type AuthSessionViewModel,
} from "../features/auth/index.ts";

const DEFAULT_DEV_ROLE: AuthRole = "knowledge_reviewer";

export function isDevelopmentSessionBootstrapEnabled(
  env: ImportMetaEnv = import.meta.env,
): boolean {
  return env.DEV;
}

export function resolveDevSession(
  env: ImportMetaEnv = import.meta.env,
): AuthSessionViewModel {
  if (!isDevelopmentSessionBootstrapEnabled(env)) {
    throw new Error("resolveDevSession is development-only and must not be used in non-dev mode.");
  }

  const role = parseAuthRole(env.VITE_DEV_ROLE) ?? DEFAULT_DEV_ROLE;
  const roleLabel = role.replaceAll("_", "-");

  // Development-only bootstrap helper. Runtime auth still belongs to backend auth services.
  return buildAuthSessionViewModel({
    userId: coalesceNonEmpty(env.VITE_DEV_USER_ID, `dev-${roleLabel}`),
    username: coalesceNonEmpty(env.VITE_DEV_USERNAME, `dev.${roleLabel}`),
    displayName: coalesceNonEmpty(env.VITE_DEV_DISPLAY_NAME, toDisplayName(role)),
    role,
    expiresAt: coalesceOptional(env.VITE_DEV_SESSION_EXPIRES_AT),
  });
}

function parseAuthRole(input: string | undefined): AuthRole | null {
  if (!input) {
    return null;
  }

  return AUTH_ROLES.includes(input as AuthRole) ? (input as AuthRole) : null;
}

function coalesceNonEmpty(value: string | undefined, fallback: string): string {
  return value?.trim() ? value.trim() : fallback;
}

function coalesceOptional(value: string | undefined): string | undefined {
  return value?.trim() ? value.trim() : undefined;
}

function toDisplayName(role: AuthRole): string {
  return role
    .split("_")
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(" ");
}
