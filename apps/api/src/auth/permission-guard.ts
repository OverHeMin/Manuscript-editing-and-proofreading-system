import type { RoleKey } from "../users/roles.ts";

export const PERMISSIONS = [
  "workbench.screening",
  "workbench.editing",
  "workbench.proofreading",
  "knowledge.review",
  "permissions.manage",
  "manuscripts.submit",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const PERMISSIONS_BY_ROLE: Record<RoleKey, readonly Permission[]> = {
  admin: PERMISSIONS,
  screener: ["workbench.screening"],
  editor: ["workbench.editing"],
  proofreader: ["workbench.proofreading"],
  knowledge_reviewer: ["knowledge.review"],
  user: ["manuscripts.submit"],
};

export class AuthorizationError extends Error {
  constructor(role: RoleKey, permission: Permission) {
    super(`Role "${role}" is not allowed to use "${permission}".`);
    this.name = "AuthorizationError";
  }
}

export class PermissionGuard {
  can(role: RoleKey, permission: Permission): boolean {
    return PERMISSIONS_BY_ROLE[role].includes(permission);
  }

  assert(role: RoleKey, permission: Permission): void {
    if (!this.can(role, permission)) {
      throw new AuthorizationError(role, permission);
    }
  }

  permissionsFor(role: RoleKey): readonly Permission[] {
    return PERMISSIONS_BY_ROLE[role];
  }
}
