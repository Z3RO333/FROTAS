import { DBSQLClient } from "@databricks/sql";

// Server-only guard: throws if accidentally imported into a client bundle.
if (typeof window !== "undefined") {
  throw new Error("lib/db.ts can only be used on the server");
}

const SCHEMA = process.env.DATABRICKS_SCHEMA || "manutencao.cd";
export const SCHEMA_FQN = SCHEMA.toLowerCase();

let clientPromise: Promise<DBSQLClient> | null = null;

async function getClient(): Promise<DBSQLClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = new DBSQLClient();
      await client.connect({
        host: process.env.DATABRICKS_SERVER_HOSTNAME!,
        path: process.env.DATABRICKS_HTTP_PATH!,
        token: process.env.DATABRICKS_TOKEN!,
      });
      return client;
    })();
  }
  return clientPromise;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = await getClient();
  const session = await client.openSession();
  try {
    let bound = sql;
    if (params.length > 0) {
      let i = 0;
      bound = sql.replace(/\?/g, () => formatParam(params[i++]));
    }
    const op = await session.executeStatement(bound, { runAsync: true });
    const rows = await op.fetchAll();
    await op.close();
    return rows as T[];
  } finally {
    await session.close();
  }
}

function formatParam(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return `TIMESTAMP '${v.toISOString().replace("T", " ").replace("Z", "")}'`;
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

export async function execute(sql: string, params: unknown[] = []): Promise<void> {
  await query(sql, params);
}
