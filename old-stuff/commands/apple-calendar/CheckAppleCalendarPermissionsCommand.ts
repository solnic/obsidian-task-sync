/**
 * Check Apple Calendar Permissions Command
 * Checks Apple Calendar permissions
 */

import { Command, type CommandContext } from "../Command";
import { Notice } from "obsidian";

export class CheckAppleCalendarPermissionsCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "check-apple-calendar-permissions";
  }

  getName(): string {
    return "Check Apple Calendar Permissions";
  }

  isAvailable(): boolean {
    return (this.plugin as any).appleCalendarService?.isPlatformSupported();
  }

  async execute(): Promise<void> {
    try {
      const appleCalendarService = (this.plugin as any).appleCalendarService;
      const hasPermissions = await appleCalendarService.checkPermissions();

      if (hasPermissions) {
        new Notice("✅ Apple Calendar access is working");
      } else {
        new Notice(
          "❌ Apple Calendar access failed. Please check your credentials in settings."
        );
      }
    } catch (error: any) {
      console.error("Error checking Apple Calendar permissions:", error);
      new Notice(`Error checking permissions: ${error.message}`);
    }
  }
}
