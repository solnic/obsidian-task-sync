/**
 * Import Apple Reminders Command
 * Imports Apple Reminders as tasks
 */

import { Command, type CommandContext } from "../Command";
import { Notice } from "obsidian";
import { taskStore } from "../../stores/taskStore";

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
    const service = this.integrationManager.getAppleRemindersService();
    return (
      service?.isPlatformSupported() &&
      this.settings.integrations.appleReminders.enabled
    );
  }

  async execute(): Promise<void> {
    const appleRemindersService =
      this.integrationManager.getAppleRemindersService();
    if (!appleRemindersService?.isEnabled()) {
      new Notice(
        "Apple Reminders integration is not enabled or not available on this platform"
      );
      return;
    }

    try {
      // Check permissions first
      const permissionResult = await appleRemindersService.checkPermissions();
      if (!permissionResult.success) {
        new Notice(`Permission error: ${permissionResult.error?.message}`);
        return;
      }

      new Notice("Fetching Apple Reminders...");

      // Fetch reminders
      const remindersResult = await appleRemindersService.fetchReminders();

      if (!remindersResult.success) {
        new Notice(
          `Failed to fetch reminders: ${remindersResult.error?.message}`
        );
        return;
      }

      const reminders = remindersResult.data || [];

      if (reminders.length === 0) {
        new Notice("No reminders found");
        return;
      }

      console.log("🍎 Starting import of", reminders.length, "reminders");

      // Import each reminder
      let imported = 0;
      let skipped = 0;
      let failed = 0;

      for (const reminder of reminders) {
        try {
          const config = (this.plugin as any).getDefaultImportConfig();

          const result = await appleRemindersService.importReminderAsTask(
            reminder,
            config
          );

          if (result.success) {
            if (result.skipped) {
              skipped++;
            } else {
              imported++;
            }
          } else {
            failed++;
          }
        } catch (error: any) {
          failed++;
        }
      }

      // Wait for file system events to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Refresh task store to ensure UI is updated
      await taskStore.refreshEntities();

      // Additional delay to ensure UI can process the changes
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Refresh Apple Reminders view if it's open
      const appleRemindersViewMethods = (window as any)
        .__appleRemindersServiceMethods;
      if (appleRemindersViewMethods && appleRemindersViewMethods.refresh) {
        await appleRemindersViewMethods.refresh();
      }

      new Notice(
        `Import complete: ${imported} imported, ${skipped} skipped, ${failed} failed`
      );
    } catch (error: any) {
      new Notice(`Error importing reminders: ${error.message}`);
    }
  }
}
