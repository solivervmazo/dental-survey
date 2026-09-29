import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { loadEnv, projectRoot } from "./env.mjs";

const { connectionString } = await loadEnv();
if (!connectionString) throw new Error("Add SUPABASE_DATABASE_URL to .env before migrating.");
const sql = await readFile(resolve(projectRoot, "supabase", "schema.sql"), "utf8");
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("Survey tables and access policies are ready.");
} catch (error) {
  try { await client.query("rollback"); } catch { /* Connection may already be closed. */ }
  console.error("Migration failed:", error.code || error.name || "unknown error");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
