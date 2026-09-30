const dashboardError = document.getElementById("dashboard-error");
const liveStatus = document.getElementById("live-status");
const soundButton = document.getElementById("sound-alerts");
let rows = [];
let latestCounts = null;
let soundEnabled = false;
let audioContext = null;
let polling = false;
let resetting = false;
let selectedQuestionRole = null;
let roleTotals = {};
let totalSubmissions = 0;

function setLiveStatus(message, newResponse = false) {
  liveStatus.textContent = message;
  liveStatus.classList.toggle("new-response", newResponse);
}

async function playAlert() {
  if (!soundEnabled || !audioContext) return;
  try {
    await audioContext.resume();
    const start = audioContext.currentTime;
    [740, 988].forEach((frequency, index) => {
      const tone = audioContext.createOscillator();
      const volume = audioContext.createGain();
      const at = start + index * 0.2;
      tone.type = "sine";
      tone.frequency.value = frequency;
      volume.gain.setValueAtTime(0.0001, at);
      volume.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      tone.connect(volume).connect(audioContext.destination);
      tone.start(at);
      tone.stop(at + 0.17);
    });
  } catch {
    soundEnabled = false;
    soundButton.setAttribute("aria-pressed", "false");
    soundButton.textContent = "Enable sound alerts";
    setLiveStatus("Sound is unavailable in this browser. New submissions still appear here.");
  }
}

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
  owner_1: "Arranges duty", owner_clinic_size: "Dentists per week", owner_2: "Uncovered duty slot", owner_3: "Frequency", owner_4: "Reason", owner_5: "Notice", owner_6: "First action", owner_7: "Dentists contacted", owner_8: "Outcome", owner_9: "Appointments moved or cancelled", owner_10: "Staff time",
  receptionist_1: "Arranges schedules", receptionist_clinic_size: "Dentists per week", receptionist_2: "Handled open duty", receptionist_gap_frequency: "Uncovered slot frequency", receptionist_3: "Availability source", receptionist_4: "Dentists contacted", receptionist_5: "Time to confirm", receptionist_6: "Schedule record", receptionist_7: "Appointments moved or cancelled",
  dentist_1: "Multiple clinics", dentist_2: "Additional duty request", dentist_3: "Clinics worked", dentist_4: "Offer frequency", dentist_5: "Notice", dentist_decline_frequency: "Decline frequency", dentist_6: "Reason declined", dentist_7: "Schedule tracking", dentist_8: "Schedule conflict",
  daily_problem: "Day-to-day problem", app_wish: "App they wish existed",
};

const questionGroups = {
  owner: [
    ["owner_1", "Involved in arranging dentist duty?"],
    ["owner_clinic_size", "Dentists scheduled in a typical week"],
    ["owner_2", "Uncovered duty slot in the past six months?"],
    ["owner_3", "How often uncovered duty slots occurred"],
    ["owner_4", "Most common reason for an open slot"],
    ["owner_5", "Notice before an open duty slot"],
    ["owner_6", "First action the clinic took"],
    ["owner_7", "Dentists contacted for one slot"],
    ["owner_8", "Usual outcome"],
    ["owner_9", "Appointments moved or cancelled"],
    ["owner_10", "Staff time spent finding coverage"],
  ],
  receptionist: [
    ["receptionist_1", "Helps arrange dentist schedules?"],
    ["receptionist_clinic_size", "Dentists scheduled in a typical week"],
    ["receptionist_2", "Handled an uncovered slot in the past six months?"],
    ["receptionist_gap_frequency", "How many uncovered slots were handled"],
    ["receptionist_3", "How availability was checked"],
    ["receptionist_4", "Dentists contacted for one slot"],
    ["receptionist_5", "Time to confirm a dentist"],
    ["receptionist_6", "Where duty schedules were recorded"],
    ["receptionist_7", "Appointments moved or cancelled"],
  ],
  dentist: [
    ["dentist_1", "Practices at more than one clinic?"],
    ["dentist_2", "Asked to cover additional duty?"],
    ["dentist_3", "Clinics worked with in the past six months"],
    ["dentist_4", "How often additional duty was offered"],
    ["dentist_5", "Notice before additional duty"],
    ["dentist_decline_frequency", "How often additional duty was declined"],
    ["dentist_6", "Most common reason for declining"],
    ["dentist_7", "How duty schedules are tracked"],
    ["dentist_8", "Scheduling conflict between clinics?"],
  ],
};

const yesNo = ["Yes", "No"];
const clinicSize = ["1", "2–3", "4–6", "7 or more", "Not sure"];
const gapFrequency = ["Once", "2–3 times", "4–6 times", "More than 6 times", "Not sure"];
const notice = ["Same day", "1 day", "2–7 days", "More than a week", "It varied"];
const dentistsContacted = ["0", "1", "2–3", "4–6", "7 or more", "Not sure"];
const appointmentImpact = ["None", "1–2", "3–5", "6 or more", "Not sure"];
const questionOptions = {
  owner_1: yesNo,
  owner_clinic_size: clinicSize,
  owner_2: yesNo,
  owner_3: gapFrequency,
  owner_4: ["A dentist became unavailable", "More patient bookings than expected", "The clinic added a new duty period", "Another reason", "Not sure"],
  owner_5: notice,
  owner_6: ["Contact dentists already working with us", "Ask another clinic or colleague for a referral", "Contact dentists through personal networks", "Move or cancel appointments", "Another action"],
  owner_7: dentistsContacted,
  owner_8: ["A dentist was confirmed in time", "A dentist was confirmed, but late", "Appointments were moved or cancelled", "The clinic operated with reduced coverage", "It varied"],
  owner_9: appointmentImpact,
  owner_10: ["Under 15 minutes", "15–30 minutes", "31–60 minutes", "More than an hour", "Not sure"],
  receptionist_1: yesNo,
  receptionist_clinic_size: clinicSize,
  receptionist_2: yesNo,
  receptionist_gap_frequency: gapFrequency,
  receptionist_3: ["Call or text them individually", "Check a shared schedule", "Ask the owner or manager", "Ask another staff member", "Another way"],
  receptionist_4: dentistsContacted,
  receptionist_5: ["Under 15 minutes", "15–30 minutes", "31–60 minutes", "More than an hour", "No one was confirmed", "Not sure"],
  receptionist_6: ["Paper or whiteboard", "Spreadsheet", "Calendar app", "Clinic software", "Messages or chat", "Another place"],
  receptionist_7: appointmentImpact,
  dentist_1: yesNo,
  dentist_2: yesNo,
  dentist_3: ["1", "2", "3", "4 or more"],
  dentist_4: gapFrequency,
  dentist_5: notice,
  dentist_decline_frequency: ["Never", "Once", "2–3 times", "4 or more times", "Not sure"],
  dentist_6: ["I had another clinic duty", "I had a personal commitment", "Travel or location was difficult", "The terms did not work for me", "Another reason"],
  dentist_7: ["Personal calendar", "Paper notes", "Messages or chat", "A clinic's system", "I do not keep a separate record", "Another way"],
  dentist_8: ["Yes", "No", "Not sure"],
};

const questionRoles = [
  ["owner", "Clinic owner / manager"],
  ["receptionist", "Receptionist / scheduler"],
  ["dentist", "Dentist"],
];

function renderQuestionBreakdown() {
  selectedQuestionRole ||= questionRoles.find(([role]) => roleTotals[role])?.[0] || "owner";
  const tabs = document.getElementById("question-role-tabs");
  tabs.replaceChildren();
  questionRoles.forEach(([role, label]) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "question-role-tab";
    tab.setAttribute("aria-pressed", String(role === selectedQuestionRole));
    tab.textContent = `${label} · ${roleTotals[role] || 0}`;
    tab.addEventListener("click", () => {
      selectedQuestionRole = role;
      renderQuestionBreakdown();
    });
    tabs.append(tab);
  });

  const note = document.getElementById("question-breakdown-note");
  const limited = rows.length < totalSubmissions;
  note.textContent = `All answer choices are shown, including 0 responses. Percentages use only people who answered that question. ${limited ? `Charts use the ${rows.length.toLocaleString()} most recent submissions.` : ""}`.trim();

  const roleRows = rows.filter(row => row.role === selectedQuestionRole);
  const charts = document.getElementById("question-charts");
  charts.replaceChildren();
  questionGroups[selectedQuestionRole].forEach(([key, title]) => {
    const counts = new Map();
    roleRows.forEach(row => {
      const answer = row.answers?.[key];
      if (typeof answer === "string" && answer.trim()) counts.set(answer, (counts.get(answer) || 0) + 1);
    });
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    const card = document.createElement("article");
    card.className = "question-card";
    const header = document.createElement("div");
    header.className = "question-card-head";
    const heading = document.createElement("h3");
    heading.textContent = title;
    const sample = document.createElement("span");
    sample.textContent = `${total} ${total === 1 ? "answer" : "answers"}`;
    header.append(heading, sample);
    card.append(header);
    if (total === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No answers yet; available choices are shown below.";
      card.append(empty);
    }
    const options = questionOptions[key] || [];
    const olderAnswers = [...counts.keys()].filter(answer => !options.includes(answer)).sort((a, b) => a.localeCompare(b));
    [...options, ...olderAnswers].forEach(answer => {
      const count = counts.get(answer) || 0;
      const percent = total ? Math.round(count / total * 100) : 0;
      const item = document.createElement("div");
      item.className = "question-answer";
      item.classList.toggle("zero", count === 0);
      const labelRow = document.createElement("div");
      labelRow.className = "question-answer-label";
      const label = document.createElement("span");
      label.textContent = answer;
      const value = document.createElement("strong");
      value.textContent = `${count} · ${percent}%`;
      labelRow.append(label, value);
      const track = document.createElement("div");
      track.className = "question-answer-track";
      const fill = document.createElement("span");
      fill.style.width = `${percent}%`;
      track.append(fill);
      item.append(labelRow, track);
      card.append(item);
    });
    charts.append(card);
  });
}

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
    latestCounts = { visits: data.visits, responses: data.responses };
    const roles = Object.fromEntries(data.roles.map(item => [item.role, item.total]));
    roleTotals = roles;
    totalSubmissions = data.responses;
    renderBars("roles", [["Owner / manager", roles.owner || 0], ["Receptionist", roles.receptionist || 0], ["Dentist", roles.dentist || 0]]);
    const daily = Object.fromEntries(data.daily.map(item => [item.day, item.total]));
    const days = Array.from({ length: 7 }, (_, index) => new Date(Date.now() - (6 - index) * 86400000));
    renderBars("daily", days.map(day => [new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" }).format(day), daily[dayKey(day)] || 0]));
    renderResponses(rows);
    renderQuestionBreakdown();
    return data;
  } catch (error) {
    showError(error.message);
    return null;
  }
}

async function checkForUpdates() {
  if (polling || resetting) return;
  polling = true;
  try {
    const response = await fetch("/api/latest", { cache: "no-store" });
    const counts = await response.json();
    if (!response.ok) throw new Error(counts.error || "Could not check for updates.");
    if (!latestCounts) {
      await load();
    } else if (counts.responses !== latestCounts.responses || counts.visits !== latestCounts.visits) {
      const previousResponses = latestCounts.responses;
      const data = await load();
      if (data && data.responses > previousResponses) {
        const added = data.responses - previousResponses;
        setLiveStatus(`${added} new survey ${added === 1 ? "response" : "responses"} received.`, true);
        await playAlert();
      } else if (data) {
        setLiveStatus("Checking for new submissions every 15 seconds while this page is open.");
      }
    }
  } catch {
    setLiveStatus("Connection interrupted. Checking again shortly.");
  } finally {
    polling = false;
  }
}

soundButton.addEventListener("click", async () => {
  if (soundEnabled) {
    soundEnabled = false;
    soundButton.setAttribute("aria-pressed", "false");
    soundButton.textContent = "Enable sound alerts";
    setLiveStatus("Sound alerts off. New submissions will still appear here.");
    return;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    setLiveStatus("Sound is unavailable in this browser. New submissions still appear here.");
    return;
  }
  try {
    audioContext ||= new AudioContextClass();
    await audioContext.resume();
    soundEnabled = true;
    soundButton.setAttribute("aria-pressed", "true");
    soundButton.textContent = "Disable sound alerts";
    setLiveStatus("Sound alerts on. Checking every 15 seconds while this page is open.");
    await playAlert();
  } catch {
    setLiveStatus("Sound could not be enabled in this browser.");
  }
});

document.getElementById("refresh").addEventListener("click", async () => {
  if (await load()) setLiveStatus("Checking for new submissions every 15 seconds while this page is open.");
});
document.getElementById("reset-data").addEventListener("click", async event => {
  const phrase = window.prompt("This permanently deletes every recorded visit and submitted response. Export CSV first if you need a copy. Type RESET SURVEY DATA to confirm:");
  if (phrase !== "RESET SURVEY DATA") return;
  const button = event.currentTarget;
  const status = document.getElementById("reset-status");
  resetting = true;
  button.disabled = true;
  status.textContent = "Clearing research data…";
  try {
    const response = await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: phrase }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not reset research data.");
    await load();
    status.textContent = `Cleared ${result.visits} visit(s) and ${result.responses} response(s).`;
    setLiveStatus("Research data cleared. Checking for new submissions every 15 seconds.");
  } catch (error) {
    status.textContent = "";
    showError(error.message);
  } finally {
    resetting = false;
    button.disabled = false;
  }
});
document.getElementById("export").addEventListener("click", () => {
  const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = ["created_at,role,status,answers", ...rows.map(row => [row.created_at, row.role, row.status, JSON.stringify(row.answers)].map(quote).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "dental-duty-responses.csv"; link.click(); URL.revokeObjectURL(url);
});

load();
setInterval(checkForUpdates, 15000);
