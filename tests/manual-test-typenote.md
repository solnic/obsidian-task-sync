# Manual Test for TypeNote Task Integration

## ✅ FIX APPLIED

The issue was that there were **two separate TypeNote instances**:
1. `plugin.typeNote` - used by settings UI
2. `obsidianExtension.typeNote` - where Task note type was registered

**Solution**: Modified ObsidianExtension to accept and use the plugin's TypeNote instance, so both share the same registry.

## Steps to verify Task note type appears in settings:

1. **Rebuild the plugin**: `npm run build`
2. **Reload Obsidian** or restart the plugin
3. **Open Settings** → TaskSync → **TypeNote** section
4. You should now see **"Task"** note type listed with:
   - ID: task
   - Version: 1.0.0
   - Description: Default template for Task notes

## Steps to verify Task note type is registered (Console):

1. Open your Obsidian vault with the TaskSync plugin enabled
2. Open the Developer Console (Ctrl+Shift+I or Cmd+Option+I)
3. Run this command in the console:

```javascript
// Get the plugin
const plugin = app.plugins.plugins["obsidian-task-sync"];

// Check plugin's TypeNote (used by settings UI)
console.log("Plugin TypeNote:", !!plugin.typeNote);

// Get the ObsidianExtension
const obsidianExtension = plugin.host.getExtensionById("obsidian");

// Verify they're the SAME instance
console.log("Same TypeNote instance:", plugin.typeNote === obsidianExtension.typeNote);

// Get the Task note type from plugin's TypeNote
const taskNoteType = plugin.typeNote.registry.get("task");

// Log the Task note type details
console.log("Task note type:", taskNoteType);

// Log property names
if (taskNoteType) {
  console.log("Properties:", Object.keys(taskNoteType.properties));
  console.log("Category options:", taskNoteType.properties.category?.selectOptions);
  console.log("Priority options:", taskNoteType.properties.priority?.selectOptions);
  console.log("Status options:", taskNoteType.properties.status?.selectOptions);
}
```

## Expected Output:

- Plugin TypeNote: true
- Same TypeNote instance: **true** ← This is the key fix!
- Task note type: Object with id="task", name="Task", version="1.0.0"
- Properties: Array with all task property keys (title, category, priority, status, done, project, areas, parentTask, doDate, dueDate, tags, description)
- Category/Priority/Status options: Arrays with values from your settings

## Expected Console Log on Plugin Load:

Look for this message in the console:
```
Task note type registered successfully with TypeNote
```

## To test task creation with TypeNote:

1. Create a task using the task creation helper (e.g., through the API)
2. Check the created task file in the Tasks folder
3. Verify the front-matter has all the expected properties
4. Verify the template was applied correctly with proper formatting

