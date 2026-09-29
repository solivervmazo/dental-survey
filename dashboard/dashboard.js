import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../site/config.js";

const apiBase = SUPABASE_URL.replace(/\/$/, "");
const loginPanel = document.getElementById("login-panel");
const dashboardPanel = document.getElementById("dashboard-panel");
const loginError = document.getElementById("login-error");
const dashboardError = document.getElementById("dashboard-error");
let session = null;
let rows = [];

function showError(element, message) { element.textContent = message; element.hidden = !message; }
function showDashboard() { loginPanel.hidden = true; dashboardPanel.hidden = false; document.getElementById("sign-out").hidden = false; }
function showLogin() { loginPanel.hidden = false; dashboardPanel.hidden = true; document.getElementById("sign-out").hidden = true; }

async function authRequest(path, body) {
  const response = await fetch(`${apiBase}/auth/v1/${path}`, { method: "POST", headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.msg || data.error || "Sign in failed.");
  return data;
}

async function ensureToken() {
  if (!session) throw new Error("Sign in again to continue.");
  if (Date.now() < session.expiresAt - 30000) return session.access_token;
  const refreshed = await authRequest("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
  session = { ...refreshed, expiresAt: Date.now() + refreshed.expires_in * 1000 };
  sessionStorage.setItem("survey-admin-session", JSON.stringify(session));
  return session.access_token;
}

async function selectTable(table, columns) {
  const token = await ensureToken();
  const all = [];
  while (all.length < 10000) {
    const response = await fetch(`${apiBase}/rest/v1/${table}?select=${encodeURIComponent(columns)}&order=created_at.desc&limit=1000&offset=${all.length}`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Could not load ${table} (${response.status}). Check the admin policy and project setup.`);
    const page = await response.json();
    all.push(...page);
    if (page.length < 1000) break;
  }
  return all;
}

function renderBars(target, items) {
  const container = document.getElementById(target);
  container.replaceChildren();
  const max = Math.max(1, ...items.map(item => item[1]));
  items.forEach(([label, count]) => {
    const row = document.createElement("div"); row.className = "bar-row";
    const name = document.createElement("span"); name.textContent = label;
    const bar = document.createElement("span"); bar.className = "bar";
    const fill = document.createElement("i"); fill.style.width = `${count / max * 100}%`; bar.append(fill);
    const value = document.createElement("strong"); value.textContent = String(count);
    row.append(name, bar, value); container.append(row);
  });
}

function renderResponses(responses) {
  const body = document.getElementById("response-rows"); body.replaceChildren();
  if (!responses.length) { const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = 4; td.className = "empty"; td.textContent = "No responses yet."; tr.append(td); body.append(tr); return; }
  responses.forEach(response => {
    const tr = document.createElement("tr");
    const date = document.createElement("td"); date.textContent = new Date(response.created_at).toLocaleString();
    const role = document.createElement("td"); role.textContent = ({ owner: "Owner / manager", receptionist: "Receptionist", dentist: "Dentist" })[response.role] || response.role;
    const statusCell = document.createElement("td"); const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = response.status === "screened_out" ? "Early exit" : "Complete"; statusCell.append(tag);
    const labels = {
      owner_1: "Arranges duty", owner_2: "Needed extra coverage", owner_3: "Frequency", owner_4: "Reason", owner_5: "Notice", owner_6: "First action", owner_7: "Dentists contacted", owner_8: "Outcome", owner_9: "Patient impact", owner_10: "Staff time",
      receptionist_1: "Arranges schedules", receptionist_2: "Handled open duty", receptionist_3: "Availability source", receptionist_4: "Dentists contacted", receptionist_5: "Time to confirm", receptionist_6: "Schedule record", receptionist_7: "Patient impact",
      dentist_1: "Multiple clinics", dentist_2: "Additional duty request", dentist_3: "Clinics worked", dentist_4: "Offer frequency", dentist_5: "Notice", dentist_6: "Reason declined", dentist_7: "Schedule tracking", dentist_8: "Schedule conflict"
    };
    const answers = document.createElement("td"); answers.className = "answers"; answers.textContent = Object.entries(response.answers || {}).map(([key, value]) => `${labels[key] || key}: ${value}`).join(" · ");
    tr.append(date, role, statusCell, answers); body.append(tr);
  });
}

async function load() {
  showError(dashboardError, "");
  try {
    const [visits, responses] = await Promise.all([selectTable("survey_visits", "id,created_at"), selectTable("survey_responses", "id,role,status,answers,created_at")]);
    rows = responses;
    const complete = responses.filter(item => item.status === "completed").length;
    document.getElementById("views").textContent = visits.length.toLocaleString();
    document.getElementById("responses").textContent = responses.length.toLocaleString();
    document.getElementById("complete").textContent = complete.toLocaleString();
    document.getElementById("rate").textContent = visits.length ? `${Math.round(responses.length / visits.length * 100)}%` : "0%";
    renderBars("roles", [["Owner / manager", responses.filter(r => r.role === "owner").length], ["Receptionist", responses.filter(r => r.role === "receptionist").length], ["Dentist", responses.filter(r => r.role === "dentist").length]]);
    const dateParts = date => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
    const dayKey = date => { const parts = dateParts(date); return `${parts.year}-${parts.month}-${parts.day}`; };
    const days = Array.from({ length: 7 }, (_, i) => { const day = new Date(Date.now() - (6 - i) * 86400000); return [new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" }).format(day), dayKey(day)]; });
    renderBars("daily", days.map(([label, date]) => [label, visits.filter(v => dayKey(new Date(v.created_at)) === date).length]));
    renderResponses(responses);
  } catch (error) { showError(dashboardError, error.message); }
}

document.getElementById("login-form").addEventListener("submit", async event => {
  event.preventDefault(); showError(loginError, "");
  if (!apiBase || !SUPABASE_PUBLISHABLE_KEY) { showError(loginError, "Add your Supabase URL and publishable key to site/config.js first."); return; }
  const button = event.currentTarget.querySelector("button"); button.disabled = true; button.textContent = "Signing in…";
  try {
    const data = await authRequest("token?grant_type=password", { email: document.getElementById("email").value.trim(), password: document.getElementById("password").value });
    session = { ...data, expiresAt: Date.now() + data.expires_in * 1000 };
    sessionStorage.setItem("survey-admin-session", JSON.stringify(session));
    document.getElementById("password").value = "";
    showDashboard(); await load();
  } catch (error) { showError(loginError, error.message); }
  finally { button.disabled = false; button.textContent = "Sign in"; }
});

document.getElementById("sign-out").addEventListener("click", () => { session = null; sessionStorage.removeItem("survey-admin-session"); showLogin(); });
document.getElementById("refresh").addEventListener("click", load);
document.getElementById("export").addEventListener("click", () => {
  const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = ["created_at,role,status,answers", ...rows.map(row => [row.created_at, row.role, row.status, JSON.stringify(row.answers)].map(quote).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "dental-duty-responses.csv"; link.click(); URL.revokeObjectURL(url);
});

try { session = JSON.parse(sessionStorage.getItem("survey-admin-session") || "null"); } catch { session = null; }
if (session && apiBase && SUPABASE_PUBLISHABLE_KEY) { showDashboard(); load(); }
