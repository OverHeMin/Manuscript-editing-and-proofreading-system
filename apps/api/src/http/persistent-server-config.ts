import {
  resolvePersistentRuntimeContract,
  type PersistentAppEnv,
} from "../ops/persistent-runtime-contract.ts";

export interface PersistentServerConfig {
  appEnv: PersistentAppEnv;
  port: number;
  host: string;
  allowedOrigins: string[];
  databaseUrl: string;
  uploadRootDir: string;
}

export function resolvePersistentServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): PersistentServerConfig {
  const contract = resolvePersistentRuntimeContract(env);

  return {
    appEnv: contract.appEnv,
    port: contract.port,
    host: contract.host,
    allowedOrigins: contract.allowedOrigins,
    databaseUrl: contract.databaseUrl,
    uploadRootDir: contract.uploadRootDir,
  };
}
