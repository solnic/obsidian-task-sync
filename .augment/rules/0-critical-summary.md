---
type: "always_apply"
---

# CRITICAL RULES SUMMARY - READ FIRST

## 🚨 MOST COMMON VIOLATIONS TO AVOID

### 1. TDD/BDD Workflow Violations

```
❌ Writing implementation before test fails
❌ Test failing on imports instead of assertions
❌ Not showing actual test output
❌ Not using task system
❌ Working on multiple tasks at once
❌ Not committing after each task

✅ Create tasks in task system (not text lists)
✅ Write test that fails on ASSERTIONS
✅ Show actual terminal output
✅ Work on ONE task at a time
✅ Commit after each task completion
```

### 2. Test Modification Violations

```
🛑 CRITICAL - NEVER EVER:
❌ Remove tests to make suite pass
❌ Comment out failing tests
❌ Change expectations to match wrong behavior
❌ Use fake assertions like expect(true).toBe(true)

✅ If test seems wrong: STOP and ask for guidance
✅ Never fake a test to make it pass
```

### 3. Defensive Code Violations

```
❌ FORBIDDEN fallback chains:
const x = data.foo || data.fooValue || data.foo_value || 'default';

❌ FORBIDDEN excessive try-catch:
try { /* every function */ } catch { return null; }

✅ Trust contracts:
const x = data.foo; // Fails fast if missing

✅ Try-catch ONLY at UI/API boundaries:
async function handler(req, res) {
  try {
    const result = await businessLogic(); // No try-catch inside
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
}
```

### 4. Bug Reproduction Violations

```
❌ Creating new test files for every bug
❌ Not checking if existing tests can be extended

✅ Find existing test for the feature
✅ Add expectations to existing test to reproduce bug
✅ Only create new scenario if truly no coverage exists
```

### 5. E2E Debugging Violations (Docker)

```
❌ FORBIDDEN in Docker:
npx playwright show-trace
npx playwright show-report

✅ CORRECT:
ls tests/e2e/debug/
cat test-output.log
Analyze screenshots and trace files programmatically
```

### 6. Task System Violations

```
❌ Creating text task lists
❌ Working on all tasks simultaneously

✅ Create actual tasks in task system
✅ Work on ONE task at a time
✅ Mark complete only after squashing commits
```

## WORKFLOW QUICK REFERENCE

### Every Task Must Follow:

```
1. Create task in task system
2. Find existing test file
3. Write minimal skeleton if needed (so imports work)
4. Write test that fails on ASSERTION
5. Show failing test output
6. Commit with "WIP - "
7. Implement minimal fix
8. Show passing test output
9. Run full suite
10. Commit without "WIP - "
11. Squash commits
12. Mark task complete
13. Move to next task
```

### Proper Test Failure:

```
❌ BAD: Cannot find module './UserService'
❌ BAD: UserService is not defined
✅ GOOD: Expected true but received false
✅ GOOD: Expected "valid" but received "invalid"
```

### Try-Catch Usage:

```
✅ USE at: API handlers, UI components, background jobs
❌ DON'T USE in: Business logic, utilities, services, transformations
```

### Fallback Values:

```
❌ NEVER: data.foo || data.fooVal || 'default'
✅ VALIDATE then TRUST: if (!data.foo) throw Error; return data.foo;
```

## STOPPING POINTS

### 🛑 STOP and ask if:

```
- Test expectations seem wrong
- Unsure if test or implementation is correct
- Need to modify existing test behavior
- Test failing and fix isn't obvious
- Want to remove or change test expectations
- E2E test artifacts unclear
```

### NEVER stop for:

```
- "Obvious" fixes
- Simple implementations
- Time pressure
- Test seeming unnecessary
```

## FILE REFERENCE

```
1-tdd-workflow-strict.md    - Complete TDD/BDD workflow
2-confident-code.md          - No defensive programming rules
3-e2e-docker-debugging.md    - Docker E2E debugging guide
```

## FINAL CRITICAL REMINDERS

```
1. Task system: Create actual tasks, not text lists
2. Test failures: Must fail on assertions, not imports
3. Test modifications: NEVER remove or fake tests
4. Defensive code: NO fallback chains (data.x || data.y || 'default')
5. Try-catch: ONLY at UI/API boundaries, not everywhere
6. Bug reproduction: Extend existing tests first
7. E2E debugging: Use artifacts, not Playwright UI
8. One task at a time: Complete and commit before next
```