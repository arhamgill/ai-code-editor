/**
 * Clerk theming.
 *
 * Clerk derives hover and active shades from `colorPrimary`, so the palette is
 * kept deliberately mid-tone; the exact surface colours are pinned with `.cl-*`
 * rules in globals.css, which follow our light/dark tokens.
 */
export const clerkAppearance = {
  layout: {
    socialButtonsVariant: "blockButton" as const,
    shimmer: false,
    logoPlacement: "none" as const,
  },
  variables: {
    colorPrimary: "#5b9bff",
    colorTextOnPrimaryBackground: "#08090a",
    colorDanger: "#f85149",
    colorSuccess: "#3fb950",
    colorWarning: "#d29922",
    borderRadius: "8px",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    fontSize: "0.875rem",
  },
  elements: {
    // Clerk emits an unstable generated class for this pill, so it can only be
    // reached through the elements API.
    badge: {
      backgroundColor: "var(--color-surface-active)",
      color: "var(--color-fg-bright)",
      border: "1px solid var(--color-border-strong)",
      fontWeight: 500,
    },
    socialButtonsProviderInitialIcon: { color: "var(--color-fg-bright)" },
    footer: { background: "transparent" },
  },
};
