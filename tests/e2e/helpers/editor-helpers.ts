/**
 * E2E Test Helpers for Editor Interactions
 * Provides helpers for cursor positioning and editor manipulation
 */

import type { Page } from "playwright";
import type { ExtendedPage } from "./global";

/**
 * Set cursor position in the active editor
 * @param page Playwright page
 * @param line Line number (0-indexed)
 * @param ch Character position (0-indexed, optional, defaults to 0)
 */
export async function setCursorPosition(
  page: ExtendedPage | Page,
  line: number,
  ch: number = 0
): Promise<void> {
  await page.evaluate(
    ({ line, ch }) => {
      const app = (window as any).app;
      const activeLeaf = app.workspace.activeLeaf;

      if (!activeLeaf || !activeLeaf.view || !activeLeaf.view.editor) {
        throw new Error("No active editor found");
      }

      const editor = activeLeaf.view.editor;
      editor.setCursor({ line, ch });
    },
    { line, ch }
  );

  // Wait a bit for the cursor to be set
  await page.waitForTimeout(100);
}

/**
 * Get current cursor position in the active editor
 * @param page Playwright page
 * @returns Object with line and ch properties
 */
export async function getCursorPosition(
  page: ExtendedPage | Page
): Promise<{ line: number; ch: number }> {
  return await page.evaluate(() => {
    const app = (window as any).app;
    const activeLeaf = app.workspace.activeLeaf;

    if (!activeLeaf || !activeLeaf.view || !activeLeaf.view.editor) {
      throw new Error("No active editor found");
    }

    const editor = activeLeaf.view.editor;
    const cursor = editor.getCursor();
    return { line: cursor.line, ch: cursor.ch };
  });
}

/**
 * Get the content of a specific line in the active editor
 * @param page Playwright page
 * @param line Line number (0-indexed)
 * @returns The line content
 */
export async function getEditorLine(
  page: ExtendedPage | Page,
  line: number
): Promise<string> {
  return await page.evaluate((lineNumber) => {
    const app = (window as any).app;
    const activeLeaf = app.workspace.activeLeaf;

    if (!activeLeaf || !activeLeaf.view || !activeLeaf.view.editor) {
      throw new Error("No active editor found");
    }

    const editor = activeLeaf.view.editor;
    return editor.getLine(lineNumber);
  }, line);
}

/**
 * Get the total number of lines in the active editor
 * @param page Playwright page
 * @returns The number of lines
 */
export async function getEditorLineCount(
  page: ExtendedPage | Page
): Promise<number> {
  return await page.evaluate(() => {
    const app = (window as any).app;
    const activeLeaf = app.workspace.activeLeaf;

    if (!activeLeaf || !activeLeaf.view || !activeLeaf.view.editor) {
      throw new Error("No active editor found");
    }

    const editor = activeLeaf.view.editor;
    return editor.lineCount();
  });
}

/**
 * Find the line number containing specific text
 * @param page Playwright page
 * @param searchText Text to search for
 * @returns Line number (0-indexed) or -1 if not found
 */
export async function findLineWithText(
  page: ExtendedPage | Page,
  searchText: string
): Promise<number> {
  return await page.evaluate((text) => {
    const app = (window as any).app;
    const activeLeaf = app.workspace.activeLeaf;

    if (!activeLeaf || !activeLeaf.view || !activeLeaf.view.editor) {
      throw new Error("No active editor found");
    }

    const editor = activeLeaf.view.editor;
    const lineCount = editor.lineCount();

    for (let i = 0; i < lineCount; i++) {
      const line = editor.getLine(i);
      if (line.includes(text)) {
        return i;
      }
    }

    return -1;
  }, searchText);
}

/**
 * Set cursor to the line containing specific text
 * @param page Playwright page
 * @param searchText Text to search for
 * @param ch Character position (optional, defaults to 0)
 * @returns true if found and cursor set, false otherwise
 */
export async function setCursorToLineWithText(
  page: ExtendedPage | Page,
  searchText: string,
  ch: number = 0
): Promise<boolean> {
  const lineNumber = await findLineWithText(page, searchText);

  if (lineNumber === -1) {
    return false;
  }

  await setCursorPosition(page, lineNumber, ch);
  return true;
}
