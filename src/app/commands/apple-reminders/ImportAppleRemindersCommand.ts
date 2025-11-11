/**
 * Import Apple Reminders Command
 * Triggers a manual import of Apple Reminders data
 */

import { Command, type CommandContext } from "../Command";
import { Notice } from "obsidian";
import { extensionRegistry } from "../../core/extension";
import type { AppleRemindersExtension } from "../../extensions/apple-reminders/AppleRemindersExtension";

export class ImportAppleRemindersCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "import-apple-reminders";
  }

  getName(): string {
    return "Import Apple Reminders";
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

    if (!extension.isEnabled()) {
      new Notice("Apple Reminders integration is disabled. Enable it in settings first.");
      return;
    }

    try {
      new Notice("Starting Apple Reminders import...");

      // Check permissions first
      const permissionResult = await extension.checkPermissions();
      if (!permissionResult.success || permissionResult.data !== "authorized") {
        new Notice(
          "Apple Reminders access not authorized. Please grant permission in System Preferences > Security & Privacy > Privacy > Reminders"
        );
        return;
      }

      // Trigger refresh which will import data
      await extension.refresh();
      
      new Notice("✅ Apple Reminders import completed successfully");
    } catch (error: any) {
      console.error("Apple Reminders import failed:", error);
      new Notice(`❌ Apple Reminders import failed: ${error.message}`);
    }
  }
}
