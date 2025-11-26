// server.js
require("dotenv").config(); // <-- load .env FIRST

const express = require("express");
const path = require("path");

const initDb = require("./db/init");
const entriesRouter = require("./routes/entries");
const exportRouter = require("./routes/export");
const aresChatRoute = require("./routes/aresChat"); // <-- use require, not import

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, "public");

// Middleware
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// Initialize database (ensure table)
initDb();

// API routes
app.use("/api", aresChatRoute);       // <-- /api/ares-chat lives here
app.use("/api/entries", entriesRouter);
app.use("/api/export", exportRouter);

// Fallback: send index.html for any unknown route (SPA behavior)
app.use((req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Ares Terminal backend running on http://localhost:${PORT}`);
});
