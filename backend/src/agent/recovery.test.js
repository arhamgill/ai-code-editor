import { describe, it, expect } from "vitest";
import { recoverToolCalls, extractBalancedJson, safeJsonParse } from "./recovery.js";

const failure = (failed_generation) => ({
  status: 400,
  message: "tool_use_failed",
  error: { failed_generation },
});

describe("extractBalancedJson", () => {
  it("stops at the matching close brace", () => {
    const s = 'prefix {"a":1} suffix';
    expect(extractBalancedJson(s, s.indexOf("{"))).toBe('{"a":1}');
  });

  it("ignores braces inside string values", () => {
    const s = '{"content":"function f() { return {a:1}; }"}';
    expect(extractBalancedJson(s, 0)).toBe(s);
  });

  it("ignores escaped quotes", () => {
    const s = '{"content":"say \\"hi\\" {"}';
    expect(extractBalancedJson(s, 0)).toBe(s);
  });

  it("returns null when never balanced", () => {
    expect(extractBalancedJson('{"a":1', 0)).toBeNull();
  });
});

describe("safeJsonParse", () => {
  it("parses ordinary JSON", () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });

  // Models routinely emit a literal newline inside a code string, which is
  // invalid JSON — this is the single most common cause of a dropped call.
  it("recovers JSON containing raw control characters", () => {
    expect(safeJsonParse('{"content":"line1\nline2"}')).toEqual({ content: "line1\nline2" });
  });

  it("returns null for unrecoverable input", () => {
    expect(safeJsonParse("not json at all")).toBeNull();
  });
});

describe("recoverToolCalls", () => {
  it("extracts a single call", () => {
    const calls = recoverToolCalls(
      failure('<function=read_file,{"path":"app/page.tsx"}></function>')
    );
    expect(calls).toEqual([{ name: "read_file", args: { path: "app/page.tsx" } }]);
  });

  it("extracts a call whose arguments contain nested braces", () => {
    const calls = recoverToolCalls(
      failure('<function=write_file,{"path":"a.ts","content":"export const x = { y: 1 };"}>')
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].args.content).toBe("export const x = { y: 1 };");
  });

  it("extracts multiple calls without re-matching inside the first payload", () => {
    const calls = recoverToolCalls(
      failure(
        '<function=read_file,{"path":"a.ts"}></function><function=write_file,{"path":"b.ts","content":"x"}></function>'
      )
    );
    expect(calls.map((c) => c.name)).toEqual(["read_file", "write_file"]);
  });

  // Executing write_file with empty args would blank the file.
  it("drops calls whose arguments cannot be parsed", () => {
    expect(recoverToolCalls(failure("<function=write_file,{broken"))).toEqual([]);
  });

  it("returns nothing for an unrelated error", () => {
    expect(recoverToolCalls(new Error("connection reset"))).toEqual([]);
    expect(recoverToolCalls({})).toEqual([]);
  });
});
