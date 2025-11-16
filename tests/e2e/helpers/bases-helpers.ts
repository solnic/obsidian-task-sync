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

  // Verify bases were actually created by checking for at least one .base file
  const startTime = Date.now();
  const timeout = 5000;
  const pollInterval = 100;

  while (Date.now() - startTime < timeout) {
    const hasBaseFiles = await page.evaluate(async () => {
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
    });

    if (hasBaseFiles) {
      return;
    }

    // Wait before next check
    await page.evaluate(async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }, pollInterval);
  }

  throw new Error("Timeout waiting for base files to be created");
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
  const fileCheckStart = Date.now();
  while (Date.now() - fileCheckStart < timeoutMs) {
    const fileExists = await page.evaluate(
      async ({ path }) => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(path);
        return file !== null;
      },
      { path: filePath }
    );

    if (fileExists) {
      break;
    }

    await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }

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
  // Keep the original manual polling since it needs to re-open the file on each check
  const stabilityWindowMs = 800;
  const stabilityStart = Date.now();
  while (Date.now() - stabilityStart < stabilityWindowMs) {
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
    // Brief polling delay
    await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }

  // Wait for editor to be visible
  await page.waitForSelector(".markdown-source-view, .markdown-preview-view", {
    state: "visible",
    timeout: timeoutMs,
  });

  // Wait for embedded Bases UI to appear - use manual polling since we need to re-open file
  const embedDeadline = Date.now() + timeoutMs;
  let embedVisible = false;
  while (Date.now() < embedDeadline) {
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

    // Brief polling delay
    await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
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
    // Retry after forcing regeneration
    await regenerateBases(page);

    // Wait for regeneration to complete
    await page
      .waitForFunction(
        () => {
          const toolbar = document.querySelector(".bases-view .query-toolbar");
          return toolbar !== null;
        },
        {},
        { timeout: 1000, polling: 100 }
      )
      .catch(() => {});

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

  // Wait for leaves to be detached
  await page.waitForFunction(
    () => {
      const app = (window as any).app;
      const leaves = app.workspace.getLeavesOfType("markdown");
      return leaves.length === 0;
    },
    {},
    { timeout: 1000, polling: 50 }
  ).catch(() => {});

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

  // Wait for Bases plugin to load the embed content
  await page.waitForFunction(
    () => {
      const embed = document.querySelector(".internal-embed.bases-embed");
      if (!embed) return false;
      const basesView = embed.querySelector(".bases-view");
      return basesView !== null;
    },
    {},
    { timeout: 2000, polling: 100 }
  );

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

  // Wait for headings to expand
  await page.waitForFunction(
    () => {
      const collapsedHeadings = document.querySelectorAll(
        ".markdown-preview-view .heading-collapse-indicator.collapse-icon"
      );
      for (const indicator of collapsedHeadings) {
        const parent = indicator.closest(".el-h2, .el-h3, .el-h4, .el-h5, .el-h6");
        if (parent && parent.classList.contains("is-collapsed")) {
          return false;
        }
      }
      return true;
    },
    {},
    { timeout: 2000, polling: 100 }
  ).catch(() => {});

  await waitForBaseView(page as any, timeoutMs);
}

/**
 * Wait for the bases view to load and have data rendered.
 * This waits for the table structure and at least one task row to appear.
 * In Obsidian 1.10.3+, also waits for the toolbar to be visible.
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

  // Wait for toolbar to be visible (critical in Obsidian 1.10.3+)
  // In Obsidian 1.10.3, the class changed from .query-toolbar to .bases-toolbar
  await page.waitForSelector(".internal-embed.bases-embed .bases-toolbar", {
    state: "attached",
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

  // CRITICAL: Wait for the toolbar to be visible in embedded bases
  // In Obsidian 1.10.3+, embedded bases render asynchronously and the toolbar
  // may not be immediately available even after the table is present
  // In Obsidian 1.10.3, the class changed from .query-toolbar to .bases-toolbar
  await page.waitForSelector(".internal-embed.bases-embed .bases-toolbar", {
    state: "visible",
    timeout: 5000,
  });

  // Wait for the toolbar to fully initialize by checking for interactive elements
  await page.waitForFunction(
    () => {
      const toolbar = document.querySelector(
        ".internal-embed.bases-embed .bases-toolbar"
      );
      if (!toolbar) return false;
      // Check if toolbar has clickable elements
      const buttons = toolbar.querySelectorAll("button, .text-icon-button");
      return buttons.length > 0;
    },
    {},
    { timeout: 1000, polling: 100 }
  );

  // Find the views dropdown button in the toolbar
  // Scope to the embedded bases view to avoid conflicts with other UI elements
  // In Obsidian 1.10.3, the views menu is now .bases-toolbar-views-menu
  const embedScope = page.locator(".internal-embed.bases-embed");

  // Try to find the views button using the new class structure (1.10.3+)
  let viewsButton = embedScope
    .locator(".bases-toolbar .bases-toolbar-views-menu .text-icon-button")
    .first();

  // Fallback to less specific selector
  if ((await viewsButton.count()) === 0) {
    viewsButton = embedScope
      .locator(".bases-toolbar .bases-toolbar-views-menu")
      .first();
  }

  // Another fallback for any button in the views menu area
  if ((await viewsButton.count()) === 0) {
    viewsButton = embedScope.locator(".bases-toolbar-views-menu").first();
  }

  if ((await viewsButton.count()) === 0) {
    // Try to find the base file path from the current context for better error message
    const projectName = await page.evaluate(() => {
      const app = (window as any).app;
      const activeFile = app.workspace.getActiveFile();
      if (activeFile?.path.startsWith("Projects/")) {
        return activeFile.basename;
      }
      if (activeFile?.path.startsWith("Areas/")) {
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
  await page.waitForFunction(
    () => {
      const menu = document.querySelector(".menu");
      return menu && (menu as HTMLElement).offsetParent !== null;
    },
    {},
    { timeout: 1000, polling: 50 }
  );

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
  await waitForBaseViewToLoad(page, 5000);

  // Wait for the view to switch and filters to apply
  // Check that we have a valid table structure and no loading indicators
  await page.waitForFunction(
    () => {
      const basesView = document.querySelector(
        ".internal-embed.bases-embed .bases-view"
      );
      if (!basesView) return false;

      // Check that we have a valid table structure
      const tbody = basesView.querySelector(".bases-tbody");
      if (!tbody) return false;

      // Check if no loading indicators are present
      const loadingIndicators = basesView.querySelectorAll(
        ".is-loading, .loading"
      );
      return loadingIndicators.length === 0;
    },
    {},
    { timeout: 3000, polling: 100 }
  );

  // Additional wait to ensure the DOM has fully updated after view switch
  // The bases view rerenders asynchronously, so we need to wait for the table to stabilize
  await page.evaluate(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
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
 * Click the "New" button in the Base UI toolbar to create a new note
 * This simulates the actual user interaction with the Base UI
 */
export async function clickBaseNewButton(page: Page): Promise<void> {
  // Wait for the Base UI toolbar to be visible
  await page.waitForSelector('.bases-toolbar', { state: 'visible', timeout: 5000 });
  
  // Find and click the "New" button
  // The button has classes: bases-toolbar-item bases-toolbar-new-item-menu
  const newButton = page.locator('.bases-toolbar .bases-toolbar-new-item-menu .text-icon-button');
  
  // Wait for button to be visible and clickable
  await expect(newButton).toBeVisible({ timeout: 5000 });
  
  // Click the button
  await newButton.click();
  
  // Wait a bit for the new note creation to process
  await page.waitForTimeout(500);
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
