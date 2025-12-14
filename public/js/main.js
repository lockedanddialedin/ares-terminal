/* ============================
   Ares Terminal — Clean main.js
   ============================ */

const STORAGE_PREFIX = "aresTerminal_v1_";

// Only fields that exist in your current UI
const FIELD_IDS = [
  "weight", "sleep", "energy",
  "calories", "protein", "carbs", "fats",
  "steps", "water",
  "mood", "screen",
  "vitalNotes",
  "trained", "rateDiscipline"
];

// ---- Daily Score targets (edit these once and forget) ----
const SCORE_TARGETS = {
  sleep: 7.0,             // hrs
  calories: 2000,         // target
  caloriesTolerance: 250, // +/- range to count as "hit"
  protein: 180,           // g
  screen: 4.0             // hrs max
};

let currentDate = new Date();
let currentDateKey = null;
let autoSaveTimer = null;
let isLoadingDay = false;

/* ---------- Helpers ---------- */

function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function updateDateDisplay() {
  const el = document.getElementById("currentDate");
  if (!el || !currentDateKey) return;
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  el.textContent = currentDate.toLocaleDateString(undefined, options);
}

function showToast(type, message) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.classList.add("toast");
  if (type === "success") toast.classList.add("toast-success");
  if (type === "error") toast.classList.add("toast-error");

  const msg = document.createElement("span");
  msg.classList.add("toast-message");
  msg.textContent = message;

  const close = document.createElement("span");
  close.classList.add("toast-close");
  close.textContent = "×";
  close.addEventListener("click", () => toast.remove());

  toast.appendChild(msg);
  toast.appendChild(close);
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 2500);
}

function collectCurrentData() {
  const data = {};
  for (const id of FIELD_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;

    if (el.type === "checkbox") data[id] = el.checked ? "1" : "0";
    else data[id] = el.value;
  }

  // Optional: store computed grade + hits if you want it saved
  const score = computeDailyScore();
  data.dayGrade = score.grade;   // e.g. "A"
  data.dayHits = String(score.hits); // "3"
  data.dayTotal = "5";

  return data;
}

/* ---------- Daily Score ---------- */

function gradeFromHits(hits) {
  if (hits === 5) return "A";
  if (hits === 4) return "B";
  if (hits === 3) return "C";
  if (hits === 2) return "D";
  return "F";
}

function setCheck(id, ok) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("pass", "fail");
  if (ok === null) return;
  el.classList.add(ok ? "pass" : "fail");
}

function computeDailyScore() {
  const sleep = parseFloat(document.getElementById("sleep")?.value || "");
  const calories = parseFloat(document.getElementById("calories")?.value || "");
  const protein = parseFloat(document.getElementById("protein")?.value || "");
  const screen = parseFloat(document.getElementById("screen")?.value || "");
  const trained = document.getElementById("trained")?.checked || false;

  const hasAny =
    !isNaN(sleep) || !isNaN(calories) || !isNaN(protein) || !isNaN(screen) || trained;

  const okSleep = isNaN(sleep) ? null : sleep >= SCORE_TARGETS.sleep;

  const okCalories = isNaN(calories)
    ? null
    : Math.abs(calories - SCORE_TARGETS.calories) <= SCORE_TARGETS.caloriesTolerance;

  const okProtein = isNaN(protein) ? null : protein >= SCORE_TARGETS.protein;
  const okScreen = isNaN(screen) ? null : screen <= SCORE_TARGETS.screen;
  const okTrained = trained ? true : false;

  const hits =
    (okSleep === true) +
    (okCalories === true) +
    (okProtein === true) +
    (okScreen === true) +
    (okTrained === true);

  const grade = hasAny ? gradeFromHits(hits) : "–";

  return {
    hasAny,
    hits,
    grade,
    checks: { okSleep, okCalories, okProtein, okScreen, okTrained }
  };
}

function updateDailyScore() {
  const score = computeDailyScore();

  setCheck("chkSleep", score.checks.okSleep);
  setCheck("chkCalories", score.checks.okCalories);
  setCheck("chkProtein", score.checks.okProtein);
  setCheck("chkScreen", score.checks.okScreen);
  setCheck("chkTrained", score.checks.okTrained);

  const gradeTag = document.getElementById("dayGrade");
  const big = document.getElementById("scoreBig");
  const detail = document.getElementById("scoreDetail");

  if (!score.hasAny) {
    if (gradeTag) gradeTag.textContent = "–";
    if (big) big.textContent = "–";
    if (detail) detail.textContent = "Enter data to score the day.";
    return;
  }

  if (gradeTag) gradeTag.textContent = score.grade;
  if (big) big.textContent = score.grade;
  if (detail) detail.textContent = `${score.hits}/5 non-negotiables hit`;
}

/* ---------- API ---------- */

async function saveDay(manual = false) {
  const saveBtn = document.getElementById("saveDay");

  if (manual && saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  if (!currentDateKey) {
    if (manual && saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Day";
    }
    return;
  }

  const payload = { date: currentDateKey, data: collectCurrentData() };

  try {
    const res = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`Save failed with status ${res.status}`);

    if (manual) showToast("success", "Day saved");
  } catch (err) {
    console.error("Error saving day:", err);
    if (manual) showToast("error", "Save failed. Check connection.");
  } finally {
    if (manual && saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Day";
    }
  }
}

async function loadDay(dateKey) {
  isLoadingDay = true;

  try {
    const res = await fetch(`/api/entries?date=${encodeURIComponent(dateKey)}`);
    const json = await res.json().catch(() => ({}));
    const data = json && json.data ? json.data : {};

    // available globally if you ever want to use it
    window.currentAresEntry = data;

    // Fill fields
    for (const id of FIELD_IDS) {
      const el = document.getElementById(id);
      if (!el) continue;

      if (el.type === "checkbox") el.checked = (data[id] || "0") === "1";
      else el.value = data[id] ?? "";
    }

    // Update score AFTER fields are populated
    updateDailyScore();
  } catch (err) {
    console.error("Error loading day:", err);
    window.currentAresEntry = null;
    showToast("error", "Load failed.");
  } finally {
    isLoadingDay = false;
  }
}

/* ---------- Events ---------- */

function scheduleAutoSave() {
  if (isLoadingDay) return;

  if (autoSaveTimer) clearTimeout(autoSaveTimer);

  // Update score instantly (no delay)
  updateDailyScore();

  autoSaveTimer = setTimeout(() => {
    saveDay(false);
  }, 800);
}

function initFields() {
  for (const id of FIELD_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("input", scheduleAutoSave);
    el.addEventListener("change", scheduleAutoSave);
  }
}

function resetToday() {
  const confirmReset = confirm("Reset fields for this day? This clears entries for this date.");
  if (!confirmReset) return;

  for (const id of FIELD_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;

    if (el.type === "checkbox") el.checked = false;
    else el.value = "";
  }

  updateDailyScore();
  saveDay(true);
}

function hardReset() {
  const confirmReset = confirm(
    "Hard reset clears local cache only. Backend history stays. Proceed?"
  );
  if (!confirmReset) return;

  Object.keys(localStorage)
    .filter(k => k.startsWith(STORAGE_PREFIX))
    .forEach(k => localStorage.removeItem(k));

  window.location.reload();
}

function shiftDay(delta) {
  // Save silently before switching days
  saveDay(false);

  currentDate.setDate(currentDate.getDate() + delta);
  currentDateKey = formatDateKey(currentDate);

  updateDateDisplay();
  loadDay(currentDateKey);
}

async function exportData() {
  try {
    const res = await fetch("/api/export");
    if (!res.ok) {
      alert("Error exporting data.");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "ares-entries.json";
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Export error:", err);
    alert("Export failed. Check console for details.");
  }
}

function initButtons() {
  const saveBtn = document.getElementById("saveDay");
  const exportBtn = document.getElementById("exportData");
  const resetBtn = document.getElementById("resetToday");
  const hardResetBtn = document.getElementById("hardReset");
  const prevDayBtn = document.getElementById("prevDay");
  const nextDayBtn = document.getElementById("nextDay");

  if (saveBtn) saveBtn.addEventListener("click", () => saveDay(true));
  if (exportBtn) exportBtn.addEventListener("click", exportData);
  if (resetBtn) resetBtn.addEventListener("click", resetToday);
  if (hardResetBtn) hardResetBtn.addEventListener("click", hardReset);
  if (prevDayBtn) prevDayBtn.addEventListener("click", () => shiftDay(-1));
  if (nextDayBtn) nextDayBtn.addEventListener("click", () => shiftDay(1));
}

function init() {
  currentDate = new Date();
  currentDateKey = formatDateKey(currentDate);

  updateDateDisplay();
  initFields();
  initButtons();

  loadDay(currentDateKey);
  updateDailyScore();
}

document.addEventListener("DOMContentLoaded", init);
