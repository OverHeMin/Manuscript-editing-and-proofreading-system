import type { AuthSessionViewModel } from "../features/auth/index.ts";

const DEFAULT_DEMO_PASSWORD = "demo-password";
const DEMO_LOGIN_PATH = "/api/v1/auth/local/login";

let activeSessionBootstrapKey: string | null = null;
let activeSessionBootstrapPromise: Promise<void> | null = null;

export function resolveDemoBackendPassword(
  env: Pick<ImportMetaEnv, "VITE_DEMO_PASSWORD">,
): string {
  return env.VITE_DEMO_PASSWORD?.trim() || DEFAULT_DEMO_PASSWORD;
}

export async function ensureDemoBackendSession(
  session: Pick<AuthSessionViewModel, "username">,
  env: Pick<ImportMetaEnv, "VITE_API_BASE_URL" | "VITE_DEMO_PASSWORD"> = import.meta.env,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const loginUrl = resolveDemoBackendLoginUrl(env);
  const password = resolveDemoBackendPassword(env);
  const bootstrapKey = `${loginUrl}|${session.username}`;

  if (activeSessionBootstrapKey === bootstrapKey && activeSessionBootstrapPromise) {
    return activeSessionBootstrapPromise;
  }

  activeSessionBootstrapKey = bootstrapKey;
  activeSessionBootstrapPromise = (async () => {
    const response = await fetchImpl(loginUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: session.username,
        password,
      }),
    });

    if (!response.ok) {
      const errorBody = await readErrorBody(response);
      throw new Error(
        `Demo backend login failed (${response.status})${errorBody ? `: ${errorBody}` : ""}`,
      );
    }
  })().catch((error) => {
    activeSessionBootstrapKey = null;
    activeSessionBootstrapPromise = null;
    throw error;
  });

  return activeSessionBootstrapPromise;
}

function resolveDemoBackendLoginUrl(
  env: Pick<ImportMetaEnv, "VITE_API_BASE_URL">,
): string {
  const configuredBaseUrl = env.VITE_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return new URL(DEMO_LOGIN_PATH, ensureTrailingSlash(configuredBaseUrl)).toString();
  }

  if (typeof window !== "undefined" && window.location.origin.length > 0) {
    return new URL(DEMO_LOGIN_PATH, ensureTrailingSlash(window.location.origin)).toString();
  }

  return new URL(DEMO_LOGIN_PATH, "http://127.0.0.1/").toString();
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

async function readErrorBody(response: Response): Promise<string | null> {
  const text = (await response.text()).trim();
  if (!text) {
    return null;
  }

  try {
    const payload = JSON.parse(text) as { message?: unknown; error?: unknown };
    if (typeof payload.message === "string" && payload.message.trim().length > 0) {
      return payload.message.trim();
    }
    if (typeof payload.error === "string" && payload.error.trim().length > 0) {
      return payload.error.trim();
    }
  } catch {
    return text;
  }

  return text;
}
