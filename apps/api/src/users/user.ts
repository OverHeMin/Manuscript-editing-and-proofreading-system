import type { RoleKey } from "./roles.ts";

export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  role: RoleKey;
  passwordHash: string;
}

export type PublicUser = Omit<UserRecord, "passwordHash">;
