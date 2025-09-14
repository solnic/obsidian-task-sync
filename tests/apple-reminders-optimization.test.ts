/**
 * Tests for Apple Reminders single script optimization
 * Verifies that the new approach generates correct AppleScript for fetching all reminders in one call
 */

import { describe, it, expect } from "vitest";

// Helper function to generate the optimized AppleScript for fetching all reminders
function generateOptimizedAppleScript(
  listNames: string[],
  includeCompleted: boolean
): string {
  const listNamesScript = listNames.map((name) => `"${name}"`).join(", ");

  return includeCompleted
    ? `tell application "Reminders"
        set targetLists to {${listNamesScript}}
        set allReminders to {}
        repeat with listName in targetLists
          try
            set listReminders to properties of reminders in list listName
            repeat with reminderProps in listReminders
              set reminderProps to reminderProps & {listName:listName}
              set end of allReminders to reminderProps
            end repeat
          on error
            -- Skip lists that can't be accessed
          end try
        end repeat
        return allReminders
      end tell`
    : `tell application "Reminders"
        set targetLists to {${listNamesScript}}
        set allReminders to {}
        repeat with listName in targetLists
          try
            set listReminders to properties of reminders in list listName whose completed is false
            repeat with reminderProps in listReminders
              set reminderProps to reminderProps & {listName:listName}
              set end of allReminders to reminderProps
            end repeat
          on error
            -- Skip lists that can't be accessed
          end try
        end repeat
        return allReminders
      end tell`;
}

describe("Apple Reminders Single Script Optimization", () => {
  it("should generate correct AppleScript for multiple lists without completed reminders", () => {
    const listNames = ["Work", "Personal"];
    const includeCompleted = false;
    
    const script = generateOptimizedAppleScript(listNames, includeCompleted);
    
    // Verify the script structure
    expect(script).toContain('set targetLists to {"Work", "Personal"}');
    expect(script).toContain("repeat with listName in targetLists");
    expect(script).toContain("set reminderProps to reminderProps & {listName:listName}");
    expect(script).toContain("whose completed is false");
    expect(script).not.toContain("list_name"); // Old approach used variables
  });

  it("should generate correct AppleScript for multiple lists with completed reminders", () => {
    const listNames = ["Work", "Personal", "Shopping"];
    const includeCompleted = true;
    
    const script = generateOptimizedAppleScript(listNames, includeCompleted);
    
    // Verify the script structure
    expect(script).toContain('set targetLists to {"Work", "Personal", "Shopping"}');
    expect(script).toContain("repeat with listName in targetLists");
    expect(script).toContain("set reminderProps to reminderProps & {listName:listName}");
    expect(script).not.toContain("whose completed is false"); // Should include all reminders
    expect(script).toContain("properties of reminders in list listName");
  });

  it("should handle single list correctly", () => {
    const listNames = ["Work"];
    const includeCompleted = false;
    
    const script = generateOptimizedAppleScript(listNames, includeCompleted);
    
    expect(script).toContain('set targetLists to {"Work"}');
    expect(script).toContain("repeat with listName in targetLists");
  });

  it("should handle list names with special characters", () => {
    const listNames = ["Work & Personal", "Mom's List"];
    const includeCompleted = false;
    
    const script = generateOptimizedAppleScript(listNames, includeCompleted);
    
    expect(script).toContain('set targetLists to {"Work & Personal", "Mom\'s List"}');
  });

  it("should include error handling for inaccessible lists", () => {
    const listNames = ["Work", "Personal"];
    const includeCompleted = false;
    
    const script = generateOptimizedAppleScript(listNames, includeCompleted);
    
    expect(script).toContain("try");
    expect(script).toContain("on error");
    expect(script).toContain("-- Skip lists that can't be accessed");
  });

  it("should properly structure the AppleScript with correct syntax", () => {
    const listNames = ["Test List"];
    const includeCompleted = true;
    
    const script = generateOptimizedAppleScript(listNames, includeCompleted);
    
    // Check basic AppleScript structure
    expect(script).toMatch(/^tell application "Reminders"/);
    expect(script).toMatch(/end tell$/);
    expect(script).toContain("set allReminders to {}");
    expect(script).toContain("return allReminders");
  });

  it("should demonstrate the optimization over concurrent approach", () => {
    // The old approach would have made separate calls like this:
    const oldApproachScript = `tell list list_name in application "Reminders"
      return properties of reminders whose completed is false
    end tell`;
    
    // The new approach combines all lists in one script
    const listNames = ["Work", "Personal"];
    const newApproachScript = generateOptimizedAppleScript(listNames, false);
    
    // Verify the new approach doesn't use the old variable-based pattern
    expect(newApproachScript).not.toContain("list_name");
    expect(newApproachScript).not.toContain("tell list");
    
    // Verify it uses the new optimized pattern
    expect(newApproachScript).toContain("set targetLists to");
    expect(newApproachScript).toContain("repeat with listName in targetLists");
    
    // The key optimization: single script vs multiple concurrent scripts
    expect(newApproachScript).toContain("tell application \"Reminders\"");
    // Should only have one "tell application" block, not multiple
    const tellCount = (newApproachScript.match(/tell application "Reminders"/g) || []).length;
    expect(tellCount).toBe(1);
  });
});
