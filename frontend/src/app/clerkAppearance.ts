// Shared Clerk appearance — monochrome, matching the Forge theme.
// Applied globally on <ClerkProvider> so every Clerk component (SignIn, SignUp,
// UserButton, UserProfile, …) is styled consistently.
//
// IMPORTANT: Clerk derives hover/active shades from `colorPrimary`. With a pure
// white primary those derived shades darken toward black, which made links and
// text disappear against the dark card. We therefore keep the palette here and
// pin every interactive state explicitly in globals.css (`.cl-*` rules), rather
// than letting Clerk compute them.
export const clerkAppearance = {
  layout: {
    socialButtonsVariant: "blockButton" as const,
    shimmer: false,
  },
  variables: {
    // Surfaces are deliberately lifted off pure black so the card reads as a
    // distinct panel and hover states have somewhere to go.
    colorBackground: "#111111",
    colorInputBackground: "#181818",
    colorPrimary: "#ffffff",
    colorTextOnPrimaryBackground: "#000000",
    colorText: "#ededed",
    colorTextSecondary: "#a1a1a1",
    colorInputText: "#ededed",
    colorDanger: "#f87171",
    colorSuccess: "#4ade80",
    colorWarning: "#d4d4d4",
    colorNeutral: "#ffffff",
    borderRadius: "8px",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    fontSize: "0.9rem",
  },
  elements: {
    // The "Last used" pill renders near-black on the dark card by default.
    // Styling it through the elements API rather than a `.cl-*` selector, since
    // Clerk emits an unstable generated class name for it.
    badge: {
      backgroundColor: "#3a3a3a",
      color: "#ffffff",
      border: "1px solid #555555",
      fontWeight: 500,
      opacity: 1,
    },
    socialButtonsProviderInitialIcon: {
      color: "#ffffff",
    },
  },
};
