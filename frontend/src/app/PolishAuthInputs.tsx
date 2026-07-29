"use client";

import { useEffect } from "react";

/**
 * Clerk renders its identifier field as a plain text input, so browsers
 * spell-check it and draw a red squiggle under usernames/emails. There is no
 * CSS for that, so turn spell-checking (and auto-capitalise) off on the auth
 * inputs once Clerk has mounted them.
 */
export function PolishAuthInputs() {
  useEffect(() => {
    const apply = () => {
      document
        .querySelectorAll<HTMLInputElement>('.cl-formFieldInput, .cl-card input, .cl-cardBox input')
        .forEach((el) => {
          if (el.type === "password") return;
          el.spellcheck = false;
          el.setAttribute("spellcheck", "false");
          el.setAttribute("autocapitalize", "none");
          el.setAttribute("autocorrect", "off");
        });
    };

    apply();
    // Clerk mounts asynchronously and re-renders between steps, so keep watching.
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
