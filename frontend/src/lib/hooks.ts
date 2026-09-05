"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@clerk/nextjs";
import { createApi, type ForgeApi } from "./api";
import { usePreferences } from "./store/preferences";

/** Typed API client bound to the current Clerk session. */
export function useApi(): ForgeApi {
  const { getToken } = useAuth();
  // getToken is stable per session; memoising keeps the client identity stable
  // so it can be a safe dependency of every data-fetching callback.
  return useMemo(() => createApi(() => getToken()), [getToken]);
}

/**
 * Keep a stable ref pointing at the newest value of something.
 *
 * Assigning `ref.current` during render is a side effect in render, which
 * breaks under concurrent rendering (and React's lint rules rightly flag it).
 * Updating in a layout effect keeps the ref fresh for anything that reads it
 * after paint — event handlers, timers, streams — which is every use here.
 */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

const NEVER_CHANGES = () => () => {};

/**
 * `false` during SSR and the first client render, `true` afterwards.
 * Uses `useSyncExternalStore` rather than a `setState` in an effect so it
 * costs no extra render pass.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false
  );
}

/**
 * Auth state that also reports when Clerk has failed to turn up.
 *
 * `useAuth().isLoaded` stays `false` forever if clerk.accounts.dev can't be
 * reached — an ad blocker, a corporate proxy, an offline laptop, or a
 * rate-limited development instance. Anything rendered behind a bare
 * `!isLoaded` check then spins for eternity, which is exactly how the landing
 * page ended up with no way into the app.
 *
 * Callers should render a usable default immediately and treat `timedOut` as
 * "Clerk is not coming — say so".
 */
export function useAuthGate(timeoutMs = 6000) {
  const { isLoaded, isSignedIn } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const timer = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [isLoaded, timeoutMs]);

  // Derived rather than reset from the effect: once Clerk arrives the timeout
  // is irrelevant, and clearing it with a setState would cost a second render.
  return { isLoaded, isSignedIn: !!isSignedIn, timedOut: timedOut && !isLoaded };
}

/* ───────────────────────────── Hotkeys ───────────────────────────── */

type HotkeyHandler = (event: KeyboardEvent) => void;

const isEditable = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable ||
    // Monaco swallows most keys itself, but Escape and Ctrl-chords reach us.
    !!el.closest(".monaco-editor")
  );
};

/**
 * Register global shortcuts.
 *
 * Keys are written like "mod+s" or "mod+shift+p". By default a shortcut with
 * no modifier is ignored while the user is typing — the previous build bound
 * bare keys globally, so pressing Escape in the chat box closed every panel.
 */
export function useHotkeys(
  bindings: Record<string, HotkeyHandler>,
  { enabled = true, allowInInputs = [] as string[] } = {}
) {
  const ref = useLatest(bindings);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const parts: string[] = [];
      if (mod) parts.push("mod");
      if (event.shiftKey) parts.push("shift");
      if (event.altKey) parts.push("alt");

      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
      parts.push(key);

      const combo = parts.join("+");
      const handler = ref.current[combo];
      if (!handler) return;

      if (isEditable(event.target) && !mod && !allowInInputs.includes(combo)) return;

      event.preventDefault();
      handler(event);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, allowInInputs.join("|")]);
}

/* ──────────────────────────── Resizable ──────────────────────────── */

/**
 * Drag-to-resize handle.
 *
 * Also keyboard-operable (arrow keys, Home/End) and exposed as a separator
 * with aria-valuenow, so the layout is adjustable without a mouse.
 */
export function useResizeHandle({
  value,
  min,
  max,
  onChange,
  direction = "right",
}: {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  /** "right" grows as the pointer moves right; "left" is the mirror. */
  direction?: "left" | "right";
}) {
  const [dragging, setDragging] = useState(false);
  const valueRef = useLatest(value);

  const clamp = useCallback((n: number) => Math.min(max, Math.max(min, n)), [min, max]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      const startX = event.clientX;
      const startValue = valueRef.current;
      const sign = direction === "right" ? 1 : -1;

      setDragging(true);
      // Keep the cursor consistent even when the pointer leaves the handle.
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (e: PointerEvent) => onChange(clamp(startValue + sign * (e.clientX - startX)));
      const onUp = () => {
        setDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [clamp, direction, onChange, valueRef]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const step = event.shiftKey ? 48 : 16;
      const sign = direction === "right" ? 1 : -1;
      const map: Record<string, number> = {
        ArrowLeft: -step * sign,
        ArrowRight: step * sign,
      };
      if (event.key in map) {
        event.preventDefault();
        onChange(clamp(valueRef.current + map[event.key]));
      } else if (event.key === "Home") {
        event.preventDefault();
        onChange(min);
      } else if (event.key === "End") {
        event.preventDefault();
        onChange(max);
      }
    },
    [clamp, direction, max, min, onChange, valueRef]
  );

  return {
    dragging,
    handleProps: {
      role: "separator" as const,
      "aria-orientation": "vertical" as const,
      "aria-valuenow": Math.round(value),
      "aria-valuemin": min,
      "aria-valuemax": max,
      "aria-label": "Resize panel",
      tabIndex: 0,
      onPointerDown,
      onKeyDown,
    },
  };
}

/* ───────────────────────────── Theme ─────────────────────────────── */

/** Applies the theme preference to <html data-theme>, following the OS in system mode. */
export function useThemeSync() {
  const theme = usePreferences((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const resolved =
        theme === "system"
          ? window.matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark"
          : theme;
      root.setAttribute("data-theme", resolved);
    };

    apply();
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}

/* ────────────────────────── Media query ──────────────────────────── */

export function useMediaQuery(query: string): boolean {
  // Subscribing directly to the MediaQueryList avoids the extra render pass a
  // `setState`-in-effect version costs on every mount, and reports `false`
  // during SSR instead of hydrating with a mismatched value.
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

/* ───────────────────── Unsaved-changes guard ─────────────────────── */

/** Warn before a reload or tab close when edits would be lost. */
export function useBeforeUnload(shouldWarn: () => boolean) {
  const ref = useLatest(shouldWarn);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!ref.current()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [ref]);
}

/* ───────────────────────── Copy to clipboard ─────────────────────── */

export function useCopy(resetAfter = 1600) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), resetAfter);
        return true;
      } catch {
        return false;
      }
    },
    [resetAfter]
  );

  return { copied, copy };
}
