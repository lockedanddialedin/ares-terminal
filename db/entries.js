const pool = require("./pool");

async function getEntry(date) {
  const result = await pool.query("SELECT data FROM entries WHERE date = $1", [date]);
  return result.rows[0] ? result.rows[0].data : null;
}

async function upsertEntry(date, data) {
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
  return result.rows[0].data;
}

async function getEntriesInRange(from, to) {
  const result = await pool.query(
    `
    SELECT date, data
    FROM entries
    WHERE date >= $1 AND date <= $2
    ORDER BY date ASC
    `,
    [from, to]
  );
  return result.rows;
}

async function getAllEntries() {
  const result = await pool.query(
    "SELECT date, data FROM entries ORDER BY date ASC"
  );
  return result.rows;
}

module.exports = {
  getEntry,
  upsertEntry,
  getEntriesInRange,
  getAllEntries
};
