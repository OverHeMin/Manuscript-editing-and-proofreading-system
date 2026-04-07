import type { RoleKey } from "./roles.ts";

export type UserAdminStatus = "active" | "disabled" | "locked";

export interface UserAdminRecord {
  id: string;
  username: string;
  displayName: string;
  role: RoleKey;
  status: UserAdminStatus;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserAdminRepository {
  listAll(): Promise<UserAdminRecord[]>;
  findByIdIncludingDisabled(userId: string): Promise<UserAdminRecord | null>;
  findByUsernameIncludingDisabled(username: string): Promise<UserAdminRecord | null>;
  create(record: UserAdminRecord): Promise<UserAdminRecord>;
  updateProfile(input: {
    userId: string;
    displayName: string;
    role: RoleKey;
    updatedAt: string;
  }): Promise<UserAdminRecord>;
  updatePasswordHash(input: {
    userId: string;
    passwordHash: string;
    updatedAt: string;
  }): Promise<UserAdminRecord>;
  updateStatus(input: {
    userId: string;
    status: UserAdminStatus;
    updatedAt: string;
  }): Promise<UserAdminRecord>;
  countActiveAdmins(excludingUserId?: string): Promise<number>;
}
