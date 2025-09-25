import { Modal, App } from "obsidian";
import { CalendarEvent } from "../../types/calendar";

export class EventDetailsModal extends Modal {
  private event: CalendarEvent;

  constructor(app: App, event: CalendarEvent) {
    super(app);
    this.event = event;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    // Modal title
    contentEl.createEl("h2", { text: "Event Details" });

    // Event details container
    const detailsContainer = contentEl.createDiv("event-details-container");

    // Title
    const titleRow = detailsContainer.createDiv("event-detail-row");
    titleRow.createEl("strong", { text: "Title:" });
    titleRow.createSpan({ text: this.event.title });

    // Time
    const timeRow = detailsContainer.createDiv("event-detail-row");
    timeRow.createEl("strong", { text: "Time:" });
    if (this.event.allDay) {
      timeRow.createSpan({ text: "All Day" });
    } else {
      const startTime = this.event.startDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const endTime = this.event.endDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      timeRow.createSpan({ text: `${startTime} - ${endTime}` });
    }

    // Date
    const dateRow = detailsContainer.createDiv("event-detail-row");
    dateRow.createEl("strong", { text: "Date:" });
    dateRow.createSpan({
      text: this.event.startDate.toLocaleDateString(),
    });

    // Calendar
    const calendarRow = detailsContainer.createDiv("event-detail-row");
    calendarRow.createEl("strong", { text: "Calendar:" });
    const calendarSpan = calendarRow.createSpan({
      text: this.event.calendar?.name || "Unknown",
    });
    if (this.event.calendar?.color) {
      calendarSpan.style.color = this.event.calendar.color;
      calendarSpan.style.fontWeight = "bold";
    }

    // Description (if available)
    if (this.event.description) {
      const descRow = detailsContainer.createDiv("event-detail-row");
      descRow.createEl("strong", { text: "Description:" });
      descRow.createDiv({ text: this.event.description });
    }

    // Location (if available)
    if (this.event.location) {
      const locationRow = detailsContainer.createDiv("event-detail-row");
      locationRow.createEl("strong", { text: "Location:" });
      locationRow.createSpan({ text: this.event.location });
    }

    // All Day indicator
    const allDayRow = detailsContainer.createDiv("event-detail-row");
    allDayRow.createEl("strong", { text: "All Day:" });
    allDayRow.createSpan({ text: this.event.allDay ? "Yes" : "No" });

    // Close button
    const buttonContainer = contentEl.createDiv("modal-button-container");
    const closeButton = buttonContainer.createEl("button", {
      text: "Close",
      cls: "mod-cta",
    });
    closeButton.addEventListener("click", () => this.close());
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
