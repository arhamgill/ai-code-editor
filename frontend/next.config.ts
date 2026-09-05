import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * This app sits next to a sibling package with its own lockfile, so Next
   * guesses the wrong tracing root and warns on every build. `process.cwd()`
   * is correct here because Next is always invoked from this directory.
   *
   * Note: deliberately NOT `turbopack.root` — pointing that at a
   * mis-resolved path sends the dev file watcher runaway.
   */
  outputFileTracingRoot: process.cwd(),

  async headers() {
    return [
      {
        /**
         * WebContainers need `SharedArrayBuffer`, which the browser only
         * exposes to a cross-origin-isolated document (COOP + COEP).
         *
         * Scoped to the workspace rather than applied site-wide: isolation
         * blocks third-party subresources that don't opt in with CORP, and
         * there's no reason to impose that on the landing or auth pages.
         *
         * `credentialless` is used instead of `require-corp` so cross-origin
         * images (avatars, for one) still load — they're fetched without
         * credentials rather than refused outright.
         */
        source: "/projects/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
