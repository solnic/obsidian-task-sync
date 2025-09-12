import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExternalDataCache } from "../src/services/ExternalDataCache";

// Mock plugin for testing
const mockPlugin = {
  loadData: vi.fn().mockResolvedValue({}),
  saveData: vi.fn().mockResolvedValue(undefined),
};

describe("Service Cache Isolation", () => {
  let cache: ExternalDataCache;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create fresh cache instance
    cache = new ExternalDataCache(mockPlugin as any);
    await cache.initialize();
  });

  it("should maintain cache isolation between different service prefixes", async () => {
    // Set up some cache data for both services
    await cache.set("apple-reminders|incomplete|with-allday", [
      { id: "1", title: "Apple Reminder 1", completed: false },
    ]);
    await cache.set("apple-reminders-lists", [
      { id: "list1", name: "Test List" },
    ]);
    await cache.set("github-repositories", [{ id: 1, name: "test-repo" }]);
    await cache.set("github-labels-test/repo1", [
      { name: "bug", color: "red" },
    ]);

    // Verify all data is cached
    expect(
      await cache.get("apple-reminders|incomplete|with-allday")
    ).toBeTruthy();
    expect(await cache.get("apple-reminders-lists")).toBeTruthy();
    expect(await cache.get("github-repositories")).toBeTruthy();
    expect(await cache.get("github-labels-test/repo1")).toBeTruthy();

    // Simulate GitHub cache clearing by deleting specific GitHub keys
    await cache.delete("github-repositories");
    await cache.delete("github-labels-test/repo1");

    // Apple Reminders cache should still exist
    expect(
      await cache.get("apple-reminders|incomplete|with-allday")
    ).toBeTruthy();
    expect(await cache.get("apple-reminders-lists")).toBeTruthy();

    // GitHub cache should be cleared
    expect(await cache.get("github-repositories")).toBeNull();
    expect(await cache.get("github-labels-test/repo1")).toBeNull();
  });

  it("should not clear GitHub cache when Apple Reminders cache is cleared", async () => {
    // Set up some cache data for both services
    await cache.set("apple-reminders|incomplete|with-allday", [
      { id: "1", title: "Apple Reminder 1", completed: false },
    ]);
    await cache.set("github-repositories", [{ id: 1, name: "test-repo" }]);
    await cache.set("github-labels-test/repo1", [
      { name: "bug", color: "red" },
    ]);

    // Verify all data is cached
    expect(
      await cache.get("apple-reminders|incomplete|with-allday")
    ).toBeTruthy();
    expect(await cache.get("github-repositories")).toBeTruthy();
    expect(await cache.get("github-labels-test/repo1")).toBeTruthy();

    // Simulate Apple Reminders cache clearing by deleting specific Apple keys
    await cache.delete("apple-reminders|incomplete|with-allday");

    // GitHub cache should still exist
    expect(await cache.get("github-repositories")).toBeTruthy();
    expect(await cache.get("github-labels-test/repo1")).toBeTruthy();

    // Apple Reminders cache should be cleared
    expect(
      await cache.get("apple-reminders|incomplete|with-allday")
    ).toBeNull();
  });

  it("should clear only specific GitHub repository caches", async () => {
    // Set up cache data for multiple repositories
    await cache.set("github-labels-test/repo1", [{ name: "bug" }]);
    await cache.set("github-labels-test/repo2", [{ name: "feature" }]);
    await cache.set("github-labels-other/repo", [{ name: "enhancement" }]);
    await cache.set("apple-reminders|incomplete|with-allday", [{ id: "1" }]);

    // Simulate clearing label cache for specific repository
    await cache.delete("github-labels-test/repo1");

    // Only the specific repository cache should be cleared
    expect(await cache.get("github-labels-test/repo1")).toBeNull();
    expect(await cache.get("github-labels-test/repo2")).toBeTruthy();
    expect(await cache.get("github-labels-other/repo")).toBeTruthy();
    expect(
      await cache.get("apple-reminders|incomplete|with-allday")
    ).toBeTruthy();
  });
});
