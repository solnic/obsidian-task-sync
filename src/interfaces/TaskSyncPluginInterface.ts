/**
 * TaskSyncPlugin Interface for Commands
 * Clean interface that commands can use without accessing implementation details
 */

import { App } from "obsidian";
import type { Task, Project, Area } from "../types/entities";
import type { FileContext } from "../main";
import type { TaskImportConfig } from "../types/integrations";
import type { AreaCreateData } from "../components/modals/AreaCreateModal";
import type { ProjectCreateData } from "../components/modals/ProjectCreateModal";
import type {
  DailyNoteResult,
  AddTaskResult,
} from "../services/DailyNoteService";

export interface TaskSyncPluginInterface {
  // Obsidian app instance
  readonly app: App;

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

  // Modal service access
  readonly modalService: {
    openTaskCreateModal(context?: FileContext): Promise<void>;
    openAreaCreateModal(): void;
    openProjectCreateModal(): void;
    openTaskScheduleModal(
      task: any,
      onSubmit: (scheduleData: any) => Promise<void>
    ): void;
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
  };

  readonly appleRemindersService: {
    isPlatformSupported(): boolean;
    checkPermissions(): Promise<any>; // Returns AppleRemindersResult<AppleRemindersPermission>
    fetchReminders(): Promise<any>; // Returns AppleRemindersResult<AppleReminder[]>
    importReminderAsTask(reminder: any, config: any): Promise<any>; // Returns ImportResult
  };
}
