---
type: "always_apply"
---

# E2E Testing in Docker - Artifact Analysis

## DOCKER ENVIRONMENT CONSTRAINTS

**You are working in a Docker container. Interactive Playwright tools DO NOT WORK.**

### ❌ ABSOLUTELY FORBIDDEN COMMANDS:

```bash
# These will FAIL in Docker and waste time:
npx playwright show-trace
npx playwright show-report
npx playwright trace viewer
playwright ui
playwright ui mode

DO NOT ATTEMPT THESE - they require GUI which doesn't exist in container
```

## CORRECT E2E DEBUGGING WORKFLOW

### STEP 1: Check for existing debug artifacts

```bash
# Look for artifacts first
ls -la tests/e2e/debug/
```

### STEP 2: Examine test output and logs

- Inspect log files
- Inspect dumped HTML files

### STEP 3: Add detailed logging to tests

```javascript
// Add console logs to understand flow
test('user login flow', async ({ page }) => {
  console.log('Starting login test');

  await page.goto('/login');
  console.log('Navigated to login page');

  await page.fill('[data-test="email"]', 'user@example.com');
  console.log('Filled email field');

  await page.fill('[data-test="password"]', 'password123');
  console.log('Filled password field');

  await page.click('[data-test="submit"]');
  console.log('Clicked submit button');

  await page.waitForURL('/dashboard');
  console.log('Redirected to dashboard');
});
```

### STEP 5: Use screenshots strategically

```javascript
// Add screenshots at key points
test('problematic flow', async ({ page }) => {
  await page.goto('/page');
  await page.screenshot({ path: 'tests/e2e/debug/step1.png' });

  await page.click('#button');
  await page.screenshot({ path: 'tests/e2e/debug/step2.png' });

  // Check for error state
  const errorVisible = await page.locator('.error').isVisible();
  if (errorVisible) {
    await page.screenshot({ path: 'tests/e2e/debug/error-state.png' });
    const errorText = await page.locator('.error').textContent();
    console.log('Error message:', errorText);
  }
});
```

## ANALYZING FAILED E2E TESTS

### Check these in order:

```
1. Test output - read error messages carefully
2. Screenshots - visual state at failure point
3. Console logs - JavaScript errors in browser
4. Network logs - API call failures
5. Page HTML - check actual DOM state
6. Trace data - sequence of actions taken
```

### Extract useful info from trace:

```javascript
// Parse trace to understand what happened
function analyzeTrace(tracePath) {
  const zip = new AdmZip(tracePath);
  const trace = JSON.parse(zip.readAsText('trace.json'));

  // Find failed action
  const failedAction = trace.actions.find(a => a.error);
  if (failedAction) {
    console.log('Failed at action:', failedAction.type);
    console.log('Error:', failedAction.error);
    console.log('Selector:', failedAction.selector);
  }

  // Check network issues
  const failedRequests = trace.network.filter(r => r.status >= 400);
  if (failedRequests.length > 0) {
    console.log('Failed HTTP requests:');
    failedRequests.forEach(r => {
      console.log(`  ${r.method} ${r.url} - ${r.status}`);
    });
  }

  // Check console errors
  const consoleErrors = trace.console.filter(c => c.type === 'error');
  if (consoleErrors.length > 0) {
    console.log('Console errors:');
    consoleErrors.forEach(e => console.log(`  ${e.text}`));
  }
}
```

## DEBUGGING STRATEGIES

### Strategy 1: Isolate failing step

```javascript
// Comment out steps to find exact failure point
test('multi-step flow', async ({ page }) => {
  await page.goto('/start'); // Works
  await page.screenshot({ path: 'debug/step1.png' });

  await page.click('#next'); // Works
  await page.screenshot({ path: 'debug/step2.png' });

  await page.fill('#input', 'value'); // Fails here?
  await page.screenshot({ path: 'debug/step3.png' });

  // Comment out remaining steps until you find the problem
});
```

### Strategy 2: Add wait conditions

```javascript
// Common E2E timing issues
test('flaky test', async ({ page }) => {
  await page.goto('/page');

  // Wait for specific condition before proceeding
  await page.waitForSelector('[data-test="loaded"]', { timeout: 5000 });

  // Wait for network idle
  await page.waitForLoadState('networkidle');

  // Wait for specific text
  await page.waitForSelector('text=Ready');

  // Then proceed with test
  await page.click('#button');
});
```

### Strategy 3: Check actual page state

```javascript
// Verify what's actually on the page
test('verify state', async ({ page }) => {
  await page.goto('/page');

  // Get page HTML for analysis
  const html = await page.content();
  console.log('Page HTML:', html);

  // Check if element exists
  const buttonExists = await page.locator('#button').count() > 0;
  console.log('Button exists:', buttonExists);

  // Check element properties
  const buttonVisible = await page.locator('#button').isVisible();
  console.log('Button visible:', buttonVisible);

  const buttonEnabled = await page.locator('#button').isEnabled();
  console.log('Button enabled:', buttonEnabled);
});
```

## REPRODUCING E2E BUGS IN UNIT TESTS

### After identifying E2E issue, write unit test:

```javascript
// E2E test revealed: form submission fails with special characters

// Write unit/integration test to reproduce:
test('form validation handles special characters', () => {
  const input = "user+test@example.com";
  const result = validateEmail(input);

  expect(result.valid).toBe(true); // Will fail - reproduces E2E issue
});

// Now fix validation logic
// Then both unit and E2E tests pass
```

## COMMON E2E FAILURE PATTERNS

### Pattern 1: Selector not found

```
Error: "Timeout waiting for selector #submit"

Causes:
- Element doesn't exist on page
- Element has different ID/class
- Element not yet rendered (timing)
- Page didn't navigate correctly

Debug:
1. Screenshot at failure point
2. Check page HTML
3. Verify navigation succeeded
4. Add wait conditions
```

### Pattern 2: Element not clickable

```
Error: "Element is not visible"

Causes:
- Element obscured by another element
- Element off-screen
- Element has display: none or visibility: hidden
- Animation not complete

Debug:
1. Take screenshot
2. Scroll element into view
3. Wait for animations
4. Check z-index and positioning
```

### Pattern 3: Unexpected navigation

```
Error: "Expected URL /dashboard, got /login"

Causes:
- Authentication failed
- Redirect logic incorrect
- Form submission failed
- API returned error

Debug:
1. Check network requests
2. Verify API responses
3. Check console for JS errors
4. Verify form data being sent
```

## SUMMARY - DOCKER E2E DEBUGGING CHECKLIST

```
✅ DO:
- Check tests/e2e/debug/ for artifacts
- Read trace files programmatically
- Examine screenshots
- Add console.log to tests
- Extract info from test output
- Write unit tests to reproduce issues

❌ DON'T:
- Try to open Playwright trace viewer
- Attempt to use Playwright UI mode
- Try to launch Playwright inspector
- Expect interactive debugging tools to work

🛑 STOP AND ASK:
- If artifacts aren't clear
- If test fails inconsistently
- If root cause is unclear
- If need help interpreting traces
```
