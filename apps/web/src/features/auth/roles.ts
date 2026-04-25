export const AUTH_ROLES = [
  "admin",
  "screener",
  "editor",
  "proofreader",
  "knowledge_reviewer",
  "user",
] as const;

export type AuthRole = (typeof AUTH_ROLES)[number];

export const INTERNAL_TEAM_AUTH_ROLES = [
  "admin",
  "editor",
  "knowledge_reviewer",
] as const;
