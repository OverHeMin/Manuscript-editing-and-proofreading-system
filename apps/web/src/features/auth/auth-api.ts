import { BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import {
  buildAuthSessionViewModel,
  type AuthSessionViewModel,
} from "./session.ts";
import type { AuthRole } from "./roles.ts";

export interface AuthHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export interface BackendAuthSessionPayload {
  provider: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    role: AuthRole;
  };
  issuedAt: string;
  expiresAt: string;
  refreshAt: string;
}

export async function readCurrentAuthSession(
  client: AuthHttpClient,
): Promise<AuthSessionViewModel | null> {
  try {
    const response = await client.request<BackendAuthSessionPayload>({
      method: "GET",
      url: "/api/v1/auth/session",
    });
    return mapBackendAuthSessionToViewModel(response.body);
  } catch (error) {
    if (error instanceof BrowserHttpClientError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

export async function loginLocalAuthSession(
  client: AuthHttpClient,
  input: {
    username: string;
    password: string;
  },
): Promise<AuthSessionViewModel> {
  const response = await client.request<BackendAuthSessionPayload>({
    method: "POST",
    url: "/api/v1/auth/local/login",
    body: {
      username: input.username,
      password: input.password,
    },
  });

  return mapBackendAuthSessionToViewModel(response.body);
}

export async function logoutAuthSession(client: AuthHttpClient): Promise<void> {
  await client.request<null>({
    method: "POST",
    url: "/api/v1/auth/logout",
  });
}

export function mapBackendAuthSessionToViewModel(
  payload: BackendAuthSessionPayload,
): AuthSessionViewModel {
  return buildAuthSessionViewModel({
    userId: payload.user.id,
    username: payload.user.username,
    displayName: payload.user.displayName,
    role: payload.user.role,
    expiresAt: payload.expiresAt,
  });
}
