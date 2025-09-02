# Obsidian Task Sync Plugin

A comprehensive task management plugin for Obsidian that implements GTD (Getting Things Done) methodology with project and area organization.

## Features

- **Task Management**: Create, edit, and organize tasks with deadlines and status tracking
- **Project Organization**: Group related tasks into projects with templates
- **Area Management**: Organize projects and tasks by life/work areas
- **Template Integration**: Support for both native Obsidian templates and Templater plugin
- **Bases Integration**: Automatic generation of .base files for Kanban-style views
- **Settings Persistence**: Configurable folder locations and sync preferences

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

- **Open Task Dashboard**: View all tasks, projects, and areas in a unified interface
- **Add Task**: Create a new task with deadline and project assignment
- **Add Project**: Create a new project with template selection
- **Add Area**: Create a new area for organizing projects

### Settings

Configure the plugin through Settings > Community Plugins > Task Sync:

- **Folder Locations**: Set custom folders for tasks, projects, and areas
- **Template Settings**: Configure template folder and Templater integration
- **Sync Options**: Enable auto-sync and set sync intervals

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

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

### Phase 1: Infrastructure & Configuration ✅
- [x] TypeScript project structure
- [x] Plugin manifest and basic class
- [x] Settings interface and persistence
- [x] Testing infrastructure

### Phase 2: Data Model & Detection
- [ ] Task, Project, and Area entities
- [ ] Vault scanning service
- [ ] Base file parser and creator
- [ ] Template detection

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
