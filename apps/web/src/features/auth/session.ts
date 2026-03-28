import type { AuthRole } from "./roles.ts";
import {
  DEFAULT_WORKBENCH_BY_ROLE,
  listWorkbenchesForRole,
  ROLE_WORKBENCHES,
  type WorkbenchEntry,
  type WorkbenchId,
} from "./workbench.ts";

export interface AuthSessionViewModel {
  userId: string;
  username: string;
  displayName: string;
  role: AuthRole;
  availableWorkbenches: readonly WorkbenchId[];
  availableWorkbenchEntries: readonly WorkbenchEntry[];
  defaultWorkbench: WorkbenchId;
  expiresAt?: string;
}

export function buildAuthSessionViewModel(
  session: Omit<
    AuthSessionViewModel,
    "availableWorkbenches" | "availableWorkbenchEntries" | "defaultWorkbench"
  >,
): AuthSessionViewModel {
  return {
    ...session,
    availableWorkbenches: ROLE_WORKBENCHES[session.role],
    availableWorkbenchEntries: listWorkbenchesForRole(session.role),
    defaultWorkbench: DEFAULT_WORKBENCH_BY_ROLE[session.role],
  };
}
