import type { KnowledgeHttpClient } from "../features/knowledge/knowledge-api.ts";

export interface BrowserHttpClientOptions {
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface BrowserHttpClientErrorDetails {
  method: "GET" | "POST";
  requestUrl: string;
  status: number;
  responseBody: unknown;
}

export class BrowserHttpClientError extends Error {
  readonly name = "BrowserHttpClientError";
  readonly method: BrowserHttpClientErrorDetails["method"];
  readonly requestUrl: string;
  readonly status: number;
  readonly responseBody: unknown;

  constructor(details: BrowserHttpClientErrorDetails) {
    super(`HTTP ${details.status} ${details.method} ${details.requestUrl}`);
    this.method = details.method;
    this.requestUrl = details.requestUrl;
    this.status = details.status;
    this.responseBody = details.responseBody;
  }
}

export function createBrowserHttpClient(
  options: BrowserHttpClientOptions = {},
): KnowledgeHttpClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async request<TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) {
      const requestUrl = resolveRequestUrl(input.url, options.apiBaseUrl);
      const requestBody = input.body == null ? undefined : JSON.stringify(input.body);
      const response = await fetchImpl(requestUrl, {
        method: input.method,
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(requestBody == null ? {} : { "Content-Type": "application/json" }),
        },
        body: requestBody,
      });
      const responseBody = await parseResponseBody(response);

      if (!response.ok) {
        throw new BrowserHttpClientError({
          method: input.method,
          requestUrl,
          status: response.status,
          responseBody,
        });
      }

      return {
        status: response.status,
        body: responseBody as TResponse,
      };
    },
  };
}

function resolveRequestUrl(pathOrUrl: string, apiBaseUrl?: string): string {
  if (isAbsoluteUrl(pathOrUrl)) {
    return pathOrUrl;
  }

  const normalizedBaseUrl = resolveApiBaseUrl(apiBaseUrl);
  return new URL(pathOrUrl, normalizedBaseUrl).toString();
}

function resolveApiBaseUrl(apiBaseUrl?: string): string {
  const configuredBaseUrl = apiBaseUrl ?? import.meta.env.VITE_API_BASE_URL;

  if (typeof configuredBaseUrl === "string" && configuredBaseUrl.trim().length > 0) {
    return ensureTrailingSlash(configuredBaseUrl.trim());
  }

  if (typeof window !== "undefined" && window.location.origin.length > 0) {
    return ensureTrailingSlash(window.location.origin);
  }

  return "http://localhost/";
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const text = await response.text();
  if (text.trim().length === 0) {
    return null;
  }

  const shouldParseJson =
    contentType.includes("application/json") || /^[\[{]/.test(text.trimStart());
  if (!shouldParseJson) {
    return text;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      rawBody: text,
      parseError: "invalid_json",
      parseErrorMessage: error instanceof Error ? error.message : "Unknown parse error",
    };
  }
}
