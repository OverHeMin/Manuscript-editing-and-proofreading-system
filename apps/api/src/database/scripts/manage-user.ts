import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { PostgresAuditService } from "../../audit/index.ts";
import { PostgresAuthSessionRepository } from "../../auth/postgres-auth-session-repository.ts";
import { PostgresLoginAttemptStore } from "../../auth/postgres-login-attempt-store.ts";
import { BcryptPasswordHasher } from "../../auth/password-hasher.ts";
import { loadAppEnvDefaults } from "../../ops/env-defaults.ts";
import {
  PostgresUserAdminRepository,
} from "../../users/postgres-user-admin-repository.ts";
import { ROLE_KEYS, type RoleKey } from "../../users/roles.ts";
import { UserAdminService } from "../../users/user-admin-service.ts";
import { getDatabaseUrl } from "../config.ts";

const appRoot = path.resolve(import.meta.dirname, "../../..");

export async function runManageUserCli(args: string[] = process.argv.slice(2)): Promise<void> {
  loadAppEnvDefaults(appRoot);

  const command = args[0];
  if (!command || command === "help" || command === "--help") {
    printUsage();
    return;
  }

  const client = new Client({ connectionString: getDatabaseUrl() });
  await client.connect();

  try {
    const repository = new PostgresUserAdminRepository({ client });
    const service = new UserAdminService({
      repository,
      authSessionRepository: new PostgresAuthSessionRepository({ client }),
      loginAttemptStore: new PostgresLoginAttemptStore({ client }),
      auditService: new PostgresAuditService({ client }),
      passwordHasher: new BcryptPasswordHasher(),
    });

    switch (command) {
      case "create": {
        const created = await service.createUser({
          actorId: "system-cli",
          username: requireOption(args, "--username"),
          displayName: requireOption(args, "--display-name"),
          role: parseRole(requireOption(args, "--role")),
          password: requireOption(args, "--password"),
        });
        console.log(
          `Created user ${created.username} (${created.id}) with role=${created.role} status=${created.status}.`,
        );
        return;
      }
      case "reset-password": {
        const updated = await service.resetPassword({
          actorId: "system-cli",
          userId: await resolveTargetUserId(repository, args),
          nextPassword: requireOption(args, "--password"),
        });
        console.log(`Reset password for ${updated.username} (${updated.id}).`);
        return;
      }
      case "disable": {
        const updated = await service.disableUser({
          actorId: "system-cli",
          userId: await resolveTargetUserId(repository, args),
        });
        console.log(`Disabled user ${updated.username} (${updated.id}).`);
        return;
      }
      case "enable": {
        const updated = await service.enableUser({
          actorId: "system-cli",
          userId: await resolveTargetUserId(repository, args),
        });
        console.log(`Enabled user ${updated.username} (${updated.id}).`);
        return;
      }
      default:
        throw new Error(`Unknown command "${command}".`);
    }
  } finally {
    await client.end();
  }
}

async function resolveTargetUserId(
  repository: PostgresUserAdminRepository,
  args: string[],
): Promise<string> {
  const userId = readOption(args, "--user-id");
  if (userId) {
    return userId;
  }

  const username = requireOption(args, "--username");
  const user = await repository.findByUsernameIncludingDisabled(username);
  if (!user) {
    throw new Error(`User "${username}" was not found.`);
  }

  return user.id;
}

function parseRole(value: string): RoleKey {
  if ((ROLE_KEYS as readonly string[]).includes(value)) {
    return value as RoleKey;
  }

  throw new Error(
    `Unknown role "${value}". Expected one of: ${ROLE_KEYS.join(", ")}.`,
  );
}

function requireOption(args: string[], name: string): string {
  const value = readOption(args, name);
  if (!value) {
    throw new Error(`Missing required option ${name}.`);
  }

  return value;
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.findIndex((candidate) => candidate === name);
  if (index < 0) {
    return undefined;
  }

  const value = args[index + 1];
  return value?.trim() ? value.trim() : undefined;
}

function printUsage(): void {
  console.log(`Usage:
  pnpm db:manage-user -- create --username <name> --display-name <display> --role <role> --password <password>
  pnpm db:manage-user -- reset-password (--user-id <id> | --username <name>) --password <password>
  pnpm db:manage-user -- disable (--user-id <id> | --username <name>)
  pnpm db:manage-user -- enable (--user-id <id> | --username <name>)`);
}

if (isDirectExecution()) {
  runManageUserCli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

function isDirectExecution(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return false;
  }

  return fileURLToPath(import.meta.url) === path.resolve(entrypoint);
}
