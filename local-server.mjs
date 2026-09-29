import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const root = resolve(import.meta.dirname);
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://localhost");
    const pathname = decodeURIComponent(url.pathname);
    const requested = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
    const target = resolve(root, `.${requested}`);
    if (!target.startsWith(`${root}${sep}`) || !(target.includes(`${sep}dashboard${sep}`) || target.includes(`${sep}site${sep}`))) {
      response.writeHead(404); response.end("Not found"); return;
    }
    const file = await stat(target);
    if (!file.isFile()) { response.writeHead(404); response.end("Not found"); return; }
    response.writeHead(200, { "Content-Type": mime[extname(target)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(await readFile(target));
  } catch {
    response.writeHead(404); response.end("Not found");
  }
}).listen(4173, "127.0.0.1", () => {
  console.log("Dashboard: http://localhost:4173/dashboard/");
});
