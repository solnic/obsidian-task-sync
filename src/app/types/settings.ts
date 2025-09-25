/**
 * Settings types for the Task Sync plugin
 * Simplified version for the new architecture
 */

export interface TaskSyncSettings {
  // Core settings
  areasFolder: string;
  projectsFolder: string;
  tasksFolder: string;
  
  // Integration settings
  enableGitHubIntegration: boolean;
  enableAppleRemindersIntegration: boolean;
  enableAppleCalendarIntegration: boolean;
  
  // UI settings
  defaultView: string;
  showCompletedTasks: boolean;
  
  // File management
  autoCreateFolders: boolean;
  useTemplates: boolean;
}

export const DEFAULT_SETTINGS: TaskSyncSettings = {
  areasFolder: "Areas",
  projectsFolder: "Projects", 
  tasksFolder: "Tasks",
  enableGitHubIntegration: false,
  enableAppleRemindersIntegration: false,
  enableAppleCalendarIntegration: false,
  defaultView: "tasks",
  showCompletedTasks: true,
  autoCreateFolders: true,
  useTemplates: false,
};
