import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Next 16 renamed the `middleware` file convention to `proxy`, and deprecated
 * the `middleware` named export along with it. The runtime is Node.js and is
 * no longer configurable, which suits Clerk fine.
 */
export const proxy = clerkMiddleware();

export default proxy;

export const config = {
  matcher: [
    // Skip Next internals and static files unless they appear in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
