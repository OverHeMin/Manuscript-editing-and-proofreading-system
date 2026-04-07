import type { RoleKey } from "./roles.ts";
import type { UserAdminRecord } from "./user-admin-repository.ts";
import { UserAdminService } from "./user-admin-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface UserAdminApiRecord {
  id: string;
  username: string;
  displayName: string;
  role: RoleKey;
  status: UserAdminRecord["status"];
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserAdminApiOptions {
  userAdminService: UserAdminService;
}

export function createUserAdminApi(options: CreateUserAdminApiOptions) {
  const { userAdminService } = options;

  return {
    async listUsers(): Promise<RouteResponse<UserAdminApiRecord[]>> {
      return {
        status: 200,
        body: (await userAdminService.listUsers()).map(toApiRecord),
      };
    },

    async createUser({
      actorId,
      actorRole,
      input,
    }: {
      actorId: string;
      actorRole: RoleKey;
      input: {
        username: string;
        displayName: string;
        role: RoleKey;
        password: string;
      };
    }): Promise<RouteResponse<UserAdminApiRecord>> {
      return {
        status: 201,
        body: toApiRecord(
          await userAdminService.createUser({
            actorId,
            actorRole,
            ...input,
          }),
        ),
      };
    },

    async updateUserProfile({
      actorId,
      actorRole,
      userId,
      input,
    }: {
      actorId: string;
      actorRole: RoleKey;
      userId: string;
      input: {
        displayName: string;
        role: RoleKey;
      };
    }): Promise<RouteResponse<UserAdminApiRecord>> {
      return {
        status: 200,
        body: toApiRecord(
          await userAdminService.updateUserProfile({
            actorId,
            actorRole,
            userId,
            ...input,
          }),
        ),
      };
    },

    async resetUserPassword({
      actorId,
      actorRole,
      userId,
      nextPassword,
    }: {
      actorId: string;
      actorRole: RoleKey;
      userId: string;
      nextPassword: string;
    }): Promise<RouteResponse<UserAdminApiRecord>> {
      return {
        status: 200,
        body: toApiRecord(
          await userAdminService.resetPassword({
            actorId,
            actorRole,
            userId,
            nextPassword,
          }),
        ),
      };
    },

    async disableUser({
      actorId,
      actorRole,
      userId,
    }: {
      actorId: string;
      actorRole: RoleKey;
      userId: string;
    }): Promise<RouteResponse<UserAdminApiRecord>> {
      return {
        status: 200,
        body: toApiRecord(
          await userAdminService.disableUser({
            actorId,
            actorRole,
            userId,
          }),
        ),
      };
    },

    async enableUser({
      actorId,
      actorRole,
      userId,
    }: {
      actorId: string;
      actorRole: RoleKey;
      userId: string;
    }): Promise<RouteResponse<UserAdminApiRecord>> {
      return {
        status: 200,
        body: toApiRecord(
          await userAdminService.enableUser({
            actorId,
            actorRole,
            userId,
          }),
        ),
      };
    },
  };
}

function toApiRecord(record: UserAdminRecord): UserAdminApiRecord {
  return {
    id: record.id,
    username: record.username,
    displayName: record.displayName,
    role: record.role,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
