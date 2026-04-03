import {
  runPersistentStartupPreflight,
  type PersistentStartupPreflightResult,
} from "../ops/persistent-startup-preflight.ts";
import type { PersistentRuntimeContract } from "../ops/persistent-runtime-contract.ts";

export interface HttpServiceReadiness {
  status: "ready" | "not_ready";
  components: Record<string, "ok" | "failed">;
}

export interface HttpServiceHealthProvider {
  getLiveness(): { status: "ok" };
  getReadiness(): Promise<HttpServiceReadiness>;
}

export function createAlwaysReadyServiceHealthProvider(): HttpServiceHealthProvider {
  return {
    getLiveness() {
      return {
        status: "ok",
      };
    },
    async getReadiness() {
      return {
        status: "ready",
        components: {
          runtimeContract: "ok",
        },
      };
    },
  };
}

export function createPersistentServiceHealthProvider(input: {
  contract: PersistentRuntimeContract;
  startupPreflight: PersistentStartupPreflightResult;
  runPreflight?: (input: {
    contract: PersistentRuntimeContract;
  }) => Promise<PersistentStartupPreflightResult>;
}): HttpServiceHealthProvider {
  return {
    getLiveness() {
      return {
        status: "ok",
      };
    },
    async getReadiness() {
      if (input.startupPreflight.status !== "ready") {
        return {
          status: "not_ready",
          components: {
            runtimeContract: "failed",
            database: "failed",
            uploadRoot: "failed",
          },
        };
      }

      const preflight =
        (await input.runPreflight?.({
          contract: input.contract,
        })) ??
        (await runPersistentStartupPreflight({
          contract: input.contract,
        }));

      return {
        status: preflight.status === "ready" ? "ready" : "not_ready",
        components: {
          runtimeContract: preflight.components.runtimeContract.status,
          database: preflight.components.database.status,
          uploadRoot: preflight.components.uploadRoot.status,
        },
      };
    },
  };
}
