import path from "node:path";
import { Pool } from "pg";
import { createApiHttpServer } from "./api-http-server.ts";
import { createPersistentGovernanceRuntime } from "./persistent-governance-runtime.ts";
import { createPersistentHttpAuthRuntime } from "./persistent-auth-runtime.ts";
import { resolvePersistentServerConfig } from "./persistent-server-config.ts";
import { loadAppEnvDefaults } from "../ops/env-defaults.ts";

const appRoot = path.resolve(import.meta.dirname, "../..");

loadAppEnvDefaults(appRoot);

const config = resolvePersistentServerConfig(process.env);
const pool = new Pool({
  connectionString: config.databaseUrl,
});
const authRuntime = createPersistentHttpAuthRuntime({
  client: pool,
  secureCookies: config.appEnv === "staging" || config.appEnv === "production",
});
const server = createApiHttpServer({
  appEnv: config.appEnv,
  allowedOrigins: config.allowedOrigins,
  seedDemoKnowledgeReviewData: false,
  uploadRootDir: config.uploadRootDir,
  runtime: createPersistentGovernanceRuntime({
    client: pool,
    authRuntime,
  }),
});

server.on("close", () => {
  void pool.end();
});

server.listen(config.port, config.host, () => {
  console.log(
    `[api] persistent runtime listening on http://${config.host}:${config.port} ` +
      `(${config.appEnv}, PostgreSQL-backed auth and governance registries)`,
  );
});
