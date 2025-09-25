/**
 * Insert Calendar Events Command
 * Inserts calendar events into current daily note
 */

import { Command, type CommandContext } from "../Command";
import { Notice } from "obsidian";

export class InsertCalendarEventsCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "insert-calendar-events";
  }

  getName(): string {
    return "Insert Calendar Events";
  }

  isAvailable(): boolean {
    return (this.plugin as any).appleCalendarService?.isPlatformSupported();
  }

  async execute(): Promise<void> {
    const appleCalendarService = (this.plugin as any).appleCalendarService;
    if (!appleCalendarService.isEnabled()) {
      new Notice(
        "Apple Calendar integration is not enabled. Please configure it in settings."
      );
      return;
    }

    try {
      // Get current daily note or create one
      const dailyNoteService = (this.plugin as any).dailyNoteService;
      const dailyNoteResult = await dailyNoteService.ensureTodayDailyNote();
      if (!dailyNoteResult.file) {
        new Notice("Could not find or create daily note");
        return;
      }
      const dailyNote = dailyNoteResult.file;

      // Get calendar events for today
      const events = await appleCalendarService.getTodayEvents();

      if (events.length === 0) {
        new Notice("No calendar events found for today");
        return;
      }

      // Format events
      const { DefaultCalendarEventFormatter } = await import(
        "../../services/CalendarEventFormatter"
      );
      const formatter = new DefaultCalendarEventFormatter();

      const config = this.settings.integrations.appleCalendar;
      const formattedEvents = formatter.formatEvents(events, {
        includeTime: true,
        includeLocation: config.includeLocation,
        includeDescription: config.includeNotes,
        timeFormat: config.timeFormat,
        groupByCalendar: true,
        showCalendarName: false,
        markdown: {
          useBullets: true,
          useCheckboxes: false,
          calendarHeaderLevel: 3,
        },
      });

      // Insert into daily note
      const content = await this.plugin.app.vault.read(dailyNote);
      const newContent =
        content + "\n\n## Calendar Events\n\n" + formattedEvents + "\n";
      await this.plugin.app.vault.modify(dailyNote, newContent);

      new Notice(`Inserted ${events.length} calendar events into daily note`);
    } catch (error: any) {
      console.error("Error inserting calendar events:", error);
      new Notice(`Error inserting calendar events: ${error.message}`);
    }
  }
}
