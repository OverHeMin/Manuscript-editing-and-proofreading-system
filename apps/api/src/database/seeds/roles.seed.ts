export interface RoleSeed {
  key: string;
  description: string;
}

type QueryableClient = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
};

export const SYSTEM_ROLES: RoleSeed[] = [
  { key: "admin", description: "Platform administrator with release and system controls." },
  { key: "screener", description: "Handles screening workflows and screening reports." },
  { key: "editor", description: "Handles medical editing workflows and edited manuscripts." },
  { key: "proofreader", description: "Handles proofreading review and final issue reporting." },
  {
    key: "knowledge_reviewer",
    description: "Reviews knowledge items and learning candidates before approval.",
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
