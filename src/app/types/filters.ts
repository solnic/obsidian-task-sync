/**
 * Filter system for Obsidian Bases generation
 * Provides a declarative way to build complex filter conditions
 *
 * Obsidian Bases uses expression-based filters, not object-based filters.
 * Filters are JavaScript-like expressions such as:
 * - file.inFolder("Tasks")
 * - note["Done"] == false
 * - note["Priority"] == "High"
 * - !note.hasProperty("Parent task") || note["Parent task"] == null
 */

// ============================================================================
// FILTER INTERFACES
// ============================================================================

export interface FilterCondition {
  toFilterObject(): any;
}

/**
 * Property-based filter (e.g., Done == false, Priority == "High")
 * Generates expression strings like: note["Property"] == value
 */
export class PropertyFilter implements FilterCondition {
  constructor(
    private property: string,
    private operator:
      | "=="
      | "!="
      | ">"
      | "<"
      | ">="
      | "<="
      | "contains"
      | "isEmpty"
      | "isNotEmpty",
    private value?: any
  ) {}

  toFilterObject(): string {
    // Special handling for "Done" property - use direct property access
    if (this.property === "Done") {
      return `Done ${this.operator} ${this.formatValue(this.value)}`;
    }

    const propRef = `note["${this.property}"]`;

    if (this.operator === "isEmpty") {
      // Use .isEmpty() method like Bases expects
      return `${propRef}.isEmpty()`;
    }
    if (this.operator === "isNotEmpty") {
      return `!${propRef}.isEmpty()`;
    }
    if (this.operator === "contains") {
      // For array properties, use .contains()
      return `${propRef}.contains(${this.formatValue(this.value)})`;
    }

    return `${propRef} ${this.operator} ${this.formatValue(this.value)}`;
  }

  private formatValue(value: any): string {
    if (typeof value === "string") {
      return `"${value}"`;
    }
    if (typeof value === "boolean" || typeof value === "number") {
      return String(value);
    }
    if (value === null || value === undefined) {
      return "null";
    }
    return JSON.stringify(value);
  }
}

/**
 * File system-based filter (e.g., folder == "Tasks", name contains "project")
 * Generates expression strings like: file.inFolder("Tasks")
 */
export class FileSystemFilter implements FilterCondition {
  constructor(
    private target: "folder" | "name" | "path",
    private operator: "==" | "!=" | "contains" | "startsWith" | "endsWith",
    private value: string
  ) {}

  toFilterObject(): string {
    // Use Obsidian's built-in file functions when available
    if (this.target === "folder" && this.operator === "==") {
      return `file.inFolder("${this.value}")`;
    }

    // For other cases, use direct property access
    const propRef = `file.${this.target}`;

    if (this.operator === "contains") {
      return `${propRef}.contains("${this.value}")`;
    }
    if (this.operator === "startsWith") {
      return `${propRef}.startsWith("${this.value}")`;
    }
    if (this.operator === "endsWith") {
      return `${propRef}.endsWith("${this.value}")`;
    }

    return `${propRef} ${this.operator} "${this.value}"`;
  }
}

/**
 * Custom filter with raw expression string
 */
export class CustomFilter implements FilterCondition {
  constructor(private expression: string) {}

  toFilterObject(): string {
    return this.expression;
  }
}

/**
 * Composite filter for AND/OR operations
 */
export class CompositeFilter implements FilterCondition {
  constructor(
    private operator: "and" | "or",
    private conditions: FilterCondition[]
  ) {}

  toFilterObject(): any {
    return {
      [this.operator]: this.conditions.map((condition) =>
        condition.toFilterObject()
      ),
    };
  }
}

// ============================================================================
// FILTER BUILDER
// ============================================================================

/**
 * Filter builder for creating common filter patterns
 */
export class FilterBuilder {
  /**
   * Create a filter for tasks in a specific folder
   */
  static inFolder(folderPath: string): FileSystemFilter {
    return new FileSystemFilter("folder", "==", folderPath);
  }

  /**
   * Create a filter for non-done items
   */
  static notDone(): PropertyFilter {
    return new PropertyFilter("Done", "==", false);
  }

  /**
   * Create a filter for done items
   */
  static done(): PropertyFilter {
    return new PropertyFilter("Done", "==", true);
  }

  /**
   * Create a filter for items without parent tasks
   */
  static noParentTask(): PropertyFilter {
    return new PropertyFilter("Parent task", "isEmpty");
  }

  /**
   * Create a filter for items with a specific parent task
   */
  static childrenOf(parentTaskName: string): PropertyFilter {
    return new PropertyFilter("Parent task", "contains", parentTaskName);
  }

  /**
   * Create a filter for items in a specific project
   * @param projectName - The display name of the project
   * @param projectPath - The full path to the project file (e.g., "Projects/Foo Bar.md")
   */
  static inProject(projectName: string, projectPath?: string): CustomFilter {
    // Based on user example: Project == link("Task Sync")
    // Format: Project == link("displayName") - just the display name, no path needed
    // Note: Uses Project directly (capital P), not note["Project"]
    return new CustomFilter(`Project == link("${projectName}")`);
  }

  /**
   * Create a filter for items in a specific area
   */
  static inArea(areaName: string): PropertyFilter {
    return new PropertyFilter("Areas", "contains", areaName);
  }

  /**
   * Create a filter for items of a specific category
   */
  static ofCategory(categoryName: string): PropertyFilter {
    return new PropertyFilter("Category", "==", categoryName);
  }

  /**
   * Create a filter for items with a specific priority
   */
  static withPriority(priorityName: string): PropertyFilter {
    return new PropertyFilter("Priority", "==", priorityName);
  }

  /**
   * Create a filter for items with a specific status
   */
  static withStatus(statusName: string): PropertyFilter {
    return new PropertyFilter("Status", "==", statusName);
  }

  /**
   * Create a filter for files with a specific name
   */
  static fileName(fileName: string): FileSystemFilter {
    return new FileSystemFilter("name", "==", fileName);
  }

  /**
   * Create an AND composite filter
   */
  static and(...conditions: FilterCondition[]): CompositeFilter {
    return new CompositeFilter("and", conditions);
  }

  /**
   * Create an OR composite filter
   */
  static or(...conditions: FilterCondition[]): CompositeFilter {
    return new CompositeFilter("or", conditions);
  }

  /**
   * Create a custom filter from raw expression string
   */
  static custom(expression: string): CustomFilter {
    return new CustomFilter(expression);
  }
}
