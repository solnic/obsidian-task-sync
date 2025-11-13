# Plan: Add Association Property Type to NoteKit

An `association` property type will enable type-safe linking between notes (Tasks, Projects, Areas) with automatic UI rendering, validation, referential integrity, and inline entity creation. This replaces the current ad-hoc approach using `string`/`array` types with a `link` flag.

## Steps

1. **Extend core type system** in [`types.ts`](/workspaces/obsidian-task-sync/src/app/core/note-kit/types.ts) by adding `"association"` to `PropertyType` enum and adding `association` configuration object to `PropertyDefinition` interface with fields: `noteTypeId` (string referencing a note type ID like "task", "project", "area"), `multiple` (boolean), optional `folder` restriction, and optional `allowCreate` boolean for inline creation.

2. **Create association schemas and validation** in [`property-processor.ts`](/workspaces/obsidian-task-sync/src/app/core/note-kit/property-processor.ts) by adding `associationSchema()` helper returning `z.array(z.string())` for multiple or `optionalStringSchema` for single, plus `validateAssociation()` function that queries the TypeRegistry to get the target note type's entity store/query interface to verify referenced entities exist (failing validation if not found), and add referential integrity tracking to maintain association mappings.

3. **Implement cascading cleanup on entity deletion** in entity operation classes ([`Tasks.Operations`](/workspaces/obsidian-task-sync/src/app/entities/Tasks.ts), [`Projects.Operations`](/workspaces/obsidian-task-sync/src/app/entities/Projects.ts), [`Areas.Operations`](/workspaces/obsidian-task-sync/src/app/entities/Areas.ts)) by adding `cleanupOrphanedAssociations()` method that finds all entities referencing the deleted entity and nullifies their association properties (empty string for single, empty array for multiple), triggered in `delete()` methods.

4. **Build AssociationProperty component** in `src/app/components/properties/AssociationProperty.svelte` that queries the TypeRegistry to resolve the target note type and its entity store/query interface based on `noteTypeId`, renders enhanced [`Dropdown`](/workspaces/obsidian-task-sync/src/app/components/Dropdown.svelte) with "Create new..." option when `allowCreate: true`, handles single/multi-select via `association.multiple`, formats values as wiki links on save, and triggers inline creation modal when user selects "Create new..." option.

5. **Create data migration system** using [`BulkOperations`](/workspaces/obsidian-task-sync/src/app/core/note-kit/bulk-operations.ts) to convert existing Task/Project/Area notes from `type: "string"/"array"` with `link: true` to `type: "association"` with proper configuration, including migration plan creation via `createMigrationPlan()`, backup creation via [`BackupManager`](/workspaces/obsidian-task-sync/src/app/core/note-kit/backup-manager.ts), and execution via `executeBulkMigration()` with progress tracking.

6. **Integrate with Obsidian systems** by adding `association: "text"` mappings in [`obsidian-property-manager.ts`](/workspaces/obsidian-task-sync/src/app/core/note-kit/obsidian-property-manager.ts) and [`bases-integration.ts`](/workspaces/obsidian-task-sync/src/app/core/note-kit/bases-integration.ts), with automatic `link: true` flag for association properties in base config generation, and update property form builder to add `case "association": return AssociationProperty`.

## Implementation Details

### Migration Strategy

Migration will run automatically once upon plugin load when schema version changes:
- Track executed migrations in plugin settings with migration ID and timestamp
- Check on plugin load if association type migration has been executed
- If not executed, run migration with progress notification using Obsidian `Notice` API
- Mark migration as completed in settings to prevent re-execution
- Backup all affected files using `BackupManager` before migration starts

### Inline Entity Creation

Simplified inline creation form when user selects "Create new..." option:
- Display inline input field directly below dropdown for entity name
- Include optional description field (textarea)
- "Create" and "Cancel" buttons inline
- On create: validate name is unique, create entity via entity operations, add to dropdown selection, close inline form
- On cancel: hide inline form, return to dropdown
- Simpler UX than full modal, keeps user in context of property editing
