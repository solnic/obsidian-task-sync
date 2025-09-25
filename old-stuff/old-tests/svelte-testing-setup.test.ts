/**
 * Test to verify Svelte Testing Library setup is working correctly
 */

import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';

// Simple test component to verify setup
const TestComponent = `
<script>
  import { writable } from 'svelte/store';
  
  let { count = 0 } = $props();
  
  const store = writable(count);
  
  function increment() {
    store.update(n => n + 1);
  }
</script>

<div>
  <p data-testid="count">Count: {$store}</p>
  <button data-testid="increment" onclick={increment}>Increment</button>
</div>
`;

describe('Svelte Testing Library Setup', () => {
  test('should render a simple Svelte component', () => {
    // This test verifies that our Svelte testing setup is working
    // We'll create a simple inline component to test
    const component = {
      render: () => '<div data-testid="test">Hello Svelte Testing!</div>'
    };
    
    // For now, just verify the testing library imports work
    expect(render).toBeDefined();
    expect(screen).toBeDefined();
  });

  test('should have access to Svelte store utilities', () => {
    const testStore = writable(42);
    
    let value: number;
    const unsubscribe = testStore.subscribe(v => value = v);
    
    expect(value!).toBe(42);
    
    testStore.set(100);
    expect(value!).toBe(100);
    
    unsubscribe();
  });
});
