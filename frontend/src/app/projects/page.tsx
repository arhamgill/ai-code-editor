"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  ArrowRight,
  FolderOpen,
  FolderUp,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { ApiError } from "@/lib/api";
import { useApi, useAuthGate } from "@/lib/hooks";
import type { Project } from "@/lib/types";
import { TEMPLATES, type Template } from "@/lib/templates";
import { cn, relativeTime } from "@/lib/utils";

import { AuthPending } from "@/components/auth-pending";
import { Logo } from "@/components/marketing/logo";
import { ThemeToggle } from "@/components/theme";
import { Button, IconButton, LinkButton } from "@/components/ui/button";
import { Badge, EmptyState, Input, Skeleton } from "@/components/ui/primitives";
import { Modal, useDialogs } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

/** Folders and files never worth uploading from a local project. */
const IGNORED_SEGMENTS = new Set([
  "node_modules", ".next", ".git", ".turbo", ".vercel", "dist", "build", "out", "coverage",
]);
const IGNORED_EXTS = new Set([
  ".exe", ".dll", ".so", ".zip", ".tar", ".gz", ".rar", ".7z", ".mp4", ".mov", ".lock",
]);
const MAX_UPLOAD_FILES = 3000;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export default function ProjectsPage() {
  const { isLoaded, isSignedIn, timedOut } = useAuthGate();
  const router = useRouter();
  const api = useApi();
  const toast = useToast();
  const { prompt, confirm, dialogs } = useDialogs();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [templateModal, setTemplateModal] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/sign-in");
  }, [isLoaded, isSignedIn, router]);

  const load = useCallback(async () => {
    try {
      // Nothing is set before the first await: a synchronous setState inside an
      // effect forces a second render pass before the browser can even paint.
      const list = await api.projects.list();
      setProjects(list);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.userMessage : "Could not load your projects.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;

    void (async () => {
      try {
        const list = await api.projects.list();
        if (cancelled) return;
        setProjects(list);
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof ApiError ? error.userMessage : "Could not load your projects."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Guards against a late response landing after the user has navigated away.
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, api]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects;
  }, [projects, query]);

  /* ── Create from template ──────────────────────────────────── */

  const openTemplate = (template: Template) => {
    // Suggest a name that doesn't collide with an existing project.
    const base = template.id === "starter" ? "my-app" : template.id;
    let candidate = base;
    let n = 2;
    while (projects.some((p) => p.name === candidate)) candidate = `${base}-${n++}`;

    setTemplateName(candidate);
    setTemplateModal(template);
  };

  const createFromTemplate = async () => {
    if (!templateModal) return;
    setCreating(true);
    try {
      const project = await api.projects.create(templateName.trim(), templateModal.files);
      toast.success(`Created "${project.name}"`, { description: "Opening your workspace…" });
      router.push(`/projects/${project.id}`);
    } catch (error) {
      // The old build had no else-branch here at all, so a failure looked
      // exactly like nothing happening.
      toast.error(
        error instanceof ApiError ? error.userMessage : "Could not create the project.",
        { description: "Nothing was saved. Try a different name." }
      );
      setCreating(false);
    }
  };

  /* ── Import a folder ───────────────────────────────────────── */

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files;
    if (!selected?.length) return;

    const candidates = [...selected].filter((file) => {
      const parts = file.webkitRelativePath.split("/");
      if (parts.length < 2) return false;
      if (parts.some((part) => IGNORED_SEGMENTS.has(part))) return false;
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (IGNORED_EXTS.has(ext)) return false;
      return file.size <= MAX_UPLOAD_BYTES;
    });

    const reset = () => {
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    if (candidates.length === 0) {
      toast.error("Nothing to import", {
        description: "Every file in that folder was skipped as build output or too large.",
      });
      return reset();
    }
    if (candidates.length > MAX_UPLOAD_FILES) {
      toast.error(`That folder has ${candidates.length.toLocaleString()} files`, {
        description: `The limit is ${MAX_UPLOAD_FILES.toLocaleString()}. Try importing a subfolder.`,
      });
      return reset();
    }

    const rootName = candidates[0].webkitRelativePath.split("/")[0];
    const name = await prompt({
      title: "Import project",
      description: `${candidates.length} file${candidates.length === 1 ? "" : "s"} will be imported.`,
      placeholder: "my-app",
      defaultValue: rootName.replace(/[^a-zA-Z0-9 ._-]/g, "-").slice(0, 60),
      confirmLabel: "Import",
      validate: (value) =>
        projects.some((p) => p.name === value) ? "You already have a project with that name." : null,
    });
    if (!name) return reset();

    setUploading({ done: 0, total: candidates.length });
    try {
      const files: { path: string; content: string }[] = [];

      for (let i = 0; i < candidates.length; i++) {
        const file = candidates[i];
        const path = file.webkitRelativePath.split("/").slice(1).join("/");
        const isBinary = /\.(png|jpe?g|gif|webp|ico|avif|bmp)$/i.test(file.name);

        const content = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) ?? "");
          reader.onerror = () => resolve("");
          if (isBinary) reader.readAsDataURL(file);
          else reader.readAsText(file);
        });

        files.push({ path, content });
        // Reading thousands of files takes a while; show real progress rather
        // than an indeterminate spinner.
        if (i % 25 === 0) setUploading({ done: i, total: candidates.length });
      }

      const project = await api.projects.create(name, files);
      toast.success(`Imported "${project.name}"`);
      router.push(`/projects/${project.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.userMessage : "Import failed.");
      setUploading(null);
      reset();
    }
  };

  /* ── Rename / delete ───────────────────────────────────────── */

  const renameProject = async (project: Project) => {
    const name = await prompt({
      title: "Rename project",
      defaultValue: project.name,
      confirmLabel: "Rename",
      validate: (value) =>
        value !== project.name && projects.some((p) => p.name === value)
          ? "You already have a project with that name."
          : null,
    });
    if (!name || name === project.name) return;

    setBusyId(project.id);
    try {
      const updated = await api.projects.rename(project.id, name);
      setProjects((current) => current.map((p) => (p.id === project.id ? updated : p)));
      toast.success(`Renamed to "${updated.name}"`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.userMessage : "Rename failed.");
    } finally {
      setBusyId(null);
    }
  };

  const deleteProject = async (project: Project) => {
    const ok = await confirm({
      title: `Delete "${project.name}"?`,
      description: "Every file in this project will be permanently removed. This can't be undone.",
      confirmLabel: "Delete project",
      danger: true,
    });
    if (!ok) return;

    setBusyId(project.id);
    try {
      await api.projects.remove(project.id);
      setProjects((current) => current.filter((p) => p.id !== project.id));
      toast.success(`Deleted "${project.name}"`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.userMessage : "Could not delete the project.");
    } finally {
      setBusyId(null);
    }
  };

  if (!isLoaded || !isSignedIn) {
    return <AuthPending timedOut={timedOut} />;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-border bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-5">
          <Logo href="/" />
          <div className="ml-auto flex items-center gap-2.5">
            <ThemeToggle />
            <UserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-bright">Projects</h1>
            <p className="mt-1 text-[13.5px] text-muted">
              Start from a template, or import a Next.js folder from your machine.
            </p>
          </div>
          <Button
            variant="secondary"
            icon={<FolderUp className="size-4" />}
            onClick={() => fileInputRef.current?.click()}
            loading={!!uploading}
          >
            {uploading ? `Reading ${uploading.done}/${uploading.total}…` : "Import folder"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
            // Non-standard but universally supported directory picker.
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          />
        </div>

        {/* Templates */}
        <section className="mt-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
            Start something new
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => openTemplate(template)}
                className={cn(
                  "group flex flex-col rounded-xl border border-border bg-surface p-4 text-left",
                  "transition-all hover:border-brand/40 hover:bg-raised hover:shadow-[var(--shadow-panel)]"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                    <Layers className="size-4" />
                  </span>
                  <span className="text-[13.5px] font-semibold text-bright">{template.name}</span>
                  <Plus className="ml-auto size-4 text-subtle transition-colors group-hover:text-brand" />
                </div>
                <p className="mt-2.5 flex-1 text-[12.5px] leading-relaxed text-muted">
                  {template.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {template.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Existing projects */}
        <section className="mt-10">
          <div className="flex items-center gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
              Your projects
              {projects.length > 0 && (
                <span className="ml-1.5 font-mono text-subtle/70">{projects.length}</span>
              )}
            </h2>
            {projects.length > 4 && (
              <div className="relative ml-auto w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter projects…"
                  className="h-8 pl-8 text-[12.5px]"
                />
              </div>
            )}
          </div>

          <div className="mt-3">
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-xl border border-border bg-surface p-4">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="mt-3 h-3 w-1/3" />
                    <Skeleton className="mt-5 h-7 w-full rounded-md" />
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="rounded-xl border border-danger/30 bg-danger-subtle p-6 text-center">
                <p className="text-[13.5px] text-danger">{loadError}</p>
                <Button size="sm" variant="secondary" className="mt-3" onClick={load}>
                  Try again
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface/50">
                <EmptyState
                  icon={<FolderOpen className="size-5" />}
                  title={query ? `No projects match "${query}"` : "No projects yet"}
                  description={
                    query
                      ? "Try a different search."
                      : "Pick a template above to scaffold a Next.js app, or import an existing folder."
                  }
                />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((project) => (
                  <div
                    key={project.id}
                    className="group relative flex flex-col rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
                  >
                    <div className="flex items-start gap-2">
                      <h3 className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-bright">
                        {project.name}
                      </h3>
                      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <IconButton
                          label={`Rename ${project.name}`}
                          size="xs"
                          disabled={busyId === project.id}
                          onClick={() => renameProject(project)}
                        >
                          <Pencil className="size-3.5" />
                        </IconButton>
                        <IconButton
                          label={`Delete ${project.name}`}
                          size="xs"
                          variant="ghost"
                          className="hover:text-danger"
                          disabled={busyId === project.id}
                          onClick={() => deleteProject(project)}
                        >
                          <Trash2 className="size-3.5" />
                        </IconButton>
                      </div>
                    </div>

                    <p className="mt-1 text-[12px] text-subtle">
                      Edited {relativeTime(project.updatedAt)}
                    </p>

                    <LinkButton
                      href={`/projects/${project.id}`}
                      size="sm"
                      variant="secondary"
                      className="mt-4 w-full"
                      iconRight={<ArrowRight className="size-3.5" />}
                    >
                      Open
                    </LinkButton>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Name-the-project step */}
      <Modal
        open={!!templateModal}
        onClose={() => !creating && setTemplateModal(null)}
        size="sm"
        title={templateModal?.name}
        description={`${templateModal?.files.length ?? 0} files will be created.`}
        footer={
          <>
            <Button size="sm" variant="ghost" disabled={creating} onClick={() => setTemplateModal(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={creating}
              disabled={!templateName.trim()}
              onClick={createFromTemplate}
            >
              Create project
            </Button>
          </>
        }
      >
        <div className="space-y-1.5 px-4 py-4">
          <label htmlFor="template-name" className="text-[12.5px] font-medium text-muted">
            Project name
          </label>
          <Input
            id="template-name"
            data-autofocus
            value={templateName}
            spellCheck={false}
            onChange={(e) => setTemplateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && templateName.trim() && !creating) createFromTemplate();
            }}
          />
        </div>
      </Modal>

      {dialogs}
    </div>
  );
}
