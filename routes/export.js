const express = require("express");
const router = express.Router();
const { getAllEntries } = require("../db/entries");

// GET /api/export
router.get("/", async (req, res) => {
  try {
    const rows = await getAllEntries();
    const entries = {};
    rows.forEach(row => {
      entries[row.date] = row.data;
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=ares-entries.json"
    );
    res.send(JSON.stringify(entries, null, 2));
  } catch (err) {
    console.error("Error exporting data:", err);
    res.status(500).json({ error: "Database error exporting data" });
  }
});

module.exports = router;
