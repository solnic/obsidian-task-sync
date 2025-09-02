import type { Page } from 'playwright';

/**
 * Wait for async operations to complete
 */
export async function waitForAsyncOperation(timeout: number = 1000): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, timeout));
}

/**
 * Reset Obsidian UI state by closing modals and dialogs
 * Improved for headless mode stability
 */
export async function resetObsidianUI(page: Page): Promise<void> {
  // Multiple escape presses with longer waits for headless mode
  await page.keyboard.press('Escape');
  await waitForAsyncOperation(300);
  await page.keyboard.press('Escape');
  await waitForAsyncOperation(500);

  await page.evaluate(() => {
    const modals = document.querySelectorAll('.modal-container, .modal-backdrop, .suggester-container, .prompt, .modal');

    modals.forEach((modal) => {
      const closeButton = modal.querySelector('.modal-close-button, .modal-close, .close, [aria-label="Close"]');
      if (closeButton) {
        (closeButton as HTMLElement).click();
      } else {
        modal.remove();
      }
    });
  });

  await waitForAsyncOperation(800); // Increased wait time for headless mode
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await waitForAsyncOperation(500); // Increased wait time

  await page.evaluate(() => {
    const modals = document.querySelectorAll('.modal-container, .modal-backdrop, .suggester-container, .prompt');
    modals.forEach(modal => modal.remove());

    if (document.activeElement && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur();
    }

    if (window.getSelection) {
      window.getSelection()?.removeAllRanges();
    }
  });

  await waitForAsyncOperation(500); // Increased final wait time for headless mode
}

/**
 * Wait for a success notice to appear
 */
export async function waitForSuccessNotice(page: Page, timeout: number = 5000): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => {
        const notices = document.querySelectorAll('.notice');
        const noticeTexts = Array.from(notices).map(n => n.textContent?.toLowerCase() || '');
        return noticeTexts.some(text =>
          text.includes('sync') ||
          text.includes('success') ||
          text.includes('updated') ||
          text.includes('published') ||
          text.includes('saved')
        );
      },
      {},
      { timeout }
    );
    return true;
  } catch (error) {
    console.log(`No success notice appeared within ${timeout}ms`);
    return false;
  }
}

/**
 * Wait for any modal to appear
 */
export async function waitForModal(page: Page, timeout: number = 5000): Promise<{ found: boolean; type: string }> {
  try {
    await page.waitForSelector('.modal-container, .suggester-container, .modal-backdrop', { timeout });

    const modalType = await page.evaluate(() => {
      if (document.querySelector('.modal-container')) return 'modal-container';
      if (document.querySelector('.suggester-container')) return 'suggester';
      if (document.querySelector('.modal-backdrop')) return 'custom-modal';
      return 'unknown';
    });

    return { found: true, type: modalType };
  } catch (error) {
    return { found: false, type: 'none' };
  }
}

/**
 * Get modal content for interaction
 */
export async function getModalContent(page: Page): Promise<any> {
  return await page.evaluate(() => {
    const modalContainer = document.querySelector('.modal-container');
    if (modalContainer) {
      return { type: 'modal-container', element: modalContainer };
    }

    const suggester = document.querySelector('.suggester-container');
    if (suggester) {
      return { type: 'suggester', element: suggester };
    }

    const modalBackdrop = document.querySelector('.modal-backdrop');
    if (modalBackdrop) {
      return { type: 'custom-modal', element: modalBackdrop };
    }

    return null;
  });
}

/**
 * Verify that the Task Sync plugin is properly loaded and available
 */
export async function verifyPluginAvailable(page: Page): Promise<void> {
  const pluginCheck = await page.evaluate(() => {
    const plugin = (window as any).app.plugins.plugins['obsidian-task-sync'];
    const isEnabled = (window as any).app.plugins.isEnabled('obsidian-task-sync');
    return {
      pluginExists: !!plugin,
      isEnabled: isEnabled,
      hasSettings: !!plugin?.settings
    };
  });

  if (!pluginCheck.pluginExists) {
    console.log('⚠️ Task Sync plugin is not loaded');
    return;
  }

  console.log(`✅ Plugin verification passed: enabled=${pluginCheck.isEnabled}, hasSettings=${pluginCheck.hasSettings}`);
}

/**
 * Get plugin instance (assumes plugin availability has been verified)
 * This is a simplified version that doesn't include defensive checks
 */
export async function getPlugin(page: Page): Promise<any> {
  return await page.evaluate(() => {
    return (window as any).app.plugins.plugins['obsidian-task-sync'];
  });
}

/**
 * Get file from vault (assumes plugin availability has been verified)
 * This is a simplified version that doesn't include defensive checks
 */
export async function getFile(page: Page, filePath: string): Promise<any> {
  return await page.evaluate(({ path }) => {
    return (window as any).app.vault.getAbstractFileByPath(path);
  }, { path: filePath });
}
