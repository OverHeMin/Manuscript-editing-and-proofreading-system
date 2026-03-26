import type { AuthRole } from "./roles.ts";

export const ROLE_WORKBENCHES: Record<AuthRole, readonly string[]> = {
  admin: [
    "screening",
    "editing",
    "proofreading",
    "knowledge-review",
    "admin-console",
  ],
  screener: ["screening"],
  editor: ["editing"],
  proofreader: ["proofreading"],
  knowledge_reviewer: ["knowledge-review"],
  user: ["submission"],
};

export const DEFAULT_WORKBENCH_BY_ROLE: Record<AuthRole, string> = {
  admin: "admin-console",
  screener: "screening",
  editor: "editing",
  proofreader: "proofreading",
  knowledge_reviewer: "knowledge-review",
  user: "submission",
};
