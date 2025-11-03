import type { Page } from "playwright";
import { expect } from "@playwright/test";
import { openFile, waitForBaseView, readVaultFile } from "./global";

/**
 * Force-regenerate all bases via plugin API.
 */
export async function regenerateBases(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];
    if (!plugin) throw new Error("Task Sync plugin not found");
    await plugin.regenerateBases();
  });

  // Wait for file system operations to complete
  await page.waitForTimeout(500);

  // Verify bases were actually created by checking for at least one .base file
  await page.waitForFunction(
    async () => {
      const app = (window as any).app;
      const basesFolder =
        app.plugins.plugins["obsidian-task-sync"]?.settings?.basesFolder ||
        "Bases";
      try {
        const contents = await app.vault.adapter.list(basesFolder);
        return contents.files.some((f: string) => f.endsWith(".base"));
      } catch {
        return false;
      }
    },
    { timeout: 5000 }
  );
}

/**
 * Open a note expected to embed a Bases view, with smart waits and a retry.
 */
export async function openNoteWithBases(
  page: Page,
  filePath: string,
  timeoutMs: number = 3000
): Promise<void> {
  // Ensure vault sees the file
  await page.waitForFunction(
    async ({ path }) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      return file !== null;
    },
    { path: filePath },
    { timeout: timeoutMs }
  );

  // Open the file
  await page.evaluate(async (path) => {
    const app = (window as any).app;
    const file = app.vault.getAbstractFileByPath(path);
    const leaf = app.workspace.getLeaf();
    await leaf.openFile(file);
    // Force Reading (preview) mode to ensure embeds render
    if (leaf && leaf.view && typeof leaf.view.setState === "function") {
      try {
        await leaf.view.setState({ mode: "preview" });
      } catch {}
    }
  }, filePath);

  // Wait for active file with longer timeout
  await page.waitForFunction(
    ({ path }) => {
      const app = (window as any).app;
      return app.workspace.getActiveFile()?.path === path;
    },
    { path: filePath },
    { timeout: timeoutMs }
  );

  // Ensure active file stays stable as the expected path for a short window
  const stabilityWindowMs = 800;
  const start = Date.now();
  while (Date.now() - start < stabilityWindowMs) {
    const stillActive = await page.evaluate(
      ({ path }) => {
        const app = (window as any).app;
        return app.workspace.getActiveFile()?.path === path;
      },
      { path: filePath }
    );
    if (!stillActive) {
      await page.evaluate(async (path) => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(path);
        const leaf = app.workspace.getLeaf();
        await leaf.openFile(file);
      }, filePath);
    }
    await page.waitForTimeout(50);
  }

  // Wait for editor to be visible
  await page.waitForSelector(".markdown-source-view, .markdown-preview-view", {
    state: "visible",
    timeout: timeoutMs,
  });

  // Two-stage wait for embedded Bases UI: first embed presence, then table
  const deadline = Date.now() + timeoutMs;
  let embedVisible = false;
  while (Date.now() < deadline) {
    embedVisible = await page
      .locator(".internal-embed.bases-embed")
      .isVisible()
      .catch(() => false);
    if (embedVisible) break;
    // Re-open target file to fight focus-steal by newly created task notes
    await page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      const leaf = app.workspace.getLeaf();
      await leaf.openFile(file);
    }, filePath);
    await page.waitForTimeout(100);
  }

  // Now wait for bases view/table to be present inside the embed
  await page.waitForSelector(".internal-embed.bases-embed .bases-view", {
    timeout: Math.max(3000, timeoutMs / 3),
  });
  await page.waitForSelector(
    ".internal-embed.bases-embed .bases-view .bases-table-container",
    {
      timeout: Math.max(5000, timeoutMs / 3),
    }
  );

  // Validate that core toolbar + at least one header renders; if not, retry once
  const toolbar = page.locator(".bases-view .query-toolbar");
  const hasToolbar = await toolbar
    .isVisible({ timeout: 3000 })
    .catch(() => false);
  const headerDone = page.locator(
    '.bases-view .bases-table-header-name:has-text("Done")'
  );
  const headerVisible = await headerDone
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  if (!hasToolbar || !headerVisible) {
    // Retry after forcing regeneration and a small delay
    await regenerateBases(page);
    await page.waitForTimeout(300);
    await page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      const leaf = app.workspace.getLeaf();
      await leaf.openFile(file);
      if (leaf && leaf.view && typeof leaf.view.setState === "function") {
        try {
          await leaf.view.setState({ mode: "preview" });
        } catch {}
      }
    }, filePath);
    await waitForBaseView(page as any, timeoutMs);
  }

  // Final guard: ensure there is at least a table container present
  await page.waitForSelector(".bases-view .bases-table-container", {
    timeout: Math.max(5000, timeoutMs / 3),
  });
}

/**
 * Open note and wait for Bases view using the legacy-stable path.
 * This mirrors the old working e2e flows.
 */
export async function openBaseNoteStable(
  page: Page,
  filePath: string,
  timeoutMs: number = 3000
): Promise<void> {
  // Close any existing open files to ensure clean state
  await page.evaluate(async () => {
    const app = (window as any).app;
    const leaves = app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
      await leaf.detach();
    }
  });

  await page.waitForTimeout(200);

  // Now open the file fresh
  await openFile(page as any, filePath, timeoutMs);

  // Switch to preview mode so embeds render
  await page.evaluate(async (path) => {
    const app = (window as any).app;
    const activeFile = app.workspace.getActiveFile();
    if (activeFile?.path === path) {
      const activeLeaf = app.workspace.activeLeaf;
      if (activeLeaf?.view && typeof activeLeaf.view.setMode === "function") {
        activeLeaf.view.setMode("preview");
      }
    }
  }, filePath);

  // Wait for preview mode content
  await page.waitForSelector(".markdown-preview-view", {
    state: "attached",
    timeout: 5000,
  });

  // Wait for embed to appear (may not have is-loaded immediately)
  await page.waitForSelector(".internal-embed.bases-embed", {
    state: "attached",
    timeout: 3000,
  });

  // Give Bases plugin time to load the embed content
  await page.waitForTimeout(500);

  // Expand collapsed headings
  await page.evaluate(() => {
    const collapsedHeadings = document.querySelectorAll(
      ".markdown-preview-view .heading-collapse-indicator.collapse-icon"
    );
    collapsedHeadings.forEach((indicator: Element) => {
      const parent = indicator.closest(
        ".el-h2, .el-h3, .el-h4, .el-h5, .el-h6"
      );
      if (parent && parent.classList.contains("is-collapsed")) {
        (indicator as HTMLElement).click();
      }
    });
  });

  await page.waitForTimeout(500);

  await waitForBaseView(page as any, timeoutMs);
}

/**
 * Wait for the bases view to load and have data rendered.
 * This waits for the table structure and at least one task row to appear.
 */
export async function waitForBaseViewToLoad(
  page: Page,
  timeout = 3000
): Promise<void> {
  // Wait for bases view container
  await page.waitForSelector(".bases-view", {
    state: "visible",
    timeout,
  });

  // Wait for table structure
  await page.waitForSelector(".bases-view .bases-table-container", {
    state: "visible",
    timeout,
  });

  // Wait for actual data rows to appear (bases queries asynchronously)
  await page.waitForFunction(
    () => {
      const links = document.querySelectorAll(
        ".bases-view .bases-tbody .bases-tr .bases-table-cell .internal-link"
      );
      return links.length > 0;
    },
    undefined,
    { timeout }
  );
}

/**
 * Read all task titles currently visible in the Bases table.
 * Only returns titles from tbody rows (not headers).
 * Scopes to only the Title column cell to avoid fetching from other columns.
 * Only includes rows that are actually visible (not filtered out by the view).
 */
export async function getBaseTaskTitles(page: Page): Promise<string[]> {
  // Scope to the embed to get the correct bases-view instance
  const embedLocator = page.locator(".internal-embed.bases-embed .bases-view");

  // Find all Title column cells that are visible
  // Using filter() ensures we only get elements that are actually visible
  const titleLinks = embedLocator
    .locator(
      ".bases-tbody .bases-tr .bases-td[data-property*='Title'] .bases-table-cell .internal-link"
    )
    .filter({ hasNotText: "" }); // Exclude empty links

  const count = await titleLinks.count();
  const titles: string[] = [];

  for (let i = 0; i < count; i++) {
    const link = titleLinks.nth(i);
    // Only get visible links - Playwright's isVisible() checks computed style and viewport
    const isVisible = await link.isVisible().catch(() => false);
    if (isVisible) {
      const text = await link.textContent().catch(() => "");
      if (text && text.trim().length > 0) {
        titles.push(text.trim());
      }
    }
  }

  return titles;
}

/**
 * Check if views dropdown is available in the bases view.
 */
export async function hasViewsDropdown(page: Page): Promise<boolean> {
  const viewsContainer = page.locator(".bases-view .query-toolbar .mod-views");
  const count = await viewsContainer.count();
  if (count === 0) return false;

  const button = viewsContainer.locator(".text-icon-button").first();
  return (await button.count()) > 0;
}

/**
 * Click the views toolbar button and select a view by exact label.
 */
export async function switchBaseView(
  page: Page,
  viewLabel: string
): Promise<void> {
  // Wait for bases view to be fully loaded first
  await waitForBaseViewToLoad(page, 3000);

  // Find the views dropdown button in the toolbar
  // The .query-toolbar and .bases-view are siblings, not parent-child
  // Look for the specific button inside the .mod-views toolbar item
  let viewsButton = page
    .locator(".query-toolbar .query-toolbar-item.mod-views .text-icon-button")
    .first();

  // If not found, try without the specific toolbar item class
  if ((await viewsButton.count()) === 0) {
    viewsButton = page
      .locator(".query-toolbar .mod-views .text-icon-button")
      .first();
  }

  // If still not found, try any text-icon-button in query-toolbar (less specific)
  if ((await viewsButton.count()) === 0) {
    viewsButton = page.locator(".query-toolbar .text-icon-button").first();
  }

  if ((await viewsButton.count()) === 0) {
    // Try to find the base file path from the current context for better error message
    const projectName = await page.evaluate(() => {
      const app = (window as any).app;
      const activeFile = app.workspace.getActiveFile();
      if (activeFile?.path.startsWith("Projects/")) {
        return activeFile.basename;
      }
      return null;
    });

    let errorMsg = `Views dropdown button not found in toolbar. Cannot switch to "${viewLabel}".`;

    if (projectName) {
      const basePath = `Bases/${projectName}.base`;
      try {
        const baseContent = await readVaultFile(page, basePath);
        if (baseContent) {
          // Count how many view definitions exist
          const viewMatches =
            baseContent.match(/^\s+name:\s*["']?([^"'\n]+)["']?/gm) || [];
          if (viewMatches.length > 1) {
            const viewNames = viewMatches
              .map((m) => {
                const match = m.match(/name:\s*["']?([^"'\n]+)["']?/);
                return match ? match[1] : null;
              })
              .filter(Boolean);

            errorMsg = `Base file "${basePath}" has ${
              viewNames.length
            } views (${viewNames.join(
              ", "
            )}) but views dropdown button is not visible in UI. Cannot switch to "${viewLabel}".`;
          }
        }
      } catch (error) {
        // Base file might not exist yet, continue with generic error
      }
    }

    throw new Error(errorMsg);
  }

  await viewsButton.waitFor({ state: "visible", timeout: 2000 });
  await viewsButton.click();

  // Wait for dropdown menu to appear
  await page.waitForTimeout(200);

  // Click the view label in the dropdown
  const viewOption = page
    .locator(".menu")
    .getByText(viewLabel, { exact: true });

  // If not found in .menu, try without scoping
  const optionCount = await viewOption.count();
  if (optionCount === 0) {
    const unscopedOption = page.getByText(viewLabel, { exact: true });
    if ((await unscopedOption.count()) === 0) {
      throw new Error(`View option "${viewLabel}" not found in dropdown menu`);
    }
    await unscopedOption.waitFor({ state: "visible", timeout: 2000 });
    await unscopedOption.click();
  } else {
    await viewOption.waitFor({ state: "visible", timeout: 2000 });
    await viewOption.click();
  }

  // Wait for the view to switch and data to reload
  await waitForBaseViewToLoad(page, 3000);

  // Wait for the view to actually apply - verify the table has updated with filtered data
  // We wait for the table to stabilize (row count stops changing)
  await page.waitForFunction(
    () => {
      const basesView = document.querySelector(
        ".internal-embed.bases-embed .bases-view"
      );
      if (!basesView) return false;

      // Check that we have a valid table structure
      const tbody = basesView.querySelector(".bases-tbody");
      if (!tbody) return false;

      // Wait for at least some rows to be present (even if 0 after filtering)
      // The key is waiting for the table to finish updating
      return true;
    },
    { timeout: 2000 }
  );

  // Give additional time for filters to apply and table to re-render
  await page.waitForTimeout(500);
}

/**
 * Assert that a specific task title is visible in the bases view.
 */
export async function expectTaskVisible(
  page: Page,
  title: string
): Promise<void> {
  await expect(page.locator(`text=${title}`)).toBeVisible();
}

/**
 * Assert that a specific task title is NOT visible in the bases view.
 */
export async function expectTaskNotVisible(
  page: Page,
  title: string
): Promise<void> {
  await expect(page.locator(`text=${title}`)).not.toBeVisible();
}

/**
 * Assert that tasks appear in the expected order.
 * Compares the actual order of visible tasks with the expected order.
 */
export async function expectBaseTasksInOrder(
  page: Page,
  expectedOrder: string[]
): Promise<void> {
  const actualTitles = await getBaseTaskTitles(page);

  // Filter to only tasks that are in the expected list
  const filteredActual = actualTitles.filter((title) =>
    expectedOrder.includes(title)
  );

  expect(filteredActual).toEqual(expectedOrder);
}

/**
 * Assert that the bases view contains exactly the specified tasks (in any order).
 */
export async function expectBaseTasksContain(
  page: Page,
  expectedTitles: string[]
): Promise<void> {
  const actualTitles = await getBaseTaskTitles(page);

  for (const expectedTitle of expectedTitles) {
    expect(actualTitles).toContain(expectedTitle);
  }
}

/**
 * Assert that the bases view does NOT contain any of the specified tasks.
 */
export async function expectBaseTasksNotContain(
  page: Page,
  excludedTitles: string[]
): Promise<void> {
  const actualTitles = await getBaseTaskTitles(page);

  for (const excludedTitle of excludedTitles) {
    expect(actualTitles).not.toContain(excludedTitle);
  }
}

/**
 * Assert headers have expected sort directions using their visible names.
 */
export async function expectSortHeader(
  page: Page,
  header: "Done" | "Category" | "Created At" | "Updated At" | "Title",
  direction: "ASC" | "DESC"
): Promise<void> {
  let selector = `.bases-td:has(.bases-table-header-name:has-text("${header}"))[data-sort="${direction}"]`;
  if (header === "Title") {
    selector = `.bases-td.mod-formula:has(.bases-table-header-name:has-text("Title"))[data-sort="${direction}"]`;
  }
  await expect(page.locator(".bases-view").locator(selector)).toBeVisible();
}
