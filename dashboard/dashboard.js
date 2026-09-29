const dashboardError = document.getElementById("dashboard-error");
let rows = [];

function showError(message) {
  dashboardError.textContent = message;
  dashboardError.hidden = !message;
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

const answerLabels = {
  owner_1: "Arranges duty", owner_2: "Needed extra coverage", owner_3: "Frequency", owner_4: "Reason", owner_5: "Notice", owner_6: "First action", owner_7: "Dentists contacted", owner_8: "Outcome", owner_9: "Patient impact", owner_10: "Staff time",
  receptionist_1: "Arranges schedules", receptionist_2: "Handled open duty", receptionist_3: "Availability source", receptionist_4: "Dentists contacted", receptionist_5: "Time to confirm", receptionist_6: "Schedule record", receptionist_7: "Patient impact",
  dentist_1: "Multiple clinics", dentist_2: "Additional duty request", dentist_3: "Clinics worked", dentist_4: "Offer frequency", dentist_5: "Notice", dentist_6: "Reason declined", dentist_7: "Schedule tracking", dentist_8: "Schedule conflict",
  daily_problem: "Day-to-day problem", app_wish: "App they wish existed",
};

function renderResponses(responses) {
  const body = document.getElementById("response-rows"); body.replaceChildren();
  if (!responses.length) {
    const tr = document.createElement("tr"); const td = document.createElement("td");
    td.colSpan = 4; td.className = "empty"; td.textContent = "No responses yet.";
    tr.append(td); body.append(tr); return;
  }
  responses.forEach(response => {
    const tr = document.createElement("tr");
    const date = document.createElement("td"); date.textContent = new Date(response.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
    const role = document.createElement("td"); role.textContent = ({ owner: "Owner / manager", receptionist: "Receptionist", dentist: "Dentist" })[response.role] || response.role;
    const statusCell = document.createElement("td"); const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = response.status === "screened_out" ? "Early exit" : "Complete"; statusCell.append(tag);
    const answers = document.createElement("td"); answers.className = "answers";
    answers.textContent = Object.entries(response.answers || {}).map(([key, value]) => `${answerLabels[key] || key}: ${value}`).join(" · ");
    tr.append(date, role, statusCell, answers); body.append(tr);
  });
}

function dayKey(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function load() {
  showError("");
  try {
    const response = await fetch("/api/analytics", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load survey data.");
    rows = data.records;
    document.getElementById("views").textContent = data.visits.toLocaleString();
    document.getElementById("responses").textContent = data.responses.toLocaleString();
    document.getElementById("complete").textContent = data.complete.toLocaleString();
    document.getElementById("rate").textContent = data.visits ? `${Math.round(data.responses / data.visits * 100)}%` : "0%";
    const roles = Object.fromEntries(data.roles.map(item => [item.role, item.total]));
    renderBars("roles", [["Owner / manager", roles.owner || 0], ["Receptionist", roles.receptionist || 0], ["Dentist", roles.dentist || 0]]);
    const daily = Object.fromEntries(data.daily.map(item => [item.day, item.total]));
    const days = Array.from({ length: 7 }, (_, index) => new Date(Date.now() - (6 - index) * 86400000));
    renderBars("daily", days.map(day => [new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" }).format(day), daily[dayKey(day)] || 0]));
    renderResponses(rows);
  } catch (error) {
    showError(error.message);
  }
}

document.getElementById("refresh").addEventListener("click", load);
document.getElementById("export").addEventListener("click", () => {
  const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = ["created_at,role,status,answers", ...rows.map(row => [row.created_at, row.role, row.status, JSON.stringify(row.answers)].map(quote).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "dental-duty-responses.csv"; link.click(); URL.revokeObjectURL(url);
});

load();
