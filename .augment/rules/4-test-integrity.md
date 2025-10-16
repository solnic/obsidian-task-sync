---
type: "always_apply"
---

# Test Integrity - Never Fake Tests

## 🚨 ABSOLUTE RULE: TESTS MUST BE HONEST

**A passing test suite with fake tests is worse than a failing test suite.**

**Tests exist to catch bugs. Faking tests hides bugs and creates false confidence.**

## FORBIDDEN TEST MODIFICATIONS

### ❌ NEVER do these to make tests pass:

```javascript
// 1. REMOVING tests
describe('User validation', () => {
  // test('should reject invalid email', () => { ... }); // REMOVED - FORBIDDEN!
  test('should accept valid email', () => { ... });
});

// 2. COMMENTING OUT tests
describe('Order processing', () => {
  // test('should handle null prices', () => { ... }); // COMMENTED - FORBIDDEN!
  test('should calculate total', () => { ... });
});

// 3. CHANGING expectations to match wrong behavior
test('should validate email', () => {
  const result = validateEmail('invalid');
  expect(result.valid).toBe(false); // Original
  // expect(result.valid).toBe(true); // Changed to make test pass - FORBIDDEN!
});

// 4. USING fake assertions
test('some feature works', () => {
  doSomething();
  expect(true).toBe(true); // FAKE - FORBIDDEN!
});

test('another feature', () => {
  const result = processData();
  expect(result).toBeDefined(); // Too weak - hides actual issues
});

// 5. MOCKING to hide failures
test('calculation works', () => {
  jest.spyOn(calculator, 'compute').mockReturnValue(100); // Hiding broken logic
  expect(calculator.compute(50, 50)).toBe(100); // This always passes
});
```

## WHEN TEST SEEMS WRONG

### If you think test expectations are incorrect:

```
🛑 STOP IMMEDIATELY

Do NOT change the test.
Do NOT make test pass with fake assertion.

Instead, say:

"I believe this test expectation may be incorrect. 

Current test expects: [X]
I think it should expect: [Y]
Reason: [explain your reasoning]

The failing test is:
[show test code]

The current implementation:
[show relevant code]

Should I:
A) Update test expectation to [Y]
B) Fix implementation to match expectation [X]
C) Something else

Please advise before I proceed."
```

### If you're unsure which is correct:

```
🛑 STOP AND ASK

"I'm unsure whether the test or implementation is correct.

Test expects: [X]
Implementation does: [Y]

I can see arguments for both:
- Test might be right because: [reasoning]
- Implementation might be right because: [reasoning]

Existing behavior in production: [if known]
Impact of changing: [analysis]

What should I do?"
```

## VALID TEST MODIFICATIONS

### ✅ These are ALLOWED:

```javascript
// 1. ADDING assertions to existing tests
test('user validation', () => {
  const result = validateUser(userData);
  expect(result.valid).toBe(true);
  // ADD: More specific checks
  expect(result.errors).toEqual([]);
  expect(result.user.email).toBe(userData.email.toLowerCase());
});

// 2. FIXING test setup/teardown
beforeEach(async () => {
  await database.clean(); // Fixed setup
  await database.seed(); // Fixed seed data
});

// 3. FIXING test implementation bugs (not expectations)
test('order total calculation', () => {
  const order = { items: [{ price: 10, qty: 2 }] };
  // const total = calculateTotal(oder); // Typo - FIX THIS
  const total = calculateTotal(order); // Fixed typo
  expect(total).toBe(20);
});

// 4. UPDATING assertions when requirements legitimately changed
// AND you have confirmation this is intentional
test('email validation', () => {
  // NEW REQUIREMENT: Now allow plus signs in email
  const result = validateEmail('user+tag@example.com');
  expect(result.valid).toBe(true); // Updated with approval
});
```

## LEGITIMATE REASONS TO MODIFY TEST EXPECTATIONS

### ✅ Change expectations ONLY when:

```
1. Requirements changed (confirmed with team/stakeholder)
2. Previous expectation was demonstrably wrong (with evidence)
3. Test was testing implementation detail, not behavior
4. Updating to match corrected understanding of feature

ALL of these require stopping and getting confirmation first.
```

### ❌ NEVER change expectations because:

```
1. Test is failing and you don't know why
2. Implementation is "too hard" to fix
3. You think different behavior would be better
4. Test is inconvenient
5. You want to "get tests passing quickly"
```

## WHAT TO DO WITH FAILING TESTS

### Process for handling failing test:

```
STEP 1: Understand why it's failing
- Read test expectations carefully
- Understand what behavior it's testing
- Run test and examine failure output
- Trace through implementation

STEP 2: Determine root cause
- Is implementation wrong?
- Is test expectation wrong?
- Is test setup wrong?
- Is it testing the right thing?

STEP 3: Take appropriate action

If implementation is wrong:
  ✅ Fix implementation to meet expectation
  
If test expectation is wrong:
  🛑 STOP and ask for guidance
  
If test setup is wrong:
  ✅ Fix test setup (not expectations)
  
If unsure:
  🛑 STOP and ask for guidance
```

## EXAMPLES OF PROPER HANDLING

### Example 1: Implementation bug

```javascript
// Test failing:
test('should sort products by price', () => {
  const products = [
    { name: 'A', price: 100 },
    { name: 'B', price: 50 }
  ];
  const sorted = sortByPrice(products);
  expect(sorted[0].name).toBe('B'); // FAILING - gets 'A'
});

// Analysis: Test expectation is correct, implementation is wrong
// Action: Fix sortByPrice implementation ✅

function sortByPrice(products) {
  // return products.sort((a, b) => b.price - a.price); // Wrong order
  return products.sort((a, b) => a.price - b.price); // Fixed
}
```

### Example 2: Test expectation seems wrong

```javascript
// Test failing:
test('should calculate discount', () => {
  const price = 100;
  const discount = calculateDiscount(price, 'SAVE20');
  expect(discount).toBe(25); // FAILING - gets 20
});

// Analysis: Implementation gives 20% discount (20), test expects 25
// This could be either:
// - Test wrong: Should expect 20
// - Implementation wrong: Should give 25% discount

// Action: STOP and ask ✅

🛑 "The discount test expects 25 but implementation returns 20.
This is a 20% discount on $100.
Should 'SAVE20' coupon be:
A) 20% discount (current implementation) 
B) $25 off (test expectation)
Which is correct?"
```

### Example 3: Test testing wrong thing

```javascript
// Test failing:
test('should save user', () => {
  const user = { name: 'John', email: 'john@example.com' };
  saveUser(user);
  // Testing implementation detail - wrong
  expect(database.insert).toHaveBeenCalledWith('users', user);
});

// Analysis: Test is testing implementation detail, not behavior
// Action: Fix test to test behavior ✅

test('should save user', async () => {
  const user = { name: 'John', email: 'john@example.com' };
  await saveUser(user);
  
  // Test behavior - can we retrieve the user?
  const saved = await getUser(user.email);
  expect(saved.name).toBe('John');
  expect(saved.email).toBe('john@example.com');
});
```

## RED FLAGS THAT YOU'RE FAKING TESTS

### Warning signs you might be faking:

```
🚨 You're about to:
- Remove a test that's "in the way"
- Comment out "problematic" assertions
- Change expectation without understanding why
- Add expect(true).toBe(true)
- Mock return value just to make test pass
- Change test to match current (buggy) behavior

If ANY of these apply: 🛑 STOP
```

## SUMMARY CHECKLIST

### Before modifying ANY test:

```
- [ ] I understand what this test is testing
- [ ] I understand why it's failing
- [ ] I've identified the root cause
- [ ] I know whether test or implementation is wrong
- [ ] If changing expectations: I have confirmation this is correct
- [ ] If unsure: I've stopped and asked for guidance
- [ ] I'm not removing/faking test to make suite pass

If ANY checkbox is unchecked: 🛑 STOP AND ASK
```