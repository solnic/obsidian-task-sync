---
type: "agent_requested"
description: "Example description"
---

# UI Components - Design System Integration

## UI DEVELOPMENT APPROACH
**Build reusable components following established design patterns, avoid one-off implementations.**

### Component Development Priority:
1. **Look for existing patterns** before creating new components
2. **Extend existing components** when possible
3. **Create new base components** only when no pattern exists
4. **Follow established naming** and file organization

## REUSABLE COMPONENT MINDSET

### ✅ GOOD - Pattern identification:
```tsx
// Instead of creating one-off cards:
<div className="bg-white p-4 rounded shadow">
  <h3>{user.name}</h3>
  <p>{user.email}</p>
</div>

// Create reusable Card component:
<Card>
  <Card.Header>
    <Card.Title>{user.name}</Card.Title>
    <Card.Subtitle>{user.email}</Card.Subtitle>
  </Card.Header>
</Card>

// Reuse for different content:
<Card>
  <Card.Header>
    <Card.Title>{product.name}</Card.Title>
    <Card.Subtitle>${product.price}</Card.Subtitle>
  </Card.Header>
  <Card.Content>
    <Badge variant="success">In Stock</Badge>
  </Card.Content>
</Card>
```

### Common reusable patterns to identify:
- **Cards/Panels** for content containers
- **Buttons** with consistent variants
- **Form controls** (Input, Select, TextArea)
- **Modal/Dialog** components
- **Navigation** elements
- **Data display** (Table, List, Grid)
- **Status indicators** (Badge, Chip, Alert)

## DESIGN SYSTEM INTEGRATION

### Use design tokens consistently:
```css
/* Design tokens */
:root {
  --color-primary-500: #3b82f6;
  --color-gray-50: #f9fafb;
  --color-gray-900: #111827;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --border-radius: 0.375rem;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}

/* Component using design tokens */
.card {
  background: var(--color-gray-50);
  padding: var(--spacing-md);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
}

.card__title {
  color: var(--color-gray-900);
  font-size: var(--font-size-lg);
  margin-bottom: var(--spacing-sm);
}

.btn--primary {
  background: var(--color-primary-500);
  color: white;
  padding: var(--spacing-sm) var(--spacing-md);
}
```

### Component theming:
```tsx
// Theme-aware Button component
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'md', children }: ButtonProps) {
  return (
    <button className={`btn btn--${variant} btn--${size}`}>
      {children}
    </button>
  );
}

// Easy global theme changes
:root {
  --color-primary-500: #10b981; /* Changes all primary buttons */
}
```

## FILE ORGANIZATION

### Structure matches UI hierarchy:
```
src/components/
├── ui/                    # Base design system
│   ├── Button/
│   ├── Card/
│   ├── Input/
│   └── Modal/
├── layout/               # Layout components
│   ├── Header/
│   ├── Sidebar/
│   └── Footer/
└── features/            # Feature-specific
    ├── UserProfile/
    ├── ProductCatalog/
    └── OrderHistory/
```

### Component naming matches UI purpose:
```tsx
✅ GOOD - Descriptive names:
<PrimaryButton>Submit Order</PrimaryButton>
<ProductCard product={item} />
<UserProfileModal user={user} />
<NavigationSidebar />

❌ BAD - Generic names:
<BlueButton>Submit Order</BlueButton>
<ItemBox product={item} />
<PopupWindow user={user} />
<LeftPanel />
```

## AVOID CSS BLOAT

### Use composition over custom variants:
```tsx
✅ GOOD - Flexible composition:
<Card>
  <div className="flex items-center gap-3">
    <Avatar src={user.avatar} size="md" />
    <div>
      <h3 className="font-semibold">{user.name}</h3>
      <p className="text-gray-600">{user.title}</p>
    </div>
    <Badge variant="success">Online</Badge>
  </div>
</Card>

❌ BAD - Specific variants:
<UserCardWithAvatarAndBadge
  user={user}
  showAvatar={true}
  avatarSize="md"
  badgeType="success"
  badgeText="Online"
/>
```

### Utility classes for spacing and layout:
```css
/* Utility classes */
.flex { display: flex; }
.items-center { align-items: center; }
.gap-3 { gap: var(--spacing-md); }
.font-semibold { font-weight: 600; }
.text-gray-600 { color: var(--color-gray-600); }
```

## MODERN CSS PRACTICES

### CSS Modules or styled-components:
```tsx
// CSS Modules approach
import styles from './Button.module.css';

export function Button({ variant, children }: ButtonProps) {
  return (
    <button className={`${styles.btn} ${styles[`btn--${variant}`]}`}>
      {children}
    </button>
  );
}

// Styled-components approach
const StyledButton = styled.button<{ variant: string }>`
  padding: var(--spacing-sm) var(--spacing-md);
  background: ${props => `var(--color-${props.variant}-500)`};
  border-radius: var(--border-radius);
`;
```

## ANTI-PATTERNS TO AVOID

### ❌ NEVER do these:
- Create one-off styled components for similar elements
- Use hardcoded colors/spacing instead of design tokens
- Mix different styling approaches in same project
- Create overly specific component variants
- Duplicate styles across components

### ✅ ALWAYS do these:
- Look for patterns before writing new components
- Use design tokens for all styling values
- Compose complex UI from simple reusable pieces
- Follow established naming conventions
- Keep component APIs simple and focused
