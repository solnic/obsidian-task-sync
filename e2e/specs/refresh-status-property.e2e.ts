import { test, expect, describe, beforeEach } from "vitest";
import { createFile, getFrontMatter, executeCommand } from "../helpers/global";
import { setupE2ETestHooks } from "../helpers/shared-context";

describe("Refresh Status Property", () => {
  const context = setupE2ETestHooks();

  test("should add ALL missing schema properties during refresh", async () => {
    const taskFile = await createFile(context, "Tasks/Minimal Task.md", {
      Type: "Task",
      Title: "Minimal Task",
    });

    await executeCommand(context, "Task Sync: Refresh", {
      notice: "Refresh completed!",
    });

    const frontMatter = await getFrontMatter(context, taskFile.path);

    expect(frontMatter.Title).toBeDefined();
    expect(frontMatter.Type).toBeDefined();
    expect(frontMatter.Areas).toBeDefined();
    expect(frontMatter["Parent task"]).toBeDefined();

    expect(frontMatter.tags).toBeDefined();
    expect(frontMatter.Project).toBeDefined();
    expect(frontMatter.Done).toBeDefined();
    expect(frontMatter.Status).toBeDefined();
    expect(frontMatter.Priority).toBeDefined();

    expect(frontMatter.Status).toBe("Backlog");
  });
});
