/**
 * Daily Planning Extension for TaskSync
 * Manages Schedule entities and provides daily planning wizard functionality
 */

import { Plugin, TFile } from "obsidian";
import {
  Extension,
  extensionRegistry,
  EntityType,
  EntityOperations,
} from "../core/extension";
import { eventBus, DomainEvent } from "../core/events";
import { derived, writable, get, type Readable } from "svelte/store";
import type {
  Task,
  Schedule,
  ScheduleCreateData,
  CalendarEvent,
} from "../core/entities";
import { Schedules } from "../entities/Schedules";
import { Tasks } from "../entities/Tasks";
import { scheduleStore } from "../stores/scheduleStore";
import { taskStore } from "../stores/taskStore";
import type { TaskSyncSettings } from "../types/settings";
import {
  setPlanningActive,
  setCurrentSchedule,
  isPlanningActive,
  currentSchedule,
} from "../stores/dailyPlanningStore";
import type { CalendarExtension } from "./CalendarExtension";
import {
  getYesterdayTasksGrouped,
  getTodayTasksGrouped,
} from "../utils/dateFiltering";

export interface DailyPlanningExtensionSettings {
  enabled: boolean;
  autoCreateDailySchedules: boolean;
  defaultPlanningTime: string; // e.g., "09:00"
}

export class DailyPlanningExtension implements Extension {
  readonly id = "daily-planning";
  readonly name = "Daily Planning";
  readonly version = "1.0.0";
  readonly supportedEntities: readonly EntityType[] = ["schedule"];

  private initialized = false;
  private plugin: Plugin;
  private settings: TaskSyncSettings;

  // Schedule operations
  public schedules: EntityOperations<Schedule>;

  // Calendar extension for events
  private calendarExtension?: CalendarExtension;

  // Note: Planning state is now managed by global dailyPlanningStore

  // Staging state for planning changes
  private stagedTasksStore = writable<Task[]>([]);
  private stagedUnscheduledTasksStore = writable<Task[]>([]);

  constructor(settings: TaskSyncSettings, plugin: Plugin) {
    this.settings = settings;
    this.plugin = plugin;
    this.schedules = new Schedules.Operations();

    // Calendar extension will be set during initialization
    this.calendarExtension = undefined;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log("Initializing DailyPlanningExtension...");

      // Register extension
      extensionRegistry.register(this);

      // Set up event listeners for domain events
      this.setupEventListeners();

      // Trigger extension registered event
      eventBus.trigger({
        type: "extension.registered",
        extension: this.id,
        supportedEntities: [...this.supportedEntities],
      });

      this.initialized = true;
      console.log("DailyPlanningExtension initialized successfully");
    } catch (error) {
      console.error("Failed to initialize DailyPlanningExtension:", error);
      throw error;
    }
  }

  async load(): Promise<void> {
    if (!this.initialized) {
      throw new Error(
        "DailyPlanningExtension must be initialized before loading"
      );
    }

    try {
      console.log("Loading DailyPlanningExtension...");

      // Try to get calendar extension from registry
      this.calendarExtension = extensionRegistry.getById(
        "calendar"
      ) as CalendarExtension;

      // Load any persisted schedule data
      // This would typically load from plugin storage
      await this.loadPersistedSchedules();

      // Auto-create today's schedule if enabled
      const extensionSettings = this.getExtensionSettings();
      if (extensionSettings.autoCreateDailySchedules) {
        await this.ensureTodayScheduleExists();
      }

      console.log("DailyPlanningExtension loaded successfully");
    } catch (error) {
      console.error("Failed to load DailyPlanningExtension:", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    // Persist any pending schedule data
    await this.persistSchedules();

    eventBus.trigger({
      type: "extension.unregistered",
      extension: this.id,
    });

    this.initialized = false;
  }

  // Extension interface methods
  async onEntityCreated(event: DomainEvent): Promise<void> {
    if (event.type === "tasks.created") {
      // Optionally add new tasks to today's schedule
      // This could be configurable behavior
    }
  }

  async onEntityUpdated(event: DomainEvent): Promise<void> {
    if (event.type === "tasks.updated") {
      // Update any schedules that contain this task
      await this.updateSchedulesWithTask(event.task);
    }
  }

  async onEntityDeleted(event: DomainEvent): Promise<void> {
    if (event.type === "tasks.deleted") {
      // Remove task from any schedules
      await this.removeTaskFromAllSchedules(event.taskId);
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.initialized;
  }

  // Data access interface
  getTasks(): Readable<readonly Task[]> {
    // Daily Planning Extension doesn't manage tasks directly
    // It works with schedules that contain tasks
    return derived(scheduleStore, () => []);
  }

  async refresh(): Promise<void> {
    await this.loadPersistedSchedules();
  }

  searchTasks(_query: string, _tasks: readonly Task[]): readonly Task[] {
    // Not applicable for this extension
    return [];
  }

  filterTasks(_tasks: readonly Task[], _filters: any): readonly Task[] {
    // Not applicable for this extension
    return [];
  }

  sortTasks(
    _tasks: readonly Task[],
    _sortFields: Array<{ key: string; direction: "asc" | "desc" }>
  ): readonly Task[] {
    // Not applicable for this extension
    return [];
  }

  // Daily Planning specific methods

  /**
   * Get the current planning state
   */
  getPlanningActive(): Readable<boolean> {
    return isPlanningActive;
  }

  /**
   * Set the planning active state
   */
  setPlanningActive(active: boolean): void {
    setPlanningActive(active);
  }

  /**
   * Get the current schedule being planned
   */
  getCurrentSchedule(): Readable<Schedule | null> {
    return currentSchedule;
  }

  /**
   * Get staged tasks for planning
   */
  getStagedTasks(): Readable<Task[]> {
    return this.stagedTasksStore;
  }

  /**
   * Get staged unscheduled tasks for planning
   */
  getStagedUnscheduledTasks(): Readable<Task[]> {
    return this.stagedUnscheduledTasksStore;
  }

  /**
   * Set the current schedule being planned
   */
  setCurrentSchedule(schedule: Schedule | null): void {
    setCurrentSchedule(schedule);
  }

  /**
   * Create or get today's schedule
   */
  async ensureTodayScheduleExists(): Promise<Schedule> {
    const queries = new Schedules.Queries();
    let todaySchedule = await queries.getToday();

    if (!todaySchedule) {
      const scheduleData = {
        date: new Date(),
        tasks: [] as Task[],
        unscheduledTasks: [] as Task[],
        events: [] as any[],
        dailyNoteExists: false,
        isPlanned: false,
      };
      todaySchedule = await this.schedules.create(scheduleData);
    }

    return todaySchedule;
  }

  /**
   * Create or get yesterday's schedule
   */
  async ensureYesterdayScheduleExists(): Promise<Schedule> {
    const queries = new Schedules.Queries();
    let yesterdaySchedule = await queries.getYesterday();

    if (!yesterdaySchedule) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const scheduleData = {
        date: yesterday,
        tasks: [] as Task[],
        unscheduledTasks: [] as Task[],
        events: [] as any[],
        dailyNoteExists: false,
        isPlanned: false,
      };
      yesterdaySchedule = await this.schedules.create(scheduleData);
    }

    return yesterdaySchedule;
  }

  /**
   * Start daily planning wizard
   */
  async startDailyPlanning(): Promise<void> {
    this.setPlanningActive(true);

    // Ensure today's schedule exists
    const todaySchedule = await this.ensureTodayScheduleExists();
    this.setCurrentSchedule(todaySchedule);

    // Ensure today's daily note exists and open it
    await this.ensureAndOpenTodayDailyNote();

    // Trigger planning started event
    eventBus.trigger({
      type: "daily-planning.started",
      schedule: todaySchedule,
    });
  }

  /**
   * Complete daily planning wizard
   */
  async completeDailyPlanning(): Promise<void> {
    const currentSchedule = scheduleStore.findScheduleByDate(new Date());
    if (currentSchedule) {
      await this.schedules.update(currentSchedule.id, {
        isPlanned: true,
        planningCompletedAt: new Date(),
      });
    }

    this.setPlanningActive(false);
    this.setCurrentSchedule(null);

    // Trigger planning completed event
    eventBus.trigger({
      type: "daily-planning.completed",
      schedule: currentSchedule,
    });
  }

  /**
   * Cancel daily planning wizard
   */
  async cancelDailyPlanning(): Promise<void> {
    this.setPlanningActive(false);
    this.setCurrentSchedule(null);

    // Trigger planning cancelled event
    eventBus.trigger({
      type: "daily-planning.cancelled",
    });
  }

  // Task movement operations for daily planning

  /**
   * Get yesterday's tasks grouped by completion status
   */
  async getYesterdayTasksGrouped(): Promise<{ done: Task[]; notDone: Task[] }> {
    const taskQueries = new Tasks.Queries();
    const allTasks = await taskQueries.getAll();
    return getYesterdayTasksGrouped([...allTasks]);
  }

  /**
   * Get today's tasks grouped by completion status
   */
  async getTodayTasksGrouped(): Promise<{ done: Task[]; notDone: Task[] }> {
    const taskQueries = new Tasks.Queries();
    const allTasks = await taskQueries.getAll();
    return getTodayTasksGrouped([...allTasks]);
  }

  /**
   * Stage a task to be moved to today (doesn't immediately apply changes)
   */
  stageTaskForToday(task: Task): void {
    this.stagedTasksStore.update((tasks) => {
      // Add task if not already staged
      if (!tasks.some((t) => t.id === task.id)) {
        return [...tasks, task];
      }
      return tasks;
    });

    // Remove from unscheduled if it was there
    this.stagedUnscheduledTasksStore.update((tasks) =>
      tasks.filter((t) => t.id !== task.id)
    );
  }

  /**
   * Stage a task to be unscheduled (doesn't immediately apply changes)
   */
  stageTaskForUnscheduling(task: Task): void {
    this.stagedUnscheduledTasksStore.update((tasks) => {
      // Add task if not already staged for unscheduling
      if (!tasks.some((t) => t.id === task.id)) {
        return [...tasks, task];
      }
      return tasks;
    });

    // Remove from scheduled if it was there
    this.stagedTasksStore.update((tasks) =>
      tasks.filter((t) => t.id !== task.id)
    );
  }

  /**
   * Clear all staging changes
   */
  clearStaging(): void {
    this.stagedTasksStore.set([]);
    this.stagedUnscheduledTasksStore.set([]);
  }

  /**
   * Apply all staged changes (move tasks to today, unschedule tasks)
   */
  async applyStaging(): Promise<void> {
    const stagedTasks = get(this.stagedTasksStore);
    const stagedUnscheduledTasks = get(this.stagedUnscheduledTasksStore);

    // Apply scheduled tasks
    for (const task of stagedTasks) {
      await this.moveTaskToTodayImmediate(task);
    }

    // Apply unscheduled tasks
    for (const task of stagedUnscheduledTasks) {
      await this.unscheduleTaskImmediate(task);
    }

    // Clear staging after applying
    this.clearStaging();
  }

  /**
   * Move a task to today immediately (used internally and for applying staging)
   */
  async moveTaskToTodayImmediate(task: Task): Promise<void> {
    const taskOperations = new Tasks.Operations();
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day

    await taskOperations.update({
      ...task,
      doDate: today,
    });

    // Add task to today's schedule
    const todaySchedule = await this.ensureTodayScheduleExists();
    const scheduleOperations = new Schedules.Operations();

    // Check if task is already in today's schedule
    const isAlreadyInSchedule = todaySchedule.tasks.some(
      (t) => t.id === task.id
    );
    if (!isAlreadyInSchedule) {
      await scheduleOperations.addTask(todaySchedule.id, {
        ...task,
        doDate: today,
      });
    }
  }

  /**
   * Unschedule a task immediately (used internally and for applying staging)
   */
  async unscheduleTaskImmediate(task: Task): Promise<void> {
    const taskOperations = new Tasks.Operations();

    await taskOperations.update({
      ...task,
      doDate: null,
    });

    // Remove task from all schedules
    await this.removeTaskFromAllSchedules(task.id);
  }

  /**
   * Move a task to today by setting its doDate to today (for backward compatibility)
   */
  async moveTaskToToday(task: Task): Promise<void> {
    // If planning is active, stage the task instead of applying immediately
    if (get(isPlanningActive)) {
      this.stageTaskForToday(task);
    } else {
      await this.moveTaskToTodayImmediate(task);
    }
  }

  /**
   * Move all unfinished tasks from yesterday to today
   */
  async moveUnfinishedTasksToToday(): Promise<void> {
    const yesterdayTasks = await this.getYesterdayTasksGrouped();

    for (const task of yesterdayTasks.notDone) {
      await this.moveTaskToToday(task);
    }
  }

  /**
   * Unschedule a task by removing its doDate
   */
  async unscheduleTask(task: Task): Promise<void> {
    const taskOperations = new Tasks.Operations();

    await taskOperations.update({
      ...task,
      doDate: undefined,
    });

    // Remove task from all schedules
    await this.removeTaskFromAllSchedules(task.id);
  }

  /**
   * Reschedule a task to a specific date
   */
  async rescheduleTask(task: Task, newDate: Date): Promise<void> {
    const taskOperations = new Tasks.Operations();

    await taskOperations.update({
      ...task,
      doDate: newDate,
    });

    // Remove from current schedules and add to new date's schedule
    await this.removeTaskFromAllSchedules(task.id);

    // Add to the schedule for the new date
    const scheduleQueries = new Schedules.Queries();
    let targetSchedule = await scheduleQueries.getByDate(newDate);

    if (!targetSchedule) {
      const scheduleOperations = new Schedules.Operations();
      targetSchedule = await scheduleOperations.create({
        date: newDate,
        tasks: [],
        unscheduledTasks: [],
        events: [],
        dailyNoteExists: false,
        isPlanned: false,
      });
    }

    const scheduleOperations = new Schedules.Operations();
    await scheduleOperations.addTask(targetSchedule.id, {
      ...task,
      doDate: newDate,
    });
  }

  // Calendar event operations for daily planning

  /**
   * Get today's calendar events
   */
  async getTodayEvents(): Promise<CalendarEvent[]> {
    if (!this.calendarExtension) {
      return [];
    }

    try {
      return await this.calendarExtension.getTodayEvents();
    } catch (error) {
      console.error("Error loading today's calendar events:", error);
      return [];
    }
  }

  /**
   * Get unscheduled tasks (tasks without a doDate)
   */
  async getUnscheduledTasks(): Promise<Task[]> {
    const taskQueries = new Tasks.Queries();
    const allTasks = await taskQueries.getAll();

    // Filter tasks that don't have a doDate set
    return allTasks.filter((task) => !task.doDate || task.doDate === null);
  }

  /**
   * Get calendar events for a specific date
   */
  async getEventsForDate(date: Date): Promise<CalendarEvent[]> {
    if (!this.calendarExtension) {
      return [];
    }

    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      return await this.calendarExtension.getEventsForDateRange(
        startOfDay,
        endOfDay
      );
    } catch (error) {
      console.error("Error loading calendar events for date:", error);
      return [];
    }
  }

  // Private helper methods

  private setupEventListeners(): void {
    // Listen for task events to keep schedules in sync
    eventBus.on("tasks.created", (event) => this.onEntityCreated(event));
    eventBus.on("tasks.updated", (event) => this.onEntityUpdated(event));
    eventBus.on("tasks.deleted", (event) => this.onEntityDeleted(event));
  }

  private getExtensionSettings(): DailyPlanningExtensionSettings {
    return {
      enabled: true,
      autoCreateDailySchedules: true,
      defaultPlanningTime: "09:00",
      // TODO: Load from actual settings
    };
  }

  private async loadPersistedSchedules(): Promise<void> {
    // TODO: Implement loading from plugin storage
    // This would load schedule persistence data and restore schedules
    console.log("Loading persisted schedules...");
  }

  private async persistSchedules(): Promise<void> {
    // TODO: Implement saving to plugin storage
    // This would save current schedule state to plugin data
    console.log("Persisting schedules...");
  }

  private async updateSchedulesWithTask(task: Task): Promise<void> {
    // Find schedules that contain this task and update them
    const allSchedules = scheduleStore.getSchedules();
    for (const schedule of allSchedules) {
      const hasTask =
        schedule.tasks.some((t) => t.id === task.id) ||
        schedule.unscheduledTasks.some((t) => t.id === task.id);

      if (hasTask) {
        await this.schedules.update(schedule.id, {
          tasks: schedule.tasks.map((t) => (t.id === task.id ? task : t)),
          unscheduledTasks: schedule.unscheduledTasks.map((t) =>
            t.id === task.id ? task : t
          ),
        });
      }
    }
  }

  private async removeTaskFromAllSchedules(taskId: string): Promise<void> {
    // Remove task from all schedules
    const allSchedules = scheduleStore.getSchedules();
    for (const schedule of allSchedules) {
      const hasTask =
        schedule.tasks.some((t) => t.id === taskId) ||
        schedule.unscheduledTasks.some((t) => t.id === taskId);

      if (hasTask) {
        await this.schedules.update(schedule.id, {
          tasks: schedule.tasks.filter((t) => t.id !== taskId),
          unscheduledTasks: schedule.unscheduledTasks.filter(
            (t) => t.id !== taskId
          ),
        });
      }
    }
  }

  /**
   * Ensure today's daily note exists and open it
   */
  private async ensureAndOpenTodayDailyNote(): Promise<void> {
    try {
      const today = new Date();
      const dateString = today.toISOString().split("T")[0]; // YYYY-MM-DD format
      const dailyNotesFolder = this.settings.dailyNotesFolder || "Daily Notes";
      const dailyNotePath = `${dailyNotesFolder}/${dateString}.md`;

      // Check if the daily note already exists
      const existingFile =
        this.plugin.app.vault.getAbstractFileByPath(dailyNotePath);

      if (!existingFile) {
        // Ensure the daily notes folder exists
        const folderExists =
          this.plugin.app.vault.getAbstractFileByPath(dailyNotesFolder);
        if (!folderExists) {
          await this.plugin.app.vault.createFolder(dailyNotesFolder);
        }

        // Create the daily note with basic content
        const content = this.generateDailyNoteContent(dateString);
        await this.plugin.app.vault.create(dailyNotePath, content);
      }

      // Open the daily note
      await this.plugin.app.workspace.openLinkText(dailyNotePath, "", false);
    } catch (error) {
      console.error("Failed to ensure and open today's daily note:", error);
    }
  }

  /**
   * Generate content for a new daily note
   */
  private generateDailyNoteContent(dateString: string): string {
    return `# ${dateString}

## Tasks
<!-- Tasks scheduled for today will appear here -->

## Notes
<!-- Daily notes and reflections -->

`;
  }

  /**
   * Add tasks to today's daily note and open it
   */
  async addTasksToTodayDailyNote(tasks: Task[]): Promise<void> {
    try {
      const today = new Date();
      const dateString = today.toISOString().split("T")[0]; // YYYY-MM-DD format
      const dailyNotesFolder = this.settings.dailyNotesFolder || "Daily Notes";
      const dailyNotePath = `${dailyNotesFolder}/${dateString}.md`;

      // Ensure today's daily note exists
      await this.ensureAndOpenTodayDailyNote();

      // Get the daily note file
      const dailyNoteFile =
        this.plugin.app.vault.getAbstractFileByPath(dailyNotePath);
      if (!dailyNoteFile || !(dailyNoteFile instanceof TFile)) {
        console.error("Daily note file not found or invalid");
        return;
      }

      // Read current content
      const currentContent = await this.plugin.app.vault.read(
        dailyNoteFile as any
      );

      // Add task links to the daily note
      const taskLinks: string[] = [];
      for (const task of tasks) {
        if (task.source?.filePath) {
          // Extract task title from file path (remove .md extension and path)
          const taskTitle =
            task.source.filePath.split("/").pop()?.replace(/\.md$/, "") ||
            task.title;
          const taskLink = `- [ ] [[${taskTitle}]]`;

          // Check if task already exists to avoid duplicates
          if (!currentContent.includes(taskLink)) {
            taskLinks.push(taskLink);
          }

          // Set the Do Date property in the task's front-matter to today's date
          await this.setTaskDoDate(task, today);
        }
      }

      // Add new task links to the daily note if any
      if (taskLinks.length > 0) {
        const tasksSection = "\n## Tasks\n" + taskLinks.join("\n") + "\n";

        // Find the Tasks section and add the links
        let updatedContent = currentContent;
        if (currentContent.includes("## Tasks")) {
          // Insert after the Tasks header
          updatedContent = currentContent.replace(
            /## Tasks\n(<!-- Tasks scheduled for today will appear here -->\n)?/,
            `## Tasks\n${taskLinks.join("\n")}\n`
          );
        } else {
          // Add Tasks section if it doesn't exist
          updatedContent = currentContent + tasksSection;
        }

        await this.plugin.app.vault.modify(
          dailyNoteFile as any,
          updatedContent
        );
      }

      // Open and focus on today's daily note
      await this.plugin.app.workspace.openLinkText(dailyNotePath, "", true);
    } catch (error) {
      console.error("Failed to add tasks to today's daily note:", error);
    }
  }

  /**
   * Set the Do Date property in a task's front-matter
   */
  private async setTaskDoDate(task: Task, date: Date): Promise<void> {
    try {
      if (!task.source?.filePath) return;

      const taskFile = this.plugin.app.vault.getAbstractFileByPath(
        task.source.filePath
      );
      if (!taskFile || !(taskFile instanceof TFile)) {
        return;
      }

      const dateString = date.toISOString().split("T")[0]; // YYYY-MM-DD format

      await this.plugin.app.fileManager.processFrontMatter(
        taskFile as any,
        (frontmatter) => {
          // Only set Do Date if it's not already set or if it's different from today
          if (
            !frontmatter["Do Date"] ||
            frontmatter["Do Date"] !== dateString
          ) {
            frontmatter["Do Date"] = dateString;
          }
        }
      );
    } catch (error) {
      console.error("Failed to set task Do Date:", error);
    }
  }
}
