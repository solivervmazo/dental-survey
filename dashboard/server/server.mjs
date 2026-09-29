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

createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) { response.writeHead(403); response.end(); return; }
  if (!allowedOrigins.has(`http://${request.headers.host}`)) { response.writeHead(403); response.end(); return; }
  if (request.method !== "GET") { response.writeHead(405); response.end(); return; }
  try {
    const url = new URL(request.url || "/", "http://localhost");
    if (url.pathname === "/api/analytics") { await analytics(response); return; }
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
