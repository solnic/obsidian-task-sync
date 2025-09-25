/**
 * TypeScript declarations for extending Playwright Page interface
 * with test context properties for easier access in test functions
 */

import type { Page, ElectronApplication } from "@playwright/test";

declare module "@playwright/test" {
  interface Page {
    /**
     * Extended properties from SharedTestContext for direct access
     * These properties are added during test setup and provide
     * access to test environment information
     */
    
    /** Electron application instance for this test */
    electronApp: ElectronApplication;
    
    /** Unique test identifier for isolation */
    testId: string;
    
    /** Path to the isolated test vault */
    vaultPath: string;
    
    /** Path to the isolated Obsidian data directory */
    dataPath: string;
    
    /** Worker identifier for parallel test execution */
    workerId: string;
    
    /** Test execution logs for debugging */
    logs: Array<{ type: string; text: string; timestamp: Date }>;
  }
}
