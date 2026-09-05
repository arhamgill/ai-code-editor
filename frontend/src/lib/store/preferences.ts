"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light" | "system";

interface Preferences {
  theme: ThemeMode;

  // Panel layout
  explorerWidth: number;
  chatWidth: number;
  previewWidth: number;
  explorerOpen: boolean;
  chatOpen: boolean;
  previewOpen: boolean;

  // Editor
  fontSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;

  // Chat
  model: string;

  /** Cleared once the user has seen the workspace tour. */
  onboarded: boolean;

  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  toggle: (key: "explorerOpen" | "chatOpen" | "previewOpen" | "wordWrap" | "minimap") => void;
}

export const CHAT_MIN = 320;
export const CHAT_MAX = 720;
export const EXPLORER_MIN = 180;
export const EXPLORER_MAX = 460;
export const PREVIEW_MIN = 320;
export const PREVIEW_MAX = 900;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * All persisted UI preferences in one place.
 *
 * These used to be a dozen `useState` calls in the 1,800-line editor page, each
 * hand-syncing its own `localStorage` key on every drag event. zustand's
 * persist middleware batches the writes and, more importantly, lets panels
 * subscribe to just the slice they care about instead of re-rendering the whole
 * workspace whenever a divider moves.
 */
export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      theme: "dark",

      explorerWidth: 248,
      chatWidth: 400,
      previewWidth: 480,
      explorerOpen: true,
      chatOpen: true,
      previewOpen: false,

      fontSize: 13,
      wordWrap: false,
      minimap: false,
      lineNumbers: true,

      model: "openai/gpt-oss-120b",
      onboarded: false,

      set: (key, value) => set({ [key]: value } as never),
      toggle: (key) => set((state) => ({ [key]: !state[key] }) as never),
    }),
    {
      name: "forge.preferences",
      version: 2,
      // Old keys stored widths outside today's bounds; clamp on rehydrate so a
      // stale value can't render an unusable 60px panel.
      migrate: (persisted) => persisted as Preferences,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Preferences>;
        return {
          ...current,
          ...saved,
          explorerWidth: clamp(saved.explorerWidth ?? current.explorerWidth, EXPLORER_MIN, EXPLORER_MAX),
          chatWidth: clamp(saved.chatWidth ?? current.chatWidth, CHAT_MIN, CHAT_MAX),
          previewWidth: clamp(saved.previewWidth ?? current.previewWidth, PREVIEW_MIN, PREVIEW_MAX),
          fontSize: clamp(saved.fontSize ?? current.fontSize, 10, 22),
        };
      },
    }
  )
);
