/**
 * Base File Parser Service
 * Parses and creates .base files for Obsidian Bases plugin integration
 */

import { BaseFile, BaseFileFilter, BaseFileSorting, BaseFileGrouping } from '../types';

export class BaseFileParser {
  
  /**
   * Parse a .base file content into a BaseFile object
   */
  parseBaseFile(content: string, filePath: string): BaseFile {
    const lines = content.split('\n');
    const baseFile: Partial<BaseFile> = {
      id: this.generateId(),
      name: this.extractNameFromPath(filePath),
      filePath,
      fileExists: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      entityIds: [],
      autoGenerate: false,
      autoUpdate: false
    };

    let currentSection = '';
    let inCodeBlock = false;
    let codeBlockContent = '';

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Handle code blocks
      if (trimmedLine.startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          this.parseCodeBlock(codeBlockContent, baseFile);
          codeBlockContent = '';
          inCodeBlock = false;
        } else {
          // Start of code block
          inCodeBlock = true;
          if (trimmedLine.includes('base')) {
            currentSection = 'base';
          }
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent += line + '\n';
        continue;
      }

      // Parse frontmatter
      if (trimmedLine === '---') {
        currentSection = currentSection === 'frontmatter' ? '' : 'frontmatter';
        continue;
      }

      if (currentSection === 'frontmatter') {
        this.parseFrontmatterLine(trimmedLine, baseFile);
      }

      // Parse inline properties
      if (trimmedLine.startsWith('view:')) {
        baseFile.viewType = this.parseViewType(trimmedLine);
      } else if (trimmedLine.startsWith('type:')) {
        baseFile.entityType = this.parseEntityType(trimmedLine);
      } else if (trimmedLine.startsWith('filter:')) {
        if (!baseFile.filters) baseFile.filters = [];
        const filter = this.parseFilter(trimmedLine);
        if (filter) baseFile.filters.push(filter);
      } else if (trimmedLine.startsWith('sort:')) {
        baseFile.sorting = this.parseSorting(trimmedLine);
      } else if (trimmedLine.startsWith('group:')) {
        baseFile.grouping = this.parseGrouping(trimmedLine);
      }
    }

    // Set defaults
    baseFile.viewType = baseFile.viewType || 'kanban';
    baseFile.entityType = baseFile.entityType || 'task';
    baseFile.filters = baseFile.filters || [];
    baseFile.sorting = baseFile.sorting || { field: 'name', direction: 'asc' };

    return baseFile as BaseFile;
  }

  /**
   * Generate a .base file content from a BaseFile object
   */
  generateBaseFile(baseFile: BaseFile, entities: any[]): string {
    const lines: string[] = [];

    // Add frontmatter
    lines.push('---');
    lines.push(`title: ${baseFile.name}`);
    lines.push(`view: ${baseFile.viewType}`);
    lines.push(`type: ${baseFile.entityType}`);
    if (baseFile.autoGenerate) {
      lines.push('auto-generate: true');
    }
    if (baseFile.autoUpdate) {
      lines.push('auto-update: true');
    }
    lines.push('---');
    lines.push('');

    // Add description
    if (baseFile.description) {
      lines.push(baseFile.description);
      lines.push('');
    }

    // Add base configuration
    lines.push('```base');
    lines.push(`view: ${baseFile.viewType}`);
    lines.push(`type: ${baseFile.entityType}`);

    // Add filters
    if (baseFile.filters && baseFile.filters.length > 0) {
      lines.push('filters:');
      for (const filter of baseFile.filters) {
        if (filter.enabled) {
          lines.push(`  - field: ${filter.field}`);
          lines.push(`    operator: ${filter.operator}`);
          lines.push(`    value: ${this.formatFilterValue(filter.value)}`);
        }
      }
    }

    // Add sorting
    if (baseFile.sorting) {
      lines.push('sort:');
      lines.push(`  field: ${baseFile.sorting.field}`);
      lines.push(`  direction: ${baseFile.sorting.direction}`);
      if (baseFile.sorting.secondary) {
        lines.push('  secondary:');
        lines.push(`    field: ${baseFile.sorting.secondary.field}`);
        lines.push(`    direction: ${baseFile.sorting.secondary.direction}`);
      }
    }

    // Add grouping
    if (baseFile.grouping) {
      lines.push('group:');
      lines.push(`  field: ${baseFile.grouping.field}`);
      lines.push(`  showEmpty: ${baseFile.grouping.showEmpty}`);
      if (baseFile.grouping.customOrder) {
        lines.push('  customOrder:');
        for (const order of baseFile.grouping.customOrder) {
          lines.push(`    - ${order}`);
        }
      }
    }

    lines.push('```');
    lines.push('');

    // Add entity references
    if (entities && entities.length > 0) {
      lines.push('## Items');
      lines.push('');
      for (const entity of entities) {
        if (entity.filePath) {
          lines.push(`- [[${entity.name}]]`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Validate a .base file content
   */
  validateBaseFile(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for required sections
    if (!content.includes('```base')) {
      errors.push('Missing base configuration block');
    }

    // Check for valid view type
    const viewMatch = content.match(/view:\s*(\w+)/);
    if (viewMatch) {
      const viewType = viewMatch[1];
      if (!['kanban', 'list', 'calendar', 'timeline'].includes(viewType)) {
        errors.push(`Invalid view type: ${viewType}`);
      }
    }

    // Check for valid entity type
    const typeMatch = content.match(/type:\s*(\w+)/);
    if (typeMatch) {
      const entityType = typeMatch[1];
      if (!['task', 'project', 'area'].includes(entityType)) {
        errors.push(`Invalid entity type: ${entityType}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private parseCodeBlock(content: string, baseFile: Partial<BaseFile>): void {
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('view:')) {
        baseFile.viewType = this.parseViewType(trimmedLine);
      } else if (trimmedLine.startsWith('type:')) {
        baseFile.entityType = this.parseEntityType(trimmedLine);
      } else if (trimmedLine.startsWith('filters:')) {
        // Parse filters section (would need more complex parsing)
        baseFile.filters = [];
      } else if (trimmedLine.startsWith('sort:')) {
        // Parse sort section (would need more complex parsing)
      } else if (trimmedLine.startsWith('group:')) {
        // Parse group section (would need more complex parsing)
      }
    }
  }

  private parseFrontmatterLine(line: string, baseFile: Partial<BaseFile>): void {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;

    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();

    switch (key) {
      case 'title':
        baseFile.name = value.replace(/['"]/g, '');
        break;
      case 'view':
        baseFile.viewType = this.parseViewType(`view: ${value}`);
        break;
      case 'type':
        baseFile.entityType = this.parseEntityType(`type: ${value}`);
        break;
      case 'auto-generate':
        baseFile.autoGenerate = value.toLowerCase() === 'true';
        break;
      case 'auto-update':
        baseFile.autoUpdate = value.toLowerCase() === 'true';
        break;
    }
  }

  private parseViewType(line: string): 'kanban' | 'list' | 'calendar' | 'timeline' {
    const match = line.match(/view:\s*(\w+)/);
    const viewType = match?.[1]?.toLowerCase();
    
    if (['kanban', 'list', 'calendar', 'timeline'].includes(viewType)) {
      return viewType as 'kanban' | 'list' | 'calendar' | 'timeline';
    }
    
    return 'kanban'; // default
  }

  private parseEntityType(line: string): 'task' | 'project' | 'area' {
    const match = line.match(/type:\s*(\w+)/);
    const entityType = match?.[1]?.toLowerCase();
    
    if (['task', 'project', 'area'].includes(entityType)) {
      return entityType as 'task' | 'project' | 'area';
    }
    
    return 'task'; // default
  }

  private parseFilter(line: string): BaseFileFilter | null {
    // Simple filter parsing - in production this would be more sophisticated
    const match = line.match(/filter:\s*(\w+)\s*(\w+)\s*(.+)/);
    if (!match) return null;

    return {
      field: match[1],
      operator: match[2] as any,
      value: match[3].trim(),
      enabled: true
    };
  }

  private parseSorting(line: string): BaseFileSorting {
    const match = line.match(/sort:\s*(\w+)\s*(asc|desc)?/);
    return {
      field: match?.[1] || 'name',
      direction: (match?.[2] as 'asc' | 'desc') || 'asc'
    };
  }

  private parseGrouping(line: string): BaseFileGrouping | undefined {
    const match = line.match(/group:\s*(\w+)/);
    if (!match) return undefined;

    return {
      field: match[1],
      showEmpty: true
    };
  }

  private formatFilterValue(value: any): string {
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    return String(value);
  }

  private extractNameFromPath(filePath: string): string {
    const fileName = filePath.split('/').pop() || '';
    return fileName.replace(/\.(base\.)?md$/, '');
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}
