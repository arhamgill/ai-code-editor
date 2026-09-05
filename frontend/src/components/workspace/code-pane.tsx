"use client";

import { useCallback, useEffect, useRef } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { AlertTriangle } from "lucide-react";

import { usePreferences } from "@/lib/store/preferences";
import { useWorkspace, type OpenTab } from "@/lib/store/workspace";
import { isImageFile, languageForPath } from "@/lib/utils";
import { toMonacoHex, withAlpha } from "@/lib/color";
import { Spinner } from "@/components/ui/primitives";

/** Editor colours derived from the CSS tokens so both themes match the shell. */
function readThemeColors() {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) =>
    toMonacoHex(styles.getPropertyValue(name), fallback);

  return {
    canvas: token("--color-canvas", "#08090a"),
    fg: token("--color-fg", "#e8eaed"),
    subtle: token("--color-fg-subtle", "#5f6b78"),
    muted: token("--color-fg-muted", "#9aa4b0"),
    border: token("--color-border", "#21262c"),
    surface: token("--color-surface-overlay", "#1a1e22"),
    raised: token("--color-surface-raised", "#14171a"),
    brand: token("--color-brand", "#5b9bff"),
  };
}

function defineThemes(monaco: Monaco) {
  const c = readThemeColors();
  const isLight = document.documentElement.getAttribute("data-theme") === "light";

  monaco.editor.defineTheme("forge", {
    base: isLight ? "vs" : "vs-dark",
    inherit: true,
    rules: isLight
      ? [
          { token: "comment", foreground: "6a737d", fontStyle: "italic" },
          { token: "keyword", foreground: "cf222e" },
          { token: "string", foreground: "0a3069" },
          { token: "number", foreground: "0550ae" },
          { token: "type", foreground: "953800" },
          { token: "tag", foreground: "116329" },
          { token: "attribute.name", foreground: "0550ae" },
          { token: "attribute.value", foreground: "0a3069" },
        ]
      : [
          { token: "comment", foreground: "6a7480", fontStyle: "italic" },
          { token: "keyword", foreground: "c586c0" },
          { token: "string", foreground: "9ecbff" },
          { token: "number", foreground: "b5cea8" },
          { token: "type", foreground: "4ec9b0" },
          { token: "tag", foreground: "7ee787" },
          { token: "attribute.name", foreground: "79c0ff" },
          { token: "attribute.value", foreground: "a5d6ff" },
        ],
    colors: {
      "editor.background": c.canvas,
      "editor.foreground": c.fg,
      "editorLineNumber.foreground": withAlpha(c.subtle, "80"),
      "editorLineNumber.activeForeground": c.muted,
      "editorCursor.foreground": c.brand,
      "editor.lineHighlightBackground": withAlpha(c.raised, "70"),
      "editor.lineHighlightBorder": "#00000000",
      "editorIndentGuide.background1": c.border,
      "editorIndentGuide.activeBackground1": c.subtle,
      "editorWidget.background": c.surface,
      "editorWidget.border": c.border,
      "editorSuggestWidget.background": c.surface,
      "editorSuggestWidget.border": c.border,
      "editorHoverWidget.background": c.surface,
      "editorGutter.background": c.canvas,
      "editorBracketMatch.background": withAlpha(c.brand, "22"),
      "editorBracketMatch.border": withAlpha(c.brand, "55"),
      "minimap.background": c.canvas,
      "scrollbarSlider.background": withAlpha(c.border, "cc"),
      "scrollbarSlider.hoverBackground": withAlpha(c.subtle, "66"),
      "scrollbarSlider.activeBackground": withAlpha(c.subtle, "99"),
      "editorOverviewRuler.border": "#00000000",
    },
  });
}

export interface CursorInfo {
  line: number;
  column: number;
}

export interface SelectionInfo {
  characters: number;
  lines: number;
}

export function CodePane({
  tab,
  onCursorChange,
  onSelectionChange,
  onSave,
}: {
  tab: OpenTab;
  onCursorChange?: (cursor: CursorInfo) => void;
  onSelectionChange?: (selection: SelectionInfo | null) => void;
  /** Invoked for Ctrl/Cmd+S while focus is inside the editor. */
  onSave?: () => void;
}) {
  const updateDraft = useWorkspace((s) => s.updateDraft);
  const fontSize = usePreferences((s) => s.fontSize);
  const wordWrap = usePreferences((s) => s.wordWrap);
  const minimap = usePreferences((s) => s.minimap);
  const lineNumbers = usePreferences((s) => s.lineNumbers);
  const theme = usePreferences((s) => s.theme);

  const monacoRef = useRef<Monaco | null>(null);

  // Monaco's keybindings run before window listeners and stop propagation, so
  // the app-level Ctrl+S never fires while the editor has focus. Read the
  // latest handler through a ref rather than re-registering the command.
  const saveRef = useRef(onSave);
  useEffect(() => {
    saveRef.current = onSave;
  });

  const beforeMount = useCallback((monaco: Monaco) => {
    monacoRef.current = monaco;

    const compilerOptions = {
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      jsxImportSource: "react",
      allowNonTsExtensions: true,
      allowJs: true,
      esModuleInterop: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      target: monaco.languages.typescript.ScriptTarget.ESNext,
    };
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);

    // Semantic validation is off because the project's node_modules are not
    // loaded into the worker — every `import` would be flagged as missing.
    // Syntax errors are still genuinely useful, so those stay on.
    const diagnostics = { noSemanticValidation: true, noSyntaxValidation: false };
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(diagnostics);
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(diagnostics);

    defineThemes(monaco);
  }, []);

  const onMount = useCallback<OnMount>(
    (instance, monaco) => {
      // Route Ctrl/Cmd+S to the app's save. Registering a command also stops
      // the browser's own "Save Page" dialog from opening.
      instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        saveRef.current?.();
      });

      instance.onDidChangeCursorPosition((event) =>
        onCursorChange?.({ line: event.position.lineNumber, column: event.position.column })
      );

      instance.onDidChangeCursorSelection(() => {
        const selection = instance.getSelection();
        const model = instance.getModel();
        if (!selection || !model || selection.isEmpty()) {
          onSelectionChange?.(null);
          return;
        }
        onSelectionChange?.({
          characters: model.getValueInRange(selection).length,
          lines: selection.endLineNumber - selection.startLineNumber + 1,
        });
      });
    },
    [onCursorChange, onSelectionChange]
  );

  // Re-derive the palette whenever the app theme changes. This has to be an
  // effect, not a render-time branch: reading a ref and mutating Monaco during
  // render is a side effect that concurrent rendering may run twice or discard.
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    defineThemes(monaco);
    monaco.editor.setTheme("forge");
  }, [theme]);

  if (tab.isBinary) {
    return (
      <div className="flex h-full items-center justify-center overflow-auto bg-canvas p-8">
        {isImageFile(tab.path) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tab.saved}
            alt={tab.path}
            className="max-h-full max-w-full rounded-lg border border-border object-contain shadow-[var(--shadow-panel)]"
            style={{ imageRendering: "auto" }}
          />
        ) : (
          <p className="text-[13px] text-muted">This file can&apos;t be previewed.</p>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full bg-canvas">
      {tab.truncated && (
        <div className="flex items-center gap-2 border-b border-warning/30 bg-warning-subtle px-3 py-1.5 text-[12px] text-warning">
          <AlertTriangle className="size-3.5 shrink-0" />
          This file is too large to load fully — only the first part is shown. Saving would truncate
          it, so editing is disabled.
        </div>
      )}

      <Editor
        key={theme}
        height="100%"
        theme="forge"
        path={tab.path}
        language={languageForPath(tab.path)}
        value={tab.draft}
        onChange={(value) => updateDraft(tab.path, value ?? "")}
        beforeMount={beforeMount}
        onMount={onMount}
        loading={
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-5 text-subtle" />
          </div>
        }
        options={
          {
            readOnly: tab.truncated,
            fontFamily: "var(--font-mono)",
            fontSize,
            lineHeight: Math.round(fontSize * 1.65),
            fontLigatures: true,
            letterSpacing: 0.2,
            minimap: { enabled: minimap, renderCharacters: false, maxColumn: 90 },
            lineNumbers: lineNumbers ? "on" : "off",
            lineNumbersMinChars: 3,
            wordWrap: wordWrap ? "on" : "off",
            automaticLayout: true,
            padding: { top: 12, bottom: 24 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            renderLineHighlight: "line",
            renderWhitespace: "selection",
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: "active", indentation: true },
            stickyScroll: { enabled: true, maxLineCount: 3 },
            tabSize: 2,
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
              useShadows: false,
            },
            overviewRulerBorder: false,
            fixedOverflowWidgets: true,
            suggest: { showWords: false },
            quickSuggestions: { other: true, comments: false, strings: false },
          } satisfies editor.IStandaloneEditorConstructionOptions
        }
      />
    </div>
  );
}
