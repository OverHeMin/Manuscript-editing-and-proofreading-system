import type { AuthSessionViewModel } from "../features/auth/index.ts";
import {
  loginLocalAuthSession,
  logoutAuthSession,
  readCurrentAuthSession,
  type AuthHttpClient,
} from "../features/auth/auth-api.ts";

export type WorkbenchRuntimeMode = "demo" | "persistent";

export function resolveWorkbenchRuntimeMode(
  env: Pick<ImportMetaEnv, "VITE_APP_ENV">,
): WorkbenchRuntimeMode {
  const appEnv = env.VITE_APP_ENV?.trim();
  return !appEnv || appEnv === "local" ? "demo" : "persistent";
}

export function bootstrapPersistentWorkbenchSession(
  client: AuthHttpClient,
): Promise<AuthSessionViewModel | null> {
  return readCurrentAuthSession(client);
}

export function loginPersistentWorkbenchSession(
  client: AuthHttpClient,
  input: {
    username: string;
    password: string;
  },
): Promise<AuthSessionViewModel> {
  return loginLocalAuthSession(client, input);
}

export function logoutPersistentWorkbenchSession(
  client: AuthHttpClient,
): Promise<void> {
  return logoutAuthSession(client);
}
