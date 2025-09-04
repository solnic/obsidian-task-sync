# Todo Promotion Feature

The Todo Promotion feature allows you to quickly convert markdown todo items (checkboxes) into proper tasks in your task management system.

## How It Works

1. **Position your cursor** on any line containing a todo item
2. **Run the command** "Task Sync: Promote Todo to Task" from the command palette (Ctrl/Cmd+P)
3. **The todo item is converted** into a task file and the original line is replaced with a link

## Supported Todo Formats

The feature recognizes various markdown todo formats:

### Basic Todo Items
```markdown
- [ ] Incomplete task
- [x] Completed task
- [X] Completed task (uppercase X)
```

### Different List Markers
```markdown
- [ ] Dash marker todo
* [ ] Asterisk marker todo
```

### Indented Todo Items
```markdown
- Main item
  - [ ] Nested todo item
    - [ ] Deeply nested todo
```

## Behavior

### Incomplete Todos
When you promote an incomplete todo:
- **Original**: `- [ ] Buy groceries`
- **Becomes**: `- [[Buy groceries]]`
- **Task Status**: Backlog

### Completed Todos
When you promote a completed todo:
- **Original**: `- [x] Finish documentation`
- **Becomes**: `- [x] [[Finish documentation]]`
- **Task Status**: Done

The completion state is preserved both in the link and in the created task.

## Context Awareness

The feature automatically detects the context of your current file:

### In Project Files
If you're in a file within the Projects folder:
- The created task will have the **Project** field set to the current project name
- Example: In `Projects/Website Redesign.md` → Task gets `Project: Website Redesign`

### In Area Files
If you're in a file within the Areas folder:
- The created task will have the **Areas** field set to the current area name
- Example: In `Areas/Personal.md` → Task gets `Areas: Personal`

### In Other Files
If you're in any other file:
- The task is created without specific project or area context
- You can manually assign it later

## Task Creation Details

When a todo is promoted to a task:

1. **Task File**: Created in the `Tasks/` folder with the todo text as the filename
2. **Task Content**: Generated using your configured task template (if any)
3. **Task Properties**:
   - **Name**: The text from the todo item
   - **Type**: Uses the first configured task type (default: "Task")
   - **Status**: "Backlog" for incomplete, "Done" for completed
   - **Context**: Project or Area based on current file location

## Error Handling

### No Todo Found
If your cursor is not on a line with a todo item, you'll see a notice:
> "No todo item found under cursor"

### Task Creation Failure
If the task creation fails for any reason, you'll see a notice:
> "Failed to promote todo to task"

The original todo item remains unchanged in case of errors.

## Usage Tips

1. **Quick Workflow**: Use this feature to quickly capture tasks while taking notes, then promote them to your task system when ready
2. **Batch Processing**: Go through your notes and promote multiple todos in sequence
3. **Preserve Context**: The feature maintains the visual structure of your notes while creating proper task tracking
4. **Integration**: Works seamlessly with the base system - promoted tasks automatically appear in your task bases

## Command Access

- **Command Palette**: `Ctrl/Cmd+P` → "Task Sync: Promote Todo to Task"
- **Command ID**: `obsidian-task-sync:promote-todo-to-task`

You can assign a custom hotkey to this command in Obsidian's hotkey settings for even faster access.
