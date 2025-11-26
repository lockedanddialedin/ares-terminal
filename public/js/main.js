const STORAGE_PREFIX = "aresTerminal_v1_";
    const SETTINGS_KEY = STORAGE_PREFIX + "settings";

let aresSettings = null;

function getDefaultSettings() {
  return {
    targetSleep: 8.0,
    targetCalories: 2300,
    targetProtein: 190,
    targetScreen: 3.0,
    targetDiscipline: 8
  };
}

    const FIELD_IDS = [
  "weight","sleep","energy",
  "calories","protein","carbs","fats",
  "steps","water",
  "mood","screen","vitalNotes",
  "trainFocus","acadBlock","trainingNotes",
  "top3","audit",
  "rateDiscipline","rateFocus",
  "habit1Done","habit2Done","habit3Done","habit4Done"
];


    let currentDate = new Date();
    let currentDateKey = null;
    let autoSaveTimer = null;
    let isLoadingDay = false;
    let lastSyncTime = null;
    let weightChart = null;

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

      const todayDateText = document.getElementById("todayDateText");
      if (todayDateText) {
        const shortOpts = { weekday: "short", month: "short", day: "numeric" };
        todayDateText.textContent = currentDate.toLocaleDateString(undefined, shortOpts);
      }
    }

    function collectCurrentData() {
      const data = {};
      FIELD_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === "checkbox") {
          data[id] = el.checked ? "1" : "0";
        } else {
          data[id] = el.value;
        }
      });

      // --- per-day session type & execution grade ---
      const sessionRow = document.querySelector('.pill-row[data-group="sessionType"]');
      if (sessionRow) {
        const active = sessionRow.querySelector('.pill.active');
        data.sessionType = active ? active.getAttribute("data-value") : "";
      }

      const execRow = document.querySelector('.pill-row[data-group="execution"]');
      if (execRow) {
        const active = execRow.querySelector('.pill.active');
        data.executionGrade = active ? active.getAttribute("data-value") : "";
      }
      // --------------------------------------------------------

      return data;
    }

    function markSynced() {
      lastSyncTime = new Date();
      updateSyncMessage();
    }

    function updateSyncMessage() {
      const el = document.getElementById("syncMessage");
      if (!el) return;
      if (!lastSyncTime) {
        el.textContent = "Last sync: --";
        return;
      }
      const opts = { hour: "2-digit", minute: "2-digit" };
      el.textContent = "Last sync: " + lastSyncTime.toLocaleTimeString(undefined, opts);
    }

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

  const payload = {
    date: currentDateKey,
    data: collectCurrentData()
  };

  try {
    const res = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Save failed with status ${res.status}`);
    }

    if (manual) {
      console.log("Manual save complete for", currentDateKey);
      showToast("success", "Day saved");
    }

    markSynced();
    renderHistoryTable(); // update weekly view after saves
    updateHabitStats();   // update habit streaks
  } catch (err) {
    console.error("Error saving day:", err);
    if (manual) {
      showToast("error", "Error saving. Check connection.");
    }
  } finally {
    if (manual && saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Day";
    }
  }
}

    function showToast(type, message) {
  const container = document.getElementById("toastContainer");
  if (!container) {
    console.warn("Toast container not found");
    return;
  }

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
  close.addEventListener("click", () => {
    toast.remove();
  });

  toast.appendChild(msg);
  toast.appendChild(close);
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2500);
}
    function loadSettings() {
  const stored = localStorage.getItem(SETTINGS_KEY);
  const defaults = getDefaultSettings();
  try {
    aresSettings = stored ? { ...defaults, ...JSON.parse(stored) } : { ...defaults };
  } catch (e) {
    console.error("Error parsing settings, using defaults:", e);
    aresSettings = { ...defaults };
  }

  // Push into UI fields if present
  const map = {
    targetSleep: "targetSleep",
    targetCalories: "targetCalories",
    targetProtein: "targetProtein",
    targetScreen: "targetScreen",
    targetDiscipline: "targetDiscipline"
  };
  Object.keys(map).forEach(key => {
    const el = document.getElementById(map[key]);
    if (el && aresSettings[key] != null) {
      el.value = aresSettings[key];
    }
  });
}

function saveSettingsFromUI() {
  if (!aresSettings) {
    aresSettings = getDefaultSettings();
  }

  function numFrom(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const v = parseFloat(el.value);
    return isNaN(v) ? fallback : v;
  }

  aresSettings.targetSleep = numFrom("targetSleep", aresSettings.targetSleep);
  aresSettings.targetCalories = numFrom("targetCalories", aresSettings.targetCalories);
  aresSettings.targetProtein = numFrom("targetProtein", aresSettings.targetProtein);
  aresSettings.targetScreen = numFrom("targetScreen", aresSettings.targetScreen);
  aresSettings.targetDiscipline = numFrom("targetDiscipline", aresSettings.targetDiscipline);

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(aresSettings));
  showToast("success", "Settings saved");
  updateTodayStrip();
}

function getSettings() {
  if (!aresSettings) {
    loadSettings();
  }
  return aresSettings || getDefaultSettings();
}

    function scheduleAutoSave() {
      if (isLoadingDay) return;
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        saveDay(false);
      }, 800); // debounce ~0.8s
      updateTodayStrip();
    }

    function applySingleSelectPill(group, value) {
      const row = document.querySelector(`.pill-row[data-group="${group}"]`);
      if (!row) return;
      const pills = row.querySelectorAll(".pill");
      pills.forEach(p => {
        p.classList.toggle("active", !!value && p.getAttribute("data-value") === value);
      });
    }

    async function loadDay(dateKey) {
  isLoadingDay = true;
  try {
    const res = await fetch(`/api/entries?date=${encodeURIComponent(dateKey)}`);
    if (!res.ok) {
      console.warn("No entry yet for", dateKey);
    }
    const json = await res.json().catch(() => ({}));
    const data = json && json.data ? json.data : {};

    // 🔥 Make today’s entry available globally for THE PROGRAM
    window.currentAresEntry = data;

    FIELD_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === "checkbox") {
        el.checked = (data[id] || "0") === "1";
      } else {
        el.value = data[id] ?? "";
      }
    });

    applySingleSelectPill("sessionType", data.sessionType || "");
    applySingleSelectPill("execution", data.executionGrade || "");
  } catch (err) {
    console.error("Error loading day:", err);
    // In case of error, at least clear the global entry
    window.currentAresEntry = null;
  } finally {
    isLoadingDay = false;
  }
  updateTodayStrip();
  markSynced();
  renderHistoryTable();
  updateHabitStats();
}

    async function updateHabitStats() {
  // Look back 30 days for streaks & totals
  const toDate = new Date(currentDate);
  const fromDate = new Date(currentDate);
  fromDate.setDate(fromDate.getDate() - 29);

  const fromKey = formatDateKey(fromDate);
  const toKey = formatDateKey(toDate);

  try {
    const res = await fetch(
      `/api/entries/range?from=${encodeURIComponent(fromKey)}&to=${encodeURIComponent(toKey)}`
    );
    const json = await res.json();
    const entries = json.entries || {};

    // Build ordered list of date keys (oldest -> newest)
    const days = [];
    const tmp = new Date(fromDate);
    while (tmp <= toDate) {
      days.push(formatDateKey(tmp));
      tmp.setDate(tmp.getDate() + 1);
    }

    for (let i = 1; i <= 4; i++) {
      let bestStreak = 0;
      let running = 0;
      let totalDone = 0;

      // All-time best over last 30 days
      days.forEach(dKey => {
        const d = entries[dKey] || {};
        const done = d[`habit${i}Done`] === "1";
        if (done) {
          running += 1;
          totalDone += 1;
          if (running > bestStreak) bestStreak = running;
        } else {
          running = 0;
        }
      });

      // Current streak from today backwards
      let currentStreak = 0;
      const back = new Date(toDate);
      while (true) {
        const key = formatDateKey(back);
        const d = entries[key] || {};
        const done = d[`habit${i}Done`] === "1";
        if (done) {
          currentStreak += 1;
          back.setDate(back.getDate() - 1);
          // stop if we walked past the range
          if (back < fromDate) break;
        } else {
          break;
        }
      }

      // Update text
      const streakEl = document.getElementById(`habit${i}Streak`);
      const bestEl = document.getElementById(`habit${i}Best`);
      const totalEl = document.getElementById(`habit${i}Total`);
      if (streakEl) streakEl.textContent = currentStreak;
      if (bestEl) bestEl.textContent = bestStreak;
      if (totalEl) totalEl.textContent = totalDone;

      // Weekly dots (last 7 days)
      const weekEl = document.getElementById(`habit${i}Week`);
      if (weekEl) {
        weekEl.innerHTML = "";
        const weeklyStart = new Date(toDate);
        weeklyStart.setDate(weeklyStart.getDate() - 6);
        const weekDays = [];
        const t = new Date(weeklyStart);
        while (t <= toDate) {
          weekDays.push(formatDateKey(t));
          t.setDate(t.getDate() + 1);
        }

        weekDays.forEach((key, idx) => {
          const d = entries[key] || {};
          const done = d[`habit${i}Done`] === "1";

          const dot = document.createElement("div");
          dot.classList.add("habit-dot");
          dot.classList.add(done ? "done" : "miss");
          if (idx === weekDays.length - 1) {
            dot.classList.add("today-outline");
          }
          dot.title = `${key}: ${done ? "Done" : "Missed"}`;
          weekEl.appendChild(dot);
        });
      }
    }
  } catch (err) {
    console.error("Error updating habit stats:", err);
  }
}

    function updateWeightChart(labels, weights) {
      const canvas = document.getElementById("weightChart");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!weightChart) {
        weightChart = new Chart(ctx, {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                data: weights,
                tension: 0.3,
                fill: false,
                pointRadius: 2,
                borderWidth: 2
              }
            ]
          },
          options: {
            plugins: {
              legend: { display: false }
            },
            scales: {
              x: {
                ticks: { autoSkip: true, maxTicksLimit: 7 }
              },
              y: {
                beginAtZero: false
              }
            }
          }
        });
      } else {
        weightChart.data.labels = labels;
        weightChart.data.datasets[0].data = weights;
        weightChart.update();
      }
    }

    async function renderHistoryTable() {
      const body = document.getElementById("historyBody");
      if (!body) return;
      body.innerHTML = "";

      const toDate = new Date(currentDate);
      const fromDate = new Date(currentDate);
      fromDate.setDate(fromDate.getDate() - 6);

      const fromKey = formatDateKey(fromDate);
      const toKey = formatDateKey(toDate);

      try {
        const res = await fetch(`/api/entries/range?from=${encodeURIComponent(fromKey)}&to=${encodeURIComponent(toKey)}`);
        const json = await res.json();
        const entries = json.entries || {};

        const days = [];
        const temp = new Date(fromDate);
        while (temp <= toDate) {
          days.push(formatDateKey(temp));
          temp.setDate(temp.getDate() + 1);
        }

        let hasAny = false;
        const labels = [];
        const weights = [];

        days.forEach(key => {
          const d = entries[key] || {};
          if (Object.keys(d).length > 0) hasAny = true;

          const row = document.createElement("tr");
          const cells = [
            key,
            d.weight || "-",
            d.calories || "-",
            d.rateDiscipline || "-"
          ];
          cells.forEach(text => {
            const td = document.createElement("td");
            td.textContent = text;
            row.appendChild(td);
          });
          body.appendChild(row);

          labels.push(key.slice(5)); // MM-DD
          const w = parseFloat(d.weight);
          weights.push(isNaN(w) ? null : w);
        });

        if (!hasAny) {
          body.innerHTML = "";
          const row = document.createElement("tr");
          const td = document.createElement("td");
          td.colSpan = 4;
          td.textContent = "Fill out at least one day to see your weekly history.";
          row.appendChild(td);
          body.appendChild(row);
        }

        updateWeightChart(labels, weights);
      } catch (err) {
        console.error("Error rendering history:", err);
        const row = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 4;
        td.textContent = "Error loading history.";
        row.appendChild(td);
        body.appendChild(row);
      }
    }

    function initFields() {
      FIELD_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", scheduleAutoSave);
        el.addEventListener("change", scheduleAutoSave);
      });
    }

    function storageKey(id) {
      return STORAGE_PREFIX + id;
    }

    function initPills() {
      document.querySelectorAll(".pill-row").forEach(row => {
        const group = row.getAttribute("data-group") || "";
        const pills = row.querySelectorAll(".pill");

        // Single-select groups (per-day only)
        const isSingleSelect = group === "execution" || group === "sessionType";
        const persists = !isSingleSelect; // non-execution/session groups persist (rules, etc.)

        let key;
        if (persists) {
          key = storageKey("pill_" + group);
          const saved = localStorage.getItem(key);
          if (saved) {
            const values = saved.split("||");
            pills.forEach(p => {
              if (values.includes(p.getAttribute("data-value"))) {
                p.classList.add("active");
              }
            });
          }
        }

        row.addEventListener("click", e => {
          const pill = e.target.closest(".pill");
          if (!pill) return;

          if (isSingleSelect) {
            const alreadyActive = pill.classList.contains("active");
            if (alreadyActive) {
              pill.classList.remove("active");
            } else {
              pills.forEach(p => p.classList.remove("active"));
              pill.classList.add("active");
            }
          } else {
            pill.classList.toggle("active");
          }

          if (persists && key) {
            const activeValues = Array.from(pills)
              .filter(p => p.classList.contains("active"))
              .map(p => p.getAttribute("data-value"));
            localStorage.setItem(key, activeValues.join("||"));
          }

          scheduleAutoSave();
        });
      });
    }

    function initHabits() {
      for (let i = 1; i <= 4; i++) {
        const nameInput = document.getElementById(`habit${i}Name`);
        if (!nameInput) continue;
        const key = storageKey(`habitName${i}`);
        const saved = localStorage.getItem(key);
        if (saved) {
          nameInput.value = saved;
        }
        nameInput.addEventListener("input", () => {
          localStorage.setItem(key, nameInput.value.trim());
        });
      }
    }

    function resetToday() {
      const confirmReset = confirm("Reset fields for this day? This will clear entries for this date.");
      if (!confirmReset) return;

      FIELD_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === "checkbox") {
          el.checked = false;
        } else {
          el.value = "";
        }
      });

      // Clear per-day pills (session type & execution only)
      document
        .querySelectorAll('[data-group="sessionType"] .pill, [data-group="execution"] .pill')
        .forEach(p => p.classList.remove("active"));

      updateTodayStrip();
      saveDay(true);
    }

    function hardReset() {
      const confirmReset = confirm(
        "Hard reset will clear pill states and local cache. It does NOT delete backend history yet. Proceed?"
      );
      if (!confirmReset) return;

      Object.keys(localStorage)
        .filter(k => k.startsWith(STORAGE_PREFIX))
        .forEach(k => localStorage.removeItem(k));

      window.location.reload();
    }

    function shiftDay(delta) {
      saveDay(false);
      currentDate.setDate(currentDate.getDate() + delta);
      currentDateKey = formatDateKey(currentDate);
      updateDateDisplay();
      loadDay(currentDateKey);
    }

    function updateTodayStrip() {
      const sleepVal = parseFloat(document.getElementById("sleep")?.value || "0");
      const caloriesVal = parseFloat(document.getElementById("calories")?.value || "0");
      const proteinVal = parseFloat(document.getElementById("protein")?.value || "0");
      const screenVal = parseFloat(document.getElementById("screen")?.value || "0");
      const disciplineVal = parseFloat(document.getElementById("rateDiscipline")?.value || "0");
      const focusTextRaw = document.getElementById("trainFocus")?.value || "";
      const s = getSettings();


      const focusEl = document.getElementById("todayFocusText");
      if (focusEl) {
        let display = focusTextRaw.replace(/\s+/g, " ").trim();
        if (!display) display = "Set your training focus for today.";
        if (display.length > 80) display = display.slice(0, 80) + "…";
        focusEl.textContent = "Training Focus: " + display;
      }

      const metricSleep = document.getElementById("metricSleepValue");
      const metricCalories = document.getElementById("metricCaloriesValue");
      const metricProtein = document.getElementById("metricProteinValue");
      const metricScreen = document.getElementById("metricScreenValue");
      const metricDiscipline = document.getElementById("metricDisciplineValue");

      if (metricSleep) metricSleep.textContent = sleepVal ? `${sleepVal.toFixed(1)} h` : "–";
      if (metricCalories) metricCalories.textContent = caloriesVal ? `${Math.round(caloriesVal)} kcal` : "–";
      if (metricProtein) metricProtein.textContent = proteinVal ? `${Math.round(proteinVal)} g` : "–";
      if (metricScreen) metricScreen.textContent = screenVal ? `${screenVal.toFixed(1)} h` : "–";
      if (metricDiscipline) metricDiscipline.textContent = (disciplineVal || disciplineVal === 0) ? `${disciplineVal || 0}/10` : "–";

            const tagsEl = document.getElementById("todayTags");
      if (!tagsEl) return;
      tagsEl.innerHTML = "";

      const tags = [];

      // Sleep
      if (sleepVal) {
        if (sleepVal >= s.targetSleep) {
          tags.push({ type: "good", text: "Rested" });
        } else if (sleepVal < s.targetSleep - 0.5) {
          tags.push({ type: "warning", text: "Sleep Debt" });
        }
      }

      // Calories
      if (caloriesVal) {
        const diff = Math.abs(caloriesVal - s.targetCalories);
        if (diff <= 200) {
          tags.push({ type: "good", text: "Fuel On Target" });
        } else if (caloriesVal > s.targetCalories + 200) {
          tags.push({ type: "warning", text: "Calories High" });
        }
      }

      // Protein
      if (proteinVal) {
        if (proteinVal >= s.targetProtein) {
          tags.push({ type: "good", text: "Protein Hit" });
        } else if (proteinVal < s.targetProtein) {
          tags.push({ type: "warning", text: "Low Protein" });
        }
      }

      // Screen
      if (screenVal) {
        if (screenVal > s.targetScreen) {
          tags.push({ type: "bad", text: "High Screen" });
        } else if (screenVal <= s.targetScreen) {
          tags.push({ type: "good", text: "Screen Locked" });
        }
      }

      // Discipline
      if (disciplineVal || disciplineVal === 0) {
        if (disciplineVal >= s.targetDiscipline) {
          tags.push({ type: "good", text: "On Track" });
        } else if (disciplineVal <= 4) {
          tags.push({ type: "bad", text: "Discipline Low" });
        }
      }

      if (tags.length === 0) {
        tags.push({ type: "", text: "Awaiting data" });
      }

      tags.forEach(tag => {
        const span = document.createElement("span");
        span.classList.add("status-pill");
        if (tag.type) span.classList.add(tag.type);
        span.textContent = tag.text;
        tagsEl.appendChild(span);
      });

    }

    function initButtons() {
      const saveBtn = document.getElementById("saveDay");
      const exportBtn = document.getElementById("exportData");
      const resetBtn = document.getElementById("resetToday");
      const hardResetBtn = document.getElementById("hardReset");
      const prevDayBtn = document.getElementById("prevDay");
      const nextDayBtn = document.getElementById("nextDay");
      const manualSyncBtn = document.getElementById("manualSync");
      const saveSettingsBtn = document.getElementById("saveSettings");


      if (saveSettingsBtn) saveSettingsBtn.addEventListener("click", saveSettingsFromUI);
      if (saveBtn) saveBtn.addEventListener("click", () => saveDay(true));
      if (exportBtn) exportBtn.addEventListener("click", exportData);
      if (resetBtn) resetBtn.addEventListener("click", resetToday);
      if (hardResetBtn) hardResetBtn.addEventListener("click", hardReset);
      if (prevDayBtn) prevDayBtn.addEventListener("click", () => shiftDay(-1));
      if (nextDayBtn) nextDayBtn.addEventListener("click", () => shiftDay(1));
      if (manualSyncBtn) manualSyncBtn.addEventListener("click", () => {
        if (!currentDateKey) return;
        loadDay(currentDateKey);
      });
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

    function init() {
      currentDate = new Date();
      currentDateKey = formatDateKey(currentDate);
      updateDateDisplay();
      initFields();
      initPills();
      initHabits();
      initButtons();
      updateSyncMessage();
      loadDay(currentDateKey);
      updateHabitStats();

    }

    document.addEventListener("DOMContentLoaded", init);
