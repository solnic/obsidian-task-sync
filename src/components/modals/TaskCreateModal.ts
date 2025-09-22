/**
 * Task creation data interface
 * Used by task creation modals and components
 */

export interface TaskCreateData {
  title: string;
  category?: string;
  areas?: string[]; // Array as per BaseConfiguration
  parentTask?: string;
  tags: string[];
  project?: string;
  done: boolean;
  status: string;
  priority?: string;
  content?: string; // Changed from description to content
  dueDate?: string;
}
