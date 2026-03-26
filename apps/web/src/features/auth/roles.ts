export const AUTH_ROLES = [
  "admin",
  "screener",
  "editor",
  "proofreader",
  "knowledge_reviewer",
  "user",
] as const;

export type AuthRole = (typeof AUTH_ROLES)[number];
