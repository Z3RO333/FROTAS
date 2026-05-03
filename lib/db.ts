import { DBSQLClient } from "@databricks/sql";
import type { DBSQLParameter, DBSQLParameterValue } from "@databricks/sql/dist/DBSQLParameter";

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

const LOG_QUERIES =
  process.env.DATABRICKS_LOG_QUERIES === "1" ||
  (process.env.NODE_ENV !== "production" && process.env.DATABRICKS_LOG_QUERIES !== "0");

export type QueryParam = DBSQLParameter | DBSQLParameterValue;

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: QueryParam[] = []
): Promise<T[]> {
  const start = LOG_QUERIES ? performance.now() : 0;
  const client = await getClient();
  const session = await client.openSession();
  try {
    const op = await session.executeStatement(sql, {
      ordinalParameters: params,
    });
    const rows = await op.fetchAll();
    await op.close();
    if (LOG_QUERIES) {
      const ms = (performance.now() - start).toFixed(0);
      const preview = sql.replace(/\s+/g, " ").trim().slice(0, 90);
      console.log(`[db] ${ms}ms ${rows.length}rows :: ${preview}`);
    }
    return rows as T[];
  } finally {
    await session.close();
  }
}

export async function execute(sql: string, params: QueryParam[] = []): Promise<void> {
  await query(sql, params);
}
