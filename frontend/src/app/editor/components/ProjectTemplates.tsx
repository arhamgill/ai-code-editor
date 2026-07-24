"use client";

import React, { useState } from "react";

interface TemplateFile {
  path: string;
  content: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  files: TemplateFile[];
}

const TEMPLATES: Template[] = [
  {
    id: "blank",
    name: "Blank Project",
    description: "Just a README to get started",
    icon: "📄",
    files: [
      {
        path: "README.md",
        content: "# My Project\n\nA new project created with **AuraEdit AI**.\n\n## Getting Started\n\nAsk the AI to help you build something amazing!\n",
      },
    ],
  },
  {
    id: "html-css-js",
    name: "HTML/CSS/JS",
    description: "Static web page with styles and scripts",
    icon: "🌐",
    files: [
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My App</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="container">
    <h1>Hello World</h1>
    <p>Built with AuraEdit AI ✨</p>
    <button id="btn">Click me</button>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
      },
      {
        path: "styles.css",
        content: `* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #0a0a0a;
  color: #e8e8e8;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.container {
  text-align: center;
  padding: 2rem;
}
h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #22d3ee, #818cf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
p { color: #888; margin-bottom: 2rem; }
button {
  background: #22d3ee;
  color: #0a0a0a;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}
button:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(34,211,238,0.25); }`,
      },
      {
        path: "script.js",
        content: `document.getElementById('btn').addEventListener('click', () => {
  alert('Hello from AuraEdit AI! 🚀');
});`,
      },
    ],
  },
  {
    id: "react-vite",
    name: "React + Vite",
    description: "React app scaffold (no npm install needed for AI editing)",
    icon: "⚛️",
    files: [
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
      },
      {
        path: "package.json",
        content: JSON.stringify({
          name: "react-app",
          version: "0.1.0",
          private: true,
          scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
          dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
          devDependencies: { "@vitejs/plugin-react": "^4.0.0", vite: "^5.0.0" },
        }, null, 2),
      },
      {
        path: "vite.config.js",
        content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()] })`,
      },
      {
        path: "src/main.jsx",
        content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
ReactDOM.createRoot(document.getElementById('root')).render(<App />)`,
      },
      {
        path: "src/App.jsx",
        content: `import React, { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)
  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui' }}>
      <h1>React App ⚛️</h1>
      <p>Built with AuraEdit AI</p>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
    </div>
  )
}
export default App`,
      },
      { path: "src/index.css", content: "* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { background: #0a0a0a; color: #e8e8e8; }" },
    ],
  },
  {
    id: "express-api",
    name: "Express REST API",
    description: "Node.js REST API with Express",
    icon: "🔌",
    files: [
      {
        path: "package.json",
        content: JSON.stringify({
          name: "express-api",
          version: "1.0.0",
          scripts: { dev: "node --watch src/index.js", start: "node src/index.js" },
          dependencies: { express: "^4.18.2", cors: "^2.8.5" },
        }, null, 2),
      },
      {
        path: "src/index.js",
        content: `import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello from Express API!', status: 'ok' })
})

app.get('/api/items', (req, res) => {
  res.json({ items: [{ id: 1, name: 'Item One' }, { id: 2, name: 'Item Two' }] })
})

app.listen(PORT, () => console.log(\`Server running on http://localhost:\${PORT}\`))
`,
      },
      { path: "README.md", content: "# Express REST API\n\nRun with `npm run dev`.\n\n## Endpoints\n- `GET /` — Health check\n- `GET /api/items` — List items\n" },
    ],
  },
];

interface ProjectTemplatesProps {
  onCreate: (name: string, files: TemplateFile[]) => Promise<void>;
  loading: boolean;
}

export function ProjectTemplates({ onCreate, loading }: ProjectTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [projectName, setProjectName] = useState("");
  const [showModal, setShowModal] = useState(false);

  const handleSelectTemplate = (t: Template) => {
    setSelectedTemplate(t);
    setProjectName(`my-${t.id}-project`);
    setShowModal(true);
  };

  const handleCreate = async () => {
    if (!selectedTemplate || !projectName.trim()) return;
    await onCreate(projectName.trim(), selectedTemplate.files);
    setShowModal(false);
    setSelectedTemplate(null);
    setProjectName("");
  };

  return (
    <>
      <div className="templates-section">
        <h3 className="templates-heading">Start from a template</h3>
        <div className="templates-grid">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              className="template-card"
              onClick={() => handleSelectTemplate(t)}
            >
              <span className="template-icon">{t.icon}</span>
              <span className="template-name">{t.name}</span>
              <span className="template-desc">{t.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Name modal */}
      {showModal && selectedTemplate && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="template-name-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="template-name-modal-header">
              <span style={{ fontSize: "1.5rem" }}>{selectedTemplate.icon}</span>
              <div>
                <h3 style={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700 }}>{selectedTemplate.name}</h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{selectedTemplate.files.length} files</p>
              </div>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              Project name
              <input
                type="text"
                className="sidebar-search-box"
                style={{ background: "#111" }}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </label>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={loading || !projectName.trim()}
              >
                {loading ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
