import type { UserRecord } from "./user.ts";

export interface UserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
  save(user: UserRecord): Promise<void>;
}
