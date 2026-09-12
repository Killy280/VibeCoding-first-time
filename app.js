const STORAGE_KEY = "climbing-tracker-workouts";
const GOAL_KEY = "climbing-tracker-weekly-goal";

const TYPE_LABELS = {
  bouldering: "Bouldering",
  sport: "Sport",
  "top-rope": "Top-rope",
  training: "Training/board",
  other: "Other",
};

let workouts = loadWorkouts();
let weeklyGoal = loadGoal();
let currentWeekOffset = 0; // 0 = this week, -1 = last week, etc.

function loadWorkouts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWorkouts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
}

function loadGoal() {
  const raw = localStorage.getItem(GOAL_KEY);
  const n = raw ? parseInt(raw, 10) : 3;
  return Number.isFinite(n) && n >= 0 ? n : 3;
}

function saveGoal(value) {
  localStorage.setItem(GOAL_KEY, String(value));
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- Week helpers (Mon-Sun) ---

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getWeekRange(offset) {
  const today = new Date();
  today.setDate(today.getDate() + offset * 7);
  return { start: startOfWeek(today), end: endOfWeek(today) };
}

function formatDateShort(d) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateFull(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function workoutsInRange(start, end) {
  return workouts.filter((w) => {
    const d = new Date(w.date + "T00:00:00");
    return d >= start && d <= end;
  });
}

function sortByDateDesc(list) {
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// --- Rendering ---

function renderOverview() {
  const { start, end } = getWeekRange(currentWeekOffset);
  const label =
    currentWeekOffset === 0
      ? `This week (${formatDateShort(start)} – ${formatDateShort(end)})`
      : `${formatDateShort(start)} – ${formatDateShort(end)}`;
  document.getElementById("week-label").textContent = label;

  const weekWorkouts = sortByDateDesc(workoutsInRange(start, end));

  // Goal
  document.getElementById("goal-input").value = weeklyGoal;
  const count = weekWorkouts.length;
  const pct = weeklyGoal > 0 ? Math.min(100, (count / weeklyGoal) * 100) : count > 0 ? 100 : 0;
  const onTrack = count >= weeklyGoal;
  const fill = document.getElementById("goal-bar-fill");
  fill.style.width = `${pct}%`;
  fill.classList.toggle("on-track", onTrack);
  document.getElementById("goal-text").textContent =
    weeklyGoal > 0
      ? `${count} / ${weeklyGoal} sessions — ${onTrack ? "on track" : "behind"}`
      : `${count} sessions logged`;

  // Type breakdown
  const breakdown = document.getElementById("type-breakdown");
  breakdown.innerHTML = "";
  Object.keys(TYPE_LABELS).forEach((type) => {
    const n = weekWorkouts.filter((w) => w.type === type).length;
    const pill = document.createElement("span");
    pill.className = `type-pill ${n > 0 ? "has-sessions" : "zero"}`;
    pill.textContent = `${TYPE_LABELS[type]} × ${n}`;
    breakdown.appendChild(pill);
  });

  // Grades
  const gradesEl = document.getElementById("grades-list");
  const grades = weekWorkouts.map((w) => w.grade).filter(Boolean);
  gradesEl.innerHTML = "";
  if (grades.length === 0) {
    gradesEl.innerHTML = `<span class="empty-msg">No grades logged this week.</span>`;
  } else {
    grades.forEach((g) => {
      const pill = document.createElement("span");
      pill.className = "grade-pill";
      pill.textContent = g;
      gradesEl.appendChild(pill);
    });
  }

  // Session list
  renderSessionList(document.getElementById("week-sessions"), weekWorkouts, "No sessions logged this week.");
}

function renderSessionList(container, list, emptyMessage) {
  container.innerHTML = "";
  if (list.length === 0) {
    container.innerHTML = `<span class="empty-msg">${emptyMessage}</span>`;
    return;
  }
  list.forEach((w) => {
    const item = document.createElement("div");
    item.className = "session-item";

    const main = document.createElement("div");
    main.className = "session-main";

    const dateEl = document.createElement("div");
    dateEl.className = "session-date";
    dateEl.textContent = formatDateFull(w.date);
    main.appendChild(dateEl);

    const metaParts = [TYPE_LABELS[w.type] || w.type];
    if (w.grade) metaParts.push(w.grade);
    if (w.duration) metaParts.push(`${w.duration} min`);
    const metaEl = document.createElement("div");
    metaEl.className = "session-meta";
    metaEl.textContent = metaParts.join(" · ");
    main.appendChild(metaEl);

    if (w.notes) {
      const notesEl = document.createElement("div");
      notesEl.className = "session-notes";
      notesEl.textContent = w.notes;
      main.appendChild(notesEl);
    }

    item.appendChild(main);

    const actions = document.createElement("div");
    actions.className = "session-actions";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => startEdit(w.id));
    actions.appendChild(editBtn);

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "danger";
    delBtn.addEventListener("click", () => deleteWorkout(w.id));
    actions.appendChild(delBtn);

    item.appendChild(actions);
    container.appendChild(item);
  });
}

function renderHistory() {
  const all = sortByDateDesc(workouts);
  renderSessionList(document.getElementById("history-list"), all, "No workouts logged yet.");
}

function renderAll() {
  renderOverview();
  renderHistory();
}

// --- Form handling ---

const form = document.getElementById("workout-form");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit");
const formTitle = document.getElementById("form-title");

function resetForm() {
  form.reset();
  document.getElementById("edit-id").value = "";
  document.getElementById("field-date").value = new Date().toISOString().slice(0, 10);
  submitBtn.textContent = "Add workout";
  formTitle.textContent = "Log a workout";
  cancelEditBtn.hidden = true;
}

function startEdit(id) {
  const w = workouts.find((x) => x.id === id);
  if (!w) return;
  document.getElementById("edit-id").value = w.id;
  document.getElementById("field-date").value = w.date;
  document.getElementById("field-type").value = w.type;
  document.getElementById("field-grade").value = w.grade || "";
  document.getElementById("field-duration").value = w.duration || "";
  document.getElementById("field-notes").value = w.notes || "";
  submitBtn.textContent = "Save changes";
  formTitle.textContent = "Edit workout";
  cancelEditBtn.hidden = false;
  switchView("log");
}

function deleteWorkout(id) {
  if (!confirm("Delete this workout?")) return;
  workouts = workouts.filter((w) => w.id !== id);
  saveWorkouts();
  renderAll();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("edit-id").value;
  const entry = {
    id: id || uid(),
    date: document.getElementById("field-date").value,
    type: document.getElementById("field-type").value,
    grade: document.getElementById("field-grade").value.trim(),
    duration: document.getElementById("field-duration").value
      ? parseInt(document.getElementById("field-duration").value, 10)
      : null,
    notes: document.getElementById("field-notes").value.trim(),
  };

  if (id) {
    const idx = workouts.findIndex((w) => w.id === id);
    if (idx !== -1) workouts[idx] = entry;
  } else {
    workouts.push(entry);
  }

  saveWorkouts();
  resetForm();
  renderAll();
  switchView("overview");
});

cancelEditBtn.addEventListener("click", () => {
  resetForm();
});

// --- Goal input ---

document.getElementById("goal-input").addEventListener("change", (e) => {
  const val = Math.max(0, parseInt(e.target.value, 10) || 0);
  weeklyGoal = val;
  saveGoal(val);
  renderOverview();
});

// --- Week navigation ---

document.getElementById("prev-week").addEventListener("click", () => {
  currentWeekOffset -= 1;
  renderOverview();
});

document.getElementById("next-week").addEventListener("click", () => {
  currentWeekOffset = Math.min(0, currentWeekOffset + 1);
  renderOverview();
});

// --- View switching ---

function switchView(view) {
  document.querySelectorAll(".view").forEach((el) => el.classList.remove("active"));
  document.getElementById(`view-${view}`).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
}

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.view !== "log") resetForm();
    switchView(btn.dataset.view);
  });
});

// --- Init ---

resetForm();
renderAll();
