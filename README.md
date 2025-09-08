# Obsidian Task Sync Plugin

A simple, focused task creation plugin for Obsidian that works seamlessly with the Bases feature for task management and visualization.

## Features

- **Quick Task Creation**: Simple modal for creating tasks with template-aligned fields
- **Bases Integration**: Designed to work perfectly with Obsidian's Bases feature for task visualization
- **Template Alignment**: Task structure matches your existing templates (Title, Type, Areas, Parent task, tags, Project, Done, Status, Priority)
- **Minimal Configuration**: Simple settings for folder paths and template preferences
- **No Sync Complexity**: Relies on Bases for automatic syncing and data management

## Installation

### Manual Installation

1. Download the latest release from the GitHub releases page
2. Extract the files to your vault's `.obsidian/plugins/obsidian-task-sync/` directory
3. Enable the plugin in Obsidian's Community Plugins settings

### Development Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the plugin
4. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugin directory

## Usage

### Commands

- **Add Task**: Create a new task with a simple modal form that matches your template structure

### Settings

Configure the plugin through Settings > Community Plugins > Task Sync:

- **Folder Locations**: Set custom folders for tasks, projects, and areas
- **Template Settings**: Configure template folder and Templater integration

### Working with Bases

This plugin is designed to work with Obsidian's Bases feature:

1. Create tasks using the plugin's "Add Task" command
2. Set up Bases to visualize and manage your tasks (e.g., Kanban boards, tables)
3. Use Bases for filtering, sorting, and organizing your task data
4. Edit tasks directly in Obsidian or through Bases interface

**Note**: There's no Bases API yet, so you'll need to set up your Bases manually for now.

## Development

### Prerequisites

- Node.js 18+
- npm

### Quick Setup

```bash
# Set up development environment (handles cross-platform dependencies)
./setup-dev.sh

# Install plugin to Obsidian
./install-plugin.sh

# Make changes and update plugin
./update-plugin.sh
```

### Manual Setup

```bash
# Install dependencies
npm install

# Build for development (with watch mode)
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run e2e tests
npm run test:e2e
```

### Cross-Platform Development

This plugin supports development on both macOS and Linux. The scripts automatically handle platform-specific dependencies:

- **`./setup-dev.sh`** - Sets up development environment for current platform
- **`./install-plugin.sh`** - Installs plugin to Obsidian vault
- **`./update-plugin.sh`** - Quick update during development

**Note**: If you switch between platforms (e.g., develop on macOS then test on Linux), run `./setup-dev.sh` again to reinstall platform-specific dependencies.

### Testing

The plugin includes comprehensive test coverage:

- **Unit Tests**: Test individual components and functions
- **Integration Tests**: Test plugin lifecycle and settings
- **E2E Tests**: Test the plugin in a real Obsidian environment using Playwright

### Project Structure

```
src/
├── main.ts              # Main plugin class
├── types/               # TypeScript type definitions
├── services/            # Business logic services
├── components/          # UI components
└── utils/               # Utility functions

tests/
├── setup.ts             # Test configuration
├── __mocks__/           # Mock implementations
└── *.test.ts            # Unit tests

e2e/
├── global-setup.ts      # E2E test setup
├── global-teardown.ts   # E2E test cleanup
└── *.e2e.ts             # End-to-end tests
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Roadmap

### Phase 1: Infrastructure & Configuration ✅ COMPLETE
- [x] TypeScript project structure with modern build tools
- [x] Plugin manifest and basic class with lifecycle methods
- [x] Settings interface and persistence with validation
- [x] Testing infrastructure with Vitest and Playwright

### Phase 2: Data Model & Detection ✅ COMPLETE
- [x] Task, Project, and Area entity interfaces with comprehensive properties
- [x] Vault scanning service with folder detection and file parsing
- [x] Base file parser and creator for Obsidian Bases integration
- [x] Template detection for native Obsidian and Templater plugin

### Phase 3: UI Components
- [ ] Dashboard modal
- [ ] Task creation/editing forms
- [ ] Project and area management

### Phase 4: Command System
- [ ] Command implementations
- [ ] Hotkey bindings
- [ ] Context menus

### Phase 5: Bases Integration
- [ ] Automatic base file generation
- [ ] Kanban view compatibility
- [ ] Filtering and sorting

### Phase 6: Template System
- [ ] Native template support
- [ ] Templater integration
- [ ] Variable injection

### Phase 7: Advanced Features
- [ ] Task dependencies
- [ ] Reminder system
- [ ] Reporting dashboard

### Phase 8: Polish & Release
- [ ] Performance optimization
- [ ] Documentation
- [ ] Community store submission
