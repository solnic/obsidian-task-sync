# Task Todo Markdown Processor Test

This document demonstrates the new markdown processor that enhances todo items with task badges.

## Test Cases

### Basic Todo Items with Task Links

- [ ] [[Enhanced todo rendering in Markdown]] - This should show badges for status, priority, and category
- [x] [[Day Planner]] - This should show badges for a completed task
- [ ] Regular todo without task link - This should remain unchanged

### Nested Todo Items

- [ ] Parent todo item
  - [ ] [[Enhanced todo rendering in Markdown]] - This nested task should also show badges
  - [ ] Another nested item without task link

### Mixed Content

- [ ] [[Day Planner]] - Should show medium priority badge
- [ ] Some regular text with [[Enhanced todo rendering in Markdown]] in the middle
- [x] [[Day Planner]] - Should show feature category badge

## How It Works

The markdown processor:

1. Detects todo items (list items with checkboxes)
2. Finds wiki links within those todo items
3. Checks if the linked file is a task note managed by the plugin
4. Adds status, priority, and category badges next to the task link

## Expected Behavior

When viewing this document in reading mode, todo items that link to task notes should display small colored badges showing:

- **Category Badge**: Shows the task type (Feature, Bug, etc.)
- **Priority Badge**: Shows the priority level (High, Medium, Low, etc.)
- **Status Badge**: Shows the current status (Open, In Progress, Done, etc.)

The badges should:
- Be small and unobtrusive
- Use colors that match the plugin's color scheme
- Only appear for todo items that link to actual task notes
- Not interfere with the checkbox functionality
