import express from "express";
import { getAuth } from "@clerk/express";

const router = express.Router();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// POST /api/chat/stream - Streams mock AI assistant responses
router.post("/stream", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Bad Request", message: "Prompt is required." });
  }

  // Set SSE Headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders(); // flush headers to establish SSE bridge

  // Prepare a dynamic mock response based on prompt keywords if appropriate
  let responseText = "Hello! I am your AuraEdit AI assistant. I am currently running in mock streaming mode. Once Stannis hooks me up to the Gemini API, I will be able to read your workspace file explorer, edit code files directly, format snippets, and help you save them to Neon PostgreSQL database. What would you like to build today?";

  if (prompt.toLowerCase().includes("hello") || prompt.toLowerCase().includes("hi")) {
    responseText = "Hi there! I am your AuraEdit AI code companion. I can stream responses back word-by-word. Soon I will be connected to the Gemini model to help you refactor, explain, or write code. Let me know what project we are working on!";
  } else if (prompt.toLowerCase().includes("code") || prompt.toLowerCase().includes("function")) {
    responseText = "Sure, here is a mock code block you requested:\n\n```typescript\nfunction greetUser(name: string): string {\n  return `Welcome to AuraEdit AI, ${name}!`;\n}\nconsole.log(greetUser(\"Developer\"));\n```\n\nI can help you review or write TSX files in this workspace. Ask me anything!";
  }

  try {
    const words = responseText.split(" ");
    
    for (const word of words) {
      // Check if client disconnected mid-stream
      if (res.writableEnded) break;
      
      const payload = { text: word + " " };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      await sleep(60); // 60ms delay per word simulates type-out streaming
    }

    if (!res.writableEnded) {
      res.write("data: [DONE]\n\n");
    }
  } catch (err) {
    console.error("Streaming error:", err);
  } finally {
    res.end();
  }
});

export default router;
