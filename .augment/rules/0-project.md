---
type: "always_apply"
---

# Current Project Context

Project: Obsidian Task Sync
Status: UNRELEASED

# READ THIS BEFORE DOING ANYTHING!

The project is in a transition phase moving from an Obsidian plugin to a Svelte app that has Obsidian support as an extension. Previous code was moved to `old-stuff` and should be used as a reference when re-introducing functionality within the new architecture.

# COMMANDS FOR RUNNING TESTS

- `npm test` to run all tests
- `npm run test:e2e` to run all `e2e` tests
- `npm run test:e2e:failed` to run e2e tests that previously failed
- `npm run test:e2e -- -g "pattern"` to run all `e2e` tests matching pattern


# 🚨 IMPORTANT INFORMATION ABOUT E2E TESTS 🚨

- The project is in transition phase from `vitest` with `playwright` to just `playwright` - all new e2e tests from now on must be implemented in `playwright` only
- All existing `vitest` e2e tests will be migrated to `playwright` gradually

# 🚨 IMPLEMENTATION RULES - NEVER VIOLATE 🚨

- There is a lot of very defensive code in this code base with complex error try/catch logic and awful fallbacks like `foo.?bar || 0` - such code is bad and you MUST NOT follow such patterns when writing new code or changing existing code.

# 🚨 TESTING RULES - NEVER VIOLATE 🚨

- `e2e` tests are the most important tests in this project as they test real interactions with the Obsidian API and the UI
- DO NOT write unit tests for anything other than simple low-level utilities where UI is not involved, everything else MUST BE COVERED BY E2E TESTS

# 🚨 UNIT TESTING RULES - NEVER VIOLATE 🚨

- Do not mock Obsidian APIs - any feature that relies on Obsidian APIs must be tested in e2e tests

# 🚨 E2E TESTING RULES - NEVER VIOLATE 🚨

- Do not use fixed timeouts in tests - instead use smart-waiting strategy. Implement helpers for smart-waiting if necessary.
- You MUST ALWAYS see what test helpers are available and AVOID complex code in test scenarios
- E2E tests use Playwright with Electron - the setup automatically handles xvfb on Linux via `xvfb-maybe`

# Running E2E Tests

## Basic Commands

- `npm test` - Run all tests (unit + e2e)
- `npm run test:e2e` - Run all e2e tests
- `npm run test:e2e:failed` - Re-run only tests that failed in the previous run
- `npm run test:e2e -- --grep "test name"` - Run specific test(s) matching pattern
- `npm run test:e2e -- --headed` - Run tests with visible browser window (not headless)
- `npm run test:e2e -- --debug` - Run tests in debug mode with Playwright Inspector

## Running Specific Tests

```bash
# Run a specific test file
npm run test:e2e tests/e2e/specs/playwright/app.e2e.ts

# Run tests matching a pattern
npm run test:e2e -- --grep "should create task"

# Run tests in a specific project
npm run test:e2e -- --project=electron
```

# Debugging E2E Tests

## Debug Artifacts Location

All debug artifacts are stored in `tests/e2e/debug/` with the following structure:

```
tests/e2e/debug/
├── test-results/           # Playwright test results
│   └── [test-name]/
│       ├── trace.zip       # Playwright trace (view with: npx playwright show-trace)
│       ├── video.webm      # Video recording of test
│       └── screenshots/    # Screenshots on failure
└── [test-dir]/            # Test-specific debug artifacts
    ├── vault-snapshot/    # Vault state at time of failure
    ├── console-logs.txt   # Console output from Obsidian
    └── settings.json      # Plugin settings at time of failure
```

## Viewing Debug Artifacts

### Playwright Traces
Traces are the most powerful debugging tool - they show every action, screenshot, network request, and console log:

```bash
# View trace from failed test
npx playwright show-trace tests/e2e/debug/test-results/[test-name]/trace.zip
```

The trace viewer shows:
- Timeline of all actions
- Screenshots at each step
- Network activity
- Console logs
- DOM snapshots
- Source code

### Videos
Failed tests automatically record video:

```bash
# Videos are saved as .webm files
open tests/e2e/debug/test-results/[test-name]/video.webm
```

### Console Logs
To see Obsidian's console output during test execution:

```bash
# Run with DEBUG environment variable
DEBUG=true npm run test:e2e -- --grep "test name"
```

This will show:
- Obsidian application logs
- Plugin console.log/error output
- Electron process output

## Interactive Debugging

### Method 1: Playwright Inspector (Recommended)

```bash
# Run test with inspector - pauses at each action
npm run test:e2e -- --debug --grep "test name"
```

This opens Playwright Inspector where you can:
- Step through test actions
- Inspect DOM at each step
- See locators and selectors
- Modify and re-run actions
- View console logs

### Method 2: Remote DevTools Access

Start Obsidian with remote debugging enabled and connect manually:

```bash
# Start Obsidian in headless mode with DevTools
npm run test:obsidian:open

# Or with custom vault
npm run test:obsidian:open -- --vault=/path/to/vault --port=9222
```

Then connect using:

**Chrome DevTools:**
1. Open Chrome and navigate to `chrome://inspect`
2. Click "Configure" and add `localhost:9222`
3. Click "inspect" on the Obsidian target

**Playwright:**
```javascript
const playwright = require('playwright');
const browser = await playwright.chromium.connectOverCDP('http://localhost:9222');
const page = browser.contexts()[0].pages()[0];
// Now interact with Obsidian
```

**Puppeteer:**
```javascript
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
const page = (await browser.pages())[0];
// Now interact with Obsidian
```

See `scripts/README-obsidian-headless.md` for complete documentation.

### Method 3: Add Breakpoints in Test Code

```typescript
import { test, expect } from './helpers/setup';

test('my test', async ({ page }) => {
  await page.click('.some-button');

  // Pause execution here - opens Playwright Inspector
  await page.pause();

  // Continue with test...
});
```

## Common Debugging Scenarios

### Test Fails Intermittently
1. Check trace to see timing of actions
2. Look for race conditions (elements not ready)
3. Add proper wait conditions instead of fixed timeouts
4. Use `page.waitForSelector()` or `page.waitForLoadState()`

### Element Not Found
1. Check trace to see DOM state when selector was used
2. Verify selector in Playwright Inspector
3. Check if element is in iframe or shadow DOM
4. Ensure element is visible and not covered

### Test Times Out
1. Check video to see where it got stuck
2. Review console logs for errors
3. Check if Obsidian is waiting for user input
4. Verify network requests aren't hanging

### Unexpected Behavior
1. Review trace timeline to see exact sequence of events
2. Check console logs for JavaScript errors
3. Inspect vault snapshot to see file state
4. Compare settings.json with expected configuration

## Best Practices for Debugging

1. **Always check traces first** - They contain the most complete information
2. **Use descriptive test names** - Makes finding debug artifacts easier
3. **Add console.log strategically** - But prefer trace viewer over excessive logging
4. **Capture state before assertions** - Take screenshots or log state before expect()
5. **Use page.pause() liberally** - When developing new tests, pause to inspect state
6. **Keep tests isolated** - Each test should clean up after itself
7. **Check debug artifacts before re-running** - Often the issue is clear from artifacts

## Headless vs Headed Mode

### Headless (Default)
- Faster execution
- Works in CI/CD
- Uses xvfb on Linux automatically
- Harder to see what's happening

### Headed (Debug)
```bash
npm run test:e2e -- --headed --grep "test name"
```
- Shows browser window
- Easier to see interactions
- Slower execution
- Requires display (won't work in CI)

## Platform-Specific Notes

### Linux
- Uses `xvfb-maybe` to automatically provide virtual display when needed
- In CI or headless environments, xvfb runs automatically
- On desktop with display, runs normally

### macOS / Windows
- No special setup needed
- Can run headed or headless
- DevTools work natively

## UI and front-end

- `styles.css` is generated by the CSS build process. To change styles you must only edit CSS in `src/styles`
- DO NOT add inline styles to Svelte components, instead add them to appropriate file in `src/styles`
