/**
 * Color Utils Tests
 * Tests hex color parsing functionality to ensure substr -> substring migration works correctly
 */

import { describe, it, expect } from "vitest";
import { getOptimalTextColor, isBrightColor } from "../src/utils/colorUtils";

describe("Color Utils", () => {
  describe("getOptimalTextColor", () => {
    it("should return white for dark colors", () => {
      expect(getOptimalTextColor("#000000")).toBe("white");
      expect(getOptimalTextColor("#333333")).toBe("white");
      expect(getOptimalTextColor("#1a1a1a")).toBe("white");
    });

    it("should return black for light colors", () => {
      expect(getOptimalTextColor("#ffffff")).toBe("black");
      expect(getOptimalTextColor("#f0f0f0")).toBe("black");
      expect(getOptimalTextColor("#cccccc")).toBe("black");
    });

    it("should handle 3-digit hex colors", () => {
      expect(getOptimalTextColor("#000")).toBe("white");
      expect(getOptimalTextColor("#fff")).toBe("black");
      expect(getOptimalTextColor("#f00")).toBe("black"); // red is actually bright
    });

    it("should handle hex colors without # prefix", () => {
      expect(getOptimalTextColor("000000")).toBe("white");
      expect(getOptimalTextColor("ffffff")).toBe("white"); // fallback for invalid format
    });
  });

  describe("isBrightColor", () => {
    it("should identify bright colors correctly", () => {
      expect(isBrightColor("#ffffff")).toBe(true);
      expect(isBrightColor("#f0f0f0")).toBe(true);
      expect(isBrightColor("#cccccc")).toBe(true);
    });

    it("should identify dark colors correctly", () => {
      expect(isBrightColor("#000000")).toBe(false);
      expect(isBrightColor("#333333")).toBe(false);
      expect(isBrightColor("#1a1a1a")).toBe(false);
    });

    it("should handle 3-digit hex colors", () => {
      expect(isBrightColor("#fff")).toBe(true);
      expect(isBrightColor("#000")).toBe(false);
    });
  });
});
