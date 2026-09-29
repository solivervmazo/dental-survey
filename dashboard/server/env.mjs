import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const projectRoot = resolve(import.meta.dirname, "..", "..");

export async function loadEnv() {
  const contents = await readFile(resolve(projectRoot, ".env"), "utf8");
  const values = {};
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const divider = line.indexOf("=");
    if (divider < 1) throw new Error("Invalid .env entry");
    const key = line.slice(0, divider).trim();
    values[key] = line.slice(divider + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  const connectionString = values.SUPABASE_DATABASE_URL;
  if (!connectionString) return { connectionString: null };
  const parsed = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) throw new Error("SUPABASE_DATABASE_URL must be a PostgreSQL URI");
  if (!parsed.hostname) throw new Error("SUPABASE_DATABASE_URL needs a hostname");
  const projectRef = new URL(values.SUPABASE_URL).hostname.split(".")[0];
  if (!parsed.hostname.includes(projectRef) && !decodeURIComponent(parsed.username).includes(projectRef)) {
    throw new Error("The database URI does not appear to belong to the Supabase project in SUPABASE_URL.");
  }
  return { connectionString };
}
