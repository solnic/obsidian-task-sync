import { PROPERTY_REGISTRY, PropertyDefinition } from "./properties";

// ============================================================================
// FILTER ABSTRACTION SYSTEM
// ============================================================================

/**
 * Base filter condition interface
 */
export interface FilterCondition {
  toFilterString(): string;
}

/**
 * Property-based filter condition
 */
export class PropertyFilter implements FilterCondition {
  constructor(
    private propertyKey: keyof typeof PROPERTY_REGISTRY,
    private operator: "==" | "!=" | "contains" | "isEmpty" | "isNotEmpty",
    private value?: any
  ) {}

  toFilterString(): string {
    const prop = PROPERTY_REGISTRY[this.propertyKey];
    if (!prop) {
      throw new Error(`Unknown property: ${String(this.propertyKey)}`);
    }

    const propertyRef = this.getPropertyReference(prop);

    switch (this.operator) {
      case "==":
        return `${propertyRef} == ${this.formatValue(prop, this.value)}`;
      case "!=":
        return `${propertyRef} != ${this.formatValue(prop, this.value)}`;
      case "contains":
        return `${propertyRef}.contains(${this.formatValue(prop, this.value)})`;
      case "isEmpty":
        return `${propertyRef}.isEmpty()`;
      case "isNotEmpty":
        return `!${propertyRef}.isEmpty()`;
      default:
        throw new Error(`Unsupported operator: ${this.operator}`);
    }
  }

  private getPropertyReference(prop: PropertyDefinition): string {
    // Use source if available (for computed properties)
    if (prop.source) {
      return prop.source;
    }

    // Special handling for certain properties that are referenced directly
    // These properties are used directly in Obsidian Bases without the note[""] wrapper
    if (
      prop.name === "Project" ||
      prop.name === "Areas" ||
      prop.name === "Category" ||
      prop.name === "Priority"
    ) {
      return prop.name;
    }

    // For front-matter properties, use note["PropertyName"] format
    if (prop.frontmatter) {
      return `note["${prop.name}"]`;
    }

    // For non-frontmatter properties, use the property name directly
    return prop.name;
  }

  private formatValue(prop: PropertyDefinition, value: any): string {
    if (value === undefined || value === null) {
      return "null";
    }

    // Handle link properties for string values (regardless of property type)
    if (prop.link && typeof value === "string") {
      return `link("${value}")`;
    }

    if (prop.type === "string") {
      return `"${value}"`;
    }

    if (prop.type === "checkbox") {
      return value ? "true" : "false";
    }

    if (prop.type === "number") {
      return String(value);
    }

    if (prop.type === "array" && Array.isArray(value)) {
      if (prop.link) {
        return `[${value.map((v) => `link("${v}")`).join(", ")}]`;
      }
      return `[${value.map((v) => `"${v}"`).join(", ")}]`;
    }

    return `"${value}"`;
  }
}

/**
 * File system filter condition
 */
export class FileSystemFilter implements FilterCondition {
  constructor(
    private property: "folder" | "name" | "path",
    private operator: "==" | "!=" | "contains" | "startsWith" | "endsWith",
    private value: string
  ) {}

  toFilterString(): string {
    const propertyRef = `file.${this.property}`;

    switch (this.operator) {
      case "==":
        return `${propertyRef} == "${this.value}"`;
      case "!=":
        return `${propertyRef} != "${this.value}"`;
      case "contains":
        return `${propertyRef}.contains("${this.value}")`;
      case "startsWith":
        return `${propertyRef}.startsWith("${this.value}")`;
      case "endsWith":
        return `${propertyRef}.endsWith("${this.value}")`;
      default:
        throw new Error(`Unsupported operator: ${this.operator}`);
    }
  }
}

/**
 * Custom filter condition for complex expressions
 */
export class CustomFilter implements FilterCondition {
  constructor(private expression: string) {}

  toFilterString(): string {
    return this.expression;
  }
}

/**
 * Composite filter that combines multiple conditions
 */
export class CompositeFilter implements FilterCondition {
  private conditions: FilterCondition[] = [];

  constructor(
    private operator: "and" | "or",
    conditions: FilterCondition[] = []
  ) {
    this.conditions = conditions;
  }

  add(condition: FilterCondition): CompositeFilter {
    this.conditions.push(condition);
    return this;
  }

  extend(other: CompositeFilter): CompositeFilter {
    this.conditions.push(...other.conditions);
    return this;
  }

  toFilterString(): string {
    if (this.conditions.length === 0) {
      return "";
    }

    if (this.conditions.length === 1) {
      return this.conditions[0].toFilterString();
    }

    const conditionStrings = this.conditions.map((c) => c.toFilterString());
    return conditionStrings.join(` ${this.operator} `);
  }

  toFilterObject(): any {
    if (this.conditions.length === 0) {
      return {};
    }

    if (this.conditions.length === 1) {
      return this.conditions[0].toFilterString();
    }

    return {
      [this.operator]: this.conditions.map((c) => c.toFilterString()),
    };
  }
}

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
   * Create a filter for items in a specific project
   */
  static inProject(projectName: string): PropertyFilter {
    return new PropertyFilter("PROJECT", "contains", projectName);
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
   * Create a filter for child tasks of a specific parent
   */
  static childrenOf(parentTaskName: string): PropertyFilter {
    return new PropertyFilter("PARENT_TASK", "==", parentTaskName);
  }

  /**
   * Create a filter for a specific file name
   */
  static fileName(name: string): FileSystemFilter {
    return new FileSystemFilter("name", "==", name);
  }

  /**
   * Create a composite AND filter
   */
  static and(...conditions: FilterCondition[]): CompositeFilter {
    return new CompositeFilter("and", conditions);
  }

  /**
   * Create a composite OR filter
   */
  static or(...conditions: FilterCondition[]): CompositeFilter {
    return new CompositeFilter("or", conditions);
  }
}
