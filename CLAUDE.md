# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build & Development
```bash
npm run dev                    # Development build with CSS compilation
npm run build                  # Production build with TypeScript check
npm run build:css              # Compile PostCSS styles
npm run build:css:watch        # Watch and compile CSS changes
```

### Testing
```bash
npm test                       # Run all tests (unit + e2e)
npm run test:unit              # Run unit tests only
npm run test:e2e               # Run e2e tests with xvfb (headless)
npm run test:e2e:windowed      # Run e2e tests with visible browser
npm run test:e2e:failed        # Rerun failed e2e tests
npm run test:coverage          # Unit tests with coverage report
npm run test:ui                # Vitest UI for unit tests
```

### Development Workflow
```bash
npm run dev:obsidian:install   # Install plugin to local Obsidian vault
npm run dev:obsidian:open_test_vault  # Open test vault in Obsidian
```

### Critical Testing Rules
- **E2E tests are primary**: This project prioritizes e2e tests over unit tests as they test real Obsidian API interactions
- **No mocking Obsidian APIs**: Unit tests must not mock Obsidian APIs - use e2e tests for Obsidian-dependent features
- **Smart waiting**: Never use fixed timeouts in tests - implement smart-waiting helpers instead
- **Use existing helpers**: Always check available test helpers before writing complex test code
- **Playwright transition**: New e2e tests must use Playwright only, not vitest+playwright

## Architecture Overview

### Core Architecture Pattern
The codebase follows a **Host-Extension-Entity** pattern:

1. **Host Abstraction** (`src/app/core/host.ts`): Defines environment-independent interface for running TaskSync in different platforms
2. **Extensions** (`src/app/extensions/`): Platform-specific implementations that handle entity persistence in their native format
3. **Core Entities** (`src/app/core/entities.ts`): Source-agnostic domain models with Zod validation

### Key Architectural Components

#### Main Application Layer
- `src/main.ts`: Obsidian plugin wrapper that creates ObsidianHost and initializes TaskSyncApp
- `src/app/App.ts`: Core application bootstrap class that manages initialization and shutdown
- `src/app/App.svelte`: Main Svelte component for the UI

#### Host-Extension Pattern
- **Host** (`src/app/hosts/ObsidianHost.ts`): Manages settings and canonical data persistence
- **Extension** (`src/app/extensions/ObsidianExtension.ts`): Handles Obsidian-specific entity representations (markdown files)
- **Extension Registry** (`src/app/core/extension.ts`): Manages extension lifecycle and registration

#### Entity Management
- **Core Entities** (`src/app/core/entities.ts`): Task, Project, Area schemas with Zod validation
- **Entity Operations** (`src/app/extensions/Obsidian*Operations.ts`): Platform-specific CRUD operations
- **Stores** (`src/app/stores/`): Svelte stores for reactive state management

#### Event System
- **Event Bus** (`src/app/core/events.ts`): Decoupled communication between components
- Extensions react to domain events (created/updated/deleted) to maintain their representations

### Project Structure
```
src/
├── main.ts                    # Obsidian plugin entry point
├── app/
│   ├── App.ts                 # Core application bootstrap
│   ├── App.svelte             # Main UI component
│   ├── core/                  # Core abstractions and domain models
│   │   ├── entities.ts        # Domain entity schemas (Task, Project, Area)
│   │   ├── host.ts            # Host abstraction interface
│   │   ├── extension.ts       # Extension system and registry
│   │   └── events.ts          # Event bus for decoupled communication
│   ├── hosts/                 # Host implementations
│   │   └── ObsidianHost.ts    # Obsidian-specific host implementation
│   ├── extensions/            # Platform-specific extensions
│   │   ├── ObsidianExtension.ts
│   │   ├── ObsidianAreaOperations.ts
│   │   └── ObsidianProjectOperations.ts
│   ├── stores/                # Svelte reactive stores
│   ├── components/            # Svelte UI components
│   └── modals/                # Obsidian modal implementations
tests/                         # Unit tests with Vitest
e2e/                          # End-to-end tests with Playwright
```

### Data Flow
1. **Host** loads settings and manages canonical entity storage
2. **Extensions** register with the extension registry and listen for domain events
3. **Core entities** are created/modified through domain operations
4. **Events** are triggered and extensions reactively update their representations
5. **UI** uses Svelte stores to display and interact with entities

### Key Design Principles
- **Host-agnostic core**: Core entities and business logic are independent of Obsidian
- **Extension pattern**: Platform-specific behavior is encapsulated in extensions
- **Event-driven**: Components communicate through events, not direct coupling
- **Reactive UI**: Svelte stores provide reactive state management
- **Validation-first**: All entities use Zod schemas for runtime type safety

### Development Context
- **Status**: In transition from pure Obsidian plugin to Svelte app with Obsidian extension
- **Previous code**: Moved to `old-stuff/` directory for reference
- **CSS**: Generated file - edit source files in `src/styles/` only
- **Testing focus**: E2E tests are prioritized over unit tests due to Obsidian API dependencies