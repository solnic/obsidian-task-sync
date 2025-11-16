# Obsidian Task Sync Plugin - Development Guidelines

## Project Overview

This is an Obsidian plugin for task management that integrates with the Bases feature. The plugin provides:
- Quick task creation with template-aligned fields
- Project and area organization
- Integration with Obsidian's Bases for visualization
- Template support (native Obsidian and Templater plugin)

**Tech Stack:**
- TypeScript (ES6 target, ESNext modules)
- Svelte 5 for UI components
- Obsidian API
- esbuild for bundling
- Vitest for unit tests
- Playwright for end-to-end tests
- PostCSS for styling

## Architecture

### Directory Structure

```
src/
├── main.ts              # Main plugin class - entry point
├── app/
│   ├── stores/          # State management (Redux-like pattern)
│   ├── commands/        # Command implementations
│   ├── modals/          # UI modal components
│   ├── components/      # Reusable UI components
│   ├── core/            # Core functionality (events, entities, extensions)
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── styles/              # CSS/PostCSS styles
└── vendor/              # Third-party code

tests/
├── unit/                # Unit tests for utilities and services
├── app/                 # Tests for app logic
├── e2e/                 # End-to-end tests with Playwright
└── vault/               # Test vault for e2e tests
```

### Key Patterns

1. **Event-Driven Architecture**: The plugin uses an EventBus (`src/app/core/events.ts`) for loose coupling between components
2. **Store Pattern**: State management follows Redux-like patterns with actions and reducers
3. **NoteKit System**: A type-aware note processing system for structured data (tasks, projects, areas)
4. **Command Pattern**: Commands are implemented as separate classes extending a base Command class

## Development Workflow

### Setup

```bash
# Install dependencies (handles platform-specific packages)
npm install

# Build for production
npm run build
```

### Testing

```bash
# Run all tests (builds and runs both unit and e2e tests)
npm test

# Run only e2e tests (recommended - most functionality is covered here)
npm run test:e2e

# Re-run failed e2e tests
npm run test:e2e:failed

# Run only unit tests (rarely needed - covers very little)
npm run test:unit
```

**Important Testing Notes:**
- **E2E tests are the primary testing method** - Use Playwright with actual Obsidian instances
- **Unit tests cover very little** - Most functionality must be tested via e2e tests
- Test timeout is 10 seconds for both unit and hook timeouts
- Use `xvfb-maybe` for headless testing on Linux
- E2E debug artifacts are saved to `tests/e2e/debug/*`

### Build System

- **esbuild** bundles the plugin into `main.js`
- **PostCSS** processes styles from `src/styles/main.css` to `styles.css`
- **TypeScript** compilation is checked but not used for output (esbuild handles transpilation)
- External modules: obsidian, electron, CodeMirror, Lezer, Node.js built-ins
- Bundle format: CommonJS (required by Obsidian)
- Source maps: inline in development, none in production

### Scripts

Development helper scripts in `scripts/`:
- `dev-obsidian-install.sh` - Install plugin to Obsidian vault
- `dev-obsidian-open-test-vault.sh` - Open test vault in Obsidian
- `setup-dev.sh` - Set up development environment
- `setup-obsidian-playwright.sh` - Set up e2e testing
- `setup-headless-testing.sh` - Configure headless testing

## Code Style and Conventions

### TypeScript

- Use **strict type checking** (`noImplicitAny: true`)
- Prefer **interfaces** for public APIs and type definitions
- Use **type aliases** for unions and complex types
- Keep type definitions in `src/app/types/`
- Import from 'obsidian' for Obsidian API types

### Naming Conventions

- **Files**: camelCase for utilities, PascalCase for classes/components
- **Classes**: PascalCase (e.g., `EventBus`, `TaskStore`)
- **Interfaces**: PascalCase, no 'I' prefix (e.g., `Task`, not `ITask`)
- **Variables/functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Private members**: prefix with underscore (e.g., `_privateMethod`)

### Svelte Components

- Use **Svelte 5** syntax and features
- Component API compatibility set to 4
- CSS is injected (not extracted)
- Store Svelte components in `src/app/components/`
- Follow reactive programming patterns

### Error Handling

- Use try-catch blocks for async operations
- Log errors using console.error or Obsidian's Notice
- EventBus logs errors but continues processing other handlers
- Validate inputs before processing
- Use Zod for runtime validation where appropriate

## Obsidian Plugin Specifics

### Plugin Lifecycle

1. **onload()**: Initialize stores, register commands, set up event handlers
2. **onunload()**: Clean up resources, unregister handlers
3. **loadData()** / **saveData()**: Persist plugin settings

### Working with Obsidian API

- Access vault: `this.app.vault`
- Access workspace: `this.app.workspace`
- Access metadata cache: `this.app.metadataCache`
- Create notices: `new Notice(message)`
- Register commands: `this.addCommand()`
- Add settings tab: `this.addSettingTab()`

### Common Patterns

```typescript
// Reading a file
const file = this.app.vault.getAbstractFileByPath(path);
if (file instanceof TFile) {
  const content = await this.app.vault.read(file);
}

// Creating a file
await this.app.vault.create(path, content);

// Modifying a file
await this.app.vault.modify(file, newContent);

// Registering a command
this.addCommand({
  id: 'my-command',
  name: 'My Command',
  callback: () => { /* ... */ }
});
```

## Testing Guidelines

### E2E Tests (Primary Testing Method)

**All tests that require Obsidian MUST be implemented as e2e tests, not unit tests.**

- Use Playwright to automate actual Obsidian instances
- Tests run in real Obsidian environment for true integration testing
- Use `tests/vault/` for test data
- Debug artifacts are saved to `tests/e2e/debug/*` for troubleshooting
- Clean up after tests
- Handle async operations properly
- Most plugin functionality is and must be covered by e2e tests

#### E2E Test Best Practices

**NEVER use `page.waitForTimeout()` in e2e tests.** Fixed timeouts are unreliable and lead to flaky tests. Instead:

- ✅ Use `page.waitForSelector()` to wait for elements to appear/disappear
- ✅ Use `page.waitForFunction()` to wait for specific conditions
- ✅ Use helper functions like `waitForFileProcessed()`, `waitForNoticeDisappear()`, `waitForFileContentToContain()`
- ✅ Use `expect().toBeVisible()` and other Playwright assertions that auto-wait
- ❌ NEVER use `page.waitForTimeout()` - it's banned in test spec files

**Examples:**

```typescript
// ❌ BAD - Arbitrary timeout
await page.click('[data-testid="submit"]');
await page.waitForTimeout(1000);

// ✅ GOOD - Wait for specific condition
await page.click('[data-testid="submit"]');
await page.waitForSelector('.success-message', { state: 'visible' });

// ✅ GOOD - Wait for file to be processed
await createTask(page, { title: "My Task" });
await waitForFileProcessed(page, "Tasks/My Task.md");

// ✅ GOOD - Wait for notice to disappear
await expectNotice(page, "created successfully");
await waitForNoticeDisappear(page, "created successfully");
```

See `tests/e2e/HELPER_FUNCTIONS_GUIDE.md` for all available helper functions.

### Unit Tests (Rarely Needed)

**Unit tests cover very little in this project.** Use them only for isolated utility functions that don't require Obsidian.

- Place tests in `tests/unit/` or `tests/app/`
- Use descriptive test names
- Follow Arrange-Act-Assert pattern
- Use Chai assertions (expect syntax)
- **Never mock the Obsidian API for integration tests** - use e2e tests instead

```typescript
describe('Utility Function', () => {
  it('should do something specific', () => {
    // Arrange
    const input = createInput();
    
    // Act
    const result = processInput(input);
    
    // Assert
    expect(result).to.equal(expectedOutput);
  });
});
```

## Common Tasks

### Adding a New Command

1. Create command class in `src/app/commands/`
2. Extend base `Command` class
3. Implement `execute()` method
4. Register in `main.ts` via `this.addCommand()`
5. Add tests in `tests/app/commands/`

### Adding a New Modal

1. Create modal class in `src/app/modals/`
2. Extend Obsidian's `Modal` class
3. Implement `onOpen()` and `onClose()`
4. Use Svelte components for complex UI if needed
5. Test with e2e tests

### Modifying State

1. Define action types in `src/app/stores/actions.ts`
2. Add reducer logic in appropriate reducer file
3. Dispatch actions through store
4. Subscribe to store changes where needed
5. Add reducer tests

### Working with Templates

- Templates are detected from vault folders
- Support both native Obsidian templates and Templater
- Template variables use Handlebars syntax
- Template processing in `src/app/utils/` and NoteKit system

## Dependencies

### Production Dependencies

- **@octokit/rest**: GitHub API client
- **handlebars**: Template processing
- **js-yaml**: YAML parsing for frontmatter
- **moment**: Date manipulation
- **zod**: Runtime type validation
- **inflection**: String inflection utilities

### Development Dependencies

- **@playwright/test**: E2E testing
- **vitest**: Unit testing
- **@testing-library/svelte**: Svelte component testing
- **esbuild**: Bundler
- **typescript**: Type checking
- **postcss**: CSS processing

## Build Output

Plugin generates three files for distribution:
- `main.js` - Bundled plugin code
- `styles.css` - Compiled styles
- `manifest.json` - Plugin metadata

## Version Management

- Version is managed in `manifest.json`
- Use `npm run version` to bump version (updates both manifest.json and versions.json)
- Version bump script: `version-bump.mjs`

## Troubleshooting

### Common Issues

1. **Build errors**: Run `npm install` to ensure dependencies are current
2. **Test failures**: Check if tests are isolated and not dependent on order
3. **E2E timeouts**: Increase timeout or check for async operation completion
4. **PostCSS errors**: Ensure PostCSS and related plugins are installed

### Debug Tips

- **Run e2e tests** and check debug artifacts in `tests/e2e/debug/*` directory
- E2E tests save screenshots, logs, and failure information for debugging
- Check Obsidian's Developer Console (Ctrl+Shift+I) when running tests
- Use `debugger` statements in e2e tests for step-by-step debugging

## Best Practices

1. **Keep changes minimal**: Only modify what's necessary
2. **Write tests**: Add tests for new functionality
3. **Follow existing patterns**: Match the style of surrounding code
4. **Document complex logic**: Add comments for non-obvious code
5. **Handle errors gracefully**: Don't let errors crash the plugin
6. **Respect Obsidian API**: Follow Obsidian's patterns and conventions
7. **Test in real Obsidian**: E2E tests ensure real-world compatibility
8. **Keep bundle size small**: Be mindful of dependencies added
9. **Use TypeScript strictly**: Leverage type safety
10. **Clean up resources**: Always unregister handlers and close connections in onunload()

## Security Considerations

- Never commit API keys or secrets
- Validate all user inputs
- Sanitize file paths before file operations
- Be cautious with `eval()` or dynamic code execution
- Use Zod for runtime validation of external data

## Contributing

When making changes:
1. Create a feature branch
2. Make minimal, focused changes
3. Add/update tests
4. Ensure all tests pass (`npm test`)
5. Build successfully (`npm run build`)
6. Test in actual Obsidian if UI/UX changes
7. Update documentation if needed
8. Submit pull request with clear description
