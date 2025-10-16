---
type: "always_apply"
---

# 🚨 MANDATORY TDD/BDD WORKFLOW - ABSOLUTE REQUIREMENTS 🚨

## CRITICAL FIRST ACTIONS FOR ANY REQUEST

```
1. Check current branch: git branch --show-current
2. Create topic branch ONLY if on main/master: git checkout -b [brief-name]
3. Create actual tasks in task system (not text lists) - MANDATORY
4. Start ONLY the first task
```

**NEVER create text task lists. NEVER work on multiple tasks simultaneously.**

## STEP-BY-STEP WORKFLOW FOR EACH TASK

### PHASE 1: EXAMINE EXISTING TESTS AND IDENTIFY WHERE TEST BELONGS

```
Before writing ANY test, you MUST:
1. Search for existing test files covering this functionality
2. Analyze patterns, imports, setup, assertions used
3. Determine if bug can be reproduced by adding expectations to existing test
4. Only create new test scenario if no existing scenario covers the feature
```

### PHASE 2: WRITE MINIMAL TEST SKELETON (IF NEEDED)

```
If implementation files don't exist yet:
1. Create MINIMAL skeleton files so imports don't fail
2. Add minimal class/function declarations (empty implementations)
3. Verify test file can be parsed and loaded

Example:
// src/services/UserService.ts - MINIMAL skeleton
export class UserService {
  validateEmail(email: string): boolean {
    // Empty - will implement after test fails properly
    return false;
  }
}

This allows test to fail on ASSERTIONS, not on "cannot find module" errors.
```

### PHASE 3: WRITE FAILING TEST WITH PROPER FAILURE

```
CRITICAL: Test must fail for the RIGHT reason:
❌ BAD: "Cannot find module './UserService'"
❌ BAD: "UserService is not defined"
✅ GOOD: "Expected true but received false"
✅ GOOD: "Expected email validation to reject invalid format"

Steps:
1. Write test with clear expectations
2. RUN THE TEST: npm test [specific-file]
3. VERIFY it fails on ASSERTION, not on missing imports
4. If failing on imports: create minimal skeleton first
5. Show actual terminal output proving assertion failure
```

### PHASE 4: COMMIT FAILING TEST

```
git add .
git commit -m "WIP - Add failing test for [specific behavior]

Test file: [path/to/test.ts]
Expected behavior: [what should happen]
Current failure: [specific assertion that fails]"
```

### PHASE 5: IMPLEMENT TO MAKE TEST PASS

```
1. Write MINIMAL code to pass the test
2. RUN THE SPECIFIC TEST: npm test [file]
3. Verify it passes
4. RUN FULL TEST SUITE: npm test
5. Verify ALL tests pass
6. Show actual terminal output
```

### PHASE 6: COMMIT IMPLEMENTATION

```
git add .
git commit -m "Implement [specific functionality]

Implementation: [what was added]
Test file extended: [path]
All tests passing: [count] tests"
```

### PHASE 7: SQUASH AND COMPLETE

```
git reset --soft HEAD~2
git commit -m "[Type] - [Clear summary]

[Details of complete change]
[Test file modifications]
[Confirmation all tests pass]

Closes task: [task description]"

Mark task complete in task system.
Move to next task.
```

## BUG REPRODUCTION STRATEGY

### CRITICAL: Check existing tests FIRST

```
For ANY bug report:
1. Find existing test file for the buggy feature
2. Look for existing test scenarios
3. Check if adding MORE EXPECTATIONS to existing test reproduces bug
4. Only create new test scenario if truly no coverage exists

Example - Bug: "User login fails with uppercase emails"

STEP 1: Find existing login tests
Found: tests/auth/login.test.ts

STEP 2: Examine existing test
test('user can login with valid credentials', async () => {
  const result = await login('user@example.com', 'password');
  expect(result.success).toBe(true);
});

STEP 3: Add expectation for uppercase to EXISTING test
test('user can login with valid credentials', async () => {
  const result = await login('user@example.com', 'password');
  expect(result.success).toBe(true);
  
  // ADD: Test uppercase variation
  const uppercaseResult = await login('USER@EXAMPLE.COM', 'password');
  expect(uppercaseResult.success).toBe(true); // This will FAIL - bug reproduced
});

✅ Bug reproduced in existing test file without creating new scenario
```

### When to create new test scenario vs extend existing

```
✅ EXTEND existing test when:
- Same test scenario, just checking additional expectations
- Same setup and context needed
- Testing edge case of existing behavior

✅ CREATE new test scenario when:
- Completely different setup required
- Different preconditions needed
- Testing orthogonal feature aspect
```

## E2E TEST DEBUGGING - DOCKER ENVIRONMENT

### FORBIDDEN PLAYWRIGHT COMMANDS

```
❌ NEVER run playwright trace viewer in docker:
- npx playwright show-trace
- npx playwright show-report
- Any interactive playwright UI tools

These DO NOT WORK in docker container environment.
```

### CORRECT E2E DEBUGGING APPROACH

```
✅ ALWAYS analyze existing artifacts:
1. Check tests/e2e/debug/ directory for artifacts
2. Read trace files programmatically if needed
3. Examine screenshots in debug directory
4. Read console logs from test output
5. Check network requests in trace data

Example:
$ ls tests/e2e/debug/
screenshot-failure-1.png
trace.zip
console-logs.txt

Analyze these files directly, don't try to open interactive viewers.
```

## TEST FAILURE VALIDATION

### Before proceeding to implementation, verify:

```
✅ Test file loads without import errors
✅ Test reaches the assertion line
✅ Test fails on EXPECTED vs RECEIVED comparison
✅ Failure message clearly shows what's wrong

❌ Do NOT proceed if test fails with:
- "Cannot find module"
- "X is not defined"
- "Unexpected token"
- Any syntax or import error
```

## FORBIDDEN TEST MODIFICATIONS

### 🚨 CRITICAL - NEVER DO THESE:

```
❌ REMOVING tests to make suite pass
❌ COMMENTING OUT failing tests
❌ Changing expectations to match wrong behavior
❌ Using fake assertions like expect(true).toBe(true)
❌ Mocking return values to make test pass artificially

If test is failing and you're unsure how to fix:
🛑 STOP and ask for guidance
NEVER remove or fake the test
```

### If test seems wrong:

```
🛑 STOP and explain:
"This test expects X but I think it should expect Y because [reasoning].
Should I:
A) Update the test expectation to Y
B) Fix implementation to meet expectation X
C) Something else

Please advise."
```

## DEFENSIVE CODE - ABSOLUTELY FORBIDDEN

### ❌ NEVER write fallback chains:

```javascript
// FORBIDDEN - don't do this:
const value = data.foo || data.fooValue || data.foo_value || 'default';
const email = user.email || user.emailAddress || user.mail || '';
const id = response.data?.id || response.id || generateFallbackId();
```

### ✅ ALWAYS trust your contracts:

```javascript
// CORRECT - trust the data structure:
const value = data.foo; // Fails fast if foo doesn't exist
const email = user.email; // Fails fast if email missing
const id = response.data.id; // Fails fast if structure wrong

// If validation needed, do it explicitly at boundaries:
if (!data.foo) {
  throw new ValidationError('foo is required');
}
const value = data.foo; // Now safe to use
```

## ERROR HANDLING - STRATEGIC TRY-CATCH ONLY

### ❌ DON'T wrap everything in try-catch:

```javascript
// FORBIDDEN - excessive try-catch:
function processUser(user) {
  try {
    const name = user.name;
    try {
      const email = user.email.toLowerCase();
      try {
        const result = saveToDatabase(user);
        return result;
      } catch (dbError) {
        console.error('DB error:', dbError);
        return null;
      }
    } catch (emailError) {
      console.error('Email error:', emailError);
      return null;
    }
  } catch (error) {
    console.error('Processing error:', error);
    return null;
  }
}
```

### ✅ ONLY catch at UI/API boundaries:

```javascript
// CORRECT - let errors propagate, catch only at boundary:

// Business logic - NO try-catch, let errors propagate:
function processUser(user) {
  if (!user.name) throw new ValidationError('name required');
  if (!user.email) throw new ValidationError('email required');
  
  const normalizedEmail = user.email.toLowerCase();
  return saveToDatabase({ ...user, email: normalizedEmail });
}

// API layer - catch to show user-friendly error:
async function handleUserUpdate(req, res) {
  try {
    const result = await processUser(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      console.error('Unexpected error:', error); // Log for debugging
      res.status(500).json({ error: 'Server error occurred' });
    }
  }
}
```

### When try-catch is appropriate:

```
✅ API/UI handlers - hide internal errors from users
✅ Background jobs - prevent crash, log for investigation
✅ Integration points - handle third-party failures gracefully
✅ Resource cleanup - ensure cleanup happens (try-finally)

❌ Business logic - let errors propagate
❌ Utility functions - let errors propagate
❌ Data transformations - let errors propagate
❌ Internal service calls - let errors propagate
```

### ❌ FORBIDDEN: Catch-and-rethrow without reason:

```javascript
// FORBIDDEN - pointless catch-and-rethrow:
async function saveUser(user) {
  try {
    return await database.save(user);
  } catch (error) {
    console.error('Failed to save:', error);
    throw error; // Pointless - just let it propagate naturally
  }
}

// CORRECT - just let it propagate:
async function saveUser(user) {
  return await database.save(user); // Error propagates naturally
}
```

## TASK SYSTEM INTEGRATION

### MANDATORY task creation:

```
For EVERY development request:
1. Create actual tasks in task system
2. Do NOT write text lists like "Task 1: ..., Task 2: ..."
3. Work on tasks ONE AT A TIME
4. Mark complete only after squashing commits
```

## SUCCESS CRITERIA PER TASK

```
Every task must have:
✅ Failing test committed with "WIP - " prefix
✅ Test fails on ASSERTION not import errors
✅ Implementation committed without "WIP - " prefix
✅ Both commits squashed into final commit
✅ All tests passing before marking complete
✅ Task marked complete in task system

Forbidden:
❌ Test failing on import/syntax errors
❌ Removing or faking tests
❌ Defensive fallback chains
❌ Excessive try-catch blocks
❌ Working on multiple tasks at once
```

## STOPPING POINTS - ASK FOR GUIDANCE

### 🛑 STOP and ask if:

```
- Test seems to have wrong expectations
- Unsure if test or implementation is correct
- Need to modify existing test behavior
- Test is failing and fix isn't obvious
- Conflicting with existing patterns
- E2E test failing and artifacts unclear
```

### NEVER:

```
- Remove test to make suite pass
- Change test to match wrong behavior
- Add fake assertion to make test pass
- Proceed with failing import errors
- Work around test failures
```