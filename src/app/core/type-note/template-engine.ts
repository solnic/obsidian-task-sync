/**
 * TemplateEngine - Template Processing Engine
 * Handles template processing, variable replacement, validation, and inheritance
 */

import type {
  Template,
  TemplateVariable,
  TemplateContext,
  TemplateProcessingResult,
  SemanticVersion,
  ValidationResult,
  NoteType,
} from "./types";
import { VersionComparison } from "./types";
import { compareVersions } from "./version";
import {
  createValidResult,
  createInvalidResult,
  createValidationError,
  createValidationWarning,
} from "./validation";

/**
 * Template engine error types
 */
export class TemplateEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "TemplateEngineError";
  }
}

/**
 * Options for template processing
 */
export interface ProcessOptions {
  /** Whether to validate variables before processing */
  validateVariables?: boolean;

  /** Whether to allow undefined variables */
  allowUndefinedVariables?: boolean;

  /** Whether to escape HTML in variable values */
  escapeHtml?: boolean;

  /** Custom variable pattern (default: {{variableName}}) */
  variablePattern?: RegExp;
}

/**
 * Template inheritance result
 */
export interface InheritanceResult {
  /** Merged template content */
  content: string;

  /** Merged variables */
  variables: Record<string, TemplateVariable>;

  /** Inheritance chain (parent IDs) */
  chain: string[];
}

/**
 * TemplateEngine processes templates with variable replacement and validation
 */
export class TemplateEngine {
  private templates: Map<string, Template> = new Map();
  private defaultVariablePattern = /\{\{(\w+)\}\}/g;

  /**
   * Register a template for inheritance
   */
  registerTemplate(id: string, template: Template): void {
    this.templates.set(id, template);
  }

  /**
   * Unregister a template
   */
  unregisterTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  /**
   * Get a registered template
   */
  getTemplate(id: string): Template | undefined {
    return this.templates.get(id);
  }

  /**
   * Process a template with the given context
   */
  process(
    template: Template,
    context: TemplateContext,
    options: ProcessOptions = {}
  ): TemplateProcessingResult {
    const {
      validateVariables = true,
      allowUndefinedVariables = false,
      escapeHtml = false,
      variablePattern = this.defaultVariablePattern,
    } = options;

    const errors = [];
    const warnings = [];

    // Validate variables if requested
    if (validateVariables) {
      const validationResult = this.validateVariables(
        template,
        context.variables
      );
      if (!validationResult.valid) {
        return {
          valid: false,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          content: "",
        };
      }
      warnings.push(...validationResult.warnings);
    }

    // Merge template variables with context variables
    const mergedVariables = this.mergeVariables(template, context);

    // Process template content
    let processedContent = template.content;
    const usedVariables = new Set<string>();

    // Replace variables
    processedContent = processedContent.replace(
      variablePattern,
      (match, variableName) => {
        usedVariables.add(variableName);

        // Check if variable exists in merged variables
        if (!(variableName in mergedVariables)) {
          if (!allowUndefinedVariables) {
            errors.push(
              createValidationError(
                `Undefined variable '${variableName}' in template`,
                "UNDEFINED_VARIABLE",
                { propertyKey: variableName }
              )
            );
            return match; // Keep original placeholder
          }
          warnings.push(
            createValidationWarning(
              `Variable '${variableName}' is undefined, using empty string`,
              "UNDEFINED_VARIABLE",
              {
                propertyKey: variableName,
                suggestion: "Provide a value for this variable",
              }
            )
          );
          return "";
        }

        let value = mergedVariables[variableName];

        // Apply transformation if defined
        const templateVar = template.variables[variableName];
        if (templateVar?.transform) {
          try {
            value = templateVar.transform(value);
          } catch (error) {
            errors.push(
              createValidationError(
                `Error transforming variable '${variableName}': ${error}`,
                "TRANSFORMATION_ERROR",
                { propertyKey: variableName }
              )
            );
            return match;
          }
        }

        // Convert to string
        const stringValue =
          value === null || value === undefined ? "" : String(value);

        // Escape HTML if requested
        return escapeHtml ? this.escapeHtml(stringValue) : stringValue;
      }
    );

    // Check for unused variables
    for (const varName in template.variables) {
      if (!usedVariables.has(varName)) {
        warnings.push(
          createValidationWarning(
            `Variable '${varName}' is defined but not used in template`,
            "UNUSED_VARIABLE",
            {
              propertyKey: varName,
              suggestion:
                "Remove unused variable or add it to template content",
            }
          )
        );
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors,
        warnings,
        content: processedContent,
      };
    }

    return {
      valid: true,
      errors: [],
      warnings,
      content: processedContent,
    };
  }

  /**
   * Validate template variables against provided values
   */
  validateVariables(
    template: Template,
    variables: Record<string, any>
  ): ValidationResult {
    const errors = [];
    const warnings = [];

    // Check for required variables
    for (const [varName, varDef] of Object.entries(template.variables)) {
      if (!(varName in variables)) {
        // Use default value if available
        if (varDef.defaultValue !== undefined) {
          warnings.push(
            createValidationWarning(
              `Variable '${varName}' not provided, using default value`,
              "USING_DEFAULT_VALUE",
              { propertyKey: varName }
            )
          );
        } else {
          errors.push(
            createValidationError(
              `Required variable '${varName}' is missing`,
              "MISSING_VARIABLE",
              { propertyKey: varName }
            )
          );
        }
      }
    }

    return errors.length > 0
      ? createInvalidResult(errors, warnings)
      : createValidResult({ variables });
  }

  /**
   * Merge template variables with context variables
   */
  private mergeVariables(
    template: Template,
    context: TemplateContext
  ): Record<string, any> {
    const merged: Record<string, any> = {};

    // Start with default values from template variables
    for (const [varName, varDef] of Object.entries(template.variables)) {
      if (varDef.defaultValue !== undefined) {
        merged[varName] = varDef.defaultValue;
      }
    }

    // Override with context variables
    for (const [varName, value] of Object.entries(context.variables)) {
      merged[varName] = value;
    }

    return merged;
  }

  /**
   * Escape HTML in a string
   */
  private escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
  }

  /**
   * Extract variables from template content
   */
  extractVariables(content: string, pattern?: RegExp): string[] {
    const regex = pattern || this.defaultVariablePattern;
    const variables = new Set<string>();
    let match;

    // Reset regex state
    regex.lastIndex = 0;

    while ((match = regex.exec(content)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  /**
   * Validate template structure
   */
  validateTemplate(template: Template): ValidationResult {
    const errors = [];

    if (!template.version) {
      errors.push(
        createValidationError(
          "Template version is required",
          "MISSING_TEMPLATE_VERSION"
        )
      );
    }

    if (!template.content) {
      errors.push(
        createValidationError(
          "Template content is required",
          "MISSING_TEMPLATE_CONTENT"
        )
      );
    }

    // Extract variables from content
    const contentVariables = this.extractVariables(template.content);

    // Check if all content variables are defined
    for (const varName of contentVariables) {
      if (!(varName in template.variables)) {
        errors.push(
          createValidationError(
            `Variable '${varName}' used in template but not defined`,
            "UNDEFINED_TEMPLATE_VARIABLE",
            { propertyKey: varName }
          )
        );
      }
    }

    return errors.length > 0
      ? createInvalidResult(errors)
      : createValidResult({ template });
  }

  /**
   * Clear all registered templates
   */
  clear(): void {
    this.templates.clear();
  }

  /**
   * Resolve template inheritance
   * Merges parent template content and variables with child template
   */
  resolveInheritance(template: Template): InheritanceResult {
    const chain: string[] = [];
    let currentTemplate = template;
    const mergedVariables: Record<string, TemplateVariable> = {};
    let mergedContent = "";

    // Build inheritance chain
    while (currentTemplate.parentTemplateId) {
      const parentId = currentTemplate.parentTemplateId;

      // Check for circular inheritance
      if (chain.includes(parentId)) {
        throw new TemplateEngineError(
          `Circular inheritance detected: ${chain.join(" -> ")} -> ${parentId}`,
          "CIRCULAR_INHERITANCE",
          { chain, parentId }
        );
      }

      chain.push(parentId);

      const parentTemplate = this.templates.get(parentId);
      if (!parentTemplate) {
        throw new TemplateEngineError(
          `Parent template '${parentId}' not found`,
          "PARENT_TEMPLATE_NOT_FOUND",
          { parentId }
        );
      }

      currentTemplate = parentTemplate;
    }

    // Merge from root to child (reverse chain)
    const templatesInOrder = [currentTemplate];
    for (let i = chain.length - 1; i >= 0; i--) {
      const templateId = chain[i];
      const t = this.templates.get(templateId);
      if (t) {
        templatesInOrder.push(t);
      }
    }
    templatesInOrder.push(template);

    // Merge variables (child overrides parent)
    for (const t of templatesInOrder) {
      Object.assign(mergedVariables, t.variables);
    }

    // Merge content (child extends parent)
    // For now, we'll use simple concatenation
    // In a more sophisticated implementation, you might have merge markers
    mergedContent = templatesInOrder.map((t) => t.content).join("\n\n");

    return {
      content: mergedContent,
      variables: mergedVariables,
      chain,
    };
  }

  /**
   * Migrate template content from one version to another
   */
  migrateTemplate(
    template: Template,
    fromVersion: SemanticVersion,
    toVersion: SemanticVersion
  ): ValidationResult {
    // Check if migration is needed
    const comparison = compareVersions(fromVersion, toVersion);

    if (comparison === VersionComparison.EQUAL) {
      return createValidResult({ content: template.content });
    }

    if (comparison === VersionComparison.GREATER_THAN) {
      return createInvalidResult([
        createValidationError(
          `Cannot migrate from newer version ${fromVersion} to older version ${toVersion}`,
          "INVALID_MIGRATION_DIRECTION",
          {
            expected: `version < ${fromVersion}`,
            actual: toVersion,
          }
        ),
      ]);
    }

    // Apply migration function if available
    if (template.migrate) {
      try {
        const migratedContent = template.migrate(fromVersion, template.content);
        return createValidResult({ content: migratedContent });
      } catch (error) {
        return createInvalidResult([
          createValidationError(
            `Migration failed: ${error}`,
            "MIGRATION_ERROR"
          ),
        ]);
      }
    }

    // No migration function available
    return createValidResult({
      content: template.content,
      warning: "No migration function available, using template as-is",
    });
  }

  /**
   * Check if a template is compatible with a given version
   */
  isTemplateCompatible(
    template: Template,
    targetVersion: SemanticVersion
  ): boolean {
    const comparison = compareVersions(template.version, targetVersion);
    // Template is compatible if it's the same version or newer
    return (
      comparison === VersionComparison.EQUAL ||
      comparison === VersionComparison.GREATER_THAN
    );
  }

  /**
   * Get all registered template IDs
   */
  getTemplateIds(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Get the number of registered templates
   */
  get size(): number {
    return this.templates.size;
  }
}
