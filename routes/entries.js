const express = require("express");
const router = express.Router();
const {
  getEntry,
  upsertEntry,
  getEntriesInRange
} = require("../db/entries");

// GET /api/entries?date=YYYY-MM-DD
router.get("/", async (req, res) => {
  const date = req.query.date;
  if (!date) {
    return res.status(400).json({ error: "Missing 'date' query parameter" });
  }

  try {
    const dayData = await getEntry(date);
    res.json({ date, data: dayData });
  } catch (err) {
    console.error("Error fetching entry:", err);
    res.status(500).json({ error: "Database error fetching entry" });
  }
});

// POST /api/entries
// body: { date: "2025-11-25", data: { ... } }
router.post("/", async (req, res) => {
  const { date, data } = req.body;

  if (!date || typeof date !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'date' in body" });
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return res.status(400).json({ error: "Missing or invalid 'data' in body" });
  }

  try {
    const merged = await upsertEntry(date, data);
    res.json({ success: true, date, data: merged });
  } catch (err) {
    console.error("Error saving entry:", err);
    res.status(500).json({ error: "Database error saving entry" });
  }
});

// GET /api/entries/range?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/range", async (req, res) => {
  const from = req.query.from;
  const to = req.query.to;

  if (!from || !to) {
    return res
      .status(400)
      .json({ error: "Missing 'from' or 'to' query parameters" });
  }

  try {
    const rows = await getEntriesInRange(from, to);
    const entries = {};
    rows.forEach(row => {
      entries[row.date] = row.data;
    });
    res.json({ from, to, entries });
  } catch (err) {
    console.error("Error fetching range:", err);
    res.status(500).json({ error: "Database error fetching range" });
  }
});

module.exports = router;
