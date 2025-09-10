/**
 * Settings module exports
 */

export { TaskSyncSettingTab } from "./SettingsTab";
export { FolderSuggestComponent, FileSuggestComponent } from "./suggest";
export {
  DEFAULT_SETTINGS,
  DEFAULT_FOLDER_PATHS,
  DEFAULT_TEMPLATE_NAMES,
  VALIDATION_PATTERNS,
} from "./defaults";
export {
  validateFolderPath,
  validateFileName,
  validateBaseFileName,
  validateTemplateFileName,
} from "./validation";
export { TASK_TYPE_COLORS } from "./types";
export type {
  TaskSyncSettings,
  TaskType,
  TaskTypeColor,
  ValidationResult,
  SettingsSection,
  FolderSuggestOptions,
  FileSuggestOptions,
} from "./types";
