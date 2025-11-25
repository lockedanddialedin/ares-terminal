const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL is not set. Backend will not be able to store data.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;
