# Task Sync Plugin - Project Specification

## Overview

**Task Sync** is a modern Obsidian plugin providing a robust, flexible framework for managing tasks, projects, and areas. The plugin leverages Obsidian's new Bases feature to enable powerful task management workflows and database-like views. Locations of data files and directories (tasks, projects, areas) are fully configurable, so any organizational method is supported. Templatesâ€”both native and via Templaterâ€”are deeply integrated for content automation and consistency.

## Project Goals

- Centralize management of tasks, projects, and areas
- Focus on intuitive task creation, tracking, and updating
- Provide commands for quickly managing tasks, with extensive configurability
- Integrate with Obsidian's template system and Templater plugin
- Fully leverage Obsidian Bases, including future Kanban view

---

## System Architecture

### Main Concepts
- **Tasks**: Core unit to track actionable items, with properties like status, deadline, assignment, and tags
- **Projects**: Grouping of related tasks, configurable storage location
- **Areas**: Broad categories or contexts for projects/tasks, configurable location
- **Configurable Data Roots**: All folder/file locations for these entities are user configurable in plugin settings

Example Structure (configurable):
```
- tasks/
  - tasks.base
- projects/
  - Project A/
- areas/
  - Area X/
```

---

## Technical Stack

- **Obsidian API**: [https://docs.obsidian.md/](https://docs.obsidian.md/)[10]
- **TypeScript**
- **Modern plugin template/generator**[12]

### Key APIs
- Plugin class, app, vault, workspace[10]
- MetadataCache for file metadata[10]
- Modal API for UI[36]
- Settings API for configuration[38]
- addCommand for custom commands[26]
- Template system (native/Templater)[21][22][30]
- Bases syntax for database-like views[17]

---

## Development Phases

### Phase 1: Infrastructure & Config
- Bootstrap plugin, initialize TypeScript setup
- Settings tab for configurable file/folder locations (tasks, projects, areas, templates)
- Manifest and data loading/saving

### Phase 2: Data Model & Detection
- Scan vault for configured locations
- Parse/create bases files (e.g. tasks.base)
- Detect available templates, and hook Templater if present

### Phase 3: UI Components
- Main dashboard/modal showing tasks, projects, areas
- Quick add modal for tasks (fields: name, deadline, status, project/area)
- Edit/update modal for tasks
- Project and area creation forms
- Settings (folder/file locations, default templates)

### Phase 4: Command System
- "Add Task" command (with modal, project/area picker)
- "Update Task" command
- "Add Project/Area" commands
- "Open Task Sync Dashboard" command
- Hotkey configuration

### Phase 5: Bases Integration
- Auto-generate tasks.base and project/area-specific bases if missing
- Dynamic updating of bases on task/project/area changes
- Prepare data for Kanban view and advanced filters

### Phase 6: Template System Integration
- Full support for native templates and Templater
- Fields inserted from templates when creating/updating tasks, projects, areas
- Provide template variables for task/project/area properties

### Phase 7: Advanced Task Workflow
- Task status tracking (todo, doing, done)
- Task deadlines, reminders, easy sorting/filtering
- Project/area archiving
- Cross-referencing tasks with their projects/areas
- Batch updates and reporting

### Phase 8: Testing & Polish
- Error handling, performance
- User documentation
- Plugin manifest polish, versioning

---

## Settings Schema
```typescript
interface TaskSyncSettings {
  tasksFolder: string;
  tasksBaseFile: string;
  projectsFolder: string;
  areasFolder: string;
  templatesFolder: string;
  defaultTaskTemplate: string;
  defaultProjectTemplate: string;
  defaultAreaTemplate: string;
  useTemplater: boolean;
  showRibbonIcon: boolean;
  defaultView: 'modal' | 'sidebar';
}
```

---

## Command Table
| Command ID          | Name           | Description                            | Hotkey       |
| ------------------- | -------------- | -------------------------------------- | ------------ |
| task-sync-add-task  | Add Task       | Create new task with project/area link | Ctrl+Shift+T |
| task-sync-update    | Update Task    | Edit/update task details               | Ctrl+Shift+U |
| task-sync-add-proj  | Add Project    | Create new project with template       | Ctrl+Shift+P |
| task-sync-add-area  | Add Area       | Create area with template              | Ctrl+Shift+A |
| task-sync-dashboard | Open Dashboard | View/manage all tasks, projects, areas | Ctrl+Shift+D |

---

## Key Documentation Links
- [Obsidian Plugin Guide](https://docs.obsidian.md/)[13]
- [Obsidian API Reference](https://github.com/obsidianmd/obsidian-api)[10]
- [Bases Feature Docs](https://help.obsidian.md/bases)[17]
- [Templater Plugin](https://github.com/SilentVoid13/Templater)[30]

## Conclusion

Task Sync will enable streamlined management of tasks, projects, and areasâ€”placing special emphasis on convenient, powerful task workflows. Flexible setup and deep template support make it ideal for all project organization approaches within Obsidian. The plugin is ready to leverage the latest features in the platform and adapt to custom vault configurations.
