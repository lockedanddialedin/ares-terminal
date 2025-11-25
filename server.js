require("dotenv").config(); // Load .env in local dev


const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const PUBLIC_DIR = path.join(__dirname, "public");

// ----- DATABASE SETUP -----
if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL is not set. Backend will not be able to store data.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // required for most managed Postgres (including Supabase)
  }
});

async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS entries (
        date TEXT PRIMARY KEY,
        data JSONB NOT NULL
      )
    `);
    console.log("Database ready (entries table ensured).");
  } catch (err) {
    console.error("Error initializing database:", err);
    process.exit(1);
  }
}
initDb();

// ----- MIDDLEWARE -----
app.use(express.json()); // parse JSON request bodies
app.use(express.static(PUBLIC_DIR)); // serve index.html and assets

// ----- API ROUTES -----

// 1) Get data for a single day
// GET /api/entries?date=2025-11-25
app.get("/api/entries", async (req, res) => {
  const date = req.query.date;
  if (!date) {
    return res.status(400).json({ error: "Missing 'date' query parameter" });
  }

  try {
    const result = await pool.query("SELECT data FROM entries WHERE date = $1", [date]);
    const row = result.rows[0];
    const dayData = row ? row.data : null;
    res.json({ date, data: dayData });
  } catch (err) {
    console.error("Error fetching entry:", err);
    res.status(500).json({ error: "Database error fetching entry" });
  }
});

// 2) Save data for a single day (upsert + merge JSON)
// POST /api/entries
// body: { date: "2025-11-25", data: { weight: 203.8, ... } }
app.post("/api/entries", async (req, res) => {
  const { date, data } = req.body;

  if (!date || typeof date !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'date' in body" });
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return res.status(400).json({ error: "Missing or invalid 'data' in body" });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO entries (date, data)
      VALUES ($1, $2)
      ON CONFLICT (date) DO UPDATE
      SET data = entries.data || EXCLUDED.data
      RETURNING data
      `,
      [date, data]
    );

    res.json({ success: true, date, data: result.rows[0].data });
  } catch (err) {
    console.error("Error saving entry:", err);
    res.status(500).json({ error: "Database error saving entry" });
  }
});



// 3) Get a range of days (for weekly/monthly views)
// GET /api/entries/range?from=2025-11-20&to=2025-11-27
app.get("/api/entries/range", async (req, res) => {
  const from = req.query.from;
  const to = req.query.to;

  if (!from || !to) {
    return res
      .status(400)
      .json({ error: "Missing 'from' or 'to' query parameters" });
  }

  try {
    const result = await pool.query(
      `
      SELECT date, data
      FROM entries
      WHERE date >= $1 AND date <= $2
      ORDER BY date ASC
      `,
      [from, to]
    );

    const entries = {};
    result.rows.forEach(row => {
      entries[row.date] = row.data;
    });

    res.json({ from, to, entries });
  } catch (err) {
    console.error("Error fetching range:", err);
    res.status(500).json({ error: "Database error fetching range" });
  }
});

// 4) Export all entries as JSON (for backup / analysis)
// GET /api/export
app.get("/api/export", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT date, data FROM entries ORDER BY date ASC"
    );
    const entries = {};
    result.rows.forEach(row => {
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

// Fallback: send index.html for any unknown route (SPA behavior)
app.use((req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Ares Terminal backend running on http://localhost:${PORT}`);
});
