import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = import.meta.dirname;
const env = Object.fromEntries((await readFile(resolve(root, ".env"), "utf8"))
  .split(/\r?\n/)
  .filter(line => line.trim() && !line.trimStart().startsWith("#"))
  .map(line => {
    const divider = line.indexOf("=");
    if (divider < 1) throw new Error("Invalid .env line");
    return [line.slice(0, divider).trim(), line.slice(divider + 1).trim().replace(/^['"]|['"]$/g, "")];
  }));

const url = env.SUPABASE_URL;
const key = env.SUPABASE_PUBLISHABLE_KEY;
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url || "")) throw new Error("SUPABASE_URL must be a Supabase HTTPS project URL.");
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key || "")) throw new Error("Only a Supabase publishable key is allowed in the public site config.");

await writeFile(resolve(root, "site", "config.js"),
  `// Generated from .env. Safe to publish: only the project URL and publishable key.\nexport const SUPABASE_URL = ${JSON.stringify(url)};\nexport const SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(key)};\n`, "utf8");
console.log("Updated site/config.js with public Supabase values.");
