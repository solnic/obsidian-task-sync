/**
 * Unit tests for NoteKit version utilities
 */

import { describe, test, expect } from "vitest";
import {
  parseVersion,
  isValidVersion,
  compareVersions,
  isGreaterThan,
  isLessThan,
  isEqual,
  isCompatible,
  nextMajor,
  nextMinor,
  nextPatch,
  sortVersions,
  getLatestVersion,
  satisfiesRange,
  formatVersion,
} from "../../../src/app/core/note-kit/version";
import { VersionComparison } from "../../../src/app/core/note-kit/types";

describe("parseVersion", () => {
  test("parses valid semantic versions", () => {
    expect(parseVersion("1.0.0")).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: undefined,
      build: undefined,
    });

    expect(parseVersion("2.5.3")).toEqual({
      major: 2,
      minor: 5,
      patch: 3,
      prerelease: undefined,
      build: undefined,
    });
  });

  test("parses versions with prerelease", () => {
    expect(parseVersion("1.0.0-alpha")).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: "alpha",
      build: undefined,
    });

    expect(parseVersion("1.0.0-beta.1")).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: "beta.1",
      build: undefined,
    });
  });

  test("parses versions with build metadata", () => {
    expect(parseVersion("1.0.0+build.123")).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: undefined,
      build: "build.123",
    });
  });

  test("parses versions with both prerelease and build", () => {
    expect(parseVersion("1.0.0-alpha+build.123")).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: "alpha",
      build: "build.123",
    });
  });

  test("returns null for invalid versions", () => {
    expect(parseVersion("1.0")).toBeNull();
    expect(parseVersion("1")).toBeNull();
    expect(parseVersion("invalid")).toBeNull();
    expect(parseVersion("")).toBeNull();
  });
});

describe("isValidVersion", () => {
  test("validates correct versions", () => {
    expect(isValidVersion("1.0.0")).toBe(true);
    expect(isValidVersion("2.5.3")).toBe(true);
    expect(isValidVersion("1.0.0-alpha")).toBe(true);
    expect(isValidVersion("1.0.0+build.123")).toBe(true);
  });

  test("rejects invalid versions", () => {
    expect(isValidVersion("1.0")).toBe(false);
    expect(isValidVersion("1")).toBe(false);
    expect(isValidVersion("invalid")).toBe(false);
    expect(isValidVersion("")).toBe(false);
  });
});

describe("compareVersions", () => {
  test("compares major versions", () => {
    expect(compareVersions("2.0.0", "1.0.0")).toBe(
      VersionComparison.GREATER_THAN
    );
    expect(compareVersions("1.0.0", "2.0.0")).toBe(VersionComparison.LESS_THAN);
  });

  test("compares minor versions", () => {
    expect(compareVersions("1.2.0", "1.1.0")).toBe(
      VersionComparison.GREATER_THAN
    );
    expect(compareVersions("1.1.0", "1.2.0")).toBe(VersionComparison.LESS_THAN);
  });

  test("compares patch versions", () => {
    expect(compareVersions("1.0.2", "1.0.1")).toBe(
      VersionComparison.GREATER_THAN
    );
    expect(compareVersions("1.0.1", "1.0.2")).toBe(VersionComparison.LESS_THAN);
  });

  test("identifies equal versions", () => {
    expect(compareVersions("1.0.0", "1.0.0")).toBe(VersionComparison.EQUAL);
    expect(compareVersions("2.5.3", "2.5.3")).toBe(VersionComparison.EQUAL);
  });

  test("compares prerelease versions", () => {
    expect(compareVersions("1.0.0", "1.0.0-alpha")).toBe(
      VersionComparison.GREATER_THAN
    );
    expect(compareVersions("1.0.0-alpha", "1.0.0")).toBe(
      VersionComparison.LESS_THAN
    );
    expect(compareVersions("1.0.0-beta", "1.0.0-alpha")).toBe(
      VersionComparison.GREATER_THAN
    );
  });

  test("ignores build metadata in comparison", () => {
    expect(compareVersions("1.0.0+build.1", "1.0.0+build.2")).toBe(
      VersionComparison.EQUAL
    );
  });

  test("returns incompatible for invalid versions", () => {
    expect(compareVersions("invalid", "1.0.0")).toBe(
      VersionComparison.INCOMPATIBLE
    );
    expect(compareVersions("1.0.0", "invalid")).toBe(
      VersionComparison.INCOMPATIBLE
    );
  });
});

describe("isGreaterThan", () => {
  test("correctly identifies greater versions", () => {
    expect(isGreaterThan("2.0.0", "1.0.0")).toBe(true);
    expect(isGreaterThan("1.1.0", "1.0.0")).toBe(true);
    expect(isGreaterThan("1.0.1", "1.0.0")).toBe(true);
  });

  test("returns false for equal or lesser versions", () => {
    expect(isGreaterThan("1.0.0", "1.0.0")).toBe(false);
    expect(isGreaterThan("1.0.0", "2.0.0")).toBe(false);
  });
});

describe("isLessThan", () => {
  test("correctly identifies lesser versions", () => {
    expect(isLessThan("1.0.0", "2.0.0")).toBe(true);
    expect(isLessThan("1.0.0", "1.1.0")).toBe(true);
    expect(isLessThan("1.0.0", "1.0.1")).toBe(true);
  });

  test("returns false for equal or greater versions", () => {
    expect(isLessThan("1.0.0", "1.0.0")).toBe(false);
    expect(isLessThan("2.0.0", "1.0.0")).toBe(false);
  });
});

describe("isEqual", () => {
  test("correctly identifies equal versions", () => {
    expect(isEqual("1.0.0", "1.0.0")).toBe(true);
    expect(isEqual("2.5.3", "2.5.3")).toBe(true);
  });

  test("returns false for different versions", () => {
    expect(isEqual("1.0.0", "1.0.1")).toBe(false);
    expect(isEqual("1.0.0", "2.0.0")).toBe(false);
  });
});

describe("isCompatible", () => {
  test("versions with same major (>= 1.0.0) are compatible", () => {
    expect(isCompatible("1.0.0", "1.5.0")).toBe(true);
    expect(isCompatible("2.0.0", "2.9.9")).toBe(true);
  });

  test("versions with different major (>= 1.0.0) are incompatible", () => {
    expect(isCompatible("1.0.0", "2.0.0")).toBe(false);
    expect(isCompatible("2.0.0", "3.0.0")).toBe(false);
  });

  test("versions < 1.0.0 require same major and minor", () => {
    expect(isCompatible("0.1.0", "0.1.5")).toBe(true);
    expect(isCompatible("0.1.0", "0.2.0")).toBe(false);
  });
});

describe("nextMajor", () => {
  test("increments major version", () => {
    expect(nextMajor("1.0.0")).toBe("2.0.0");
    expect(nextMajor("2.5.3")).toBe("3.0.0");
  });

  test("returns null for invalid versions", () => {
    expect(nextMajor("invalid")).toBeNull();
  });
});

describe("nextMinor", () => {
  test("increments minor version", () => {
    expect(nextMinor("1.0.0")).toBe("1.1.0");
    expect(nextMinor("2.5.3")).toBe("2.6.0");
  });

  test("returns null for invalid versions", () => {
    expect(nextMinor("invalid")).toBeNull();
  });
});

describe("nextPatch", () => {
  test("increments patch version", () => {
    expect(nextPatch("1.0.0")).toBe("1.0.1");
    expect(nextPatch("2.5.3")).toBe("2.5.4");
  });

  test("returns null for invalid versions", () => {
    expect(nextPatch("invalid")).toBeNull();
  });
});

describe("sortVersions", () => {
  test("sorts versions in ascending order", () => {
    const versions = ["2.0.0", "1.0.0", "1.5.0", "1.0.1"];
    expect(sortVersions(versions)).toEqual([
      "1.0.0",
      "1.0.1",
      "1.5.0",
      "2.0.0",
    ]);
  });

  test("handles prerelease versions", () => {
    const versions = ["1.0.0", "1.0.0-beta", "1.0.0-alpha"];
    expect(sortVersions(versions)).toEqual([
      "1.0.0-alpha",
      "1.0.0-beta",
      "1.0.0",
    ]);
  });
});

describe("getLatestVersion", () => {
  test("returns the latest version", () => {
    const versions = ["1.0.0", "2.0.0", "1.5.0"];
    expect(getLatestVersion(versions)).toBe("2.0.0");
  });

  test("returns null for empty array", () => {
    expect(getLatestVersion([])).toBeNull();
  });
});

describe("satisfiesRange", () => {
  test("exact version match", () => {
    expect(satisfiesRange("1.0.0", "1.0.0")).toBe(true);
    expect(satisfiesRange("1.0.1", "1.0.0")).toBe(false);
  });

  test("caret range (compatible versions)", () => {
    expect(satisfiesRange("1.5.0", "^1.0.0")).toBe(true);
    expect(satisfiesRange("1.0.0", "^1.0.0")).toBe(true);
    expect(satisfiesRange("2.0.0", "^1.0.0")).toBe(false);
    expect(satisfiesRange("0.9.0", "^1.0.0")).toBe(false);
  });

  test("tilde range (same minor version)", () => {
    expect(satisfiesRange("1.0.5", "~1.0.0")).toBe(true);
    expect(satisfiesRange("1.0.0", "~1.0.0")).toBe(true);
    expect(satisfiesRange("1.1.0", "~1.0.0")).toBe(false);
  });
});

describe("formatVersion", () => {
  test("formats basic versions", () => {
    expect(formatVersion("1.0.0")).toBe("1.0.0");
    expect(formatVersion("2.5.3")).toBe("2.5.3");
  });

  test("formats versions with prerelease", () => {
    expect(formatVersion("1.0.0-alpha")).toBe("1.0.0-alpha");
  });

  test("formats versions with build", () => {
    expect(formatVersion("1.0.0+build.123")).toBe("1.0.0+build.123");
  });

  test("returns original string for invalid versions", () => {
    expect(formatVersion("invalid")).toBe("invalid");
  });
});
