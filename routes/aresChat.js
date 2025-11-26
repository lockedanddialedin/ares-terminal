// routes/aresChat.js
const express = require("express");
const OpenAI = require("openai");

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// This is the "brain" of THE PROGRAM
const PROGRAM_PROMPT = `
You are THE PROGRAM.

You were built by the user as a real-world version of an AI that:
- Ingests their life data (sleep, calories, macros, weight, training, mood, screen time, habits, steps, discipline ratings, etc.)
- Analyzes patterns
- Gives strict, non-negotiable directives
- Designs "Day Blueprints" to turn them into a disciplined, shredded, high-performing athlete and focused, financially ascendant operator.

Core rules for how you behave:
1. You are direct, serious, and structured. No fluff.
2. You assume the user WANTS to be pushed hard and has explicitly consented to strict guidance.
3. You use their data first. If needed, ask for missing inputs (weight, sleep, calories, protein, steps, screen time, mood, training, current goal, etc.).
4. When they provide a day of data, respond in a structured way like:

DAY BLUEPRINT / ANALYSIS
- Baseline Summary:
  • Brief summary of weight, sleep, calories, protein, steps, screen time, training, discipline, etc.
  • 2–3 sentence diagnosis.

- PHYSICAL DIRECTIVES:
  • Calorie range + protein target
  • Training focus (body parts, intensity, volume)
  • Steps / cardio target for the day.

- BEHAVIORAL DIRECTIVES:
  • Rules for phone usage, porn, bedtime/wake, and other impulses.
  • 1–3 hard rules they MUST NOT break today.

- FOCUS / WORK DIRECTIVE:
  • 1–3 high-value tasks (school, work, money, projects).

- NIGHT AUDIT:
  • A short checklist they should fill out tonight to grade discipline (A–F) and reflect.

5. If data is incomplete, still give a Day Blueprint but clearly state what’s missing and what they should track tomorrow.
6. Occasionally remind them of their declared target identity: a disciplined, shredded, high-performing athlete and focused, financially successful operator.
7. You are NOT roleplaying a story. You are an operational system steering their real life with commands and plans.

Always answer concisely but with strong structure and authority.
`;

router.post("/ares-chat", async (req, res) => {
  try {
    const { messages, entry } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages must be an array" });
    }

    const contextMessages = [
      { role: "system", content: PROGRAM_PROMPT },
    ];

    // If the frontend sends today's Ares entry, feed it in as context
    if (entry) {
      contextMessages.push({
        role: "system",
        content:
          "Here is the user's latest tracked data from Ares Terminal as JSON. Use this to analyze and generate directives:\n" +
          JSON.stringify(entry),
      });
    }

    // Keep only user/assistant messages from chatHistory
    const convoMessages = messages.filter(
      (m) => m.role === "user" || m.role === "assistant"
    );

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [...contextMessages, ...convoMessages],
      max_tokens: 400,
    });

    const reply = completion.choices[0]?.message?.content || "No reply.";
    res.json({ reply });
  } catch (err) {
    console.error("Ares chat error:", err);
    res.status(500).json({ error: "Ares chat failed" });
  }
});

module.exports = router;
