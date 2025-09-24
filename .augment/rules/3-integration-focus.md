---
type: "always_apply"
---

# Outside-In BDD - Real Integration Testing

## TEST APPROACH PHILOSOPHY
**Start with real user behavior, use real implementations, avoid excessive mocking.**

### BDD Test Hierarchy:
1. **Integration tests** - Real user scenarios with real dependencies
2. **Component tests** - Key business logic with minimal mocking
3. **Unit tests** - Only for pure functions and complex algorithms

## START WITH REAL INTEGRATION TESTS

### ✅ GOOD - Real integration approach:
```typescript
// Test real user flow with real database, real API calls
describe('User Registration Flow', () => {
  beforeEach(async () => {
    // Use real test database
    await testDb.migrate.latest();
    await testDb.seed.run();
  });

  test('user can register and immediately log in', async () => {
    // Test the complete real flow
    const registrationResponse = await request(app)
      .post('/api/users/register')
      .send({
        email: 'newuser@example.com',
        password: 'secure123',
        name: 'Test User'
      });

    expect(registrationResponse.status).toBe(201);
    expect(registrationResponse.body.user.email).toBe('newuser@example.com');

    // Verify user was actually created in database
    const user = await testDb('users').where({ email: 'newuser@example.com' }).first();
    expect(user).toBeDefined();
    expect(user.name).toBe('Test User');

    // Test immediate login works
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'newuser@example.com',
        password: 'secure123'
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.token).toBeDefined();
  });
});
```

### ❌ BAD - Over-mocked unit test approach:
```typescript
// Don't start with heavily mocked isolated tests
describe('UserService', () => {
  test('register calls database and email service', () => {
    const mockDb = { insert: jest.fn().mockResolvedValue({ id: 1 }) };
    const mockEmailService = { sendWelcomeEmail: jest.fn() };
    const mockHasher = { hash: jest.fn().mockReturnValue('hashedpass') };

    const userService = new UserService(mockDb, mockEmailService, mockHasher);

    userService.register({ email: 'test@test.com', password: 'pass' });

    expect(mockDb.insert).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'hashedpass'
    });
    expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalled();
  });
});
```

## MINIMAL STRATEGIC MOCKING

### ONLY mock external systems you don't control:
✅ Third-party payment APIs (Stripe, PayPal)
✅ External email services (SendGrid, Mailgun)
✅ Cloud storage services (AWS S3, Google Cloud)
✅ Time-dependent behavior (Date.now(), timers)

### NEVER mock your own systems:
❌ Your own database repositories
❌ Your own service classes
❌ Your own business logic functions
❌ Your own API endpoints

### Use real implementations with test configurations:
```typescript
// Use real database with test config
const testDbConfig = {
  client: 'sqlite3',
  connection: ':memory:',
  migrations: { directory: './migrations' }
};

// Use real email service in test mode
const emailService = new EmailService({
  provider: 'test', // Captures emails instead of sending
  apiKey: 'test-key'
});

// Use real file storage with temp directory
const fileStorage = new FileStorage({
  basePath: path.join(__dirname, 'tmp'),
  cleanup: true
});
```

## TEST DATA MANAGEMENT

### Create realistic, reusable test data:
```typescript
// Test data factories that create realistic data
const createTestUser = (overrides = {}) => ({
  email: 'user@example.com',
  password: 'secure123',
  firstName: 'Test',
  lastName: 'User',
  dateOfBirth: '1990-01-01',
  ...overrides
});

const createTestProduct = (overrides = {}) => ({
  name: 'Test Product',
  description: 'A test product for testing',
  price: 29.99,
  category: 'electronics',
  inStock: true,
  ...overrides
});

// Use in tests with variations
test('user can purchase available product', async () => {
  const user = await createUserInDb(createTestUser());
  const product = await createProductInDb(createTestProduct({ price: 49.99 }));

  // Test real purchase flow
  const response = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${user.token}`)
    .send({
      productId: product.id,
      quantity: 1
    });

  expect(response.status).toBe(201);

  // Verify real side effects
  const order = await testDb('orders').where({ userId: user.id }).first();
  expect(order.total).toBe(49.99);
});
```

## WHEN TO ADD LOWER-LEVEL TESTS

### Add component/service tests for:
- **Complex business logic** that needs isolation
- **Algorithm implementations** with many edge cases
- **Validation rules** with multiple scenarios
- **Data transformations** with complex rules

### Add unit tests only for:
- **Pure functions** with no dependencies
- **Mathematical calculations**
- **String/data parsing utilities**
- **Complex conditional logic**

### Example progression:
```typescript
// 1. Start with integration test
test('order total calculation includes tax and shipping', async () => {
  const response = await request(app)
    .post('/api/orders/calculate')
    .send({
      items: [{ productId: 1, quantity: 2, price: 25.00 }],
      shippingAddress: { country: 'US', state: 'CA' }
    });

  expect(response.body.subtotal).toBe(50.00);
  expect(response.body.tax).toBe(4.13); // CA tax rate
  expect(response.body.shipping).toBe(5.99);
  expect(response.body.total).toBe(60.12);
});

// 2. Add component test if business logic is complex
describe('OrderCalculator', () => {
  test('calculates CA tax correctly for different amounts', () => {
    const calculator = new OrderCalculator();

    expect(calculator.calculateTax(100, 'CA')).toBe(8.25);
    expect(calculator.calculateTax(50, 'CA')).toBe(4.13);
    expect(calculator.calculateTax(25, 'CA')).toBe(2.06);
  });
});

// 3. Only add unit test if algorithm is complex
describe('taxRateCalculator', () => {
  test('handles complex multi-jurisdiction tax rules', () => {
    // Only if tax calculation itself is very complex
    expect(calculateTaxRate('CA', 'San Francisco', 'digital')).toBe(0.0875);
  });
});
```

## ANTI-PATTERNS TO AVOID

### ❌ NEVER start with these patterns:
- **Mock-heavy unit tests** before integration tests
- **Isolated component testing** without real dependencies
- **Complex test setup** that doesn't reflect real usage
- **Testing implementation details** instead of user behavior
- **Mocking your own business logic**

### ✅ ALWAYS start with these patterns:
- **Real user scenarios** end-to-end
- **Real database** with test data
- **Real API calls** through your application
- **Real file system** with temp directories
- **Behavior verification** not implementation details
