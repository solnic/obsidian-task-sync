/**
 * Abstract interfaces for label-to-type mapping in external integrations
 * Provides a generic way to map external labels to internal task types
 */

/**
 * Interface for mapping external labels to task types
 * Implementations should handle the specific mapping logic for each integration
 */
export interface LabelTypeMapper {
  /**
   * Map external labels to a task type
   * @param labels Array of label names from external system
   * @param availableTypes Array of configured task types in the system
   * @returns The mapped task type name, or undefined if no mapping found
   */
  mapLabelsToType(
    labels: string[],
    availableTypes: string[]
  ): string | undefined;

  /**
   * Set the label-to-type mapping configuration
   * @param mapping Object mapping label names to task type names
   */
  setLabelMapping(mapping: Record<string, string>): void;

  /**
   * Get the current label-to-type mapping configuration
   * @returns Current mapping configuration
   */
  getLabelMapping(): Record<string, string>;

  /**
   * Check if a label has a configured mapping
   * @param label Label name to check
   * @returns True if the label has a mapping configured
   */
  hasMapping(label: string): boolean;
}

/**
 * Configuration for label-to-type mapping
 * Used in integration settings to define how labels map to types
 */
export interface LabelMappingConfig {
  /** Mapping from external label names to internal task type names */
  labelToTypeMapping: Record<string, string>;

  /** Default task type to use when no label mapping is found */
  defaultTaskType: string;

  /** Whether to use the first matching label or prioritize certain labels */
  mappingStrategy: "first-match" | "priority-based";

  /** Priority order for labels when using priority-based strategy */
  labelPriority?: string[];
}

// Import types we need
import type { TaskImportConfig } from "./integrations";

// Define FileContext here since we can't import it from main
export interface FileContext {
  type: "project" | "area" | "task" | "daily" | "none";
  name?: string;
  path?: string;
}

/**
 * Interface for context-aware import configuration
 * Allows integrations to adapt import behavior based on current file context
 */
export interface ContextAwareImportService {
  /**
   * Get import configuration based on current file context
   * @param context Current file context (project, area, or none)
   * @param baseConfig Base import configuration to enhance
   * @returns Enhanced import configuration with context-specific settings
   */
  getContextAwareConfig(
    context: FileContext,
    baseConfig?: Partial<TaskImportConfig>
  ): TaskImportConfig;

  /**
   * Detect the current file context
   * @returns Current file context information
   */
  detectCurrentContext(): FileContext;
}
