import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const roles = [
  ["owner", "Clinic owner or manager"],
  ["receptionist", "Receptionist or scheduler"],
  ["dentist", "Dentist"],
];

const questions = {
  owner_1: { text: "Are you involved in arranging or approving dentist duty at your clinic?", options: ["Yes", "No"], next: { Yes: "owner_2", No: "end" } },
  owner_2: { text: "In the past six months, has your clinic needed a dentist outside its confirmed duty schedule?", options: ["Yes", "No"], next: { Yes: "owner_3", No: "end" } },
  owner_3: { text: "How often did this happen in the past six months?", options: ["Once", "2–3 times", "4–6 times", "More than 6 times", "Not sure"], next: "owner_4" },
  owner_4: { text: "What was the most common reason?", options: ["A dentist became unavailable", "More patient bookings than expected", "A new or uncovered duty slot", "Another reason", "Not sure"], next: "owner_5" },
  owner_5: { text: "How much notice did you usually have?", options: ["Same day", "1 day", "2–7 days", "More than a week", "It varied"], next: "owner_6" },
  owner_6: { text: "What did your clinic usually do first?", options: ["Contact dentists already working with us", "Ask another clinic or colleague for a referral", "Contact dentists through personal networks", "Move or cancel appointments", "Another action"], next: "owner_7" },
  owner_7: { text: "How many dentists did you typically contact before filling a duty slot?", options: ["1", "2–3", "4–6", "7 or more", "We usually could not fill it", "Not sure"], next: "owner_8" },
  owner_8: { text: "What was the usual outcome?", options: ["A dentist was confirmed in time", "A dentist was confirmed, but late", "Appointments were moved or cancelled", "The clinic operated with reduced coverage", "It varied"], next: "owner_9" },
  owner_9: { text: "Did these situations affect patient appointments?", options: ["Yes, often", "Yes, sometimes", "No", "Not sure"], next: "owner_10" },
  owner_10: { text: "How much staff time did finding coverage usually take?", options: ["Under 15 minutes", "15–30 minutes", "31–60 minutes", "More than an hour", "Not sure"], next: "end" },

  receptionist_1: { text: "Do you help arrange or confirm dentist duty schedules?", options: ["Yes", "No"], next: { Yes: "receptionist_2", No: "end" } },
  receptionist_2: { text: "In the past six months, have you handled a duty slot without a confirmed dentist?", options: ["Yes", "No"], next: { Yes: "receptionist_3", No: "end" } },
  receptionist_3: { text: "How did you usually find out which dentists were available?", options: ["Call or text them individually", "Check a shared schedule", "Ask the owner or manager", "Ask another staff member", "Another way"], next: "receptionist_4" },
  receptionist_4: { text: "How many dentists did you typically contact for one open duty slot?", options: ["1", "2–3", "4–6", "7 or more", "Not sure"], next: "receptionist_5" },
  receptionist_5: { text: "How long did it usually take to confirm someone?", options: ["Under 15 minutes", "15–30 minutes", "31–60 minutes", "More than an hour", "We sometimes could not confirm anyone"], next: "receptionist_6" },
  receptionist_6: { text: "Where were duty schedules usually recorded?", options: ["Paper or whiteboard", "Spreadsheet", "Calendar app", "Clinic software", "Messages or chat", "Another place"], next: "receptionist_7" },
  receptionist_7: { text: "Did an unfilled duty slot affect patient appointments?", options: ["Yes, often", "Yes, sometimes", "No", "Not sure"], next: "end" },

  dentist_1: { text: "Do you currently practice at more than one dental clinic?", options: ["Yes", "No"], next: "dentist_2" },
  dentist_2: { text: "In the past six months, have you been asked to cover an additional duty slot at a clinic?", options: ["Yes", "No"], next: (answer, all) => answer === "No" && all.dentist_1 === "No" ? "end" : "dentist_3" },
  dentist_3: { text: "How many clinics have you worked with in the past six months?", options: ["1", "2", "3", "4 or more"], next: (answer, all) => all.dentist_2 === "Yes" ? "dentist_4" : "dentist_7" },
  dentist_4: { text: "How often were you asked to take an additional duty slot?", options: ["Once", "2–3 times", "4–6 times", "More than 6 times", "Not sure"], next: "dentist_5" },
  dentist_5: { text: "How much notice did you usually receive?", options: ["Same day", "1 day", "2–7 days", "More than a week", "It varied"], next: "dentist_6" },
  dentist_6: { text: "If you declined an offer, what was the most common reason?", options: ["I had another clinic duty", "I had a personal commitment", "Travel or location was difficult", "The terms did not work for me", "I did not decline any offers", "Another reason"], next: "dentist_7" },
  dentist_7: { text: "How do you currently track your clinic duty schedules?", options: ["Personal calendar", "Paper notes", "Messages or chat", "A clinic's system", "I do not keep a separate record", "Another way"], next: "dentist_8" },
  dentist_8: { text: "In the past six months, have you had a scheduling conflict between clinics?", options: ["Yes", "No", "Not sure"], next: "end" },
};

const firstByRole = { owner: "owner_1", receptionist: "receptionist_1", dentist: "dentist_1" };
const content = document.getElementById("survey-content");
const actions = document.getElementById("survey-actions");
const errorBox = document.getElementById("survey-error");
const stepLabel = document.getElementById("step-label");
const progressLabel = document.getElementById("progress-label");
const progressFill = document.getElementById("progress-fill");
const state = { role: null, current: "role", selected: null, answers: {}, history: [], status: "completed" };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, style, onClick, disabled = false) {
  const node = element("button", `btn ${style}`, label);
  node.type = "button";
  node.disabled = disabled;
  node.addEventListener("click", onClick);
  return node;
}

function clear() {
  content.replaceChildren();
  actions.replaceChildren();
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function choices(options, selectedValue, onSelect) {
  const list = element("div", "choices");
  options.forEach(([value, label]) => {
    const item = element("button", "choice");
    item.type = "button";
    item.setAttribute("aria-pressed", String(selectedValue === value));
    const circle = element("span", "choice-symbol", "✓");
    circle.setAttribute("aria-hidden", "true");
    item.append(circle, element("span", "choice-text", label));
    item.addEventListener("click", () => onSelect(value));
    list.append(item);
  });
  return list;
}

function render() {
  clear();
  if (state.current === "role") {
    stepLabel.textContent = "START HERE";
    progressLabel.textContent = "About 3 minutes";
    progressFill.style.width = "5%";
    content.append(element("h2", "", "Please select your role"));
    content.append(element("p", "question-hint", "We’ll show questions relevant to your work."));
    content.append(choices(roles, state.selected, value => { state.selected = value; render(); }));
    actions.append(button("Continue", "btn-primary", () => {
      state.role = state.selected;
      state.history.push("role");
      state.current = firstByRole[state.role];
      state.selected = state.answers[state.current] ?? null;
      render();
    }, !state.selected));
    return;
  }

  if (state.current === "end") {
    stepLabel.textContent = "LAST STEP";
    progressLabel.textContent = "Ready to submit";
    progressFill.style.width = "100%";
    content.append(element("div", "success-icon", "✓"));
    content.append(element("h2", "", "Thank you for your time"));
    content.append(element("p", "completion-copy", "Your answers will help us understand how dentist duty is arranged today. Select Submit responses to send them."));
    actions.append(button("Back", "btn-secondary", goBack));
    actions.append(button("Submit responses", "btn-primary", submit));
    return;
  }

  if (state.current === "done") {
    stepLabel.textContent = "COMPLETE";
    progressLabel.textContent = "Responses submitted";
    progressFill.style.width = "100%";
    content.append(element("div", "success-icon", "✓"));
    content.append(element("h2", "", "Responses received"));
    content.append(element("p", "completion-copy", "Thank you for sharing your experience."));
    return;
  }

  const question = questions[state.current];
  const answered = Object.keys(state.answers).length;
  stepLabel.textContent = "QUESTIONNAIRE";
  progressLabel.textContent = `Question ${answered + (state.selected ? 0 : 1)}`;
  progressFill.style.width = `${Math.min(89, 12 + (state.history.length / 9) * 77)}%`;
  content.append(element("h2", "", question.text));
  content.append(element("p", "question-hint", "Select one answer."));
  content.append(choices(question.options.map(option => [option, option]), state.selected, value => { state.selected = value; render(); }));
  actions.append(button("Back", "btn-secondary", goBack));
  actions.append(button("Continue", "btn-primary", () => {
    if (state.answers[state.current] !== state.selected) {
      const relevant = new Set([...state.history, state.current]);
      Object.keys(state.answers).forEach(key => { if (!relevant.has(key)) delete state.answers[key]; });
    }
    state.answers[state.current] = state.selected;
    const route = question.next;
    const next = typeof route === "function" ? route(state.selected, state.answers) : typeof route === "string" ? route : route[state.selected];
    state.history.push(state.current);
    state.status = next === "end" && state.history.length <= 3 ? "screened_out" : "completed";
    state.current = next;
    state.selected = state.answers[next] ?? null;
    render();
  }, !state.selected));
}

function goBack() {
  const previous = state.history.pop();
  if (!previous) return;
  state.current = previous;
  state.selected = previous === "role" ? state.role : state.answers[previous] ?? null;
  render();
}

const configured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
const apiBase = SUPABASE_URL.replace(/\/$/, "");

async function postTable(table, value) {
  const response = await fetch(`${apiBase}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
}

async function submit() {
  if (!configured) {
    errorBox.textContent = "The survey is not connected yet. Please try again later.";
    errorBox.hidden = false;
    return;
  }
  const submitButton = actions.querySelector(".btn-primary");
  submitButton.disabled = true;
  submitButton.textContent = "Submitting…";
  try {
    await postTable("survey_responses", { role: state.role, answers: state.answers, status: state.status });
    state.current = "done";
    render();
  } catch {
    errorBox.textContent = "We couldn’t submit your responses. Please check your connection and try again.";
    errorBox.hidden = false;
    submitButton.disabled = false;
    submitButton.textContent = "Submit responses";
  }
}

if (configured && !sessionStorage.getItem("survey-visit-recorded")) {
  postTable("survey_visits", {}).then(() => sessionStorage.setItem("survey-visit-recorded", "1")).catch(() => {});
}

render();
