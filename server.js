const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "entries.json");

// Ensure data folder + file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({}), "utf8");
}

// Middleware
app.use(express.json()); // parse JSON request bodies
app.use(express.static(PUBLIC_DIR)); // serve index.html and other static files

// Helper functions to read/write the JSON "database"
function readEntries() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.error("Error reading entries:", err);
    return {};
  }
}

function writeEntries(entries) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing entries:", err);
  }
}

// ----- API ROUTES -----
// 1) Get data for a single day
// GET /api/entries?date=2025-11-24
app.get("/api/entries", (req, res) => {
  const date = req.query.date;
  if (!date) {
    return res.status(400).json({ error: "Missing 'date' query parameter" });
  }

  const entries = readEntries();
  const dayData = entries[date] || null;
  res.json({ date, data: dayData });
});

// 2) Save data for a single day
// POST /api/entries
// body: { date: "2025-11-24", data: { weight: 203.8, ... } }
app.post("/api/entries", (req, res) => {
  const { date, data } = req.body;

  if (!date || typeof date !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'date' in body" });
  }
  if (!data || typeof data !== "object") {
    return res.status(400).json({ error: "Missing or invalid 'data' in body" });
  }

  const entries = readEntries();
  entries[date] = data;
  writeEntries(entries);

  res.json({ success: true, date, data });
});

// 3) Get a range of days (for weekly/monthly views)
// GET /api/entries/range?from=2025-11-20&to=2025-11-27
app.get("/api/entries/range", (req, res) => {
  const from = req.query.from;
  const to = req.query.to;

  if (!from || !to) {
    return res
      .status(400)
      .json({ error: "Missing 'from' or 'to' query parameters" });
  }

  const entries = readEntries();
  const result = {};

  const keys = Object.keys(entries).sort(); // sort dates ascending
  keys.forEach((date) => {
    if (date >= from && date <= to) {
      result[date] = entries[date];
    }
  });

  res.json({ from, to, entries: result });
});
// 4) Export all entries as JSON (for backup / analysis)
// GET /api/export
app.get("/api/export", (req, res) => {
  const entries = readEntries();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=ares-entries.json");
  res.send(JSON.stringify(entries, null, 2));
});

// Fallback: send index.html for any unknown route (for SPA behavior)
app.use((req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Ares Terminal backend running on http://localhost:${PORT}`);
});