import {
  isOriginAllowed,
  parseAllowedOrigins,
  defaultDevOrigins,
} from "../security";

describe("security config", () => {
  it("parseAllowedOrigins splits comma list", () => {
    expect(parseAllowedOrigins("https://a.com, https://b.com")).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
  });

  it("allows missing Origin for native mobile", () => {
    expect(isOriginAllowed(undefined, ["https://app.example.com"])).toBe(true);
  });

  it("allows listed browser origin", () => {
    expect(isOriginAllowed("https://app.example.com", ["https://app.example.com"])).toBe(
      true
    );
  });

  it("rejects unknown origin when not in allowlist", () => {
    expect(isOriginAllowed("https://evil.example", ["https://app.example.com"])).toBe(
      false
    );
  });

  it("defaultDevOrigins includes localhost", () => {
    expect(defaultDevOrigins()).toContain("http://localhost:3000");
  });
});
