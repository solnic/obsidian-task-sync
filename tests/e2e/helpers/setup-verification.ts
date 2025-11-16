/**
 * Setup verification utilities for e2e testing
 * Checks if the e2e testing environment is properly configured
 */

import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface SetupCheckResult {
  name: string;
  passed: boolean;
  details?: string;
}

export interface SetupVerificationResult {
  isReady: boolean;
  checks: SetupCheckResult[];
  missingRequirements: string[];
}

/**
 * Check if a command exists in the system
 */
async function commandExists(command: string): Promise<boolean> {
  try {
    await execAsync(`which ${command}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if xvfb is installed (for headless testing on Linux)
 */
async function checkXvfb(): Promise<SetupCheckResult> {
  const exists = await commandExists("xvfb-run");
  return {
    name: "Xvfb (headless display)",
    passed: exists,
    details: exists ? "Installed" : "Not installed - required for headless testing on Linux",
  };
}

/**
 * Check if Obsidian is unpacked and ready for Playwright
 */
async function checkObsidianUnpacked(): Promise<SetupCheckResult> {
  const unpackedDir = path.resolve("./tests/e2e/.obsidian-unpacked");

  // Check for different possible Obsidian structures
  const mainJsPath = path.join(unpackedDir, "main.js");
  const appExtractedMainJs = path.join(unpackedDir, "app-extracted", "main.js");
  const obsidianBinaryPath = path.join(unpackedDir, "obsidian");

  const hasMainJs = fs.existsSync(mainJsPath);
  const hasAppExtracted = fs.existsSync(appExtractedMainJs);
  const hasBinary = fs.existsSync(obsidianBinaryPath);

  const passed = hasMainJs || hasAppExtracted || hasBinary;

  let details = "Not found";
  if (hasMainJs) {
    details = "Found main.js";
  } else if (hasAppExtracted) {
    details = "Found app-extracted/main.js";
  } else if (hasBinary) {
    details = "Found obsidian binary";
  }

  return {
    name: "Obsidian unpacked",
    passed,
    details,
  };
}

/**
 * Check if required Electron dependencies are installed (Linux only)
 */
async function checkElectronDependencies(): Promise<SetupCheckResult> {
  // Only check on Linux systems with apt-get
  const hasAptGet = await commandExists("apt-get");

  if (!hasAptGet) {
    return {
      name: "Electron dependencies",
      passed: true,
      details: "Skipped (not a Debian-based system)",
    };
  }

  const requiredLibs = [
    "libnss3",
    "libatk-bridge2.0-0",
    "libgbm1",
    "libxss1",
    "libasound2",
  ];

  let missingLibs: string[] = [];

  for (const lib of requiredLibs) {
    try {
      await execAsync(`dpkg -l | grep -q ${lib}`);
    } catch {
      missingLibs.push(lib);
    }
  }

  const passed = missingLibs.length === 0;

  return {
    name: "Electron dependencies",
    passed,
    details: passed
      ? "All required libraries installed"
      : `Missing: ${missingLibs.join(", ")}`,
  };
}

/**
 * Check if Node.js and npm are available
 */
async function checkNodeAndNpm(): Promise<SetupCheckResult[]> {
  const hasNode = await commandExists("node");
  const hasNpm = await commandExists("npm");

  let nodeVersion = "";
  let npmVersion = "";

  if (hasNode) {
    try {
      const { stdout } = await execAsync("node --version");
      nodeVersion = stdout.trim();
    } catch {}
  }

  if (hasNpm) {
    try {
      const { stdout } = await execAsync("npm --version");
      npmVersion = stdout.trim();
    } catch {}
  }

  return [
    {
      name: "Node.js",
      passed: hasNode,
      details: hasNode ? nodeVersion : "Not found",
    },
    {
      name: "npm",
      passed: hasNpm,
      details: hasNpm ? `v${npmVersion}` : "Not found",
    },
  ];
}

/**
 * Check if the plugin is built
 */
async function checkPluginBuilt(): Promise<SetupCheckResult> {
  const mainJsPath = path.resolve("./main.js");
  const manifestPath = path.resolve("./manifest.json");
  const stylesPath = path.resolve("./styles.css");

  const hasMainJs = fs.existsSync(mainJsPath);
  const hasManifest = fs.existsSync(manifestPath);
  const hasStyles = fs.existsSync(stylesPath);

  const passed = hasMainJs && hasManifest && hasStyles;

  const missing = [];
  if (!hasMainJs) missing.push("main.js");
  if (!hasManifest) missing.push("manifest.json");
  if (!hasStyles) missing.push("styles.css");

  return {
    name: "Plugin built",
    passed,
    details: passed ? "All files present" : `Missing: ${missing.join(", ")}`,
  };
}

/**
 * Verify that the e2e testing environment is ready
 * Returns a comprehensive report of what's ready and what's missing
 */
export async function verifySetup(): Promise<SetupVerificationResult> {
  const checks: SetupCheckResult[] = [];

  // Check Node.js and npm
  const nodeNpmChecks = await checkNodeAndNpm();
  checks.push(...nodeNpmChecks);

  // Check if plugin is built
  const pluginCheck = await checkPluginBuilt();
  checks.push(pluginCheck);

  // Check Obsidian setup
  const obsidianCheck = await checkObsidianUnpacked();
  checks.push(obsidianCheck);

  // Check xvfb (Linux only)
  const xvfbCheck = await checkXvfb();
  checks.push(xvfbCheck);

  // Check Electron dependencies (Linux only)
  const electronDepsCheck = await checkElectronDependencies();
  checks.push(electronDepsCheck);

  // Determine if setup is ready
  const failedChecks = checks.filter(check => !check.passed);
  const isReady = failedChecks.length === 0;

  const missingRequirements = failedChecks.map(check =>
    `${check.name}${check.details ? `: ${check.details}` : ""}`
  );

  return {
    isReady,
    checks,
    missingRequirements,
  };
}

/**
 * Run the setup script to configure the e2e testing environment
 */
export async function runSetup(): Promise<void> {
  const setupScriptPath = path.resolve("./scripts/setup-e2e.sh");

  if (!fs.existsSync(setupScriptPath)) {
    throw new Error(
      `Setup script not found at ${setupScriptPath}. ` +
      "Please ensure the setup-e2e.sh script exists."
    );
  }

  console.log("🔧 Running e2e setup...");

  try {
    await execAsync(`bash ${setupScriptPath}`, {
      stdio: "inherit",
      cwd: process.cwd(),
    } as any);

    console.log("✅ Setup completed successfully");
  } catch (error: any) {
    console.error("❌ Setup failed:", error.message);
    throw new Error(`Setup script failed: ${error.message}`);
  }
}

/**
 * Verify setup and run setup script if needed
 * This is the main entry point for ensuring e2e tests can run
 */
export async function ensureSetup(): Promise<void> {
  console.log("🔍 Verifying e2e testing setup...");

  const result = await verifySetup();

  if (result.isReady) {
    console.log("✅ E2E testing environment is ready");
    return;
  }

  console.log("⚠️ E2E testing environment is not ready:");
  for (const requirement of result.missingRequirements) {
    console.log(`   - ${requirement}`);
  }

  console.log("\n🔧 Running setup to configure the environment...\n");

  await runSetup();

  // Verify again after setup
  console.log("\n🔍 Re-verifying setup...");
  const verifyResult = await verifySetup();

  if (!verifyResult.isReady) {
    console.error("\n❌ Setup verification failed:");
    for (const requirement of verifyResult.missingRequirements) {
      console.error(`   - ${requirement}`);
    }
    throw new Error(
      "E2E testing environment setup failed. Please check the errors above."
    );
  }

  console.log("✅ E2E testing environment is now ready\n");
}
