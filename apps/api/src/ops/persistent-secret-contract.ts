import type { PersistentAppEnv } from "./persistent-runtime-contract.ts";

interface SecretPlaceholderGuard {
  envName: string;
  placeholderValues: Set<string>;
  requiredInProductionLike?: boolean;
}

const PRODUCTION_PLACEHOLDER_SECRET_GUARDS: SecretPlaceholderGuard[] = [
  {
    envName: "AI_PROVIDER_MASTER_KEY",
    placeholderValues: new Set([
      "place_holder_key",
      "change-me",
      "change-me-in-prod",
    ]),
    requiredInProductionLike: true,
  },
  {
    envName: "ONLYOFFICE_JWT_SECRET",
    placeholderValues: new Set(["change-me-in-prod"]),
  },
  {
    envName: "OBJECT_STORAGE_ACCESS_KEY",
    placeholderValues: new Set(["minioadmin"]),
  },
  {
    envName: "OBJECT_STORAGE_SECRET_KEY",
    placeholderValues: new Set(["minioadmin123"]),
  },
];

export function assertPersistentSecretContract(
  appEnv: PersistentAppEnv,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (appEnv !== "staging" && appEnv !== "production") {
    return;
  }

  for (const guard of PRODUCTION_PLACEHOLDER_SECRET_GUARDS) {
    const rawValue = env[guard.envName];
    const normalizedValue = rawValue?.trim();

    if (!normalizedValue) {
      if (guard.requiredInProductionLike) {
        throw new Error(
          `Persistent API runtime requires ${guard.envName} for APP_ENV="${appEnv}".`,
        );
      }

      continue;
    }

    if (
      guard.placeholderValues.has(normalizedValue) ||
      guard.placeholderValues.has(normalizedValue.toLowerCase())
    ) {
      throw new Error(
        `Persistent API runtime requires ${guard.envName} to be replaced for APP_ENV="${appEnv}".`,
      );
    }
  }
}
