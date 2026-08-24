import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

const databaseGlobal = globalThis as typeof globalThis & {
  __kinhMatSql?: ReturnType<typeof postgres>;
  __kinhMatDb?: Database;
};

export function getDb(): Database {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL chưa được cấu hình.");
  }

  if (!databaseGlobal.__kinhMatSql) {
    databaseGlobal.__kinhMatSql = postgres(connectionString, {
      max: process.env.NODE_ENV === "production" ? 5 : 1,
      prepare: false,
    });
  }

  if (!databaseGlobal.__kinhMatDb) {
    databaseGlobal.__kinhMatDb = drizzle(databaseGlobal.__kinhMatSql, { schema });
  }

  return databaseGlobal.__kinhMatDb;
}
