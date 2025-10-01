/**
 * Filter system for Obsidian Bases generation
 * Provides a declarative way to build complex filter conditions
 */

// ============================================================================
// FILTER INTERFACES
// ============================================================================

export interface FilterCondition {
  toFilterObject(): any;
}

/**
 * Property-based filter (e.g., Done == false, Priority == "High")
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

  toFilterObject(): any {
    if (this.operator === "isEmpty") {
      return { property: this.property, operator: "isEmpty" };
    }
    if (this.operator === "isNotEmpty") {
      return { property: this.property, operator: "isNotEmpty" };
    }
    return {
      property: this.property,
      operator: this.operator,
      value: this.value,
    };
  }
}

/**
 * File system-based filter (e.g., folder == "Tasks", name contains "project")
 */
export class FileSystemFilter implements FilterCondition {
  constructor(
    private target: "folder" | "name" | "path",
    private operator: "==" | "!=" | "contains" | "startsWith" | "endsWith",
    private value: string
  ) {}

  toFilterObject(): any {
    return {
      file: {
        [this.target]: {
          operator: this.operator,
          value: this.value,
        },
      },
    };
  }
}

/**
 * Custom filter with raw filter object
 */
export class CustomFilter implements FilterCondition {
  constructor(private filterObject: any) {}

  toFilterObject(): any {
    return this.filterObject;
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
    return new PropertyFilter("DONE", "==", false);
  }

  /**
   * Create a filter for done items
   */
  static done(): PropertyFilter {
    return new PropertyFilter("DONE", "==", true);
  }

  /**
   * Create a filter for items without parent tasks
   */
  static noParentTask(): PropertyFilter {
    return new PropertyFilter("PARENT_TASK", "isEmpty");
  }

  /**
   * Create a filter for items with a specific parent task
   */
  static childrenOf(parentTaskName: string): PropertyFilter {
    return new PropertyFilter("PARENT_TASK", "==", parentTaskName);
  }

  /**
   * Create a filter for items in a specific project
   */
  static inProject(projectName: string): PropertyFilter {
    return new PropertyFilter("PROJECT", "==", projectName);
  }

  /**
   * Create a filter for items in a specific area
   */
  static inArea(areaName: string): PropertyFilter {
    return new PropertyFilter("AREAS", "contains", areaName);
  }

  /**
   * Create a filter for items of a specific category
   */
  static ofCategory(categoryName: string): PropertyFilter {
    return new PropertyFilter("CATEGORY", "==", categoryName);
  }

  /**
   * Create a filter for items with a specific priority
   */
  static withPriority(priorityName: string): PropertyFilter {
    return new PropertyFilter("PRIORITY", "==", priorityName);
  }

  /**
   * Create a filter for items with a specific status
   */
  static withStatus(statusName: string): PropertyFilter {
    return new PropertyFilter("STATUS", "==", statusName);
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
   * Create a custom filter from raw object
   */
  static custom(filterObject: any): CustomFilter {
    return new CustomFilter(filterObject);
  }
}
