import type { AuthRole } from "./roles.ts";
import { DEFAULT_WORKBENCH_BY_ROLE, ROLE_WORKBENCHES } from "./workbench.ts";

export interface AuthSessionViewModel {
  userId: string;
  username: string;
  displayName: string;
  role: AuthRole;
  availableWorkbenches: readonly string[];
  defaultWorkbench: string;
  expiresAt?: string;
}

export function buildAuthSessionViewModel(
  session: Omit<AuthSessionViewModel, "availableWorkbenches" | "defaultWorkbench">,
): AuthSessionViewModel {
  return {
    ...session,
    availableWorkbenches: ROLE_WORKBENCHES[session.role],
    defaultWorkbench: DEFAULT_WORKBENCH_BY_ROLE[session.role],
  };
}
