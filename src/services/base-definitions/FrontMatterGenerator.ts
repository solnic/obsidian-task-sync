/**
 * Front-Matter Generator
 * Generates front-matter for tasks, areas, and projects using base definitions
 * Uses gray-matter for robust YAML front-matter handling
 */

import matter from 'gray-matter';
import {
  PropertyDefinition,
  generateTaskFrontMatter as getTaskPropertyDefinitions,
  generateProjectFrontMatter as getProjectPropertyDefinitions,
  generateAreaFrontMatter as getAreaPropertyDefinitions,
  PROPERTY_REGISTRY,
  PROPERTY_SETS
} from './BaseConfigurations';
import { TaskCreateData } from '../../components/modals/TaskCreateModal';
import { ProjectCreateData } from '../../components/modals/ProjectCreateModal';
import { AreaCreateData } from '../../components/modals/AreaCreateModal';
import { sanitizeFileName } from '../../utils/fileNameSanitizer';

// ============================================================================
// TYPES
// ============================================================================

export interface FrontMatterField {
  type: 'string' | 'boolean' | 'array' | 'number';
  default?: any;
}

export interface FrontMatterData {
  [key: string]: any;
}

export interface FrontMatterOptions {
  includeDescription?: boolean;
  customFields?: Record<string, any>;
  templateContent?: string;
  settings?: import('../../components/ui/settings/types').TaskSyncSettings;
}

// ============================================================================
// FRONT-MATTER GENERATORS
// ============================================================================

/**
 * Generate front-matter for a task
 */
export function generateTaskFrontMatter(
  taskData: TaskCreateData,
  options: FrontMatterOptions = {}
): string {
  // Get property order from settings or use default
  const propertyOrder = options.settings?.taskPropertyOrder || PROPERTY_SETS.TASK_FRONTMATTER;

  // Validate property order - ensure all required properties are present
  const requiredProperties = PROPERTY_SETS.TASK_FRONTMATTER;
  const isValidOrder = requiredProperties.every(prop => propertyOrder.includes(prop)) &&
    propertyOrder.every(prop => requiredProperties.includes(prop as typeof requiredProperties[number]));

  // Use validated order or fall back to default
  const finalPropertyOrder = isValidOrder ? propertyOrder : requiredProperties;

  const frontMatterData: Record<string, any> = {};

  // Add all defined fields in the correct order
  for (const propertyKey of finalPropertyOrder) {
    const prop = PROPERTY_REGISTRY[propertyKey as keyof typeof PROPERTY_REGISTRY];
    if (!prop) continue;

    const value = getFieldValue(taskData, prop.name, prop);
    if (value !== undefined && value !== null) {
      frontMatterData[prop.name] = value;
    }
  }

  // For Type field, use the default value if not provided
  if (!frontMatterData.Type) {
    frontMatterData.Type = 'Task';
  }

  // Add custom fields
  if (options.customFields) {
    Object.assign(frontMatterData, options.customFields);
  }

  // Generate content
  let content = '';
  if (taskData.description) {
    content = taskData.description;
  } else if (options.templateContent) {
    content = options.templateContent;
  } else {
    content = 'This task uses default generation';
  }

  // Use gray-matter to generate the front-matter
  return matter.stringify(content, frontMatterData);
}

/**
 * Generate front-matter for a project
 */
export function generateProjectFrontMatter(
  projectData: ProjectCreateData,
  options: FrontMatterOptions = {}
): string {
  const properties = getProjectPropertyDefinitions();
  const frontMatterData: Record<string, any> = {};

  // Add all defined fields in the correct order
  for (const prop of properties) {
    const value = getFieldValue(projectData, prop.name, prop);
    if (value !== undefined && value !== null) {
      frontMatterData[prop.name] = value;
    }
  }

  // Always include Areas field for projects, even if empty (as array)
  if (!frontMatterData.Areas) {
    frontMatterData.Areas = [];
  }

  // For Type field, use the default value if not provided
  if (!frontMatterData.Type) {
    frontMatterData.Type = 'Project';
  }

  // Add custom fields
  if (options.customFields) {
    Object.assign(frontMatterData, options.customFields);
  }

  // Generate content
  let content = '';
  if (options.templateContent) {
    content = options.templateContent;
  } else {
    content = [
      '## Notes',
      '',
      projectData.description || 'This is a cool project',
      '',
      '## Tasks',
      '',
      `![[${sanitizeFileName(projectData.name)}.base]]`,
      ''
    ].join('\n');
  }

  // Use gray-matter to generate the front-matter
  return matter.stringify(content, frontMatterData);
}

/**
 * Generate front-matter for an area
 */
export function generateAreaFrontMatter(
  areaData: AreaCreateData,
  options: FrontMatterOptions = {}
): string {
  const properties = getAreaPropertyDefinitions();
  const frontMatterData: Record<string, any> = {};

  // Add all defined fields in the correct order
  for (const prop of properties) {
    const value = getFieldValue(areaData, prop.name, prop);
    if (value !== undefined && value !== null) {
      frontMatterData[prop.name] = value;
    }
  }

  // For Type field, use the default value if not provided
  if (!frontMatterData.Type) {
    frontMatterData.Type = 'Area';
  }

  // Add custom fields
  if (options.customFields) {
    Object.assign(frontMatterData, options.customFields);
  }

  // Generate content
  let content = '';
  if (options.templateContent) {
    content = options.templateContent;
  } else {
    content = [
      '## Notes',
      '',
      areaData.description || 'This is an important area of responsibility',
      '',
      '## Tasks',
      '',
      `![[${sanitizeFileName(areaData.name)}.base]]`,
      ''
    ].join('\n');
  }

  // Use gray-matter to generate the front-matter
  return matter.stringify(content, frontMatterData);
}

/**
 * Generate front-matter for a parent task
 */
export function generateParentTaskFrontMatter(
  taskData: TaskCreateData,
  options: FrontMatterOptions = {}
): string {
  const properties = getTaskPropertyDefinitions();
  const frontMatterData: Record<string, any> = {};

  // Add all defined fields in the correct order
  for (const prop of properties) {
    const value = getFieldValue(taskData, prop.name, prop);
    if (value !== undefined && value !== null) {
      frontMatterData[prop.name] = value;
    }
  }

  // Override type for parent tasks
  frontMatterData.Type = 'Parent Task';

  // Add custom fields
  if (options.customFields) {
    Object.assign(frontMatterData, options.customFields);
  }

  // Generate content
  let content = '';
  if (options.includeDescription && taskData.description) {
    content = taskData.description;
  } else if (options.templateContent) {
    content = options.templateContent;
  } else {
    content = [
      'Parent task description...',
      '',
      '## Sub-tasks',
      '',
      `![[${sanitizeFileName(taskData.name)}.base]]`,
      ''
    ].join('\n');
  }

  // Use gray-matter to generate the front-matter
  return matter.stringify(content, frontMatterData);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get field value from data object, applying defaults if needed
 */
function getFieldValue(data: any, fieldName: string, propertyDef: PropertyDefinition): any {
  // Map field names to data properties
  const fieldMap: Record<string, string> = {
    'Title': 'name',
    'Name': 'name',
    'Type': 'type',
    'Areas': 'areas',
    'Parent task': 'parentTask',
    'Sub-tasks': 'subTasks',
    'tags': 'tags',
    'Project': 'project',
    'Done': 'done',
    'Status': 'status',
    'Priority': 'priority'
  };

  const dataKey = fieldMap[fieldName] || fieldName.toLowerCase();
  let value = data[dataKey];

  // Apply defaults for required fields or when value is undefined
  if ((value === undefined || value === null) && propertyDef.default !== undefined) {
    value = propertyDef.default;
  }

  // Special handling for specific fields
  if (fieldName === 'Name' && !value && data.name) {
    value = data.name;
  }

  // Handle array types - ensure they are arrays
  if (propertyDef.type === 'array' && value && !Array.isArray(value)) {
    value = [value];
  }

  return value;
}



// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate front-matter data against field definitions
 */
export function validateFrontMatterData(
  _data: FrontMatterData,
  _type: 'task' | 'project' | 'area'
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Basic validation - check for valid data types if needed
  // For now, we consider all front-matter valid since all fields are optional
  // This function can be extended later for specific validation rules

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Extract front-matter data from existing content using gray-matter
 */
export function extractFrontMatterData(content: string): FrontMatterData | null {
  try {
    const parsed = matter(content);
    return parsed.data || null;
  } catch (error) {
    console.error('Failed to parse front-matter:', error);
    return null;
  }
}
