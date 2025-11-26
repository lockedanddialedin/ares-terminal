// routes/aresChat.js
const express = require("express");
const OpenAI = require("openai");

const router = express.Router();

// process.env.OPENAI_API_KEY is now available because dotenv
// was loaded in server.js before this file was required.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/ares-chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages must be an array" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-5.1-mini",
      messages,
      max_tokens: 350,
    });

    const reply = completion.choices[0]?.message?.content || "No reply.";
    res.json({ reply });
  } catch (err) {
    console.error("Ares chat error:", err);
    res.status(500).json({ error: "Ares chat failed" });
  }
});

module.exports = router;
