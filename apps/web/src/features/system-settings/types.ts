import type { AuthRole } from "../auth/index.ts";

export type SystemSettingsUserStatus = "active" | "disabled" | "locked";

export interface SystemSettingsUserViewModel {
  id: string;
  username: string;
  displayName: string;
  role: AuthRole;
  status: SystemSettingsUserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettingsSummary {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  adminUsers: number;
}

export interface SystemSettingsWorkbenchOverview {
  users: SystemSettingsUserViewModel[];
  summary: SystemSettingsSummary;
  selectedUserId: string | null;
  selectedUser: SystemSettingsUserViewModel | null;
}

export interface CreateSystemSettingsUserInput {
  username: string;
  displayName: string;
  role: AuthRole;
  password: string;
}

export interface UpdateSystemSettingsUserProfileInput {
  displayName: string;
  role: AuthRole;
}
