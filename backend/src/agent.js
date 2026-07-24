import express from "express";
import { getAuth } from "@clerk/express";
import Groq from "groq-sdk";
import fs from "fs/promises";
import path from "path";
import prisma from "./db.js";

const router = express.Router();
const STORAGE_ROOT = path.resolve("./storage/users");

// Helper to ensure path is secure and stays within the user's project folder
function getSecurePath(userId, projectName, relativeFilePath) {
  const userDir = path.join(STORAGE_ROOT, userId);
  const projectDir = path.join(userDir, projectName);

  if (!relativeFilePath) {
    return projectDir;
  }

  const absoluteFilePath = path.join(projectDir, relativeFilePath);

  // Prevent Directory Traversal
  if (!absoluteFilePath.startsWith(projectDir)) {
    throw new Error("Security Violation: Access denied outside project boundary.");
  }

  return absoluteFilePath;
}

// Get relative file paths for system prompt context
async function getRelativeFilePaths(dirPath, baseDir) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let paths = [];
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(baseDir, entryPath).replace(/\\/g, "/");

      if (["node_modules", "dist", ".next", ".git", ".turbo", "build", "out", ".prisma"].includes(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        paths = paths.concat(await getRelativeFilePaths(entryPath, baseDir));
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if ([".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".tar", ".gz", ".dll", ".exe", ".tmp"].includes(ext)) {
          continue;
        }
        paths.push(relativePath);
      }
    }
    return paths;
  } catch (err) {
    return [];
  }
}

// Helper to build recursive tree representation of folders/files
async function readDirectoryTree(dirPath, baseDir) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(baseDir, entryPath).replace(/\\/g, "/");

    if (["node_modules", "dist", ".next", ".git", ".turbo", "build", "out", ".prisma"].includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      result.push({
        name: entry.name,
        path: relativePath,
        type: "directory",
        children: await readDirectoryTree(entryPath, baseDir)
      });
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if ([".pdf", ".zip", ".tar", ".gz", ".dll", ".exe", ".tmp"].includes(ext)) {
        continue;
      }
      result.push({
        name: entry.name,
        path: relativePath,
        type: "file"
      });
    }
  }

  return result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// Helper to grep recursively
async function searchFilesRecursively(dirPath, query, baseDir) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  let results = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(baseDir, entryPath).replace(/\\/g, "/");

    if (["node_modules", "dist", ".next", ".git", ".turbo", "build", "out", ".prisma"].includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      results = results.concat(await searchFilesRecursively(entryPath, query, baseDir));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if ([".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".tar", ".gz", ".dll", ".exe", ".tmp"].includes(ext)) {
        continue;
      }

      try {
        const content = await fs.readFile(entryPath, "utf8");
        if (content.toLowerCase().includes(query.toLowerCase())) {
          const lines = content.split("\n");
          const matches = [];
          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(query.toLowerCase())) {
              matches.push({ lineNum: index + 1, content: line.trim() });
            }
          });
          results.push({ path: relativePath, matches: matches.slice(0, 5) });
        }
      } catch (err) {
        // Ignore single read errors
      }
    }
  }
  return results;
}

// Simple line diff helper to calculate lines added/removed
function getLineDiff(oldContent, newContent) {
  const oldLines = oldContent ? oldContent.split("\n") : [];
  const newLines = newContent ? newContent.split("\n") : [];
  
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  
  let added = 0;
  let removed = 0;
  
  for (const line of newLines) {
    if (!oldSet.has(line)) added++;
  }
  for (const line of oldLines) {
    if (!newSet.has(line)) removed++;
  }
  
  return { added, removed };
}

// Parse JSON that may contain raw control characters (unescaped newlines/tabs) inside
// string values — a common reason Groq rejects the tool call in the first place.
function safeJsonParse(s) {
  const escapeCtrl = (str) => {
    let out = "";
    for (const ch of str) {
      if (ch.charCodeAt(0) < 0x20) out += JSON.stringify(ch).slice(1, -1);
      else out += ch;
    }
    return out;
  };
  for (const attempt of [s, escapeCtrl(s)]) {
    try {
      return JSON.parse(attempt);
    } catch (_) {}
  }
  return null;
}

// Scans from an opening '{' and returns the balanced JSON object substring,
// respecting string literals (so braces inside JSON string values are ignored).
// This is needed because tool-call arguments contain code with nested { } braces.
function extractBalancedJson(str, startIdx) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startIdx; i < str.length; i++) {
    const ch = str[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (inStr) {
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return str.slice(startIdx, i + 1);
    }
  }
  return null;
}

// Some Groq/Llama models emit tool calls in a text format like
// `<function=write_file,{"path":"...","content":"..."}></function>` that Groq's server
// rejects with a `tool_use_failed` 400. Formats vary (with/without a trailing `>`, and
// the args contain nested braces), so we locate each `<function=NAME` and then extract a
// balanced JSON object for the args, letting us run the intended call ourselves.
function parseGroqFailedGeneration(err) {
  let haystack = "";
  try {
    haystack =
      err?.error?.failed_generation ||
      err?.error?.error?.failed_generation ||
      "";
  } catch (_) {}
  if (!haystack) {
    try {
      haystack = `${err?.message || ""} ${JSON.stringify(err?.error ?? "")}`;
    } catch (_) {
      haystack = err?.message || "";
    }
  }

  const calls = [];
  const nameRe = /<function=([a-zA-Z0-9_]+)/g;
  let m;
  while ((m = nameRe.exec(haystack)) !== null) {
    const name = m[1];
    const braceIdx = haystack.indexOf("{", nameRe.lastIndex);
    if (braceIdx === -1) continue;
    const jsonStr = extractBalancedJson(haystack, braceIdx);
    if (!jsonStr) continue;

    // Continue scanning after this call's JSON to avoid matching inside it.
    nameRe.lastIndex = braceIdx + jsonStr.length;

    const args = safeJsonParse(jsonStr);
    // Skip calls we can't parse rather than executing a tool with empty args.
    if (args && typeof args === "object") {
      calls.push({ name, args });
    }
  }
  return calls;
}

function getGroqTools() {
  return [
    {
      type: "function",
      function: {
        name: "list_files",
        description: "List all files and folders recursively in the active workspace project root.",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "read_file",
        description: "Read the full contents of a file in the workspace.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "The relative file path to read from the project root." }
          },
          required: ["path"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "write_file",
        description: "Write content to a file, replacing its content entirely. Can edit existing files.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "The relative file path to write to." },
            content: { type: "string", description: "The full content to write to the file." }
          },
          required: ["path", "content"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_file",
        description: "Create a new file in the workspace with initial content.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "The relative file path to create." },
            content: { type: "string", description: "The initial content of the file." }
          },
          required: ["path", "content"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "delete_file",
        description: "Delete a file recursively in the workspace.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "The relative file path to delete." }
          },
          required: ["path"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "search_in_files",
        description: "Search for a string pattern across all text files in the project workspace recursively.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "The text string to search for." }
          },
          required: ["query"]
        }
      }
    }
  ];
}

// POST /api/agent/stream - Agentic streaming endpoint (Groq, tool-calling)
router.post("/stream", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { projectId, prompt, history = [], model } = req.body;
  // Groq production models that support tool calling. Update from the Groq
  // models page as their lineup changes: https://console.groq.com/docs/models
  const GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "llama-3.1-8b-instant",
  ];
  const DEFAULT_MODEL = "llama-3.3-70b-versatile";
  const selectedModel = GROQ_MODELS.includes(model) ? model : DEFAULT_MODEL;

  if (!projectId || !prompt) {
    return res.status(400).json({ error: "Bad Request", message: "projectId and prompt are required." });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return res.status(500).json({
      error: "Configuration Error",
      message: "GROQ_API_KEY is not defined in backend environment variables."
    });
  }

  // Setup SSE stream headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  console.log(`[Stream API] Entering stream route. ProjectId: ${projectId}, Model: ${selectedModel}`);
  try {
    // 1. Resolve project
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: auth.userId }
    });

    if (!project) {
      console.log(`[Stream API] Project not found in database for user ${auth.userId}`);
      res.write(`data: ${JSON.stringify({ type: "error", message: "Project not found." })}\n\n`);
      return res.end();
    }
    console.log(`[Stream API] Project resolved: ${project.name}`);

    const projectDir = getSecurePath(auth.userId, project.name);

    // 2. Build system instruction
    const filePaths = await getRelativeFilePaths(projectDir, projectDir);
    let filePathsList = filePaths.slice(0, 150).join("\n");
    if (filePaths.length > 150) {
      filePathsList += `\n... and ${filePaths.length - 150} more files. Use list_files tool to see everything.`;
    }

    let systemInstruction = `You are Forge AI, an autonomous coding assistant built into Forge — an AI editor for building Next.js apps.
Workspace Project Name: ${project.name}
Files in workspace:
${filePathsList}

This is a Next.js project. Assume the App Router with TypeScript and Tailwind CSS unless the files clearly show otherwise.

Next.js conventions you MUST follow:
- Use the App Router only. Routes live in the 'app/' directory. Never create a 'pages/' directory.
- Route files: 'app/<route>/page.tsx' for pages, 'app/<route>/layout.tsx' for layouts, 'app/<route>/route.ts' for API routes, 'app/<route>/loading.tsx' and 'error.tsx' for loading/error UI.
- Components are Server Components by default. Only add the "use client" directive (as the first line) when a component needs hooks (useState/useEffect), browser APIs, or event handlers.
- Style with Tailwind utility classes. Do not introduce a different CSS framework or CSS-in-JS.
- Use TypeScript (.tsx/.ts). Export 'metadata' objects for SEO where appropriate.
- Use the 'next/link' component for internal navigation and 'next/image' for images.
- Keep the project on Next 15.x — do NOT upgrade 'next' to 16.x (it must run in the in-browser preview).

Tool rules:
- Read existing files with 'read_file' BEFORE editing them so you have their full content.
- Write complete file contents with 'write_file' — never partial snippets or placeholders.
- Always perform tool calls natively.
- All paths must be relative to the project root.
- You cannot run terminal commands; you only edit files. The user runs the app via the built-in Preview (which boots a WebContainer and runs 'next dev').`;

    // Initialize the Groq client + messages
      const groqClient = new Groq({ apiKey: groqApiKey });
      const groqMessages = [{ role: "system", content: systemInstruction }];
      for (const msg of history) {
        if (msg.role === "user" || msg.role === "assistant") {
          groqMessages.push({
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content || ""
          });
        }
      }
      groqMessages.push({ role: "user", content: prompt });

      let keepLooping = true;
      let loopIteration = 0;
      const maxIterations = 15;
      const groqTools = getGroqTools();

      console.log(`[Groq Path] Starting SDK-based execution loop. Tools count: ${groqTools.length}`);

      // Executes one tool call, emitting SSE file_change events for writes/creates/deletes.
      const executeToolCall = async (callName, parsedArgs) => {
        switch (callName) {
          case "list_files": {
            const tree = await readDirectoryTree(projectDir, projectDir);
            return { files: tree };
          }
          case "read_file": {
            const target = getSecurePath(auth.userId, project.name, parsedArgs.path);
            const fileContent = await fs.readFile(target, "utf8");
            return { content: fileContent };
          }
          case "write_file": {
            const target = getSecurePath(auth.userId, project.name, parsedArgs.path);
            let oldContent = "";
            try { oldContent = await fs.readFile(target, "utf8"); } catch (_) {}
            await fs.writeFile(target, parsedArgs.content, "utf8");
            const diff = getLineDiff(oldContent, parsedArgs.content);
            res.write(`data: ${JSON.stringify({ type: "file_change", action: "Modified", path: parsedArgs.path, added: diff.added, removed: diff.removed })}\n\n`);
            return { success: true };
          }
          case "create_file": {
            const target = getSecurePath(auth.userId, project.name, parsedArgs.path);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, parsedArgs.content, "utf8");
            const diff = getLineDiff("", parsedArgs.content);
            res.write(`data: ${JSON.stringify({ type: "file_change", action: "Created", path: parsedArgs.path, added: diff.added, removed: 0 })}\n\n`);
            return { success: true };
          }
          case "delete_file": {
            const target = getSecurePath(auth.userId, project.name, parsedArgs.path);
            await fs.rm(target, { recursive: true, force: true });
            res.write(`data: ${JSON.stringify({ type: "file_change", action: "Deleted", path: parsedArgs.path, added: 0, removed: 0 })}\n\n`);
            return { success: true };
          }
          case "search_in_files": {
            const matches = await searchFilesRecursively(projectDir, parsedArgs.query, projectDir);
            return { matches };
          }
          default:
            throw new Error(`Unknown function name: ${callName}`);
        }
      };

      // Runs a list of tool_calls, streaming tool_call events and returning results.
      const runToolCalls = async (calls) => {
        const results = [];
        for (const tc of calls) {
          if (res.writableEnded) break;
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch (_) {
            console.error(`[Groq Path] Failed to parse args for '${tc.function.name}':`, tc.function.arguments);
          }
          console.log(`[Groq Path] Executing tool: ${tc.function.name}`, parsedArgs);
          res.write(`data: ${JSON.stringify({ type: "tool_call", name: tc.function.name, args: parsedArgs })}\n\n`);
          let resultData;
          try {
            resultData = await executeToolCall(tc.function.name, parsedArgs);
          } catch (err) {
            console.error(`[Groq Path] Tool execution error for '${tc.function.name}':`, err.message);
            resultData = { error: err.message };
          }
          results.push(resultData);
        }
        return results;
      };

      // Thread an assistant tool_calls turn + its tool results back into the conversation.
      const appendToolTurn = (calls, results) => {
        groqMessages.push({
          role: "assistant",
          content: null,
          tool_calls: calls.map(tc => ({
            id: tc.id,
            type: "function",
            function: { name: tc.function.name, arguments: tc.function.arguments }
          }))
        });
        calls.forEach((tc, idx) => {
          groqMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify(results[idx])
          });
        });
      };

      while (keepLooping && loopIteration < maxIterations) {
        loopIteration++;
        console.log(`[Groq Path] Loop iteration ${loopIteration}...`);

        let completion;
        try {
          completion = await groqClient.chat.completions.create({
            model: selectedModel,
            messages: groqMessages,
            tools: groqTools,
            tool_choice: "auto"
          });
        } catch (err) {
          // Recover from Groq's `tool_use_failed` by parsing the intended call out
          // of `failed_generation` and executing it ourselves, then continue the loop.
          const recovered = parseGroqFailedGeneration(err);
          if (recovered.length > 0 && !res.writableEnded) {
            console.log(`[Groq Path] Recovered ${recovered.length} tool call(s) from failed_generation.`);
            const synthCalls = recovered.map((c, i) => ({
              id: `call_recovered_${loopIteration}_${i}`,
              type: "function",
              function: { name: c.name, arguments: JSON.stringify(c.args || {}) }
            }));
            const results = await runToolCalls(synthCalls);
            appendToolTurn(synthCalls, results);
            keepLooping = true;
            continue;
          }
          console.error(`[Groq Path] Chat completion error with model ${selectedModel}:`, err.message);
          res.write(`data: ${JSON.stringify({
            type: "error",
            message: `Groq model error: ${err.message}. Try **Llama 3.3 70B** for the most reliable tool calling.`
          })}\n\n`);
          keepLooping = false;
          break;
        }

        const message = completion.choices?.[0]?.message;
        if (!message) break;

        const toolCalls = message.tool_calls || [];

        // If no tool calls, stream the text response to the frontend token-by-token
        // by doing a second streaming call so the UI shows live text
        if (toolCalls.length === 0) {
          if (message.content) {
            // Stream the final text response
            const textStream = await groqClient.chat.completions.create({
              model: selectedModel,
              messages: groqMessages,
              stream: true
            });
            for await (const chunk of textStream) {
              if (res.writableEnded) break;
              const delta = chunk.choices?.[0]?.delta?.content;
              if (delta) {
                res.write(`data: ${JSON.stringify({ type: "thinking", text: delta })}\n\n`);
              }
            }
          }
          keepLooping = false;
        } else {
          keepLooping = true;
          const toolResults = await runToolCalls(toolCalls);
          appendToolTurn(toolCalls, toolResults);
        }
      }

      if (!res.writableEnded) {
        res.write("data: [DONE]\n\n");
      }

  } catch (err) {
    console.error("AI Agent error:", err);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
    }
  } finally {
    res.end();
  }
});

export default router;
