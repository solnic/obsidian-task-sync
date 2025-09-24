---
type: "always_apply"
---

# 🚨 MANDATORY WORKFLOW - NEVER VIOLATE 🚨

## CRITICAL FIRST RESPONSE TO ANY REQUEST
**Your IMMEDIATE first action for ANY development request:**

```
I need to check current branch and break this down into individual tasks.

[Check current branch - only create topic branch if on main/master]
[Create individual tasks in Augment's task system - do NOT list them in text]
[Start working on FIRST task only]
```

**NEVER create text task lists. NEVER work on multiple things at once.**

## STEP-BY-STEP MANDATORY WORKFLOW

### STEP 1: IMMEDIATE SETUP (BEFORE ANYTHING ELSE)
```
1. Check current branch: git branch --show-current
2. Only create topic branch if on main/master: git checkout -b [brief-name]
3. Create actual tasks in Augment's task system (not text lists)
4. Start ONLY the first task
```

### STEP 2: FOR EACH INDIVIDUAL TASK
```
1. Examine existing test patterns for this specific task
2. Write ONE failing test following existing patterns
3. RUN THE TEST and show it fails: $ npm test [specific test file]
4. Commit failing test with "WIP - " prefix
5. Implement MINIMAL code to make ONLY that test pass
6. RUN THE TEST again and show it passes: $ npm test [specific test file]
7. RUN FULL TEST SUITE: $ npm test
8. Commit successful implementation (no "WIP - " prefix)
9. Squash the two commits into one final commit
10. Mark task complete in task system
11. Move to next task
```

### STEP 3: COMMIT DISCIPLINE FOR EACH TASK

#### COMMIT 1: Failing Test (with WIP prefix)
```
After writing failing test:

git add .
git commit -m "WIP - Add failing test for [specific behavior]

Added test in [test file] that demonstrates [expected behavior]
Test currently fails as expected: [failure reason]"
```

#### COMMIT 2: Successful Implementation (no WIP prefix)
```
After making test pass and full suite passes:

git add .
git commit -m "Implement [specific functionality]

Added [specific implementation details]
All tests now pass including new test for [behavior]
Extended [test file] following existing patterns"
```

#### COMMIT 3: Squash into Final Task Commit
```
Squash the two commits into one:

git reset --soft HEAD~2
git commit -m "[TaskType] - [Clear summary of what was accomplished]

[Detailed description of the complete change]
[Which test file was extended and how]
[Confirmation that all tests pass]

Closes task: [task description]"

Examples:
git commit -m "Feature - Add email validation to user registration

Extended tests/user/registration.test.js with email format validation tests
Added validateEmailFormat function to UserService class
Registration now rejects invalid email formats and accepts valid ones
All 15 registration tests pass

Closes task: Add email validation"

git commit -m "Bugfix - Handle null prices in product sorting

Extended tests/features/product-sort.test.js with null price test case
Modified sortProducts function to treat null values as highest priority
Sorting now correctly handles products with null prices
All 23 sorting tests pass

Closes task: Fix sorting with null prices"
```

## WIP PREFIX RULES

### ✅ USE "WIP - " prefix ONLY when:
```
- Committing failing tests before implementation
- Committing partial work that doesn't make tests pass
- Any commit where the test suite has failing tests
```

### ❌ NEVER use "WIP - " prefix when:
```
- All tests are passing
- Task is complete and ready to be marked done
- Implementation successfully makes tests pass
- Final squashed commit for completed task
```

## BRANCH MANAGEMENT

### Check current branch first:
```
git branch --show-current

If on main/master/develop:
  git checkout -b [descriptive-topic-branch-name]

If already on a topic branch:
  Continue working on current branch
  Do NOT create another branch
```

### Topic branch naming examples:
```
✅ GOOD branch names:
- fix-sorting-null-prices
- add-email-validation
- update-button-loading-state
- reproduce-login-uppercase-bug

❌ BAD branch names:
- feature-branch
- bug-fix
- updates
- my-changes
```

## EXACT WORKFLOW TEMPLATE

### For ANY development request:
```
Let me check the current branch and set up tasks for this work.

git branch --show-current

[If on main/master:]
git checkout -b [descriptive-name]

[If already on topic branch:]
Continuing on current topic branch: [branch-name]

[Create individual tasks in Augment's task system - NOT text]

Starting with the first task: [specific task description]

I need to examine existing test patterns for [specific functionality].

[Search for existing test files]
Found: [specific test file]
Pattern analysis: [describe patterns found]

Following the existing pattern, I'll add a test for [specific behavior]:

[Write one test in existing file]

Let me run this test to verify it fails:
$ npm test [specific file]
[Show actual failing output]

❌ Test failing as expected: [specific failure reason]

Committing the failing test:
git add .
git commit -m "WIP - Add failing test for [specific behavior]

Added test in [test file] for [expected behavior]
Test fails as expected: [failure reason]"

Now I'll implement the minimal code to make this test pass:

[Implement minimal solution]

Let me verify the test now passes:
$ npm test [specific file]
[Show actual passing output]

Let me run the full test suite:
$ npm test
[Show all tests passing]

✅ All tests passing

Committing the successful implementation:
git add .
git commit -m "Implement [specific functionality]

Added [implementation details]
All tests now pass including new test for [behavior]
Extended [test file] following existing patterns"

Squashing commits into final task commit:
git reset --soft HEAD~2
git commit -m "Feature - [Clear summary]

[Complete description of what was accomplished]
[Test file modifications]
[Confirmation all tests pass]

Closes task: [task description]"

Task 1 complete. Moving to next task...
```

## FORBIDDEN WORKFLOW PATTERNS

### ❌ NEVER do these:
```
❌ Create topic branch when already on one
❌ Use "WIP - " prefix when all tests pass
❌ Skip squashing commits at end of task
❌ Create text task lists instead of using task system
❌ Work on multiple tasks simultaneously
❌ Skip showing actual test execution output
❌ Proceed to next task without squashing commits
```

### ✅ ALWAYS do these:
```
✅ Check current branch before creating new one
✅ Use "WIP - " only for failing tests or partial work
✅ Squash task commits into one final descriptive commit
✅ Use Augment's task system for actual trackable tasks
✅ Work on ONE task at a time sequentially
✅ Run tests and show actual terminal output
✅ Complete commit squashing before marking task done
```

## TEST EXECUTION REQUIREMENTS

### MANDATORY for every test:
```
BEFORE implementation - show failing test:
$ npm test tests/specific/file.test.js
❌ [Actual terminal output showing failure]

AFTER implementation - show passing test:
$ npm test tests/specific/file.test.js
✅ [Actual terminal output showing success]

AFTER implementation - show full suite passing:
$ npm test
✅ [Actual terminal output showing all tests pass]

Never simulate or assume - always show real output.
```

## TASK SYSTEM INTEGRATION

### MUST use Augment's task features:
```
Instead of writing:
"I'll break this into 3 tasks:
1. Add validation
2. Update UI
3. Add tests"

Do this:
[Create actual task: "Add email validation"]
[Create actual task: "Update registration UI"]
[Create actual task: "Add comprehensive tests"]

Work on first task only until complete, committed, and squashed.
```

## VIOLATION RECOVERY

### If you catch yourself creating branch when on topic branch:
```
🚨 VIOLATION: I was about to create a topic branch but I'm already on one.

Current branch: [current-branch-name]
Continuing work on existing topic branch.
```

### If you catch yourself using "WIP - " with passing tests:
```
🚨 VIOLATION: I was about to use "WIP - " prefix but all tests are passing.

Correcting commit message to not include "WIP - " prefix since tests pass.
```

### If you catch yourself not squashing commits:
```
🚨 VIOLATION: I completed a task but didn't squash commits.

Immediate correction:
1. git reset --soft HEAD~2 (or appropriate number)
2. git commit -m "[TaskType] - [Clear summary]..."
3. Mark task complete in task system
4. Move to next individual task
```

### If you catch yourself doing multiple tasks:
```
🚨 VIOLATION: I was working on multiple tasks simultaneously.

Stopping immediately:
1. Complete current task with test and implementation
2. Commit implementation (no WIP prefix if tests pass)
3. Squash commits for current task
4. Mark current task complete in task system
5. Move to next individual task
```

## SUCCESS CRITERIA

### Every development request must:
- [ ] Check current branch before creating new one
- [ ] Create topic branch only if on main/master
- [ ] Use Augment's task system (not text lists)
- [ ] Work on one task at a time sequentially
- [ ] Show actual test failure before implementation
- [ ] Show actual test success after implementation
- [ ] Show full test suite success before final commit
- [ ] Squash task commits before marking complete

### Every task must:
- [ ] Have failing test committed with "WIP - " prefix
- [ ] Have implementation committed without "WIP - " prefix
- [ ] Have both commits squashed into final descriptive commit
- [ ] Be marked complete only after squashing
- [ ] Extend existing test file (not create new one)
- [ ] Show actual terminal output for all test runs

### Every final task commit must:
- [ ] Be result of squashing work commits
- [ ] Have no "WIP - " prefix (tests must be passing)
- [ ] Include clear task type (Feature/Bugfix/Refactor)
- [ ] Include specific details about what was accomplished
- [ ] Reference which test files were modified
- [ ] Confirm all tests pass
- [ ] Include "Closes task: [description]"

## MANDATORY STOPPING POINTS

### You MUST stop and ask if:
- Cannot find existing test file for the functionality
- Cannot determine how to reproduce a bug with existing tests
- Task system is not available and you need to create tasks
- Test environment is broken and tests cannot run
- Git repository is in an unexpected state

### You MUST NOT stop for:
- Implementation seeming "obvious"
- Simple bug fixes
- Small feature additions
- Refactoring tasks
- Commit squashing (always required)
