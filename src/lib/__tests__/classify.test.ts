import { describe, it, expect } from "vitest";
import { classifyRegion, detectLang } from "../sources";

describe("classifyRegion", () => {
  it("maps German cities and country to DE", () => {
    expect(classifyRegion("Berlin, Germany", false)).toBe("DE");
    expect(classifyRegion("Munich", false)).toBe("DE");
    expect(classifyRegion("Karlsruhe, Baden-Wurttemberg", false)).toBe("DE");
  });

  it("maps Austria and Switzerland to DACH (not DE)", () => {
    expect(classifyRegion("Vienna, Austria", false)).toBe("DACH");
    expect(classifyRegion("Zurich", false)).toBe("DACH");
  });

  it("maps other European locations to EU", () => {
    expect(classifyRegion("Amsterdam, Netherlands", false)).toBe("EU");
    expect(classifyRegion("Dublin, Ireland", false)).toBe("EU");
  });

  it("classifies worldwide-remote as OTHER", () => {
    expect(classifyRegion("Anywhere", true)).toBe("OTHER");
    expect(classifyRegion("Worldwide", true)).toBe("OTHER");
  });

  it("falls back to OTHER for unknown locations", () => {
    expect(classifyRegion("Tokyo, Japan", false)).toBe("OTHER");
  });
});

describe("detectLang", () => {
  it("detects German from common tokens", () => {
    expect(detectLang("Softwareentwickler (m/w/d)", "Wir suchen dich fur unser Team")).toBe("de");
  });

  it("defaults to English otherwise", () => {
    expect(detectLang("Senior Backend Engineer", "We are looking for an engineer")).toBe("en");
  });
});
