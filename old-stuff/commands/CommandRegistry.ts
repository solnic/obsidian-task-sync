/**
 * Command Registry
 * Central registry for all plugin commands
 */

import { Command, type CommandContext } from "./Command";

// Core commands
import { AddTaskCommand } from "./core/AddTaskCommand";
import { CreateAreaCommand } from "./core/CreateAreaCommand";
import { CreateProjectCommand } from "./core/CreateProjectCommand";
import { RefreshCommand } from "./core/RefreshCommand";
import { RefreshBaseViewsCommand } from "./core/RefreshBaseViewsCommand";

// View commands
import { OpenTasksViewCommand } from "./views/OpenTasksViewCommand";
import { OpenContextTabCommand } from "./views/OpenContextTabCommand";
import { OpenTaskPlanningCommand } from "./views/OpenTaskPlanningCommand";
import { StartDailyPlanningCommand } from "./views/StartDailyPlanningCommand";

// GitHub commands
import { ImportGitHubIssueCommand } from "./github/ImportGitHubIssueCommand";
import { ImportAllGitHubIssuesCommand } from "./github/ImportAllGitHubIssuesCommand";

// Todo commands
import { PromoteTodoToTaskCommand } from "./todo/PromoteTodoToTaskCommand";
import { RevertPromotedTodoCommand } from "./todo/RevertPromotedTodoCommand";

// Daily commands
import { AddToTodayCommand } from "./daily/AddToTodayCommand";

// Apple Reminders commands
import { ImportAppleRemindersCommand } from "./apple-reminders/ImportAppleRemindersCommand";
import { CheckAppleRemindersPermissionsCommand } from "./apple-reminders/CheckAppleRemindersPermissionsCommand";

// Apple Calendar commands
import { InsertCalendarEventsCommand } from "./apple-calendar/InsertCalendarEventsCommand";
import { CheckAppleCalendarPermissionsCommand } from "./apple-calendar/CheckAppleCalendarPermissionsCommand";
import { ScheduleTaskCommand } from "./apple-calendar/ScheduleTaskCommand";

// Cache commands
import { ClearAllCachesCommand } from "./cache/ClearAllCachesCommand";
import { ShowCacheStatsCommand } from "./cache/ShowCacheStatsCommand";

export class CommandRegistry {
  private commands: Command[] = [];
  private context: CommandContext;

  constructor(context: CommandContext) {
    this.context = context;
    this.initializeCommands();
  }

  /**
   * Initialize all commands
   */
  private initializeCommands(): void {
    // Core commands
    this.commands.push(new AddTaskCommand(this.context));
    this.commands.push(new CreateAreaCommand(this.context));
    this.commands.push(new CreateProjectCommand(this.context));
    this.commands.push(new RefreshCommand(this.context));
    this.commands.push(new RefreshBaseViewsCommand(this.context));

    // View commands
    this.commands.push(new OpenTasksViewCommand(this.context));
    this.commands.push(new OpenContextTabCommand(this.context));
    this.commands.push(new OpenTaskPlanningCommand(this.context));
    this.commands.push(new StartDailyPlanningCommand(this.context));

    // GitHub commands
    this.commands.push(new ImportGitHubIssueCommand(this.context));
    this.commands.push(new ImportAllGitHubIssuesCommand(this.context));

    // Todo commands
    this.commands.push(new PromoteTodoToTaskCommand(this.context));
    this.commands.push(new RevertPromotedTodoCommand(this.context));

    // Daily commands
    this.commands.push(new AddToTodayCommand(this.context));

    // Apple Reminders commands
    this.commands.push(new ImportAppleRemindersCommand(this.context));
    this.commands.push(new CheckAppleRemindersPermissionsCommand(this.context));

    // Apple Calendar commands
    this.commands.push(new InsertCalendarEventsCommand(this.context));
    this.commands.push(new CheckAppleCalendarPermissionsCommand(this.context));
    this.commands.push(new ScheduleTaskCommand(this.context));

    // Cache commands
    this.commands.push(new ClearAllCachesCommand(this.context));
    this.commands.push(new ShowCacheStatsCommand(this.context));
  }

  /**
   * Get all commands
   */
  getCommands(): Command[] {
    return this.commands;
  }

  /**
   * Get available commands (filtered by availability)
   */
  getAvailableCommands(): Command[] {
    return this.commands.filter((command) => command.isAvailable());
  }

  /**
   * Register all available commands
   */
  registerAll(): void {
    const availableCommands = this.getAvailableCommands();

    console.log(
      `🔧 CommandRegistry: Registering ${availableCommands.length} commands`
    );

    for (const command of availableCommands) {
      command.register();
    }
  }

  /**
   * Update settings for all commands
   */
  updateSettings(settings: any): void {
    for (const command of this.commands) {
      command.updateSettings(settings);
    }
  }
}
