/**
 * Version comparison utilities for TypeNote
 * Implements semantic versioning comparison and validation
 */

import type { SemanticVersion } from "./types";
import { VersionComparison } from "./types";

/**
 * Parsed semantic version
 */
interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

/**
 * Parse a semantic version string
 * Supports formats: "1.0.0", "1.0.0-alpha", "1.0.0-beta.1", "1.0.0+build.123"
 */
export function parseVersion(version: SemanticVersion): ParsedVersion | null {
  // Semantic version regex pattern
  const pattern =
    /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/;

  const match = version.match(pattern);

  if (!match) {
    return null;
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    build: match[5],
  };
}

/**
 * Validate a semantic version string
 */
export function isValidVersion(version: SemanticVersion): boolean {
  return parseVersion(version) !== null;
}

/**
 * Compare two semantic versions
 * Returns VersionComparison indicating the relationship between versions
 */
export function compareVersions(
  version1: SemanticVersion,
  version2: SemanticVersion
): VersionComparison {
  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  // If either version is invalid, return incompatible
  if (!v1 || !v2) {
    return VersionComparison.INCOMPATIBLE;
  }

  // Compare major version
  if (v1.major !== v2.major) {
    return v1.major > v2.major
      ? VersionComparison.GREATER_THAN
      : VersionComparison.LESS_THAN;
  }

  // Compare minor version
  if (v1.minor !== v2.minor) {
    return v1.minor > v2.minor
      ? VersionComparison.GREATER_THAN
      : VersionComparison.LESS_THAN;
  }

  // Compare patch version
  if (v1.patch !== v2.patch) {
    return v1.patch > v2.patch
      ? VersionComparison.GREATER_THAN
      : VersionComparison.LESS_THAN;
  }

  // Compare prerelease versions
  if (v1.prerelease !== v2.prerelease) {
    // Version without prerelease is greater than version with prerelease
    if (!v1.prerelease) return VersionComparison.GREATER_THAN;
    if (!v2.prerelease) return VersionComparison.LESS_THAN;

    // Compare prerelease strings lexicographically
    return v1.prerelease > v2.prerelease
      ? VersionComparison.GREATER_THAN
      : VersionComparison.LESS_THAN;
  }

  // Versions are equal (build metadata is ignored in comparison)
  return VersionComparison.EQUAL;
}

/**
 * Check if version1 is greater than version2
 */
export function isGreaterThan(
  version1: SemanticVersion,
  version2: SemanticVersion
): boolean {
  return compareVersions(version1, version2) === VersionComparison.GREATER_THAN;
}

/**
 * Check if version1 is less than version2
 */
export function isLessThan(
  version1: SemanticVersion,
  version2: SemanticVersion
): boolean {
  return compareVersions(version1, version2) === VersionComparison.LESS_THAN;
}

/**
 * Check if version1 equals version2
 */
export function isEqual(
  version1: SemanticVersion,
  version2: SemanticVersion
): boolean {
  return compareVersions(version1, version2) === VersionComparison.EQUAL;
}

/**
 * Check if version1 is compatible with version2
 * Compatible means same major version (for versions >= 1.0.0)
 * or same major and minor version (for versions < 1.0.0)
 */
export function isCompatible(
  version1: SemanticVersion,
  version2: SemanticVersion
): boolean {
  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  if (!v1 || !v2) {
    return false;
  }

  // For versions >= 1.0.0, same major version means compatible
  if (v1.major >= 1 && v2.major >= 1) {
    return v1.major === v2.major;
  }

  // For versions < 1.0.0, same major and minor version means compatible
  return v1.major === v2.major && v1.minor === v2.minor;
}

/**
 * Get the next major version
 */
export function nextMajor(version: SemanticVersion): SemanticVersion | null {
  const v = parseVersion(version);
  if (!v) return null;

  return `${v.major + 1}.0.0`;
}

/**
 * Get the next minor version
 */
export function nextMinor(version: SemanticVersion): SemanticVersion | null {
  const v = parseVersion(version);
  if (!v) return null;

  return `${v.major}.${v.minor + 1}.0`;
}

/**
 * Get the next patch version
 */
export function nextPatch(version: SemanticVersion): SemanticVersion | null {
  const v = parseVersion(version);
  if (!v) return null;

  return `${v.major}.${v.minor}.${v.patch + 1}`;
}

/**
 * Sort versions in ascending order
 */
export function sortVersions(versions: SemanticVersion[]): SemanticVersion[] {
  return [...versions].sort((a, b) => {
    const comparison = compareVersions(a, b);
    return comparison === VersionComparison.INCOMPATIBLE ? 0 : comparison;
  });
}

/**
 * Get the latest version from a list
 */
export function getLatestVersion(
  versions: SemanticVersion[]
): SemanticVersion | null {
  if (versions.length === 0) return null;

  const sorted = sortVersions(versions);
  return sorted[sorted.length - 1];
}

/**
 * Check if a version satisfies a version range
 * Supports simple ranges: "^1.0.0" (compatible), "~1.0.0" (same minor), "1.0.0" (exact)
 */
export function satisfiesRange(
  version: SemanticVersion,
  range: string
): boolean {
  // Exact version match
  if (!range.startsWith("^") && !range.startsWith("~")) {
    return isEqual(version, range);
  }

  // Caret range (^) - compatible versions
  if (range.startsWith("^")) {
    const targetVersion = range.slice(1);
    return isCompatible(version, targetVersion) && !isLessThan(version, targetVersion);
  }

  // Tilde range (~) - same minor version
  if (range.startsWith("~")) {
    const targetVersion = range.slice(1);
    const v = parseVersion(version);
    const target = parseVersion(targetVersion);

    if (!v || !target) return false;

    return (
      v.major === target.major &&
      v.minor === target.minor &&
      v.patch >= target.patch
    );
  }

  return false;
}

/**
 * Format a version for display
 */
export function formatVersion(version: SemanticVersion): string {
  const v = parseVersion(version);
  if (!v) return version;

  let formatted = `${v.major}.${v.minor}.${v.patch}`;

  if (v.prerelease) {
    formatted += `-${v.prerelease}`;
  }

  if (v.build) {
    formatted += `+${v.build}`;
  }

  return formatted;
}

