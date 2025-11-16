/**
 * Test setup file for Vitest with Svelte Testing Library
 * Configures global test utilities and matchers
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/svelte';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});
