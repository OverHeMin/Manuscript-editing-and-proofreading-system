export interface RuntimeLocationLike {
  origin: string;
  hostname: string;
}

export interface ResolveRuntimeBackendBaseUrlInput {
  configuredBaseUrl?: string;
  windowLocation?: RuntimeLocationLike;
  fallbackBaseUrl?: string;
}

export function resolveRuntimeBackendBaseUrl(
  input: ResolveRuntimeBackendBaseUrlInput,
): string {
  const configuredBaseUrl = input.configuredBaseUrl?.trim();
  if (configuredBaseUrl) {
    return maybeAlignConfiguredBackendHost(configuredBaseUrl, input.windowLocation);
  }

  if (input.windowLocation?.origin.trim()) {
    return input.windowLocation.origin.trim();
  }

  return input.fallbackBaseUrl ?? "http://localhost/";
}

export function maybeAlignConfiguredBackendHost(
  configuredBaseUrl: string,
  windowLocation?: RuntimeLocationLike,
): string {
  const resolvedUrl = new URL(configuredBaseUrl);
  const currentHostname = windowLocation?.hostname.trim();

  if (!currentHostname || currentHostname === resolvedUrl.hostname) {
    return resolvedUrl.toString();
  }

  if (!isLoopbackHost(currentHostname) && !isLoopbackHost(resolvedUrl.hostname)) {
    return resolvedUrl.toString();
  }

  resolvedUrl.hostname = currentHostname;
  return resolvedUrl.toString();
}

export function isLoopbackHost(hostname: string): boolean {
  const normalizedHost = hostname.trim().replace(/^\[|\]$/g, "").toLowerCase();

  return (
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1" ||
    normalizedHost === "0.0.0.0"
  );
}
