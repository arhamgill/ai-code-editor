import express from "express";
import { getAuth } from "@clerk/express";
import { GoogleGenAI } from "@google/genai";
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

// Tool declarations for Gemini API
const tools = [
  {
    functionDeclarations: [
      {
        name: "list_files",
        description: "List all files and folders recursively in the active workspace project root.",
        parameters: { type: "OBJECT", properties: {} }
      },
      {
        name: "read_file",
        description: "Read the full contents of a file in the workspace.",
        parameters: {
          type: "OBJECT",
          properties: {
            path: { type: "STRING", description: "The relative file path to read from the project root." }
          },
          required: ["path"]
        }
      },
      {
        name: "write_file",
        description: "Write content to a file, replacing its content entirely. Can edit existing files.",
        parameters: {
          type: "OBJECT",
          properties: {
            path: { type: "STRING", description: "The relative file path to write to." },
            content: { type: "STRING", description: "The full content to write to the file." }
          },
          required: ["path", "content"]
        }
      },
      {
        name: "create_file",
        description: "Create a new file in the workspace with initial content.",
        parameters: {
          type: "OBJECT",
          properties: {
            path: { type: "STRING", description: "The relative file path to create." },
            content: { type: "STRING", description: "The initial content of the file." }
          },
          required: ["path", "content"]
        }
      },
      {
        name: "delete_file",
        description: "Delete a file recursively in the workspace.",
        parameters: {
          type: "OBJECT",
          properties: {
            path: { type: "STRING", description: "The relative file path to delete." }
          },
          required: ["path"]
        }
      },
      {
        name: "search_in_files",
        description: "Search for a string pattern across all text files in the project workspace recursively.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "The text string to search for." }
          },
          required: ["query"]
        }
      }
    ]
  }
];

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

// POST /api/agent/stream - Agentic streaming endpoint with Gemini & Groq
router.post("/stream", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { projectId, prompt, history = [], model = "gemini-2.5-flash" } = req.body;
  const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"];
  const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "deepseek-r1-distill-llama-70b", "qwen-2.5-32b"];
  
  const isGroq = GROQ_MODELS.includes(model);
  const selectedModel = isGroq ? model : (GEMINI_MODELS.includes(model) ? model : "gemini-2.5-flash");

  if (!projectId || !prompt) {
    return res.status(400).json({ error: "Bad Request", message: "projectId and prompt are required." });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!isGroq && !geminiApiKey) {
    return res.status(500).json({
      error: "Configuration Error",
      message: "GEMINI_API_KEY is not defined in backend environmental variables."
    });
  }

  if (isGroq && !groqApiKey) {
    return res.status(500).json({
      error: "Configuration Error",
      message: "GROQ_API_KEY is not defined in backend environmental variables."
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

    let systemInstruction = `You are AuraEdit AI, an autonomous coding assistant built into the AuraEdit Editor.
Workspace Project Name: ${project.name}
Files in workspace:
${filePathsList}

You have native access to file tools to read and edit project files directly.
Rules:
- Read existing files with 'read_file' BEFORE editing them so you have full content.
- Write complete file contents with 'write_file'. Do NOT use partial snippets or placeholders.
- Always perform tool calls natively.
- All paths must be relative to project root.`;

    if (isGroq) {
      // 3. Initialize Groq client + messages
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
          console.error(`[Groq Path] Chat completion error with model ${selectedModel}:`, err.message);
          res.write(`data: ${JSON.stringify({
            type: "error",
            message: `Groq tool error: ${err.message}. Please switch to **Gemini 2.5 Flash** using the model dropdown above.`
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
          const toolResults = [];

          for (const tc of toolCalls) {
            if (res.writableEnded) break;

            const callName = tc.function.name;
            let parsedArgs = {};
            try {
              parsedArgs = JSON.parse(tc.function.arguments);
            } catch (err) {
              console.error(`[Groq Path] Failed to parse args for '${callName}':`, tc.function.arguments);
              parsedArgs = {};
            }

            console.log(`[Groq Path] Executing tool: ${callName}`, parsedArgs);
            res.write(`data: ${JSON.stringify({ type: "tool_call", name: callName, args: parsedArgs })}\n\n`);

            let resultData;
            try {
              switch (callName) {
                case "list_files": {
                  const tree = await readDirectoryTree(projectDir, projectDir);
                  resultData = { files: tree };
                  break;
                }
                case "read_file": {
                  const target = getSecurePath(auth.userId, project.name, parsedArgs.path);
                  const fileContent = await fs.readFile(target, "utf8");
                  resultData = { content: fileContent };
                  break;
                }
                case "write_file": {
                  const target = getSecurePath(auth.userId, project.name, parsedArgs.path);
                  let oldContent = "";
                  try { oldContent = await fs.readFile(target, "utf8"); } catch (_) {}
                  await fs.writeFile(target, parsedArgs.content, "utf8");
                  const diff = getLineDiff(oldContent, parsedArgs.content);
                  resultData = { success: true };
                  res.write(`data: ${JSON.stringify({ type: "file_change", action: "Modified", path: parsedArgs.path, added: diff.added, removed: diff.removed })}\n\n`);
                  break;
                }
                case "create_file": {
                  const target = getSecurePath(auth.userId, project.name, parsedArgs.path);
                  await fs.mkdir(path.dirname(target), { recursive: true });
                  await fs.writeFile(target, parsedArgs.content, "utf8");
                  const diff = getLineDiff("", parsedArgs.content);
                  resultData = { success: true };
                  res.write(`data: ${JSON.stringify({ type: "file_change", action: "Created", path: parsedArgs.path, added: diff.added, removed: 0 })}\n\n`);
                  break;
                }
                case "delete_file": {
                  const target = getSecurePath(auth.userId, project.name, parsedArgs.path);
                  await fs.rm(target, { recursive: true, force: true });
                  resultData = { success: true };
                  res.write(`data: ${JSON.stringify({ type: "file_change", action: "Deleted", path: parsedArgs.path, added: 0, removed: 0 })}\n\n`);
                  break;
                }
                case "search_in_files": {
                  const matches = await searchFilesRecursively(projectDir, parsedArgs.query, projectDir);
                  resultData = { matches };
                  break;
                }
                default:
                  throw new Error(`Unknown function name: ${callName}`);
              }
            } catch (err) {
              console.error(`[Groq Path] Tool execution error for '${callName}':`, err.message);
              resultData = { error: err.message };
            }

            toolResults.push(resultData);
          }

          // Append assistant message with tool_calls
          groqMessages.push({
            role: "assistant",
            content: message.content || null,
            tool_calls: toolCalls.map(tc => ({
              id: tc.id,
              type: "function",
              function: { name: tc.function.name, arguments: tc.function.arguments }
            }))
          });

          // Append each tool result
          toolCalls.forEach((tc, idx) => {
            groqMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              name: tc.function.name,
              content: JSON.stringify(toolResults[idx])
            });
          });
        }
      }

      if (!res.writableEnded) {
        res.write("data: [DONE]\n\n");
      }

    } else {
      // 3. Initialize Gemini
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });

      // 4. Map user-supplied chat history to Gemini structure
      const contents = [];
      for (const msg of history) {
        if (msg.role === "user" || msg.role === "assistant") {
          contents.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }]
          });
        }
      }
      
      // Add current user prompt
      contents.push({
        role: "user",
        parts: [{ text: prompt }]
      });

      let keepLooping = true;
      let loopIteration = 0;
      const maxIterations = 15; // Safeguard against infinite tool loops

      while (keepLooping && loopIteration < maxIterations) {
        loopIteration++;
        let modelParts = [];
        let responseText = "";
        let functionCalls = [];

        // Start stream call to Gemini
        const responseStream = await ai.models.generateContentStream({
          model: selectedModel,
          contents: contents,
          config: {
            systemInstruction,
            tools
          }
        });

        for await (const chunk of responseStream) {
          if (res.writableEnded) break;

          if (chunk.candidates?.[0]?.content?.parts) {
            modelParts.push(...chunk.candidates[0].content.parts);
          }
          if (chunk.text) {
            responseText += chunk.text;
            res.write(`data: ${JSON.stringify({ type: "thinking", text: chunk.text })}\n\n`);
          }
          if (chunk.functionCalls) {
            functionCalls.push(...chunk.functionCalls);
          }
        }

        if (res.writableEnded) break;

        // Handle function calls if any
        if (functionCalls.length > 0) {
          keepLooping = true;
          const toolResults = [];

          // Execute functions sequentially
          for (const call of functionCalls) {
            if (res.writableEnded) break;

            // Notify frontend of active tool execution
            res.write(`data: ${JSON.stringify({ type: "tool_call", name: call.name, args: call.args })}\n\n`);

            let resultData;
            try {
              switch (call.name) {
                case "list_files": {
                  const tree = await readDirectoryTree(projectDir, projectDir);
                  resultData = { files: tree };
                  break;
                }
                case "read_file": {
                  const target = getSecurePath(auth.userId, project.name, call.args.path);
                  const fileContent = await fs.readFile(target, "utf8");
                  resultData = { content: fileContent };
                  break;
                }
                case "write_file": {
                  const target = getSecurePath(auth.userId, project.name, call.args.path);
                  let oldContent = "";
                  try {
                    oldContent = await fs.readFile(target, "utf8");
                  } catch (_) {}

                  await fs.writeFile(target, call.args.content, "utf8");
                  const diff = getLineDiff(oldContent, call.args.content);

                  resultData = { success: true };
                  // Send change card event
                  res.write(`data: ${JSON.stringify({
                    type: "file_change",
                    action: "Modified",
                    path: call.args.path,
                    added: diff.added,
                    removed: diff.removed
                  })}\n\n`);
                  break;
                }
                case "create_file": {
                  const target = getSecurePath(auth.userId, project.name, call.args.path);
                  const dir = path.dirname(target);
                  await fs.mkdir(dir, { recursive: true });
                  await fs.writeFile(target, call.args.content, "utf8");
                  const diff = getLineDiff("", call.args.content);

                  resultData = { success: true };
                  // Send change card event
                  res.write(`data: ${JSON.stringify({
                    type: "file_change",
                    action: "Created",
                    path: call.args.path,
                    added: diff.added,
                    removed: 0
                  })}\n\n`);
                  break;
                }
                case "delete_file": {
                  const target = getSecurePath(auth.userId, project.name, call.args.path);
                  await fs.rm(target, { recursive: true, force: true });
                  resultData = { success: true };
                  // Send change card event
                  res.write(`data: ${JSON.stringify({
                    type: "file_change",
                    action: "Deleted",
                    path: call.args.path,
                    added: 0,
                    removed: 0
                  })}\n\n`);
                  break;
                }
                case "search_in_files": {
                  const matches = await searchFilesRecursively(projectDir, call.args.query, projectDir);
                  resultData = { matches };
                  break;
                }
                default:
                  throw new Error(`Unknown function name: ${call.name}`);
              }
            } catch (err) {
              resultData = { error: err.message };
            }

            toolResults.push(resultData);
          }

          // Push model's turn to history
          contents.push({
            role: "model",
            parts: modelParts
          });

          // Push tool responses to history
          contents.push({
            role: "tool",
            parts: functionCalls.map((c, idx) => ({
              functionResponse: {
                name: c.name,
                id: c.id,
                response: toolResults[idx]
              }
            }))
          });

        } else {
          // No function calls from Gemini, loop is complete!
          keepLooping = false;
        }
      }

      if (!res.writableEnded) {
        res.write("data: [DONE]\n\n");
      }
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
