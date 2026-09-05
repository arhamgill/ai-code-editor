/**
 * Normalise any CSS colour into the `#rrggbb` / `#rrggbbaa` form Monaco accepts.
 *
 * Monaco's theme parser rejects shorthand hex outright ("Illegal value for
 * token color: #fff"), and Tailwind's minifier happily rewrites `#ffffff` to
 * `#fff` in the built stylesheet — so reading a design token straight out of
 * `getComputedStyle` and handing it to `defineTheme` crashed the whole editor
 * in the light theme.
 */
export function toMonacoHex(value: string, fallback: string): string {
  const input = (value ?? "").trim();
  if (!input) return fallback;

  const shorthand = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i.exec(input);
  if (shorthand) {
    const [, r, g, b, a] = shorthand;
    return `#${r}${r}${g}${g}${b}${b}${a ? `${a}${a}` : ""}`;
  }

  if (/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(input)) return input;

  // Browsers sometimes report rgb()/rgba() rather than the authored hex.
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(input);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
    const [r, g, b, a] = parts;
    if (r && g && b) {
      const byte = (n: number) =>
        Math.max(0, Math.min(255, Math.round(n)))
          .toString(16)
          .padStart(2, "0");
      const alphaByte = a === undefined ? "" : byte(Number(a) * 255);
      return `#${byte(Number(r))}${byte(Number(g))}${byte(Number(b))}${alphaByte}`;
    }
  }

  return fallback;
}

/** Append an alpha byte to an already-normalised `#rrggbb`. */
export function withAlpha(hex: string, byte: string): string {
  return `${hex.slice(0, 7)}${byte}`;
}
