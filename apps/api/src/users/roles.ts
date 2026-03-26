export const ROLE_KEYS = [
  "admin",
  "screener",
  "editor",
  "proofreader",
  "knowledge_reviewer",
  "user",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];
