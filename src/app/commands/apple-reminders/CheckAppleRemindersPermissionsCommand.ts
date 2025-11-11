/**
 * Check Apple Reminders Permissions Command
 * Checks Apple Reminders permissions and shows appropriate notices
 */

import { Command, type CommandContext } from "../Command";
import { Notice } from "obsidian";
import { extensionRegistry } from "../../core/extension";
import type { AppleRemindersExtension } from "../../extensions/apple-reminders/AppleRemindersExtension";

export class CheckAppleRemindersPermissionsCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "check-apple-reminders-permissions";
  }

  getName(): string {
    return "Check Apple Reminders Permissions";
  }

  isAvailable(): boolean {
    const extension = extensionRegistry.getById("apple-reminders") as AppleRemindersExtension;
    return (
      extension?.isPlatformSupported() &&
      this.settings.integrations.appleReminders?.enabled
    );
  }

  async execute(): Promise<void> {
    const extension = extensionRegistry.getById("apple-reminders") as AppleRemindersExtension;
    
    if (!extension) {
      new Notice("Apple Reminders extension not found");
      return;
    }

    if (!extension.isPlatformSupported()) {
      new Notice("Apple Reminders is only supported on macOS");
      return;
    }

    try {
      const result = await extension.checkPermissions();

      if (result.success) {
        const permission = result.data;
        switch (permission) {
          case "authorized":
            new Notice("✅ Apple Reminders access is authorized");
            break;
          case "denied":
            new Notice(
              "❌ Apple Reminders access is denied. Please grant permission in System Preferences > Security & Privacy > Privacy > Reminders"
            );
            break;
          case "notDetermined":
            new Notice(
              "⚠️ Apple Reminders permission not determined. Please try importing reminders to trigger permission request."
            );
            break;
          case "restricted":
            new Notice("🔒 Apple Reminders access is restricted");
            break;
        }
      } else {
        new Notice(`Permission check failed: ${result.error?.message}`);
      }
    } catch (error: any) {
      new Notice(`Error checking permissions: ${error.message}`);
    }
  }
}
