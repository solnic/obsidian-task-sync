/**
 * API stubbing helpers for e2e tests
 * Provides fixture-based stubbing using vitest API
 */

import { vi } from "vitest";
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
