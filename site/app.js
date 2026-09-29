import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
import qrcode from "./assets/qrcode.js";
import { translate } from "./i18n.js";

const roles = [
  ["owner", "Clinic owner or manager"],
  ["receptionist", "Receptionist or scheduler"],
  ["dentist", "Dentist"],
];

const questions = {
  owner_1: { text: "Are you involved in arranging or approving dentist duty at your clinic?", options: ["Yes", "No"], next: { Yes: "owner_clinic_size", No: "end" } },
  owner_clinic_size: { text: "How many dentists are usually scheduled at your clinic in a typical week?", options: ["1", "2–3", "4–6", "7 or more", "Not sure"], next: "owner_2" },
  owner_2: { text: "In the past six months, has your clinic had a duty slot without a confirmed dentist?", options: ["Yes", "No"], next: { Yes: "owner_3", No: "end" } },
  owner_3: { text: "How often did this happen in the past six months?", options: ["Once", "2–3 times", "4–6 times", "More than 6 times", "Not sure"], next: "owner_4" },
  owner_4: { text: "What was the most common reason?", options: ["A dentist became unavailable", "More patient bookings than expected", "The clinic added a new duty period", "Another reason", "Not sure"], next: "owner_5" },
  owner_5: { text: "How much notice did you usually have?", options: ["Same day", "1 day", "2–7 days", "More than a week", "It varied"], next: "owner_6" },
  owner_6: { text: "What did your clinic usually do first?", options: ["Contact dentists already working with us", "Ask another clinic or colleague for a referral", "Contact dentists through personal networks", "Move or cancel appointments", "Another action"], next: "owner_7" },
  owner_7: { text: "How many dentists did your clinic usually contact for an open duty slot?", options: ["0", "1", "2–3", "4–6", "7 or more", "Not sure"], next: "owner_8" },
  owner_8: { text: "What was the usual outcome?", options: ["A dentist was confirmed in time", "A dentist was confirmed, but late", "Appointments were moved or cancelled", "The clinic operated with reduced coverage", "It varied"], next: "owner_9" },
  owner_9: { text: "About how many patient appointments were moved or cancelled in the past six months because a dentist was unavailable?", options: ["None", "1–2", "3–5", "6 or more", "Not sure"], next: "owner_10" },
  owner_10: { text: "How much staff time did finding coverage usually take?", options: ["Under 15 minutes", "15–30 minutes", "31–60 minutes", "More than an hour", "Not sure"], next: "end" },

  receptionist_1: { text: "Do you help arrange or confirm dentist duty schedules?", options: ["Yes", "No"], next: { Yes: "receptionist_clinic_size", No: "end" } },
  receptionist_clinic_size: { text: "How many dentists are usually scheduled at your clinic in a typical week?", options: ["1", "2–3", "4–6", "7 or more", "Not sure"], next: "receptionist_2" },
  receptionist_2: { text: "In the past six months, have you handled a duty slot without a confirmed dentist?", options: ["Yes", "No"], next: { Yes: "receptionist_gap_frequency", No: "end" } },
  receptionist_gap_frequency: { text: "About how many uncovered dentist duty slots did you handle in the past six months?", options: ["Once", "2–3 times", "4–6 times", "More than 6 times", "Not sure"], next: "receptionist_3" },
  receptionist_3: { text: "How did you usually find out which dentists were available?", options: ["Call or text them individually", "Check a shared schedule", "Ask the owner or manager", "Ask another staff member", "Another way"], next: "receptionist_4" },
  receptionist_4: { text: "How many dentists did you typically contact for one open duty slot?", options: ["0", "1", "2–3", "4–6", "7 or more", "Not sure"], next: "receptionist_5" },
  receptionist_5: { text: "For the most recent open duty slot, how long did it take to confirm someone?", options: ["Under 15 minutes", "15–30 minutes", "31–60 minutes", "More than an hour", "No one was confirmed", "Not sure"], next: "receptionist_6" },
  receptionist_6: { text: "Where were duty schedules usually recorded?", options: ["Paper or whiteboard", "Spreadsheet", "Calendar app", "Clinic software", "Messages or chat", "Another place"], next: "receptionist_7" },
  receptionist_7: { text: "About how many patient appointments were moved or cancelled in the past six months because a dentist was unavailable?", options: ["None", "1–2", "3–5", "6 or more", "Not sure"], next: "end" },

  dentist_1: { text: "Do you currently practice at more than one dental clinic?", options: ["Yes", "No"], next: "dentist_2" },
  dentist_2: { text: "In the past six months, have you been asked to cover an additional duty slot at a clinic?", options: ["Yes", "No"], next: (answer, all) => answer === "No" && all.dentist_1 === "No" ? "end" : "dentist_3" },
  dentist_3: { text: "How many clinics have you worked with in the past six months?", options: ["1", "2", "3", "4 or more"], next: (answer, all) => all.dentist_2 === "Yes" ? "dentist_4" : "dentist_7" },
  dentist_4: { text: "How often were you asked to take an additional duty slot?", options: ["Once", "2–3 times", "4–6 times", "More than 6 times", "Not sure"], next: "dentist_5" },
  dentist_5: { text: "How much notice did you usually receive?", options: ["Same day", "1 day", "2–7 days", "More than a week", "It varied"], next: "dentist_decline_frequency" },
  dentist_decline_frequency: { text: "In the past six months, how often did you decline an additional duty slot?", options: ["Never", "Once", "2–3 times", "4 or more times", "Not sure"], next: answer => ["Once", "2–3 times", "4 or more times"].includes(answer) ? "dentist_6" : "dentist_7" },
  dentist_6: { text: "When you declined, what was the most common reason?", options: ["I had another clinic duty", "I had a personal commitment", "Travel or location was difficult", "The terms did not work for me", "Another reason"], next: "dentist_7" },
  dentist_7: { text: "How do you currently track your clinic duty schedules?", options: ["Personal calendar", "Paper notes", "Messages or chat", "A clinic's system", "I do not keep a separate record", "Another way"], next: "dentist_8" },
  dentist_8: { text: "In the past six months, have you had a scheduling conflict between clinics?", options: ["Yes", "No", "Not sure"], next: "end" },
};

const firstByRole = { owner: "owner_1", receptionist: "receptionist_1", dentist: "dentist_1" };
const earlyExitQuestions = new Set(["owner_1", "owner_2", "receptionist_1", "receptionist_2", "dentist_2"]);
const content = document.getElementById("survey-content");
const actions = document.getElementById("survey-actions");
const languageSlot = document.getElementById("language-slot");
const restartLink = document.getElementById("restart-survey");
const errorBox = document.getElementById("survey-error");
const stepLabel = document.getElementById("step-label");
const progressLabel = document.getElementById("progress-label");
const progressFill = document.getElementById("progress-fill");
const state = { role: null, current: "intro", selected: null, answers: {}, history: [], status: "completed", language: localStorage.getItem("survey-language") === "tl" ? "tl" : "en" };
const publicUrl = new URL(window.location.href);
publicUrl.search = "";
publicUrl.hash = "";
const shareUrl = publicUrl.href;
const t = value => translate(value, state.language);

function updateStaticLanguage() {
  document.documentElement.lang = state.language === "tl" ? "fil" : "en";
  document.title = t("Dental Clinic Scheduling Research");
  document.querySelectorAll("[data-i18n]").forEach(node => {
    node.dataset.english ||= node.textContent;
    node.textContent = t(node.dataset.english);
  });
}

function drawQr(container) {
  const qr = qrcode(0, "M");
  qr.addData(shareUrl);
  qr.make();
  container.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  container.setAttribute("aria-label", t("Scan to open the questionnaire"));
}

async function copyShareLink(status) {
  try {
    await navigator.clipboard.writeText(shareUrl);
    status.textContent = t("Link copied");
  } catch {
    status.textContent = t("Could not copy the link. Please select and copy it manually.");
  }
}

function languageControl() {
  const control = element("div", "language-control");
  control.setAttribute("role", "group");
  control.setAttribute("aria-label", "Language / Wika");
  [["en", "English"], ["tl", "Tagalog"]].forEach(([code, label]) => {
    const item = element("button", "language-option", label);
    item.type = "button";
    item.setAttribute("aria-pressed", String(state.language === code));
    item.addEventListener("click", () => {
      state.language = code;
      localStorage.setItem("survey-language", code);
      updateStaticLanguage();
      render();
    });
    control.append(item);
  });
  return control;
}

function finalQuestion(label, placeholder, key) {
  const wrapper = element("label", "text-question");
  wrapper.append(element("span", "", t(label)));
  const input = element("textarea", "text-answer");
  input.rows = 3;
  input.maxLength = 500;
  input.placeholder = t(placeholder);
  input.value = state.answers[key] || "";
  input.addEventListener("input", () => {
    const answer = input.value.trim();
    if (answer) state.answers[key] = answer;
    else delete state.answers[key];
  });
  wrapper.append(input);
  return wrapper;
}

function completionShare() {
  const box = element("div", "completion-share");
  box.append(element("p", "", t("If you know another dentist or clinic, please share this questionnaire with them.")));
  const row = element("div", "completion-share-row");
  const qr = element("div", "qr-code qr-small");
  drawQr(qr);
  const linkArea = element("div", "completion-share-link");
  linkArea.append(element("span", "share-url", shareUrl));
  const status = element("span", "copy-status");
  linkArea.append(button(t("Copy link"), "btn-secondary", () => copyShareLink(status)), status);
  row.append(qr, linkArea);
  box.append(row);
  return box;
}

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
  updateStaticLanguage();
  document.body.classList.toggle("survey-start", state.current === "intro" || state.current === "role");
  document.body.classList.toggle("survey-intro", state.current === "intro");
  restartLink.hidden = state.current === "intro" && state.history.length === 0;
  languageSlot.replaceChildren(languageControl());
  if (state.current === "intro") {
    stepLabel.textContent = t("START HERE");
    progressLabel.textContent = t("About 3 minutes");
    progressFill.style.width = "3%";
    content.append(element("h2", "", t("Before you begin")));
    content.append(element("p", "privacy-note", t("For your privacy, please do not share your clinic name, your name, contact details, or any patient information in your answers.")));
    actions.append(button(t("Start"), "btn-primary", () => {
      state.history.push("intro");
      state.current = "role";
      render();
    }));
    return;
  }
  if (state.current === "role") {
    stepLabel.textContent = t("START HERE");
    progressLabel.textContent = t("About 3 minutes");
    progressFill.style.width = "5%";
    content.append(element("h2", "", t("Please select your role")));
    content.append(element("p", "question-hint", t("We’ll show questions relevant to your work.")));
    content.append(choices(roles.map(([value, label]) => [value, t(label)]), state.selected, value => { state.selected = value; render(); }));
    actions.append(button(t("Back"), "btn-secondary", goBack));
    actions.append(button(t("Continue"), "btn-primary", () => {
      state.role = state.selected;
      state.history.push("role");
      state.current = firstByRole[state.role];
      state.selected = state.answers[state.current] ?? null;
      render();
    }, !state.selected));
    return;
  }

  if (state.current === "end") {
    const screenedOut = state.status === "screened_out";
    stepLabel.textContent = t(screenedOut ? "LAST STEP" : "SURVEY COMPLETE");
    progressLabel.textContent = t("Ready to submit");
    progressFill.style.width = "96%";
    content.append(element("h2", "", t("Thank you for your time")));
    content.append(element("p", "completion-copy", t(screenedOut
      ? "These duty questions do not apply to your recent experience. If you wish, you can share another day-to-day problem below."
      : "Your answers will help us understand how dentist duty is arranged today.")));
    if (screenedOut) {
      const problems = {
        owner: ["What day-to-day problem in running your clinic would you most like to solve?", "What kind of application do you wish your clinic had to solve it?"],
        receptionist: ["What day-to-day problem at the front desk would you most like to solve?", "What kind of application would help you with it?"],
        dentist: ["What day-to-day problem in your practice would you most like to solve?", "What kind of application would help you with that problem?"],
      };
      content.append(finalQuestion(problems[state.role][0], "Describe the problem, if any", "daily_problem"));
      content.append(finalQuestion(problems[state.role][1], "Describe the app you wish existed", "app_wish"));
      content.append(element("p", "question-hint final-hint", t("Both questions are optional. Please do not include patient information.")));
    }
    actions.append(button(t("Back"), "btn-secondary", goBack));
    actions.append(button(t("Submit responses"), "btn-primary", submit));
    return;
  }

  if (state.current === "done") {
    stepLabel.textContent = t("COMPLETE");
    progressLabel.textContent = t("Responses submitted");
    progressFill.style.width = "100%";
    content.append(element("div", "success-icon", "✓"));
    content.append(element("h2", "", t("Responses received")));
    content.append(element("p", "completion-copy", t("Thank you for sharing your experience.")));
    content.append(completionShare());
    return;
  }

  const question = questions[state.current];
  stepLabel.textContent = t("QUESTIONNAIRE");
  progressLabel.textContent = `${t("Question")} ${state.history.length}`;
  progressFill.style.width = `${Math.min(89, 12 + (state.history.length / 9) * 77)}%`;
  content.append(element("h2", "", t(question.text)));
  content.append(element("p", "question-hint", t("Select one answer.")));
  content.append(choices(question.options.map(option => [option, t(option)]), state.selected, value => { state.selected = value; render(); }));
  actions.append(button(t("Back"), "btn-secondary", goBack));
  actions.append(button(t("Continue"), "btn-primary", () => {
    if (state.answers[state.current] !== state.selected) {
      const relevant = new Set([...state.history, state.current]);
      Object.keys(state.answers).forEach(key => { if (!relevant.has(key)) delete state.answers[key]; });
    }
    state.answers[state.current] = state.selected;
    const route = question.next;
    const next = typeof route === "function" ? route(state.selected, state.answers) : typeof route === "string" ? route : route[state.selected];
    state.history.push(state.current);
    state.status = next === "end" && earlyExitQuestions.has(state.current) ? "screened_out" : "completed";
    state.current = next;
    state.selected = state.answers[next] ?? null;
    render();
  }, !state.selected));
}

restartLink.addEventListener("click", event => {
  event.preventDefault();
  state.role = null;
  state.current = "intro";
  state.selected = null;
  state.answers = {};
  state.history = [];
  state.status = "completed";
  render();
});

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
    errorBox.textContent = t("The survey is not connected yet. Please try again later.");
    errorBox.hidden = false;
    return;
  }
  const submitButton = actions.querySelector(".btn-primary");
  submitButton.disabled = true;
  submitButton.textContent = t("Submitting…");
  try {
    await postTable("survey_responses", { role: state.role, answers: state.answers, status: state.status });
    state.current = "done";
    render();
  } catch {
    errorBox.textContent = t("We couldn’t submit your responses. Please check your connection and try again.");
    errorBox.hidden = false;
    submitButton.disabled = false;
    submitButton.textContent = t("Submit responses");
  }
}

if (configured && !sessionStorage.getItem("survey-visit-recorded")) {
  postTable("survey_visits", {}).then(() => sessionStorage.setItem("survey-visit-recorded", "1")).catch(() => {});
}

document.getElementById("share-url").textContent = shareUrl;
document.getElementById("copy-link").addEventListener("click", () => copyShareLink(document.getElementById("copy-status")));
drawQr(document.getElementById("home-qr"));
render();
