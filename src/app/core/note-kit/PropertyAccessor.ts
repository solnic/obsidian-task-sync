/**
 * PropertyAccessor - Enhanced property definition with convenient accessors
 *
 * This class implements {@link PropertyDefinition} and adds convenience getters for
 * working with defaults and select options. It is designed to be a transparent
 * implementation, so it can be used anywhere a PropertyDefinition is expected.
 *
 * ## Design decisions:
 * - Implements PropertyDefinition directly (rather than wrapping) so that all fields are accessible
 *   and type compatibility is preserved.
 * - The `.default` getter provides smart default value resolution:
 *   - For select properties: returns the option marked with `isDefault: true`
 *   - Falls back to the `defaultValue` field if no option is marked as default
 * - The `.default` getter does not shadow a `default` field, as PropertyDefinition does not define one,
 *   but if one were ever added, this getter would take precedence.
 * - When retrieving a property from the registry (e.g., `TypeRegistry.get()`), you receive a PropertyAccessor.
 *
 * ## Example
 * ```typescript
 * const taskNoteType = registry.get("task");
 * const statusProp = taskNoteType.properties.status; // This is a PropertyAccessor
 * const defaultStatus = statusProp.default; // Gets the isDefault-marked option or defaultValue
 * ```
 */

import type { PropertyDefinition, SelectOption } from "./types";

/**
 * Enhanced property definition with convenient accessors
 * This is a transparent wrapper that provides all PropertyDefinition fields
 * plus additional convenience properties like .default and .options
 */
export class PropertyAccessor implements PropertyDefinition {
  // PropertyDefinition fields - exposed directly
  readonly key: string;
  readonly name: string;
  readonly type: PropertyDefinition["type"];
  readonly schema: PropertyDefinition["schema"];
  readonly frontMatterKey: string;
  readonly required: boolean;
  readonly defaultValue?: any;
  readonly transform?: PropertyDefinition["transform"];
  readonly description?: string;
  readonly visible?: boolean;
  readonly order?: number;
  readonly options?: string[]; // For enum properties
  readonly source?: string;
  readonly link?: boolean;
  readonly selectOptions?: SelectOption[];
  readonly form?: PropertyDefinition["form"];

  constructor(private readonly propertyDef: PropertyDefinition) {
    // Copy all fields from propertyDef
    this.key = propertyDef.key;
    this.name = propertyDef.name;
    this.type = propertyDef.type;
    this.schema = propertyDef.schema;
    this.frontMatterKey = propertyDef.frontMatterKey;
    this.required = propertyDef.required;
    this.defaultValue = propertyDef.defaultValue;
    this.transform = propertyDef.transform;
    this.description = propertyDef.description;
    this.visible = propertyDef.visible;
    this.order = propertyDef.order;
    this.options = propertyDef.options;
    this.source = propertyDef.source;
    this.link = propertyDef.link;
    this.selectOptions = propertyDef.selectOptions;
    this.form = propertyDef.form;
  }

  /**
   * Get the default value for this property
   * For select properties, this finds the option marked as default
   * or falls back to the defaultValue field
   */
  get default(): any {
    // If there are select options, try to find the one marked as default
    if (this.selectOptions && this.selectOptions.length > 0) {
      const defaultOption = this.selectOptions.find(opt => opt.isDefault === true);
      if (defaultOption) {
        return defaultOption.value;
      }
    }

    // Otherwise return the defaultValue field
    return this.defaultValue;
  }

  /**
   * Get a specific option by value
   * Returns undefined if not found or if this is not a select property
   */
  getOption(value: string): SelectOption | undefined {
    if (!this.selectOptions) return undefined;
    return this.selectOptions.find(opt => opt.value === value);
  }

  /**
   * Get the color for a specific option value
   * Returns undefined if option not found or has no color
   */
  getOptionColor(value: string): string | undefined {
    return this.getOption(value)?.color;
  }

  /**
   * Get all options marked as "done" (for status properties)
   * Returns empty array if this is not a status property
   */
  get doneOptions(): SelectOption[] {
    if (!this.selectOptions) return [];
    return this.selectOptions.filter(opt => opt.isDone === true);
  }

  /**
   * Get all options marked as "in progress" (for status properties)
   * Returns empty array if this is not a status property
   */
  get inProgressOptions(): SelectOption[] {
    if (!this.selectOptions) return [];
    return this.selectOptions.filter(opt => opt.isInProgress === true);
  }

  /**
   * Check if a value represents a "done" status
   */
  isDoneStatus(value: string): boolean {
    return this.getOption(value)?.isDone === true;
  }

  /**
   * Check if a value represents an "in progress" status
   */
  isInProgressStatus(value: string): boolean {
    return this.getOption(value)?.isInProgress === true;
  }
}

/**
 * Create an enhanced property accessor from a property definition
 * This wraps the property definition with convenient accessors
 */
export function createPropertyAccessor(propertyDef: PropertyDefinition): PropertyAccessor {
  return new PropertyAccessor(propertyDef);
}
