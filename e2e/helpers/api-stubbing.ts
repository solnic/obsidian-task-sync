/**
 * API stubbing helpers for e2e tests
 * Provides fixture-based stubbing using vitest API
 */

import * as fs from "fs";
import * as path from "path";
import type { Page } from "playwright";

/**
 * Load a fixture file by service and fixture name
 */
function loadFixture(service: string, fixtureName: string): any {
  const fixturePath = path.join(
    process.cwd(),
    "e2e",
    "fixtures",
    service,
    `${fixtureName}.json`
  );

  if (!fs.existsSync(fixturePath)) {
    throw new Error(
      `Fixture file not found: ${fixturePath}. Available fixtures: ${getAvailableFixtures(
        service
      ).join(", ")}`
    );
  }

  try {
    const fixtureContent = fs.readFileSync(fixturePath, "utf-8");
    return JSON.parse(fixtureContent);
  } catch (error) {
    throw new Error(
      `Failed to parse fixture file ${fixturePath}: ${error.message}`
    );
  }
}

/**
 * Get list of available fixtures for a service
 */
function getAvailableFixtures(service: string): string[] {
  const fixturesDir = path.join(process.cwd(), "e2e", "fixtures", service);

  if (!fs.existsSync(fixturesDir)) {
    return [];
  }

  return fs
    .readdirSync(fixturesDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(".json", ""));
}

/**
 * Stub API calls using vitest and fixture data
 *
 * @param page - Playwright page instance
 * @param service - Service name (e.g., 'github')
 * @param method - Method name (e.g., 'listIssues', 'listRepositories')
 * @param fixtureName - Name of the fixture file (without .json extension)
 *
 * @example
 * await stubAPI(page, "github", "listIssues", "issues-basic");
 * await stubAPI(page, "github", "listRepositories", "repositories-multiple");
 */
export async function stubAPI(
  page: Page,
  service: string,
  method: string,
  fixtureName: string
): Promise<void> {
  const fixtureData = loadFixture(service, fixtureName);

  if (service === "github") {
    await stubGitHubAPI(page, method, fixtureData);
  } else {
    throw new Error(
      `Unsupported service: ${service}. Supported services: github`
    );
  }
}

/**
 * Stub GitHub API methods specifically
 */
async function stubGitHubAPI(
  page: Page,
  method: string,
  fixtureData: any
): Promise<void> {
  await page.evaluate(
    async ({ methodName, data }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin || !plugin.githubService) {
        throw new Error("Task Sync plugin or GitHub service not found");
      }

      // Map method names to actual GitHub service method names
      const methodMap: Record<string, string> = {
        listIssues: "fetchIssues",
        listRepositories: "fetchRepositories",
        fetchIssues: "fetchIssues",
        fetchRepositories: "fetchRepositories",
        fetchPullRequests: "fetchPullRequests",
      };

      const mappedMethod = methodMap[methodName];
      if (!mappedMethod) {
        throw new Error(
          `Unknown GitHub method: ${methodName}. Available methods: ${Object.keys(
            methodMap
          ).join(", ")}`
        );
      }

      // Store original method if not already stored
      const originalMethodKey = `_original${
        mappedMethod.charAt(0).toUpperCase() + mappedMethod.slice(1)
      }`;

      if (!plugin.githubService[originalMethodKey]) {
        plugin.githubService[originalMethodKey] =
          plugin.githubService[mappedMethod];
      }

      // Stub the method
      plugin.githubService[mappedMethod] = async (...args: any[]) => {
        console.log(`🔧 Stubbed ${methodName} called with args:`, args);
        return data;
      };
    },
    { methodName: method, data: fixtureData }
  );
}

/**
 * Restore all stubbed API methods to their original implementations
 */
export async function restoreAPI(page: Page, service: string): Promise<void> {
  if (service === "github") {
    await restoreGitHubAPI(page);
  } else {
    throw new Error(
      `Unsupported service: ${service}. Supported services: github`
    );
  }
}

/**
 * Restore GitHub API methods specifically
 */
async function restoreGitHubAPI(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];

    if (!plugin || !plugin.githubService) {
      return;
    }

    // Restore all original methods
    const methodsToRestore = ["fetchIssues", "fetchRepositories"];

    methodsToRestore.forEach((methodName) => {
      const originalMethodKey = `_original${
        methodName.charAt(0).toUpperCase() + methodName.slice(1)
      }`;

      if (plugin.githubService[originalMethodKey]) {
        plugin.githubService[methodName] =
          plugin.githubService[originalMethodKey];
        delete plugin.githubService[originalMethodKey];
      }
    });
  });
}

/**
 * Stub multiple API calls at once using a configuration object
 *
 * @example
 * await stubMultipleAPIs(page, {
 *   github: {
 *     listIssues: "issues-basic",
 *     listRepositories: "repositories-basic"
 *   }
 * });
 */
export async function stubMultipleAPIs(
  page: Page,
  config: Record<string, Record<string, string>>
): Promise<void> {
  for (const [service, methods] of Object.entries(config)) {
    for (const [method, fixtureName] of Object.entries(methods)) {
      await stubAPI(page, service, method, fixtureName);
    }
  }
}

// ============================================================================
// SIMPLIFIED STUBBING WITH RELOAD PERSISTENCE
// ============================================================================

/**
 * Simple GitHub API stubbing that persists across plugin reloads
 * Uses global window storage to maintain stubs
 */
export async function stubGitHubAPIs(
  page: Page,
  fixtures: {
    issues?: string;
    repositories?: string;
    pullRequests?: string;
  }
): Promise<void> {
  // Load fixture data
  const fixtureData: any = {};

  if (fixtures.issues) {
    fixtureData.issues = loadFixture("github", fixtures.issues);
  }
  if (fixtures.repositories) {
    fixtureData.repositories = loadFixture("github", fixtures.repositories);
  }
  if (fixtures.pullRequests) {
    fixtureData.pullRequests = loadFixture("github", fixtures.pullRequests);
  }

  // Store fixture data globally so it persists across plugin reloads
  await page.evaluate((data) => {
    (window as any).__githubApiStubs = data;

    // Create a global stub installer that can be called after plugin reloads
    (window as any).__installGitHubStubs = () => {
      const app = (window as any).app;
      const plugin = app?.plugins?.plugins?.["obsidian-task-sync"];

      if (!plugin?.githubService) {
        return false;
      }

      // Only stub if not already stubbed
      if (plugin.githubService.__isStubbed) {
        return true;
      }

      // Store originals
      plugin.githubService.__originals = {
        fetchIssues: plugin.githubService.fetchIssues,
        fetchRepositories: plugin.githubService.fetchRepositories,
        fetchPullRequests: plugin.githubService.fetchPullRequests,
      };

      // Install stubs
      plugin.githubService.fetchIssues = async () => {
        console.log("🔧 Stubbed fetchIssues called");
        return (window as any).__githubApiStubs?.issues || [];
      };

      plugin.githubService.fetchRepositories = async () => {
        console.log("🔧 Stubbed fetchRepositories called");
        return (window as any).__githubApiStubs?.repositories || [];
      };

      plugin.githubService.fetchPullRequests = async () => {
        console.log("🔧 Stubbed fetchPullRequests called");
        return (window as any).__githubApiStubs?.pullRequests || [];
      };

      plugin.githubService.__isStubbed = true;
      return true;
    };

    // Install stubs immediately if plugin is available
    (window as any).__installGitHubStubs();
  }, fixtureData);
}

/**
 * Restore GitHub APIs to original implementations
 */
export async function restoreGitHubAPIs(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = (window as any).app;
    const plugin = app?.plugins?.plugins?.["obsidian-task-sync"];

    if (plugin?.githubService?.__originals) {
      plugin.githubService.fetchIssues =
        plugin.githubService.__originals.fetchIssues;
      plugin.githubService.fetchRepositories =
        plugin.githubService.__originals.fetchRepositories;
      plugin.githubService.fetchPullRequests =
        plugin.githubService.__originals.fetchPullRequests;

      delete plugin.githubService.__originals;
      delete plugin.githubService.__isStubbed;
    }

    // Clean up global stubs
    delete (window as any).__githubApiStubs;
    delete (window as any).__installGitHubStubs;
  });
}

/**
 * Ensure stubs are installed (useful after plugin reloads)
 */
export async function ensureGitHubStubsInstalled(page: Page): Promise<void> {
  await page.evaluate(() => {
    if ((window as any).__installGitHubStubs) {
      (window as any).__installGitHubStubs();
    }
  });
}

/**
 * List all available fixtures for debugging
 */
export function listAvailableFixtures(): Record<string, string[]> {
  const fixturesDir = path.join(process.cwd(), "e2e", "fixtures");
  const result: Record<string, string[]> = {};

  if (!fs.existsSync(fixturesDir)) {
    return result;
  }

  const services = fs
    .readdirSync(fixturesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  services.forEach((service) => {
    result[service] = getAvailableFixtures(service);
  });

  return result;
}
