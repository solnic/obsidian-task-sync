/**
 * E2E Test Helpers for Editor Operations
 * Provides utilities for working with the Obsidian editor in tests
 */

import type { Page } from "playwright";

/**
 * Get line number matching text
 * Raises error if more than one line is found or no line is found
 * @param page - Playwright page instance
 * @param text - Text to search for in the editor
 * @returns Line number (0-indexed)
 */
export async function getLine(page: Page, text: string): Promise<number> {
  return await page.evaluate(
    ({ searchText }) => {
      const app = (window as any).app;
      const activeView = app.workspace.activeLeaf?.view;

      if (!activeView || activeView.getViewType() !== "markdown") {
        throw new Error("No active MarkdownView found");
      }

      const editor = activeView.editor;
      const lineCount = editor.lineCount();
      const matchingLines: number[] = [];

      for (let i = 0; i < lineCount; i++) {
        const lineText = editor.getLine(i);
        if (lineText.includes(searchText)) {
          matchingLines.push(i);
        }
      }

      if (matchingLines.length === 0) {
        throw new Error(`No line found containing text: "${searchText}"`);
      }

      if (matchingLines.length > 1) {
        throw new Error(
          `Multiple lines found containing text: "${searchText}" (found ${
            matchingLines.length
          } matches at lines: ${matchingLines.join(", ")})`
        );
      }

      return matchingLines[0];
    },
    { searchText: text }
  );
}

/**
 * Move cursor to a line matching the given text
 * Raises error if more than one line is found or no line is found
 * @param page - Playwright page instance
 * @param text - Text to search for in the editor
 */
export async function goToLine(page: Page, text: string): Promise<void> {
  await page.evaluate(
    ({ searchText }) => {
      const app = (window as any).app;
      const activeView = app.workspace.activeLeaf?.view;

      if (!activeView || activeView.getViewType() !== "markdown") {
        throw new Error("No active MarkdownView found");
      }

      const editor = activeView.editor;
      const lineCount = editor.lineCount();
      const matchingLines: number[] = [];

      for (let i = 0; i < lineCount; i++) {
        const lineText = editor.getLine(i);
        if (lineText.includes(searchText)) {
          matchingLines.push(i);
        }
      }

      if (matchingLines.length === 0) {
        throw new Error(`No line found containing text: "${searchText}"`);
      }

      if (matchingLines.length > 1) {
        throw new Error(
          `Multiple lines found containing text: "${searchText}" (found ${
            matchingLines.length
          } matches at lines: ${matchingLines.join(", ")})`
        );
      }

      const lineNumber = matchingLines[0];
      // Set cursor to the beginning of the line
      editor.setCursor({ line: lineNumber, ch: 0 });
    },
    { searchText: text }
  );
}
