"use client";

import Link from "next/link";
import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  ArrowLeft,
  Minus,
  MessageSquare,
  PanelLeft,
  Play,
  Plus,
  Save,
  Settings2,
  Type,
} from "lucide-react";

import { usePreferences } from "@/lib/store/preferences";
import { useResizeHandle } from "@/lib/hooks";
import { cn, modKey } from "@/lib/utils";
import { Button, IconButton } from "@/components/ui/button";
import { Kbd, Switch } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { Popover, PopoverLabel, PopoverRow, PopoverSeparator } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/theme";
import { LogoMark } from "@/components/marketing/logo";

/* ───────────────────────────── Top bar ───────────────────────────── */

export function WorkspaceHeader({
  projectName,
  dirtyCount,
  saving,
  onSave,
}: {
  projectName: string;
  dirtyCount: number;
  saving: boolean;
  onSave: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const prefs = usePreferences();

  return (
    <header className="flex h-(--spacing-titlebar) shrink-0 items-center gap-2 border-b border-border bg-surface px-2.5">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted transition-colors hover:bg-hover hover:text-fg"
        title="Back to projects"
      >
        <ArrowLeft className="size-3.5" />
        <LogoMark className="size-5 rounded-md" />
      </Link>

      <span className="truncate text-[13px] font-medium text-bright" title={projectName}>
        {projectName}
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        {dirtyCount > 0 && (
          <Button
            size="xs"
            variant="primary"
            icon={<Save className="size-3" />}
            loading={saving}
            onClick={onSave}
            title={`Save ${dirtyCount} file${dirtyCount === 1 ? "" : "s"} (${modKey()}+S)`}
          >
            Save{dirtyCount > 1 ? ` ${dirtyCount}` : ""}
          </Button>
        )}

        <IconButton
          label="Toggle explorer"
          size="sm"
          active={prefs.explorerOpen}
          onClick={() => prefs.toggle("explorerOpen")}
        >
          <PanelLeft className="size-4" />
        </IconButton>

        <IconButton
          label="Toggle live preview"
          size="sm"
          active={prefs.previewOpen}
          onClick={() => prefs.toggle("previewOpen")}
        >
          <Play className="size-4" />
        </IconButton>

        <IconButton
          label="Toggle assistant"
          size="sm"
          active={prefs.chatOpen}
          onClick={() => prefs.toggle("chatOpen")}
        >
          <MessageSquare className="size-4" />
        </IconButton>

        <Popover
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          panelClassName="w-[240px]"
          trigger={({ ref, onClick }) => (
            <IconButton ref={ref} label="Editor settings" size="sm" active={settingsOpen} onClick={onClick}>
              <Settings2 className="size-4" />
            </IconButton>
          )}
        >
          <PopoverLabel>Appearance</PopoverLabel>
          <PopoverRow label="Theme">
            <ThemeToggle />
          </PopoverRow>

          <PopoverSeparator />
          <PopoverLabel>Editor</PopoverLabel>

          <PopoverRow label="Font size">
            <div className="inline-flex items-center gap-1 rounded-md border border-border bg-raised p-0.5">
              <IconButton
                label="Decrease font size"
                size="xs"
                className="size-5"
                disabled={prefs.fontSize <= 10}
                onClick={() => prefs.set("fontSize", prefs.fontSize - 1)}
              >
                <Minus className="size-3" />
              </IconButton>
              <span className="w-5 text-center font-mono text-[11.5px] tabular-nums text-fg">
                {prefs.fontSize}
              </span>
              <IconButton
                label="Increase font size"
                size="xs"
                className="size-5"
                disabled={prefs.fontSize >= 22}
                onClick={() => prefs.set("fontSize", prefs.fontSize + 1)}
              >
                <Plus className="size-3" />
              </IconButton>
            </div>
          </PopoverRow>

          <PopoverRow label="Word wrap">
            <Switch label="Word wrap" checked={prefs.wordWrap} onChange={(v) => prefs.set("wordWrap", v)} />
          </PopoverRow>
          <PopoverRow label="Minimap">
            <Switch label="Minimap" checked={prefs.minimap} onChange={(v) => prefs.set("minimap", v)} />
          </PopoverRow>
          <PopoverRow label="Line numbers">
            <Switch
              label="Line numbers"
              checked={prefs.lineNumbers}
              onChange={(v) => prefs.set("lineNumbers", v)}
            />
          </PopoverRow>
        </Popover>

        <div className="ml-1">
          <UserButton />
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────────── Resize handle ───────────────────────── */

export function ResizeHandle({
  value,
  min,
  max,
  onChange,
  direction,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  direction: "left" | "right";
}) {
  const { dragging, handleProps } = useResizeHandle({ value, min, max, onChange, direction });

  return (
    <div
      {...handleProps}
      className={cn(
        "group/handle relative w-px shrink-0 cursor-col-resize bg-border transition-colors",
        "hover:bg-brand focus-visible:bg-brand",
        dragging && "bg-brand"
      )}
    >
      {/* Widen the hit area without widening the visual line. */}
      <span className="absolute inset-y-0 -left-1.5 -right-1.5" aria-hidden />
    </div>
  );
}

/* ────────────────────────── Shortcuts modal ──────────────────────── */

const SHORTCUTS: { group: string; items: { keys: string; label: string }[] }[] = [
  {
    group: "General",
    items: [
      { keys: "Mod+K", label: "Command palette" },
      { keys: "Mod+P", label: "Go to file" },
      { keys: "Mod+S", label: "Save the active file" },
      { keys: "Mod+Shift+S", label: "Save every open file" },
      { keys: "Mod+/", label: "Keyboard shortcuts" },
    ],
  },
  {
    group: "Panels",
    items: [
      { keys: "Mod+B", label: "Toggle the explorer" },
      { keys: "Mod+I", label: "Toggle the assistant" },
      { keys: "Mod+Shift+P", label: "Toggle the live preview" },
    ],
  },
  {
    group: "Files",
    items: [
      { keys: "Mod+N", label: "New file" },
      { keys: "Mod+W", label: "Close the active tab" },
      { keys: "Mod+Shift+]", label: "Next tab" },
      { keys: "Mod+Shift+[", label: "Previous tab" },
      { keys: "F2", label: "Rename (in the explorer)" },
    ],
  },
];

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Keyboard shortcuts"
      description="Everything in Forge is reachable from the keyboard."
    >
      <div className="space-y-5 px-4 py-4">
        {SHORTCUTS.map((section) => (
          <div key={section.group}>
            <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-subtle">
              {section.group}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => (
                <div
                  key={item.keys}
                  className="flex items-center justify-between gap-4 rounded-md px-1.5 py-1"
                >
                  <span className="text-[12.5px] text-fg">{item.label}</span>
                  <Kbd>{item.keys}</Kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ───────────────────────── Welcome (no file open) ────────────────── */

export function WelcomePane({
  recent,
  onOpenFile,
  onOpenChat,
  onShowShortcuts,
}: {
  recent: string[];
  onOpenFile: (path: string) => void;
  onOpenChat: () => void;
  onShowShortcuts: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center overflow-auto bg-canvas p-8">
      <div className="w-full max-w-md">
        <LogoMark className="size-9 rounded-xl" />
        <h2 className="mt-4 text-[19px] font-semibold tracking-[-0.01em] text-bright">
          Ready when you are
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          Open a file from the explorer, or describe a change and let the assistant write it.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" variant="primary" icon={<MessageSquare className="size-3.5" />} onClick={onOpenChat}>
            Ask the assistant
          </Button>
          <Button size="sm" variant="secondary" icon={<Type className="size-3.5" />} onClick={onShowShortcuts}>
            Shortcuts
          </Button>
        </div>

        {recent.length > 0 && (
          <div className="mt-8">
            <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-subtle">
              Recent files
            </h3>
            <div className="mt-2 space-y-0.5">
              {recent.slice(0, 6).map((path) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => onOpenFile(path)}
                  className="block w-full truncate rounded-md px-2 py-1.5 text-left font-mono text-[12.5px] text-muted transition-colors hover:bg-hover hover:text-fg"
                >
                  {path}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-8 text-[12px] text-subtle">
          Press <Kbd>Mod+K</Kbd> for the command palette, or <Kbd>Mod+P</Kbd> to jump to a file.
        </p>
      </div>
    </div>
  );
}
