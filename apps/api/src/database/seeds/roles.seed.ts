export interface RoleSeed {
  key: string;
  description: string;
}

type QueryableClient = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
};

export const SYSTEM_ROLES: RoleSeed[] = [
  { key: "admin", description: "Platform administrator with release and system controls." },
  { key: "screener", description: "Legacy screening-only compatibility role." },
  {
    key: "editor",
    description: "Internal manuscript operator for screening, editing, and proofreading workflows.",
  },
  { key: "proofreader", description: "Legacy proofreading-only compatibility role." },
  {
    key: "knowledge_reviewer",
    description:
      "Internal knowledge governance operator with manuscript-operator access and knowledge review controls.",
  },
  { key: "user", description: "Standard manuscript submitter and case owner." },
];

export async function seedRoles(client: QueryableClient): Promise<void> {
  for (const role of SYSTEM_ROLES) {
    await client.query(
      `
        insert into roles (key, description)
        values ($1, $2)
        on conflict (key) do update
        set description = excluded.description
      `,
      [role.key, role.description],
    );
  }
}
