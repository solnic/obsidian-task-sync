/**
 * TaskSyncPlugin Interface for Commands
 * Clean interface that commands can use without accessing implementation details
 */

import { App } from "obsidian";
import type { Task, Project, Area } from "../types/entities";
import type { FileContext } from "../main";
import type { TaskImportConfig } from "../types/integrations";
import type { AreaCreateData } from "../commands/core/CreateAreaCommand";
import type { ProjectCreateData } from "../commands/core/CreateProjectCommand";
import type {
  DailyNoteResult,
  AddTaskResult,
} from "../services/DailyNoteService";
import type { TaskSyncSettings } from "../components/ui/settings/types";

export interface TaskSyncPluginInterface {
  // Obsidian app instance
  readonly app: App;

  // Settings access
  readonly settings: TaskSyncSettings;

  // Entity creation methods
  createTask(taskData: any): Promise<Task>;
  createArea(areaData: AreaCreateData): Promise<Area>;
  createProject(projectData: ProjectCreateData): Promise<Project>;

  // Base management
  refresh(): Promise<void>;
  refreshBaseViews(): Promise<void>;

  // Context detection
  detectCurrentFileContext(): FileContext;
  getCurrentContext(): FileContext;

  // Context service access
  readonly contextService: {
    detectCurrentFileContext(): FileContext;
    detectFileContext(filePath: string): FileContext;
  };

  // Import configuration
  getDefaultImportConfig(): TaskImportConfig;

  // Service access for commands that need it
  readonly todoPromotionService: {
    promoteTodoToTask(): Promise<{ message: string }>;
    revertPromotedTodo(): Promise<{ message: string }>;
  };

  readonly dailyNoteService: {
    ensureTodayDailyNote(): Promise<DailyNoteResult>;
    addTaskToToday(taskPath: string): Promise<AddTaskResult>;
  };

  readonly cacheManager: {
    getStats(): Promise<Array<{ cacheKey: string; keyCount: number }>>;
    clearAllCaches(): Promise<void>;
  };

  readonly appleCalendarService: {
    isPlatformSupported(): boolean;
    isEnabled(): boolean;
    checkPermissions(): Promise<boolean>;
    getTodayEvents(): Promise<any[]>;
  };

  readonly taskSchedulingService: {
    isEnabled(): boolean;
    scheduleTask(
      task: any,
      config: any
    ): Promise<{ success: boolean; error?: string }>;
    isTaskScheduled(taskPath: string): Promise<boolean>;
    getAvailableCalendars(): Promise<any[]>;
  };

  readonly appleRemindersService: {
    isPlatformSupported(): boolean;
    checkPermissions(): Promise<any>; // Returns AppleRemindersResult<AppleRemindersPermission>
    fetchReminders(): Promise<any>; // Returns AppleRemindersResult<AppleReminder[]>
    importReminderAsTask(reminder: any, config: any): Promise<any>; // Returns ImportResult
  };
}
