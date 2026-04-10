import {
  createSystemSettingsAiProvider,
  createSystemSettingsUser,
  disableSystemSettingsUser,
  enableSystemSettingsUser,
  listSystemSettingsAiProviders,
  listSystemSettingsUsers,
  resetSystemSettingsUserPassword,
  rotateSystemSettingsAiProviderCredential,
  testSystemSettingsAiProvider,
  updateSystemSettingsAiProvider,
  updateSystemSettingsUserProfile,
  type SystemSettingsHttpClient,
} from "./system-settings-api.ts";
import type {
  CreateAiProviderConnectionInput,
  CreateSystemSettingsUserInput,
  SystemSettingsAiProviderConnectionViewModel,
  SystemSettingsSummary,
  SystemSettingsUserViewModel,
  SystemSettingsWorkbenchOverview,
  UpdateAiProviderConnectionInput,
  UpdateSystemSettingsUserProfileInput,
} from "./types.ts";

export interface SystemSettingsReloadContext {
  selectedUserId?: string | null;
  selectedConnectionId?: string | null;
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
  createProviderConnectionAndReload(input: CreateAiProviderConnectionInput): Promise<{
    createdConnection: SystemSettingsAiProviderConnectionViewModel;
    overview: SystemSettingsWorkbenchOverview;
  }>;
  updateProviderConnectionAndReload(input: {
    connectionId: string;
    input: UpdateAiProviderConnectionInput;
  } & SystemSettingsReloadContext): Promise<{
    updatedConnection: SystemSettingsAiProviderConnectionViewModel;
    overview: SystemSettingsWorkbenchOverview;
  }>;
  rotateProviderCredentialAndReload(input: {
    connectionId: string;
    nextApiKey: string;
  } & SystemSettingsReloadContext): Promise<{
    updatedConnection: SystemSettingsAiProviderConnectionViewModel;
    overview: SystemSettingsWorkbenchOverview;
  }>;
  testProviderConnectionAndReload(input: {
    connectionId: string;
    testModelName: string;
  } & SystemSettingsReloadContext): Promise<{
    updatedConnection: SystemSettingsAiProviderConnectionViewModel;
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
          selectedConnectionId: input.selectedConnectionId,
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
          selectedConnectionId: input.selectedConnectionId,
        }),
      };
    },
    async disableUserAndReload(input) {
      const updatedUser = (await disableSystemSettingsUser(client, input.userId)).body;

      return {
        updatedUser,
        overview: await loadSystemSettingsOverview(client, {
          selectedUserId: input.selectedUserId ?? updatedUser.id,
          selectedConnectionId: input.selectedConnectionId,
        }),
      };
    },
    async enableUserAndReload(input) {
      const updatedUser = (await enableSystemSettingsUser(client, input.userId)).body;

      return {
        updatedUser,
        overview: await loadSystemSettingsOverview(client, {
          selectedUserId: input.selectedUserId ?? updatedUser.id,
          selectedConnectionId: input.selectedConnectionId,
        }),
      };
    },
    async createProviderConnectionAndReload(input) {
      const createdConnection = (await createSystemSettingsAiProvider(client, input)).body;

      return {
        createdConnection,
        overview: await loadSystemSettingsOverview(client, {
          selectedConnectionId: createdConnection.id,
        }),
      };
    },
    async updateProviderConnectionAndReload(input) {
      const updatedConnection = (
        await updateSystemSettingsAiProvider(client, input.connectionId, input.input)
      ).body;

      return {
        updatedConnection,
        overview: await loadSystemSettingsOverview(client, {
          selectedUserId: input.selectedUserId,
          selectedConnectionId: input.selectedConnectionId ?? updatedConnection.id,
        }),
      };
    },
    async rotateProviderCredentialAndReload(input) {
      const updatedConnection = (
        await rotateSystemSettingsAiProviderCredential(
          client,
          input.connectionId,
          input.nextApiKey,
        )
      ).body;

      return {
        updatedConnection,
        overview: await loadSystemSettingsOverview(client, {
          selectedUserId: input.selectedUserId,
          selectedConnectionId: input.selectedConnectionId ?? updatedConnection.id,
        }),
      };
    },
    async testProviderConnectionAndReload(input) {
      const updatedConnection = (
        await testSystemSettingsAiProvider(client, input.connectionId, input.testModelName)
      ).body;

      return {
        updatedConnection,
        overview: await loadSystemSettingsOverview(client, {
          selectedUserId: input.selectedUserId,
          selectedConnectionId: input.selectedConnectionId ?? updatedConnection.id,
        }),
      };
    },
  };
}

async function loadSystemSettingsOverview(
  client: SystemSettingsHttpClient,
  input: SystemSettingsReloadContext = {},
): Promise<SystemSettingsWorkbenchOverview> {
  const [userResponse, connectionResponse] = await Promise.all([
    listSystemSettingsUsers(client),
    listSystemSettingsAiProviders(client),
  ]);

  return buildOverview({
    users: userResponse.body,
    providerConnections: connectionResponse.body,
    preferredSelectedUserId: input.selectedUserId,
    preferredSelectedConnectionId: input.selectedConnectionId,
  });
}

function buildOverview(input: {
  users: SystemSettingsUserViewModel[];
  providerConnections: SystemSettingsAiProviderConnectionViewModel[];
  preferredSelectedUserId?: string | null;
  preferredSelectedConnectionId?: string | null;
}): SystemSettingsWorkbenchOverview {
  const summary: SystemSettingsSummary = {
    totalUsers: input.users.length,
    activeUsers: input.users.filter((user) => user.status === "active").length,
    disabledUsers: input.users.filter((user) => user.status === "disabled").length,
    adminUsers: input.users.filter((user) => user.role === "admin").length,
  };
  const selectedUser =
    (input.preferredSelectedUserId
      ? input.users.find((user) => user.id === input.preferredSelectedUserId)
      : undefined) ?? input.users[0] ?? null;
  const selectedConnection =
    (input.preferredSelectedConnectionId
      ? input.providerConnections.find(
          (connection) => connection.id === input.preferredSelectedConnectionId,
        )
      : undefined) ?? input.providerConnections[0] ?? null;

  return {
    users: input.users,
    summary,
    selectedUserId: selectedUser?.id ?? null,
    selectedUser,
    providerConnections: input.providerConnections,
    selectedConnectionId: selectedConnection?.id ?? null,
    selectedConnection,
  };
}
