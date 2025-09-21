/**
 * Check Apple Reminders Permissions Command
 * Checks Apple Reminders permissions
 */

import { Command, type CommandContext } from "../Command";
import { Notice } from "obsidian";

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
    const service = this.integrationManager.getAppleRemindersService();
    return (
      service?.isPlatformSupported() &&
      this.settings.appleRemindersIntegration.enabled
    );
  }

  async execute(): Promise<void> {
    const appleRemindersService =
      this.integrationManager.getAppleRemindersService();
    if (!appleRemindersService?.isPlatformSupported()) {
      new Notice("Apple Reminders is only available on macOS");
      return;
    }

    try {
      const result = await appleRemindersService.checkPermissions();

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
      console.error("Error checking Apple Reminders permissions:", error);
      new Notice(`Error checking permissions: ${error.message}`);
    }
  }
}
