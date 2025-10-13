---
type: "agent_requested"
description: "Obey these Svelte 5 guidelines when working on Svelte components"
---

# Svelte 5: A Practical Guide to Stores, Props, and Effects

## Introduction

Svelte 5 introduces a revolutionary approach to reactivity through **runes**, moving from compile-time to runtime reactivity. This guide provides clear examples and best practices for handling complex state management, particularly with nested settings objects, while addressing common pitfalls when working with stores, props, and effects.

## Stores vs. Runes in Svelte 5: When to Use What

### The Current State of Stores

While stores are **not deprecated** in Svelte 5, their use cases have significantly diminished. The Svelte team recommends using runes for most scenarios, with stores reserved for specific edge cases.

**When to use stores:**
- Complex asynchronous data streams (like WebSocket connections)
- When you need manual control over subscription lifecycles
- Integration with external libraries that expect observable patterns
- Start/stop notifiers for expensive operations

**When to use runes:**
- General state management (preferred approach)
- Shared state across components
- Computed values and derivations
- Most reactive scenarios

### Example: Settings Management with Runes

Let's explore a practical example with a complex settings object containing nested maps and arrays.

```typescript
// settings-store.svelte.ts
interface GitHubIntegration {
  enabled: boolean;
  token?: string;
  repositories: string[];
}

interface SlackIntegration {
  enabled: boolean;
  webhook?: string;
  channels: string[];
}

interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    desktop: boolean;
  };
  integrations: {
    github?: GitHubIntegration;
    slack?: SlackIntegration;
  };
  recentProjects: string[];
}

// Global settings using runes (recommended approach)
const defaultSettings: AppSettings = {
  theme: 'auto',
  notifications: {
    email: true,
    push: false,
    desktop: true
  },
  integrations: {},
  recentProjects: []
};

export const settings = $state<AppSettings>(defaultSettings);

// Derived values for specific parts of settings
export const githubIntegration = $derived(settings.integrations.github);
export const hasActiveIntegrations = $derived(
  Object.values(settings.integrations).some(integration => integration?.enabled)
);
export const notificationCount = $derived(
  Object.values(settings.notifications).filter(Boolean).length
);
```

## Understanding Svelte 5 Stores

### When Stores Are Still Appropriate

Despite the shift toward runes, stores remain valuable for specific scenarios:

```typescript
// async-data-store.ts - Complex async operations
import { writable, derived } from 'svelte/store';

interface ApiResponse<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function createAsyncStore<T>() {
  const { subscribe, set, update } = writable<ApiResponse<T>>({
    data: null,
    loading: false,
    error: null
  });

  return {
    subscribe,
    async fetch(url: string) {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const response = await fetch(url);
        const data = await response.json();
        set({ data, loading: false, error: null });
      } catch (error) {
        set({ data: null, loading: false, error: error.message });
      }
    },
    reset: () => set({ data: null, loading: false, error: null })
  };
}

export const userStore = createAsyncStore<User>();
```

### Migrating from Stores to Runes

Here's how to convert a traditional store to runes:

```typescript
// OLD: Traditional store approach
import { writable, derived } from 'svelte/store';

export const count = writable(0);
export const doubled = derived(count, $count => $count * 2);

// NEW: Runes approach (recommended)
// settings.svelte.ts
export const count = $state(0);
export const doubled = $derived(count * 2);

// Usage in components remains similar
```

## Effective Use of Derived Values

### Basic Derived Usage

Derived values automatically recalculate when their dependencies change:

```typescript
// settings-derived.svelte.ts
import { settings } from './settings-store.svelte';

// Simple derivations
export const isDarkMode = $derived(
  settings.theme === 'dark' ||
  (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
);

export const enabledNotifications = $derived(
  Object.entries(settings.notifications)
    .filter(([_, enabled]) => enabled)
    .map(([type]) => type)
);

// Complex derivations using $derived.by
export const integrationsSummary = $derived.by(() => {
  const integrations = settings.integrations;
  const active = Object.values(integrations).filter(integration => integration?.enabled);

  return {
    total: Object.keys(integrations).length,
    active: active.length,
    types: Object.keys(integrations).filter(key => integrations[key]?.enabled)
  };
});
```

### Components Reacting to Derived Values

```typescript
<!-- IntegrationsPanel.svelte -->
<script lang="ts">
  import { settings, githubIntegration, hasActiveIntegrations } from './settings-store.svelte';

  // This component automatically reacts to changes in derived values
  // No manual subscriptions needed!
</script>

{#if hasActiveIntegrations}
  <div class="integrations-panel">
    <h3>Active Integrations</h3>

    {#if githubIntegration?.enabled}
      <div class="integration-item">
        <span>GitHub</span>
        <span>{githubIntegration.repositories.length} repositories</span>
      </div>
    {/if}
  </div>
{:else}
  <p>No integrations configured</p>
{/if}
```

## Props and Bindings: When and How

### Understanding $bindable

The `$bindable` rune enables two-way data binding between parent and child components:

```typescript
<!-- SettingsInput.svelte -->
<script lang="ts">
  interface Props {
    label: string;
    value: $bindable<string>;
    placeholder?: string;
  }

  let { label, value = $bindable(), placeholder = '' }: Props = $props();
</script>

<label>
  {label}
  <input bind:value placeholder={placeholder} />
</label>
```

### When to Use Bindings vs. Callbacks

**Use bindings when:**
- You need true two-way data flow
- The child component should directly mutate parent state
- Working with form inputs or similar interactive elements

**Use callbacks when:**
- You want explicit control over state updates
- You need to validate or transform data before updating
- The relationship should be one-way (parent → child)

```typescript
<!-- GitHubSettings.svelte -->
<script lang="ts">
  import type { GitHubIntegration } from './types';

  interface Props {
    // Binding approach - direct mutation
    integration: $bindable<GitHubIntegration>;

    // OR callback approach - explicit control
    integration: GitHubIntegration;
    onUpdate: (integration: GitHubIntegration) => void;
  }

  // Choose one approach based on your needs
  let { integration = $bindable(), onUpdate }: Props = $props();

  function addRepository(repo: string) {
    // Binding approach
    integration.repositories = [...integration.repositories, repo];

    // OR Callback approach
    // onUpdate({
    //   ...integration,
    //   repositories: [...integration.repositories, repo]
    // });
  }
</script>
```

### Best Practices for Props

1. **Use bindings sparingly** - They can make data flow harder to track
2. **Prefer immutable updates** - Spread operators help maintain reactivity
3. **Type your props properly** - TypeScript catches errors early

```typescript
<!-- SettingsForm.svelte -->
<script lang="ts">
  import { settings } from './settings-store.svelte';

  // Bind to the entire settings object
  function updateTheme(newTheme: 'light' | 'dark' | 'auto') {
    settings.theme = newTheme; // Direct mutation works with runes
  }

  function toggleNotification(type: keyof typeof settings.notifications) {
    settings.notifications[type] = !settings.notifications[type];
  }
</script>

<div class="settings-form">
  <select value={settings.theme} onchange={e => updateTheme(e.target.value)}>
    <option value="light">Light</option>
    <option value="dark">Dark</option>
    <option value="auto">Auto</option>
  </select>

  <label>
    <input
      type="checkbox"
      checked={settings.notifications.email}
      onchange={() => toggleNotification('email')}
    />
    Email Notifications
  </label>
</div>
```

## The $effect Rune: When and How to Use It

### Understanding Effects

Effects run side effects in response to state changes. They should be used sparingly and only for actual side effects, not for derived computations.

**Use $effect for:**
- DOM manipulation that can't be done declaratively
- Starting/stopping timers or intervals
- Setting up event listeners
- Interacting with external APIs
- Logging or debugging

**Don't use $effect for:**
- Computing derived values (use `$derived` instead)
- Synchronizing state (use `$derived` instead)
- Simple reactive updates (Svelte handles this automatically)

### Practical Effect Examples

```typescript
<!-- SettingsManager.svelte -->
<script lang="ts">
  import { settings } from './settings-store.svelte';

  // GOOD: Persisting to localStorage
  $effect(() => {
    localStorage.setItem('app-settings', JSON.stringify(settings));
  });

  // GOOD: Setting up theme CSS variables
  $effect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  });

  // GOOD: Analytics tracking
  $effect(() => {
    if (settings.integrations.github?.enabled) {
      analytics.track('GitHub integration enabled');
    }
  });

  // BAD: Don't use effects for derived values!
  // let activeIntegrations = $state(0);
  // $effect(() => {
  //   activeIntegrations = Object.values(settings.integrations)
  //     .filter(integration => integration?.enabled).length;
  // });

  // GOOD: Use $derived instead
  const activeIntegrations = $derived(
    Object.values(settings.integrations)
      .filter(integration => integration?.enabled).length
  );
</script>
```

### Effect Cleanup and Best Practices

```typescript
<script lang="ts">
  import { settings } from './settings-store.svelte';

  // Cleanup example
  $effect(() => {
    const interval = setInterval(() => {
      console.log('Auto-saving settings...', settings);
    }, 30000);

    // Cleanup function
    return () => {
      clearInterval(interval);
    };
  });

  // Effect with specific dependencies
  $effect(() => {
    // Only runs when GitHub integration changes
    const github = settings.integrations.github;
    if (github?.enabled && github.token) {
      validateGitHubToken(github.token);
    }
  });
</script>
```

## Complete Example: Settings Management System

Here's a comprehensive example bringing everything together:

```typescript
// types.ts
export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    desktop: boolean;
  };
  integrations: {
    github?: {
      enabled: boolean;
      token?: string;
      repositories: string[];
    };
    slack?: {
      enabled: boolean;
      webhook?: string;
      channels: string[];
    };
  };
  recentProjects: string[];
}
```

```typescript
// settings.svelte.ts
import type { AppSettings } from './types';

const defaultSettings: AppSettings = {
  theme: 'auto',
  notifications: { email: true, push: false, desktop: true },
  integrations: {},
  recentProjects: []
};

// Global settings state
export const settings = $state<AppSettings>(defaultSettings);

// Derived values
export const activeIntegrationsCount = $derived(
  Object.values(settings.integrations)
    .filter(integration => integration?.enabled).length
);

export const githubRepositories = $derived(
  settings.integrations.github?.repositories || []
);

export const notificationPreferences = $derived(settings.notifications);
```

```typescript
<!-- App.svelte -->
<script lang="ts">
  import { settings, activeIntegrationsCount } from './settings.svelte';
  import SettingsPanel from './SettingsPanel.svelte';
  import IntegrationsList from './IntegrationsList.svelte';

  // Effect for persistence
  $effect(() => {
    localStorage.setItem('settings', JSON.stringify(settings));
  });

  // Effect for theme application
  $effect(() => {
    document.body.className = `theme-${settings.theme}`;
  });

  // Load settings on mount
  $effect(() => {
    const saved = localStorage.getItem('settings');
    if (saved) {
      Object.assign(settings, JSON.parse(saved));
    }
  });
</script>

<main>
  <header>
    <h1>Settings Demo</h1>
    <p>Active integrations: {activeIntegrationsCount}</p>
  </header>

  <SettingsPanel />
  <IntegrationsList />
</main>
```

```typescript
<!-- SettingsPanel.svelte -->
<script lang="ts">
  import { settings, notificationPreferences } from './settings.svelte';

  function toggleNotification(type: keyof typeof settings.notifications) {
    settings.notifications[type] = !settings.notifications[type];
  }
</script>

<section class="settings-panel">
  <h2>General Settings</h2>

  <label>
    Theme:
    <select bind:value={settings.theme}>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="auto">Auto</option>
    </select>
  </label>

  <fieldset>
    <legend>Notifications</legend>
    {#each Object.entries(notificationPreferences) as [type, enabled]}
      <label>
        <input
          type="checkbox"
          {enabled}
          onchange={() => toggleNotification(type)}
        />
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </label>
    {/each}
  </fieldset>
</section>
```

## Best Practices Summary

### State Management
1. **Prefer runes over stores** for most use cases
2. **Use stores for complex async operations** or when you need subscription control
3. **Keep state as flat as possible** while still being logical
4. **Use TypeScript** for better developer experience and error catching

### Derived Values
1. **Use $derived for computed values** instead of effects
2. **Prefer simple expressions** in `$derived()` when possible
3. **Use $derived.by() for complex computations** that need multiple statements
4. **Remember derived values are memoized** and only recalculate when dependencies change

### Props and Bindings
1. **Use $bindable sparingly** - only when true two-way binding is needed
2. **Prefer callbacks for most parent-child communication**
3. **Type your props properly** with TypeScript interfaces
4. **Consider the component's API design** - make it intuitive for consumers

### Effects
1. **Use effects only for actual side effects** (DOM manipulation, timers, external APIs)
2. **Always provide cleanup functions** when needed
3. **Keep effects simple and focused** on one concern
4. **Avoid effects for state synchronization** - use `$derived` instead
5. **Remember effects don't run during SSR** - plan accordingly

### Complex Settings Objects

For complex, nested settings objects like in our example:

1. **Use runes with direct mutation** rather than immutable patterns
2. **Create focused derived values** for specific parts of the settings
3. **Use effects for persistence and side effects** (localStorage, API calls)
4. **Structure components to consume specific slices** of the settings rather than passing the entire object
5. **Consider using the Context API** for deeply nested component trees

This approach provides excellent performance, maintainability, and developer experience while leveraging Svelte 5's strengths effectively.
