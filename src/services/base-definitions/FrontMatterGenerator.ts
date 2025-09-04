/**
 * Front-Matter Generator
 * Generates front-matter for tasks, areas, and projects using base definitions
 */

import { FRONTMATTER_FIELDS } from './BaseConfigurations';
import { TaskCreateData } from '../../components/modals/TaskCreateModal';
import { ProjectCreateData } from '../../components/modals/ProjectCreateModal';
import { AreaCreateData } from '../../components/modals/AreaCreateModal';

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
  const fields = FRONTMATTER_FIELDS.task;
  const frontMatter: string[] = ['---'];

  // Add all defined fields
  for (const [fieldName, fieldConfig] of Object.entries(fields)) {
    const value = getFieldValue(taskData, fieldName, fieldConfig);
    if (value !== undefined && value !== null) {
      frontMatter.push(formatFrontMatterField(fieldName, value, fieldConfig));
    }
  }

  // Add custom fields
  if (options.customFields) {
    for (const [key, value] of Object.entries(options.customFields)) {
      if (value !== undefined && value !== null) {
        frontMatter.push(`${key}: ${formatValue(value)}`);
      }
    }
  }

  frontMatter.push('---', '');

  // Add description or template content
  if (options.includeDescription && taskData.description) {
    frontMatter.push(taskData.description, '');
  } else if (options.templateContent) {
    frontMatter.push(options.templateContent, '');
  } else {
    frontMatter.push('Task description...', '');
  }

  return frontMatter.join('\n');
}

/**
 * Generate front-matter for a project
 */
export function generateProjectFrontMatter(
  projectData: ProjectCreateData,
  options: FrontMatterOptions = {}
): string {
  const fields = FRONTMATTER_FIELDS.project;
  const frontMatter: string[] = ['---'];

  // Add all defined fields
  for (const [fieldName, fieldConfig] of Object.entries(fields)) {
    const value = getFieldValue(projectData, fieldName, fieldConfig);
    // Always include Areas field for projects, even if empty
    if (value !== undefined && value !== null || fieldName === 'Areas') {
      const displayValue = value !== undefined && value !== null ? value : '';
      frontMatter.push(formatFrontMatterField(fieldName, displayValue, fieldConfig));
    }
  }

  // Add custom fields
  if (options.customFields) {
    for (const [key, value] of Object.entries(options.customFields)) {
      if (value !== undefined && value !== null) {
        frontMatter.push(`${key}: ${formatValue(value)}`);
      }
    }
  }

  frontMatter.push('---', '');

  // Add project template content
  if (options.templateContent) {
    frontMatter.push(options.templateContent);
  } else {
    frontMatter.push(
      '## Notes',
      '',
      projectData.description || 'This is a cool project',
      '',
      '## Tasks',
      '',
      `![[${sanitizeFileName(projectData.name)}.base]]`,
      ''
    );
  }

  return frontMatter.join('\n');
}

/**
 * Generate front-matter for an area
 */
export function generateAreaFrontMatter(
  areaData: AreaCreateData,
  options: FrontMatterOptions = {}
): string {
  const fields = FRONTMATTER_FIELDS.area;
  const frontMatter: string[] = ['---'];

  // Add all defined fields
  for (const [fieldName, fieldConfig] of Object.entries(fields)) {
    const value = getFieldValue(areaData, fieldName, fieldConfig);
    if (value !== undefined && value !== null) {
      frontMatter.push(formatFrontMatterField(fieldName, value, fieldConfig));
    }
  }

  // Add custom fields
  if (options.customFields) {
    for (const [key, value] of Object.entries(options.customFields)) {
      if (value !== undefined && value !== null) {
        frontMatter.push(`${key}: ${formatValue(value)}`);
      }
    }
  }

  frontMatter.push('---', '');

  // Add area template content
  if (options.templateContent) {
    frontMatter.push(options.templateContent);
  } else {
    frontMatter.push(
      '## Notes',
      '',
      areaData.description || 'This is an important area of responsibility',
      '',
      '## Tasks',
      '',
      `![[${sanitizeFileName(areaData.name)}.base]]`,
      ''
    );
  }

  return frontMatter.join('\n');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get field value from data object, applying defaults if needed
 */
function getFieldValue(data: any, fieldName: string, fieldConfig: FrontMatterField): any {
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
  if ((value === undefined || value === null) && fieldConfig.default !== undefined) {
    value = fieldConfig.default;
  }

  // Special handling for specific fields
  if (fieldName === 'Name' && !value && data.name) {
    value = data.name;
  }

  return value;
}

/**
 * Format a front-matter field
 */
function formatFrontMatterField(fieldName: string, value: any, fieldConfig: FrontMatterField): string {
  const formattedValue = formatValue(value, fieldConfig.type);
  return `${fieldName}: ${formattedValue}`;
}

/**
 * Format a value based on its type
 */
function formatValue(value: any, type?: string): string {
  if (value === null || value === undefined) {
    return '';
  }

  switch (type) {
    case 'array':
      if (Array.isArray(value)) {
        return value.length > 0 ? value.join(', ') : '';
      }
      return String(value);

    case 'boolean':
      return String(Boolean(value));

    case 'number':
      return String(Number(value));

    case 'string':
    default:
      return String(value);
  }
}

/**
 * Sanitize file name for use in links
 * Simple version - should match the existing sanitizeFileName utility
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate front-matter data against field definitions
 */
export function validateFrontMatterData(
  data: FrontMatterData,
  type: 'task' | 'project' | 'area'
): { isValid: boolean; errors: string[] } {
  const fields = FRONTMATTER_FIELDS[type];
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
 * Extract front-matter data from existing content
 */
export function extractFrontMatterData(content: string): FrontMatterData | null {
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontMatterMatch) {
    return null;
  }

  const frontMatterText = frontMatterMatch[1];
  const data: FrontMatterData = {};

  // Simple YAML-like parsing for front-matter
  const lines = frontMatterText.split('\n');
  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      data[key.trim()] = value.trim();
    }
  }

  return data;
}
