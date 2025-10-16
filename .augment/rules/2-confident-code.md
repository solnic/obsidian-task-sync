---
type: "always_apply"
---

# Confident Code - No Defensive Programming

## ABSOLUTE RULE: TRUST YOUR CONTRACTS

**Write code that trusts data structures and fails fast when contracts are violated.**

**NEVER write fallback chains or defensive value checking that hides bugs.**

## FORBIDDEN DEFENSIVE PATTERNS

### ❌ NEVER use fallback chains:

```javascript
// ABSOLUTELY FORBIDDEN:
const foo = data.foo || data.fooValue || data.foo_value || 'default';
const email = user.email || user.emailAddress || user.mail || '';
const id = response.data?.id || response.id || response.userId || generateId();
const name = obj.name || obj.title || obj.label || 'Unknown';

// These hide contract violations and make bugs invisible
```

### ❌ NEVER use defensive value checks everywhere:

```javascript
// FORBIDDEN - excessive defensive checks:
function processUser(user) {
  const name = user?.name || user?.userName || '';
  const email = user?.email || user?.emailAddress || '';
  const age = typeof user?.age === 'number' ? user.age : 0;
  
  if (name && email) {
    return { name, email, age };
  }
  return null;
}
```

### ✅ ALWAYS trust contracts and validate explicitly:

```javascript
// CORRECT - trust the contract:
function processUser(user) {
  // Validate at boundary
  if (!user.name) throw new ValidationError('name is required');
  if (!user.email) throw new ValidationError('email is required');
  if (typeof user.age !== 'number') throw new ValidationError('age must be number');
  
  // Now trust the structure
  return {
    name: user.name,
    email: user.email,
    age: user.age
  };
}
```

## DATA STRUCTURE CONFIDENCE

### ✅ Access properties directly:

```javascript
// API response contract: { data: { user: { id, email, profile: { name } } } }
function extractUserData(response) {
  // Trust the contract - access directly
  return {
    id: response.data.user.id,
    email: response.data.user.email,
    name: response.data.user.profile.name
  };
}
```

### ❌ Don't try multiple property paths:

```javascript
// FORBIDDEN - trying multiple paths:
function extractUserData(response) {
  const id = response?.data?.user?.id || 
            response?.user?.id || 
            response?.id ||
            null;
            
  const email = response?.data?.user?.email ||
                response?.user?.email ||
                response?.email ||
                '';
  
  return { id, email };
}
```

## VALIDATION AT BOUNDARIES ONLY

### ✅ Validate once at entry points:

```javascript
// API handler - validate at boundary
async function createUserHandler(req, res) {
  const { email, password, name } = req.body;
  
  // Validate at boundary
  if (!email) throw new ValidationError('email required');
  if (!password) throw new ValidationError('password required');
  if (!name) throw new ValidationError('name required');
  if (!email.includes('@')) throw new ValidationError('invalid email');
  
  // Now pass validated data confidently
  const user = await userService.create({ email, password, name });
  res.json({ user });
}

// Service - trust data is already validated
class UserService {
  async create(userData) {
    // Don't re-validate, trust the data
    const hashedPassword = await hash(userData.password);
    return database.users.insert({
      email: userData.email.toLowerCase(),
      password: hashedPassword,
      name: userData.name.trim()
    });
  }
}
```

### ❌ Don't validate everywhere:

```javascript
// FORBIDDEN - validating at every layer:
class UserService {
  async create(userData) {
    // Don't do this if already validated at boundary
    const email = userData?.email || userData?.emailAddress || '';
    const password = userData?.password || '';
    
    if (!email || !password) return null;
    
    // More defensive checks...
  }
}
```

## ERROR HANDLING PHILOSOPHY

### ✅ Let errors propagate naturally:

```javascript
// Business logic - no try-catch
function calculateOrderTotal(items) {
  if (!Array.isArray(items)) {
    throw new Error('items must be an array');
  }
  
  if (items.length === 0) {
    throw new Error('cannot calculate total for empty order');
  }
  
  // Trust items structure
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// Utility function - no try-catch
function formatCurrency(amount) {
  if (typeof amount !== 'number') {
    throw new Error('amount must be a number');
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

// API handler - catch only here for user-friendly response
async function orderHandler(req, res) {
  try {
    const total = calculateOrderTotal(req.body.items);
    const formatted = formatCurrency(total);
    res.json({ total: formatted });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      console.error('Order calculation error:', error);
      res.status(500).json({ error: 'Failed to process order' });
    }
  }
}
```

### ❌ Don't wrap everything in try-catch:

```javascript
// FORBIDDEN - try-catch everywhere:
function calculateOrderTotal(items) {
  try {
    const safeItems = Array.isArray(items) ? items : [];
    if (safeItems.length === 0) return 0;
    
    try {
      return safeItems.reduce((sum, item) => {
        try {
          const price = typeof item?.price === 'number' ? item.price : 0;
          const qty = typeof item?.quantity === 'number' ? item.quantity : 1;
          return sum + (price * qty);
        } catch (itemError) {
          return sum; // Silently ignore errors
        }
      }, 0);
    } catch (reduceError) {
      return 0;
    }
  } catch (error) {
    return 0;
  }
}
```

## TRY-CATCH USAGE RULES

### ✅ ONLY use try-catch for:

```
1. API/UI response handlers - hide internal errors from users
2. Background jobs - prevent crash, log for ops
3. Third-party integrations - handle external failures
4. Resource cleanup - ensure cleanup (try-finally)
```

### ❌ NEVER use try-catch for:

```
1. Business logic functions - let errors propagate
2. Utility functions - let errors propagate
3. Data transformations - let errors propagate  
4. Internal service calls - let errors propagate
5. Catch-and-rethrow without adding value
```

### ❌ FORBIDDEN: Pointless catch-and-rethrow:

```javascript
// FORBIDDEN - adds no value:
async function saveUser(user) {
  try {
    return await database.save(user);
  } catch (error) {
    console.error('Failed to save user:', error);
    throw error; // Pointless - just let it propagate
  }
}

// CORRECT - let it propagate:
async function saveUser(user) {
  return await database.save(user);
}
```

### ✅ VALID: Catch for user-friendly handling:

```javascript
// CORRECT - transforming error for user:
async function saveUser(user) {
  try {
    return await database.save(user);
  } catch (error) {
    if (error.code === 'DUPLICATE_KEY') {
      throw new ValidationError('User with this email already exists');
    }
    throw error; // Re-throw unexpected errors
  }
}
```

## NULL/UNDEFINED HANDLING

### ✅ Explicit checks when truly optional:

```javascript
function greetUser(user, greeting) {
  // greeting is truly optional - provide default
  const message = greeting || 'Hello';
  
  // user.name is required - don't use fallback
  if (!user.name) throw new Error('user.name is required');
  
  return `${message}, ${user.name}!`;
}
```

### ❌ Don't use fallbacks for required fields:

```javascript
// FORBIDDEN:
function greetUser(user, greeting) {
  const message = greeting || 'Hello';
  const name = user?.name || user?.userName || 'Guest'; // Hides missing required field
  return `${message}, ${name}!`;
}
```

## ASYNC OPERATIONS

### ✅ Let async errors propagate:

```javascript
// Service layer - no try-catch
async function updateUserProfile(userId, profileData) {
  if (!userId) throw new ValidationError('userId required');
  if (!profileData.email) throw new ValidationError('email required');
  
  // Let database errors propagate
  const updated = await database.users.update(userId, profileData);
  
  // Let notification errors propagate
  await emailService.sendProfileUpdateEmail(updated.email);
  
  return updated;
}

// API layer - catch for user response
async function profileUpdateHandler(req, res) {
  try {
    const updated = await updateUserProfile(req.params.id, req.body);
    res.json({ success: true, user: updated });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      console.error('Profile update failed:', error);
      res.status(500).json({ error: 'Update failed' });
    }
  }
}
```

### ❌ Don't swallow async errors:

```javascript
// FORBIDDEN:
async function updateUserProfile(userId, profileData) {
  try {
    const updated = await database.users.update(userId, profileData);
    
    // Don't silently swallow errors
    try {
      await emailService.sendProfileUpdateEmail(updated.email);
    } catch (emailError) {
      console.warn('Email failed:', emailError); // Swallowed
    }
    
    return updated;
  } catch (error) {
    console.error('Update failed:', error);
    return null; // Caller can't tell what went wrong
  }
}
```

## ANTI-PATTERNS SUMMARY

### ❌ ABSOLUTELY FORBIDDEN:

```javascript
// Fallback value chains
const x = a || b || c || d || 'default';

// Multiple property path attempts  
const y = obj?.path1?.val || obj?.path2?.val || obj?.val || '';

// Defensive type checking everywhere
const z = typeof val === 'number' ? val : 0;

// Excessive try-catch wrapping
try { /* every function */ } catch { return null; }

// Catch-and-rethrow without purpose
try { doThing(); } catch (e) { throw e; }

// Silent error swallowing
try { doThing(); } catch (e) { /* ignore */ }
```

### ✅ REQUIRED PATTERNS:

```javascript
// Direct property access
const x = data.foo; // Fails fast if missing

// Explicit validation at boundaries
if (!data.foo) throw new Error('foo required');
const x = data.foo; // Now safe

// Minimal try-catch at UI/API layers only
async function handler(req, res) {
  try {
    const result = await businessLogic(); // No try-catch in business logic
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Operation failed' });
  }
}

// Let errors propagate through internal layers
function utilityFunction() {
  return doThing(); // No try-catch, let it propagate
}
```