import { afterEach, afterAll } from 'vitest';
import { captureScreenshotOnFailure, captureFullDebugInfo, getSharedTestContext } from './shared-context';

/**
 * Global test failure handler that captures screenshots when tests fail
 * This should be imported in test files that need screenshot capture on failure
 */

let isFailureHandlerSetup = false;

export function setupTestFailureHandler() {
  if (isFailureHandlerSetup) {
    return;
  }

  isFailureHandlerSetup = true;

  // Handle test failures in afterEach
  afterEach(async (testContext) => {
    await handleTestFailure(testContext, 'test');
  });

  // Handle setup/teardown failures
  afterAll(async (testContext) => {
    await handleTestFailure(testContext, 'suite');
  });
}

async function handleTestFailure(testContext: any, type: string) {
  // Check if the test failed
  const testResult = testContext?.meta?.result;
  if (testResult?.state === 'fail' || testResult?.errors?.length > 0) {
    try {
      const context = await getSharedTestContext();
      const testName = testContext?.meta?.name?.replace(/[^a-zA-Z0-9]/g, '-') || 'unknown-test';

      // Capture full debug info for failed tests (includes screenshot + more)
      console.log(`🔍 ${type} failed: ${testName}, capturing debug information...`);
      await captureFullDebugInfo(context, `${type}-failure-${testName}`);
    } catch (error) {
      console.warn(`⚠️ Failed to capture debug info on ${type} failure: ${error.message}`);

      // Fallback to just screenshot
      try {
        const context = await getSharedTestContext();
        const testName = testContext?.meta?.name?.replace(/[^a-zA-Z0-9]/g, '-') || 'unknown-test';
        await captureScreenshotOnFailure(context, `${type}-failure-${testName}-fallback`);
      } catch (fallbackError) {
        console.warn(`⚠️ Fallback screenshot also failed: ${fallbackError.message}`);
      }
    }
  }
}

/**
 * Manually capture a screenshot with a custom name
 */
export async function captureDebugScreenshot(name: string) {
  try {
    const context = await getSharedTestContext();
    await captureScreenshotOnFailure(context, `debug-${name}`);
  } catch (error) {
    console.warn(`⚠️ Failed to capture debug screenshot: ${error.message}`);
  }
}

/**
 * Capture a screenshot before performing a potentially failing action
 * Useful for debugging complex interactions
 */
export async function captureBeforeAction(actionName: string) {
  try {
    const context = await getSharedTestContext();
    await captureScreenshotOnFailure(context, `before-${actionName}`);
  } catch (error) {
    console.warn(`⚠️ Failed to capture before-action screenshot: ${error.message}`);
  }
}

/**
 * Capture a screenshot after performing an action
 * Useful for verifying the result of an action
 */
export async function captureAfterAction(actionName: string) {
  try {
    const context = await getSharedTestContext();
    await captureScreenshotOnFailure(context, `after-${actionName}`);
  } catch (error) {
    console.warn(`⚠️ Failed to capture after-action screenshot: ${error.message}`);
  }
}

/**
 * Capture full debug information for a specific action or state
 * Includes screenshot, console logs, and app state
 */
export async function captureFullDebugForAction(actionName: string) {
  try {
    const context = await getSharedTestContext();
    await captureFullDebugInfo(context, `action-${actionName}`);
  } catch (error) {
    console.warn(`⚠️ Failed to capture full debug info for action: ${error.message}`);
  }
}

/**
 * Wrapper function to automatically capture debug info if an action fails
 */
export async function withDebugCapture<T>(
  actionName: string,
  action: () => Promise<T>
): Promise<T> {
  try {
    await captureBeforeAction(actionName);
    const result = await action();
    await captureAfterAction(actionName);
    return result;
  } catch (error) {
    console.warn(`❌ Action "${actionName}" failed, capturing debug info...`);
    await captureFullDebugForAction(`failed-${actionName}`);
    throw error;
  }
}
