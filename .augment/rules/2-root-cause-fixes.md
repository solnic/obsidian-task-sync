---
type: "always_apply"
---

# Root Cause Solutions - No Workarounds or Defensive Code

## CRITICAL PRINCIPLE
**Always fix the root cause of problems. Never implement workarounds that hide bugs.**

**Write confident code that trusts contracts and fails clearly when assumptions are violated.**

## ROOT CAUSE FIXING - MANDATORY APPROACH

### ✅ CORRECT - Fix the actual problem:
```javascript
// Bug: Function crashes when array contains null values
function calculateAverage(numbers) {
  // ROOT CAUSE FIX: Handle null/undefined values properly
  const validNumbers = numbers.filter(n => typeof n === 'number' && !isNaN(n));

  if (validNumbers.length === 0) {
    throw new Error('Cannot calculate average: no valid numbers provided');
  }

  const sum = validNumbers.reduce((acc, num) => acc + num, 0);
  return sum / validNumbers.length;
}
```

### ❌ FORBIDDEN - Workarounds that hide the problem:
```javascript
// Don't wrap in try-catch to hide the issue
function calculateAverage(numbers) {
  try {
    return numbers.reduce((acc, num) => acc + num, 0) / numbers.length;
  } catch (error) {
    console.warn('Average calculation failed, returning 0:', error);
    return 0; // Hides the root cause
  }
}

// Don't return default values silently
function calculateAverage(numbers) {
  if (!numbers || !Array.isArray(numbers)) {
    return 0; // Silent failure - calling code doesn't know there was a problem
  }
  // ... rest of buggy implementation unchanged
}
```

## CONFIDENT ERROR HANDLING

### ✅ TRUST your contracts and fail fast:
```javascript
function processOrder(order) {
  // Validate inputs explicitly and fail fast
  if (!order) {
    throw new ValidationError('Order is required');
  }

  if (!order.items || order.items.length === 0) {
    throw new ValidationError('Order must contain at least one item');
  }

  if (typeof order.customerId !== 'string') {
    throw new ValidationError('Customer ID must be a string');
  }

  // Confidently process with validated data
  const total = order.items.reduce((sum, item) => sum + item.price, 0);

  return {
    orderId: generateOrderId(),
    customerId: order.customerId,
    total,
    status: 'pending'
  };
}
```

### ❌ DEFENSIVE programming that hides bugs:
```javascript
function processOrder(order) {
  // Don't add excessive defensive checks
  const safeOrder = order || {};
  const items = Array.isArray(safeOrder.items) ? safeOrder.items : [];
  const customerId = safeOrder.customerId || safeOrder.customer_id || 'unknown';

  try {
    const total = items.reduce((sum, item) => {
      const price = typeof item?.price === 'number' ? item.price : 0;
      return sum + price;
    }, 0);

    return {
      orderId: generateOrderId() || 'unknown',
      customerId,
      total: total || 0,
      status: 'pending'
    };
  } catch (error) {
    console.error('Order processing failed:', error);
    return { error: 'Processing failed' }; // Hides what actually went wrong
  }
}
```

## DATA STRUCTURE CONFIDENCE

### ✅ TRUST your API contracts:
```javascript
// API contract: { user: { profile: { email: string, name: string } } }
function extractUserInfo(apiResponse) {
  // Trust the contract - access properties directly
  return {
    email: apiResponse.user.profile.email,
    name: apiResponse.user.profile.name,
    displayName: `${apiResponse.user.profile.name} (${apiResponse.user.profile.email})`
  };
}
```

### ❌ FALLBACK chains that hide contract violations:
```javascript
function extractUserInfo(apiResponse) {
  // Don't try multiple possible property paths
  const email = apiResponse?.user?.profile?.email ||
                apiResponse?.user?.email ||
                apiResponse?.email ||
                apiResponse?.data?.email ||
                'unknown@example.com';

  const name = apiResponse?.user?.profile?.name ||
               apiResponse?.user?.name ||
               apiResponse?.name ||
               apiResponse?.displayName ||
               apiResponse?.user?.firstName + ' ' + apiResponse?.user?.lastName ||
               'Unknown User';

  return { email, name, displayName: `${name} (${email})` };
}
```

## BUG FIXING METHODOLOGY

### Step 1: Reproduce the exact bug
```javascript
// Bug report: "Sorting fails when products have null prices"

// REPRODUCE: Write test that demonstrates the exact failure
test('should sort products with null prices correctly', () => {
  const products = [
    { name: 'Product A', price: 100 },
    { name: 'Product B', price: null },
    { name: 'Product C', price: 50 }
  ];

  const result = sortProductsByPrice(products, 'asc');

  // This should work but currently fails
  expect(result).toEqual([
    { name: 'Product C', price: 50 },
    { name: 'Product A', price: 100 },
    { name: 'Product B', price: null } // nulls should sort to end
  ]);
});
```

### Step 2: Fix the root cause
```javascript
function sortProductsByPrice(products, direction) {
  return products.sort((a, b) => {
    // ROOT CAUSE FIX: Handle null prices explicitly
    if (a.price === null && b.price === null) return 0;
    if (a.price === null) return 1; // null sorts to end
    if (b.price === null) return -1; // null sorts to end

    return direction === 'asc' ? a.price - b.price : b.price - a.price;
  });
}
```

### ❌ Don't implement workarounds:
```javascript
function sortProductsByPrice(products, direction) {
  // DON'T filter out problematic data
  const validProducts = products.filter(p => p.price !== null);
  return validProducts.sort((a, b) => a.price - b.price);

  // DON'T wrap in try-catch to hide the issue
  try {
    return products.sort((a, b) => a.price - b.price);
  } catch (error) {
    console.warn('Sort failed, returning original order');
    return products;
  }
}
```

## ASYNC ERROR HANDLING

### ✅ PROPAGATE errors clearly:
```javascript
async function saveUserProfile(userId, profileData) {
  // Validate inputs
  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  if (!profileData.email) {
    throw new ValidationError('Email is required in profile data');
  }

  // Let database errors propagate - they indicate real problems
  const updatedUser = await database.updateUser(userId, profileData);

  // Let notification errors propagate - calling code should handle
  await notificationService.sendProfileUpdateNotification(userId);

  return updatedUser;
}
```

### ❌ Don't swallow errors or use workarounds:
```javascript
async function saveUserProfile(userId, profileData) {
  try {
    // Don't use fallback values for required data
    const safeUserId = userId || 'anonymous';
    const safeEmail = profileData?.email || 'noemail@example.com';

    try {
      const result = await database.updateUser(safeUserId, {
        ...profileData,
        email: safeEmail
      });

      // Don't silently ignore notification failures
      try {
        await notificationService.sendProfileUpdateNotification(safeUserId);
      } catch (notificationError) {
        console.warn('Notification failed:', notificationError);
        // Swallowing this error - calling code doesn't know about failure
      }

      return result;
    } catch (dbError) {
      console.error('Database update failed:', dbError);
      return null; // Caller can't distinguish between different failure types
    }
  } catch (error) {
    console.error('Profile save failed:', error);
    return { success: false }; // Generic response hides actual error
  }
}
```

## VALIDATION STRATEGIES

### ✅ EXPLICIT validation at boundaries:
```javascript
function createUser(userData) {
  // Validate all required fields explicitly
  const requiredFields = ['email', 'password', 'firstName', 'lastName'];

  for (const field of requiredFields) {
    if (!userData[field]) {
      throw new ValidationError(`${field} is required`);
    }
  }

  // Validate field formats explicitly
  if (!userData.email.includes('@')) {
    throw new ValidationError('Email must be valid format');
  }

  if (userData.password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }

  // Proceed confidently with validated data
  return new User({
    email: userData.email.toLowerCase(),
    password: hashPassword(userData.password),
    firstName: userData.firstName.trim(),
    lastName: userData.lastName.trim()
  });
}
```

### ❌ Don't use defensive fallbacks:
```javascript
function createUser(userData) {
  // Don't use fallback values for required data
  const email = userData?.email || userData?.emailAddress || '';
  const password = userData?.password || userData?.pass || 'defaultpass';
  const firstName = userData?.firstName || userData?.fName || 'Unknown';

  // Don't wrap validation in try-catch
  try {
    if (email && email.includes('@') && password.length >= 6) {
      return new User({
        email: email.toLowerCase(),
        password: hashPassword(password),
        firstName,
        lastName: userData?.lastName || ''
      });
    }
  } catch (error) {
    console.warn('User creation failed, using defaults:', error);
    return new User({
      email: 'default@example.com',
      password: 'defaultpass',
      firstName: 'Unknown'
    });
  }

  return null;
}
```

## ANTI-PATTERNS SUMMARY

### ❌ NEVER implement these patterns:
- **Try-catch wrapping** to hide errors instead of fixing root cause
- **Fallback value chains** that hide missing required data
- **Silent failure returns** (null, false, empty) without throwing errors
- **Default value substitution** for required fields
- **Multiple property path attempts** instead of trusting contracts
- **Filtering out problematic data** instead of handling it correctly
- **Generic error responses** that hide specific failure reasons

### ✅ ALWAYS implement these patterns:
- **Explicit input validation** with specific error messages
- **Root cause fixes** that address the actual problem
- **Contract trust** with direct property access
- **Fast failure** when assumptions are violated
- **Error propagation** to appropriate handling layers
- **Specific error types** for different failure modes
- **Clear success/failure paths** with no ambiguity
