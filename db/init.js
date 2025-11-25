const pool = require("./pool");

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

module.exports = initDb;
