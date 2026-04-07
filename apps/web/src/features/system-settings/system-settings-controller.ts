import {
  createSystemSettingsUser,
  disableSystemSettingsUser,
  enableSystemSettingsUser,
  listSystemSettingsUsers,
  resetSystemSettingsUserPassword,
  updateSystemSettingsUserProfile,
  type SystemSettingsHttpClient,
} from "./system-settings-api.ts";
import type {
  CreateSystemSettingsUserInput,
  SystemSettingsSummary,
  SystemSettingsUserViewModel,
  SystemSettingsWorkbenchOverview,
  UpdateSystemSettingsUserProfileInput,
} from "./types.ts";

export interface SystemSettingsReloadContext {
  selectedUserId?: string | null;
}

export interface SystemSettingsWorkbenchController {
  loadOverview(input?: SystemSettingsReloadContext): Promise<SystemSettingsWorkbenchOverview>;
  createUserAndReload(input: CreateSystemSettingsUserInput): Promise<{
    createdUser: SystemSettingsUserViewModel;
    overview: SystemSettingsWorkbenchOverview;
  }>;
  updateUserProfileAndReload(input: {
    userId: string;
    input: UpdateSystemSettingsUserProfileInput;
  } & SystemSettingsReloadContext): Promise<{
    updatedUser: SystemSettingsUserViewModel;
    overview: SystemSettingsWorkbenchOverview;
  }>;
  resetUserPasswordAndReload(input: {
    userId: string;
    nextPassword: string;
  } & SystemSettingsReloadContext): Promise<{
    updatedUser: SystemSettingsUserViewModel;
    overview: SystemSettingsWorkbenchOverview;
  }>;
  disableUserAndReload(input: {
    userId: string;
  } & SystemSettingsReloadContext): Promise<{
    updatedUser: SystemSettingsUserViewModel;
    overview: SystemSettingsWorkbenchOverview;
  }>;
  enableUserAndReload(input: {
    userId: string;
  } & SystemSettingsReloadContext): Promise<{
    updatedUser: SystemSettingsUserViewModel;
    overview: SystemSettingsWorkbenchOverview;
  }>;
}

export function createSystemSettingsWorkbenchController(
  client: SystemSettingsHttpClient,
): SystemSettingsWorkbenchController {
  return {
    loadOverview(input) {
      return loadSystemSettingsOverview(client, input);
    },
    async createUserAndReload(input) {
      const createdUser = (await createSystemSettingsUser(client, input)).body;

      return {
        createdUser,
        overview: await loadSystemSettingsOverview(client, {
          selectedUserId: createdUser.id,
        }),
      };
    },
    async updateUserProfileAndReload(input) {
      const updatedUser = (
        await updateSystemSettingsUserProfile(client, input.userId, input.input)
      ).body;

      return {
        updatedUser,
        overview: await loadSystemSettingsOverview(client, {
          selectedUserId: input.selectedUserId ?? updatedUser.id,
        }),
      };
    },
    async resetUserPasswordAndReload(input) {
      const updatedUser = (
        await resetSystemSettingsUserPassword(client, input.userId, input.nextPassword)
      ).body;

      return {
        updatedUser,
        overview: await loadSystemSettingsOverview(client, {
          selectedUserId: input.selectedUserId ?? updatedUser.id,
        }),
      };
    },
    async disableUserAndReload(input) {
      const updatedUser = (await disableSystemSettingsUser(client, input.userId)).body;

      return {
        updatedUser,
        overview: await loadSystemSettingsOverview(client, {
          selectedUserId: input.selectedUserId ?? updatedUser.id,
        }),
      };
    },
    async enableUserAndReload(input) {
      const updatedUser = (await enableSystemSettingsUser(client, input.userId)).body;

      return {
        updatedUser,
        overview: await loadSystemSettingsOverview(client, {
          selectedUserId: input.selectedUserId ?? updatedUser.id,
        }),
      };
    },
  };
}

async function loadSystemSettingsOverview(
  client: SystemSettingsHttpClient,
  input: SystemSettingsReloadContext = {},
): Promise<SystemSettingsWorkbenchOverview> {
  const response = await listSystemSettingsUsers(client);
  return buildOverview(response.body, input.selectedUserId);
}

function buildOverview(
  users: SystemSettingsUserViewModel[],
  preferredSelectedUserId?: string | null,
): SystemSettingsWorkbenchOverview {
  const summary: SystemSettingsSummary = {
    totalUsers: users.length,
    activeUsers: users.filter((user) => user.status === "active").length,
    disabledUsers: users.filter((user) => user.status === "disabled").length,
    adminUsers: users.filter((user) => user.role === "admin").length,
  };
  const selectedUser =
    (preferredSelectedUserId
      ? users.find((user) => user.id === preferredSelectedUserId)
      : undefined) ?? users[0] ?? null;

  return {
    users,
    summary,
    selectedUserId: selectedUser?.id ?? null,
    selectedUser,
  };
}
