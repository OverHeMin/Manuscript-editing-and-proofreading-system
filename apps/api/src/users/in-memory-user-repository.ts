import type { UserRecord } from "./user.ts";
import type { UserRepository } from "./user-repository.ts";

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export class InMemoryUserRepository implements UserRepository {
  private readonly usersByUsername = new Map<string, UserRecord>();

  async findByUsername(username: string): Promise<UserRecord | null> {
    return this.usersByUsername.get(normalizeUsername(username)) ?? null;
  }

  async save(user: UserRecord): Promise<void> {
    this.usersByUsername.set(normalizeUsername(user.username), {
      ...user,
      username: normalizeUsername(user.username),
    });
  }
}
