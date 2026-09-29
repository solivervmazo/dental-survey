import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import pg from "pg";
import { loadEnv, projectRoot } from "./env.mjs";

const { connectionString } = await loadEnv();
const pool = connectionString ? new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 10000 }) : null;
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".txt": "text/plain; charset=utf-8" };
const allowedOrigins = new Set(["http://localhost:4173", "http://127.0.0.1:4173"]);

function json(response, code, body) {
  response.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(body));
}

async function analytics(response) {
  if (!pool) { json(response, 503, { error: "Add SUPABASE_DATABASE_URL to .env and restart the dashboard server." }); return; }
  try {
    const [counts, roleCounts, dailyCounts, records] = await Promise.all([
      pool.query("select (select count(*)::int from public.survey_visits) as visits, (select count(*)::int from public.survey_responses) as responses, (select count(*)::int from public.survey_responses where status = 'completed') as complete"),
      pool.query("select role, count(*)::int as total from public.survey_responses group by role"),
      pool.query("select to_char(created_at at time zone 'Asia/Manila', 'YYYY-MM-DD') as day, count(*)::int as total from public.survey_visits where created_at >= now() - interval '8 days' group by 1 order by 1"),
      pool.query("select id, role, status, answers, created_at from public.survey_responses order by created_at desc limit 10000"),
    ]);
    json(response, 200, { ...counts.rows[0], roles: roleCounts.rows, daily: dailyCounts.rows, records: records.rows });
  } catch (error) {
    console.error("Dashboard query failed:", error.code || error.name || "unknown error");
    json(response, 503, { error: "Could not read survey data. Check the database connection and migration." });
  }
}

async function latest(response) {
  if (!pool) { json(response, 503, { error: "Add SUPABASE_DATABASE_URL to .env and restart the dashboard server." }); return; }
  try {
    const result = await pool.query("select (select count(*)::int from public.survey_visits) as visits, (select count(*)::int from public.survey_responses) as responses");
    json(response, 200, result.rows[0]);
  } catch (error) {
    console.error("Dashboard latest-count query failed:", error.code || error.name || "unknown error");
    json(response, 503, { error: "Could not check for new responses." });
  }
}

async function resetData(request, response) {
  if (!pool) { json(response, 503, { error: "Add SUPABASE_DATABASE_URL to .env and restart the dashboard server." }); return; }
  if (!String(request.headers["content-type"] || "").startsWith("application/json")) {
    json(response, 415, { error: "Expected JSON." }); return;
  }
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 128) { json(response, 413, { error: "Request too large." }); return; }
  }
  try {
    if (JSON.parse(body).confirmation !== "RESET SURVEY DATA") {
      json(response, 400, { error: "Confirmation phrase did not match." }); return;
    }
  } catch {
    json(response, 400, { error: "Invalid JSON." }); return;
  }
  let client;
  try {
    client = await pool.connect();
    await client.query("begin");
    const before = await client.query("select (select count(*)::int from public.survey_visits) as visits, (select count(*)::int from public.survey_responses) as responses");
    await client.query("truncate table public.survey_visits, public.survey_responses");
    await client.query("commit");
    json(response, 200, before.rows[0]);
  } catch (error) {
    if (client) await client.query("rollback").catch(() => {});
    console.error("Dashboard reset failed:", error.code || error.name || "unknown error");
    json(response, 503, { error: "Could not clear research data. Check the database connection." });
  } finally {
    client?.release();
  }
}

createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) { response.writeHead(403); response.end(); return; }
  if (!allowedOrigins.has(`http://${request.headers.host}`)) { response.writeHead(403); response.end(); return; }
  try {
    const url = new URL(request.url || "/", "http://localhost");
    if (url.pathname === "/api/reset") {
      if (request.method !== "POST") { response.writeHead(405); response.end(); return; }
      await resetData(request, response); return;
    }
    if (request.method !== "GET") { response.writeHead(405); response.end(); return; }
    if (url.pathname === "/api/analytics") { await analytics(response); return; }
    if (url.pathname === "/api/latest") { await latest(response); return; }
    const pathname = decodeURIComponent(url.pathname);
    const requested = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
    const target = resolve(projectRoot, `.${requested}`);
    if (!target.startsWith(`${projectRoot}${sep}`) || !(target.includes(`${sep}dashboard${sep}`) || target.includes(`${sep}site${sep}`))) {
      response.writeHead(404); response.end("Not found"); return;
    }
    const file = await stat(target);
    if (!file.isFile()) { response.writeHead(404); response.end("Not found"); return; }
    response.writeHead(200, { "Content-Type": mime[extname(target)] || "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(await readFile(target));
  } catch {
    response.writeHead(404); response.end("Not found");
  }
}).listen(4173, "127.0.0.1", () => {
  console.log("Survey preview: http://localhost:4173/site/");
  console.log("Local dashboard: http://localhost:4173/dashboard/");
});
