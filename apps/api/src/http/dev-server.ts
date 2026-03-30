import path from "node:path";
import { createApiHttpServer } from "./api-http-server.ts";
import { resolveDemoServerConfig } from "./demo-server-config.ts";
import { loadAppEnvDefaults } from "../ops/env-defaults.ts";

const appRoot = path.resolve(import.meta.dirname, "../..");

loadAppEnvDefaults(appRoot);

const config = resolveDemoServerConfig(process.env);
const server = createApiHttpServer({
  appEnv: config.appEnv,
  allowedOrigins: config.allowedOrigins,
  seedDemoKnowledgeReviewData: true,
});

server.listen(config.port, config.host, () => {
  console.log(
    `[api] demo runtime listening on http://${config.host}:${config.port} ` +
      "(in-memory data, local loopback only)",
  );
});
