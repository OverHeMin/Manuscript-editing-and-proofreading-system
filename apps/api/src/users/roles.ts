export const ROLE_KEYS = [
  "admin",
  "screener",
  "editor",
  "proofreader",
  "knowledge_reviewer",
  "user",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export const INTERNAL_TEAM_ROLE_KEYS = [
  "admin",
  "editor",
  "knowledge_reviewer",
] as const;

export type InternalTeamRoleKey = (typeof INTERNAL_TEAM_ROLE_KEYS)[number];
