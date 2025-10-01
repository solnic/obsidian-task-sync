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
    "tests",
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
      `Failed to parse fixture file ${fixturePath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Get list of available fixtures for a service
 */
function getAvailableFixtures(service: string): string[] {
  const fixturesDir = path.join(
    process.cwd(),
    "tests",
    "e2e",
    "fixtures",
    service
  );

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
  } else if (service === "apple-calendar") {
    await stubAppleCalendarAPI(page, method, fixtureData);
  } else if (service === "apple-reminders") {
    await stubAppleRemindersAPI(page, method, fixtureData);
  } else {
    throw new Error(
      `Unsupported service: ${service}. Supported services: github, apple-calendar, apple-reminders`
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

      if (!plugin) {
        throw new Error("Task Sync plugin not found");
      }

      // Get GitHub service through IntegrationManager
      const githubService = plugin.integrationManager?.getGitHubService();
      if (!githubService) {
        throw new Error(
          "GitHub service not found - ensure GitHub integration is enabled"
        );
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

      if (!githubService[originalMethodKey]) {
        githubService[originalMethodKey] = githubService[mappedMethod];
      }

      // Stub the method
      githubService[mappedMethod] = async (...args: any[]) => {
        console.log(`🔧 Stubbed ${methodName} called with args:`, args);
        return data;
      };
    },
    { methodName: method, data: fixtureData }
  );
}

/**
 * Stub Apple Calendar API methods specifically
 */
async function stubAppleCalendarAPI(
  page: Page,
  method: string,
  fixtureData: any
): Promise<void> {
  await page.evaluate(
    async ({ methodName, data }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin) {
        throw new Error("Task Sync plugin not found");
      }

      const appleCalendarService = plugin.appleCalendarService;
      if (!appleCalendarService) {
        throw new Error("Apple Calendar service not found");
      }

      // Map method names to actual service methods
      const methodMap: Record<string, string> = {
        getCalendars: "getCalendars",
        getEvents: "getEvents",
        getTodayEvents: "getTodayEvents",
        checkPermissions: "checkPermissions",
        requestPermissions: "requestPermissions",
        createEvent: "createEvent",
      };

      const mappedMethod = methodMap[methodName];
      if (!mappedMethod) {
        throw new Error(
          `Unknown Apple Calendar method: ${methodName}. Available methods: ${Object.keys(
            methodMap
          ).join(", ")}`
        );
      }

      // Store original method if not already stored
      const originalMethodKey = `_original${
        mappedMethod.charAt(0).toUpperCase() + mappedMethod.slice(1)
      }`;

      if (!appleCalendarService[originalMethodKey]) {
        appleCalendarService[originalMethodKey] =
          appleCalendarService[mappedMethod];
      }

      // Stub the method
      appleCalendarService[mappedMethod] = async (...args: any[]) => {
        console.log(
          `🔧 Stubbed Apple Calendar ${methodName} called with args:`,
          args
        );
        return data;
      };
    },
    { methodName: method, data: fixtureData }
  );
}

/**
 * Stub Apple Reminders API methods specifically
 */
async function stubAppleRemindersAPI(
  page: Page,
  method: string,
  fixtureData: any
): Promise<void> {
  await page.evaluate(
    async ({ methodName, data }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin) {
        throw new Error("Task Sync plugin not found");
      }

      const appleRemindersService = plugin.appleRemindersService;
      if (!appleRemindersService) {
        throw new Error("Apple Reminders service not found");
      }

      // Map method names to actual service methods
      const methodMap: Record<string, string> = {
        fetchReminders: "fetchReminders",
        fetchLists: "fetchLists",
        checkPermissions: "checkPermissions",
        clearCache: "clearCache",
      };

      const mappedMethod = methodMap[methodName];
      if (!mappedMethod) {
        throw new Error(
          `Unknown Apple Reminders method: ${methodName}. Available methods: ${Object.keys(
            methodMap
          ).join(", ")}`
        );
      }

      // Store original method if not already stored
      const originalMethodKey = `_original${
        mappedMethod.charAt(0).toUpperCase() + mappedMethod.slice(1)
      }`;

      if (!appleRemindersService[originalMethodKey]) {
        appleRemindersService[originalMethodKey] =
          appleRemindersService[mappedMethod];
      }

      // Stub the method
      appleRemindersService[mappedMethod] = async (...args: any[]) => {
        console.log(
          `🔧 Stubbed Apple Reminders ${methodName} called with args:`,
          args
        );
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
  } else if (service === "apple-calendar") {
    await restoreAppleCalendarAPI(page);
  } else if (service === "apple-reminders") {
    await restoreAppleRemindersAPI(page);
  } else {
    throw new Error(
      `Unsupported service: ${service}. Supported services: github, apple-calendar, apple-reminders`
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

    if (!plugin) {
      return;
    }

    // Get GitHub service through IntegrationManager
    const githubService = plugin.integrationManager?.getGitHubService();
    if (!githubService) {
      return;
    }

    // Restore all original methods
    const methodsToRestore = ["fetchIssues", "fetchRepositories"];

    methodsToRestore.forEach((methodName) => {
      const originalMethodKey = `_original${
        methodName.charAt(0).toUpperCase() + methodName.slice(1)
      }`;

      if (githubService[originalMethodKey]) {
        githubService[methodName] = githubService[originalMethodKey];
        delete githubService[originalMethodKey];
      }
    });
  });
}

/**
 * Restore Apple Calendar API methods specifically
 */
async function restoreAppleCalendarAPI(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];

    if (!plugin) {
      return;
    }

    const appleCalendarService = plugin.appleCalendarService;
    if (!appleCalendarService) {
      return;
    }

    // Restore all original methods
    const methodNames = [
      "getCalendars",
      "getEvents",
      "getTodayEvents",
      "checkPermissions",
      "requestPermissions",
      "createEvent",
    ];

    for (const methodName of methodNames) {
      const originalMethodKey = `_original${
        methodName.charAt(0).toUpperCase() + methodName.slice(1)
      }`;

      if (appleCalendarService[originalMethodKey]) {
        appleCalendarService[methodName] =
          appleCalendarService[originalMethodKey];
        delete appleCalendarService[originalMethodKey];
      }
    }
  });
}

/**
 * Restore Apple Reminders API methods specifically
 */
async function restoreAppleRemindersAPI(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];

    if (!plugin) {
      return;
    }

    const appleRemindersService = plugin.appleRemindersService;
    if (!appleRemindersService) {
      return;
    }

    // Restore all original methods
    const methodNames = [
      "fetchReminders",
      "fetchLists",
      "checkPermissions",
      "clearCache",
    ];

    for (const methodName of methodNames) {
      const originalMethodKey = `_original${
        methodName.charAt(0).toUpperCase() + methodName.slice(1)
      }`;

      if (appleRemindersService[originalMethodKey]) {
        appleRemindersService[methodName] =
          appleRemindersService[originalMethodKey];
        delete appleRemindersService[originalMethodKey];
      }
    }
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
    organizations?: string;
    currentUser?: string;
    labels?: string;
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
  if (fixtures.organizations) {
    fixtureData.organizations = loadFixture("github", fixtures.organizations);
  }
  if (fixtures.currentUser) {
    fixtureData.currentUser = loadFixture("github", fixtures.currentUser);
  }
  if (fixtures.labels) {
    fixtureData.labels = loadFixture("github", fixtures.labels);
  }

  // Store fixture data globally so it persists across plugin reloads
  await page.evaluate((data) => {
    (window as any).__githubApiStubs = data;

    // Create a global stub installer that can be called after plugin reloads
    (window as any).__installGitHubStubs = () => {
      const app = (window as any).app;
      const plugin = app?.plugins?.plugins?.["obsidian-task-sync"];

      // Get GitHub extension through the new architecture
      const taskSyncApp = plugin?.host?.getApp();
      const githubExtension = taskSyncApp?.githubExtension;

      if (!githubExtension) {
        console.warn("GitHub extension not found for stubbing");
        return false;
      }

      // Only stub if not already stubbed
      if (githubExtension.__isStubbed) {
        return true;
      }

      // Store originals
      githubExtension.__originals = {
        fetchIssues: githubExtension.fetchIssues,
        fetchRepositories: githubExtension.fetchRepositories,
        fetchPullRequests: githubExtension.fetchPullRequests,
        fetchOrganizations: githubExtension.fetchOrganizations,
        fetchRepositoriesForOrganization:
          githubExtension.fetchRepositoriesForOrganization,
        getCurrentUser: githubExtension.getCurrentUser,
        fetchLabels: githubExtension.fetchLabels,
      };

      // Install stubs
      githubExtension.fetchIssues = async (repository?: string) => {
        console.log(
          "🔧 Stubbed fetchIssues called for repository:",
          repository
        );
        const allItems = (window as any).__githubApiStubs?.issues || [];
        // Filter out pull requests - same logic as real implementation
        // Pull requests have a "pull_request" field that distinguishes them from actual issues
        return allItems.filter((item: any) => !item.pull_request);
      };

      githubExtension.fetchRepositories = async () => {
        console.log("🔧 Stubbed fetchRepositories called");
        return (window as any).__githubApiStubs?.repositories || [];
      };

      githubExtension.fetchPullRequests = async () => {
        console.log("🔧 Stubbed fetchPullRequests called");
        return (window as any).__githubApiStubs?.pullRequests || [];
      };

      githubExtension.fetchOrganizations = async () => {
        console.log("🔧 Stubbed fetchOrganizations called");
        return (window as any).__githubApiStubs?.organizations || [];
      };

      githubExtension.fetchRepositoriesForOrganization = async (
        org: string
      ) => {
        console.log(
          `🔧 Stubbed fetchRepositoriesForOrganization called for: ${org}`
        );
        const allRepos = (window as any).__githubApiStubs?.repositories || [];
        return allRepos.filter((repo: any) =>
          repo.full_name.startsWith(org + "/")
        );
      };

      githubExtension.getCurrentUser = async () => {
        console.log("🔧 Stubbed getCurrentUser called");
        return (window as any).__githubApiStubs?.currentUser || null;
      };

      githubExtension.fetchLabels = async (repository: string) => {
        console.log(`🔧 Stubbed fetchLabels called for: ${repository}`);
        return (window as any).__githubApiStubs?.labels || [];
      };

      githubExtension.__isStubbed = true;
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

    // Get GitHub extension through the new architecture
    const taskSyncApp = plugin?.host?.getApp();
    const githubExtension = taskSyncApp?.githubExtension;

    if (githubExtension?.__originals) {
      githubExtension.fetchIssues = githubExtension.__originals.fetchIssues;
      githubExtension.fetchRepositories =
        githubExtension.__originals.fetchRepositories;
      githubExtension.fetchPullRequests =
        githubExtension.__originals.fetchPullRequests;
      githubExtension.fetchOrganizations =
        githubExtension.__originals.fetchOrganizations;
      githubExtension.fetchRepositoriesForOrganization =
        githubExtension.__originals.fetchRepositoriesForOrganization;
      githubExtension.getCurrentUser =
        githubExtension.__originals.getCurrentUser;
      githubExtension.fetchLabels = githubExtension.__originals.fetchLabels;

      delete githubExtension.__originals;
      delete githubExtension.__isStubbed;
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
 * Simple Apple Calendar API stubbing that persists across plugin reloads
 * Uses global window storage to maintain stubs
 */
export async function stubAppleCalendarAPIs(
  page: Page,
  fixtures: {
    calendars?: string;
    events?: string;
    todayEvents?: string;
    permissions?: string;
  }
): Promise<void> {
  // Load fixture data
  const fixtureData: any = {};

  if (fixtures.calendars) {
    fixtureData.calendars = loadFixture("apple-calendar", fixtures.calendars);
  }
  if (fixtures.events) {
    fixtureData.events = loadFixture("apple-calendar", fixtures.events);
  }
  if (fixtures.todayEvents) {
    fixtureData.todayEvents = loadFixture(
      "apple-calendar",
      fixtures.todayEvents
    );
  }
  if (fixtures.permissions) {
    fixtureData.permissions = loadFixture(
      "apple-calendar",
      fixtures.permissions
    );
  }

  await page.evaluate((fixtureData) => {
    // Store fixture data globally
    (window as any).__appleCalendarApiStubs = fixtureData;

    // Create a global stub installer that can be called after plugin reloads
    (window as any).__installAppleCalendarStubs = () => {
      const app = (window as any).app;
      const plugin = app?.plugins?.plugins?.["obsidian-task-sync"];

      const appleCalendarService = plugin?.appleCalendarService;
      if (!appleCalendarService) {
        return false;
      }

      // Only stub if not already stubbed
      if (appleCalendarService.__isStubbed) {
        return true;
      }

      // Store originals
      appleCalendarService.__originals = {
        getCalendars: appleCalendarService.getCalendars,
        getEvents: appleCalendarService.getEvents,
        getTodayEvents: appleCalendarService.getTodayEvents,
        checkPermissions: appleCalendarService.checkPermissions,
      };

      // Install stubs
      appleCalendarService.getCalendars = async () => {
        console.log("🔧 Stubbed Apple Calendar getCalendars called");
        return (window as any).__appleCalendarApiStubs?.calendars || [];
      };

      appleCalendarService.getEvents = async () => {
        console.log("🔧 Stubbed Apple Calendar getEvents called");
        return (window as any).__appleCalendarApiStubs?.events || [];
      };

      appleCalendarService.getTodayEvents = async () => {
        console.log("🔧 Stubbed Apple Calendar getTodayEvents called");
        return (window as any).__appleCalendarApiStubs?.todayEvents || [];
      };

      appleCalendarService.checkPermissions = async () => {
        console.log("🔧 Stubbed Apple Calendar checkPermissions called");
        return (window as any).__appleCalendarApiStubs?.permissions !==
          undefined
          ? (window as any).__appleCalendarApiStubs?.permissions
          : true;
      };

      appleCalendarService.__isStubbed = true;
      return true;
    };

    // Install stubs immediately if plugin is available
    (window as any).__installAppleCalendarStubs();
  }, fixtureData);
}

/**
 * Simple Apple Reminders API stubbing that persists across plugin reloads
 * Uses global window storage to maintain stubs
 */
export async function stubAppleRemindersAPIs(
  page: Page,
  fixtures: {
    reminders?: string;
    lists?: string;
    permissions?: string;
  }
): Promise<void> {
  // Load fixture data
  const fixtureData: any = {};

  if (fixtures.reminders) {
    fixtureData.reminders = loadFixture("apple-reminders", fixtures.reminders);
  }
  if (fixtures.lists) {
    fixtureData.lists = loadFixture("apple-reminders", fixtures.lists);
  }
  if (fixtures.permissions) {
    fixtureData.permissions = loadFixture(
      "apple-reminders",
      fixtures.permissions
    );
  }

  await page.evaluate((fixtureData) => {
    // Store fixture data globally
    (window as any).__appleRemindersApiStubs = fixtureData;

    // Create a global stub installer that can be called after plugin reloads
    (window as any).__installAppleRemindersStubs = () => {
      const app = (window as any).app;
      const plugin = app?.plugins?.plugins?.["obsidian-task-sync"];

      const appleRemindersService = plugin?.appleRemindersService;
      if (!appleRemindersService) {
        return false;
      }

      // Only stub if not already stubbed
      if (appleRemindersService.__isStubbed) {
        return true;
      }

      // Store originals
      appleRemindersService.__originals = {
        fetchReminders: appleRemindersService.fetchReminders,
        fetchLists: appleRemindersService.fetchLists,
        checkPermissions: appleRemindersService.checkPermissions,
        clearCache: appleRemindersService.clearCache,
      };

      // Install stubs
      appleRemindersService.fetchReminders = async () => {
        console.log("🔧 Stubbed Apple Reminders fetchReminders called");
        return {
          success: true,
          data: (window as any).__appleRemindersApiStubs?.reminders || [],
        };
      };

      appleRemindersService.fetchLists = async () => {
        console.log("🔧 Stubbed Apple Reminders fetchLists called");
        return {
          success: true,
          data: (window as any).__appleRemindersApiStubs?.lists || [],
        };
      };

      appleRemindersService.checkPermissions = async () => {
        console.log("🔧 Stubbed Apple Reminders checkPermissions called");
        return {
          success: true,
          data:
            (window as any).__appleRemindersApiStubs?.permissions !== undefined
              ? (window as any).__appleRemindersApiStubs?.permissions
              : "AUTHORIZED",
        };
      };

      appleRemindersService.clearCache = async () => {
        console.log("🔧 Stubbed Apple Reminders clearCache called");
        return;
      };

      appleRemindersService.__isStubbed = true;
      return true;
    };

    // Install stubs immediately if plugin is available
    (window as any).__installAppleRemindersStubs();
  }, fixtureData);
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
