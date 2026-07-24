import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Cross-Origin Isolation headers required for WebContainers (@webcontainer/api).
   * COOP + COEP must both be set to enable SharedArrayBuffer in the browser.
   * Safe for a developer tool — does not affect regular page navigation.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
