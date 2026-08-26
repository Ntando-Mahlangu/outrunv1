import { describe, it, expect } from "vitest";
import { isSafeHttpUrl } from "./safe-url";

describe("isSafeHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isSafeHttpUrl("http://example.com")).toBe(true);
    expect(isSafeHttpUrl("https://example.com/path?q=1")).toBe(true);
  });

  it("rejects a javascript: URI", () => {
    expect(isSafeHttpUrl("javascript:alert(document.cookie)")).toBe(false);
  });

  it("rejects a data: URI", () => {
    expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects other non-http schemes", () => {
    expect(isSafeHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeHttpUrl("vbscript:msgbox(1)")).toBe(false);
  });

  it("rejects an unparseable string", () => {
    expect(isSafeHttpUrl("not a url")).toBe(false);
  });
});
