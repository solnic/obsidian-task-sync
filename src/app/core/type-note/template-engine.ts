/**
 * TemplateEngine - Template Processing Engine
 * Handles template processing, variable replacement, validation, and inheritance
 * Uses Handlebars for powerful template rendering with conditionals, loops, and helpers
 */

import Handlebars from "handlebars";
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
 * Uses Handlebars for template rendering
 */
export class TemplateEngine {
  private templates: Map<string, Template> = new Map();
  private handlebars: typeof Handlebars;
  private defaultVariablePattern = /\{\{(\w+)\}\}/g;

  constructor() {
    // Create a new Handlebars instance for isolation
    this.handlebars = Handlebars.create();

    // Register default helpers
    this.registerDefaultHelpers();
  }

  /**
   * Register default Handlebars helpers
   */
  private registerDefaultHelpers(): void {
    // Date formatting helper
    this.handlebars.registerHelper(
      "formatDate",
      (date: any, format?: string) => {
        if (!date) return "";
        const d = new Date(date);
        if (isNaN(d.getTime())) return String(date);

        // Simple date formatting (can be enhanced with moment.js or similar)
        const fmt = format || "YYYY-MM-DD";
        return fmt
          .replace("YYYY", d.getFullYear().toString())
          .replace("MM", String(d.getMonth() + 1).padStart(2, "0"))
          .replace("DD", String(d.getDate()).padStart(2, "0"));
      }
    );

    // Conditional helper for existence check
    this.handlebars.registerHelper(
      "ifExists",
      function (value: any, options: any) {
        return value !== null && value !== undefined && value !== ""
          ? options.fn(this)
          : options.inverse(this);
      }
    );

    // Join array helper
    this.handlebars.registerHelper("join", (array: any[], separator = ", ") => {
      if (!Array.isArray(array)) return "";
      return array.join(separator);
    });

    // Default value helper
    this.handlebars.registerHelper(
      "default",
      (value: any, defaultValue: any) => {
        return value !== null && value !== undefined && value !== ""
          ? value
          : defaultValue;
      }
    );
  }

  /**
   * Register a custom Handlebars helper
   */
  registerHelper(name: string, helper: Handlebars.HelperDelegate): void {
    this.handlebars.registerHelper(name, helper);
  }

  /**
   * Unregister a custom Handlebars helper
   */
  unregisterHelper(name: string): void {
    this.handlebars.unregisterHelper(name);
  }

  /**
   * Register a template for inheritance
   */
  registerTemplate(id: string, template: Template): void {
    this.templates.set(id, template);
    // Also register as a Handlebars partial for template inheritance
    this.handlebars.registerPartial(id, template.content);
  }

  /**
   * Unregister a template
   */
  unregisterTemplate(id: string): boolean {
    const deleted = this.templates.delete(id);
    if (deleted) {
      this.handlebars.unregisterPartial(id);
    }
    return deleted;
  }

  /**
   * Get a registered template
   */
  getTemplate(id: string): Template | undefined {
    return this.templates.get(id);
  }

  /**
   * Process a template with the given context using Handlebars
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
          success: false,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          content: "",
        };
      }
      warnings.push(...validationResult.warnings);
    }

    // Merge template variables with context variables
    const mergedVariables = this.mergeVariables(template, context);

    // Apply transformations to variables
    const transformedVariables: Record<string, any> = {};
    for (const [varName, value] of Object.entries(mergedVariables)) {
      const templateVar = template.variables[varName];
      if (templateVar?.transform) {
        try {
          transformedVariables[varName] = templateVar.transform(value);
        } catch (error) {
          errors.push(
            createValidationError(
              `Error transforming variable '${varName}': ${error}`,
              "TRANSFORMATION_ERROR",
              { propertyKey: varName }
            )
          );
          // Don't continue if transformation fails
          return {
            success: false,
            errors,
            warnings,
            content: "",
          };
        }
      } else {
        transformedVariables[varName] = value;
      }
    }

    // Compile and render template with Handlebars
    let processedContent: string;
    try {
      const compiledTemplate = this.handlebars.compile(template.content, {
        noEscape: !escapeHtml,
        strict: false, // Always use non-strict mode, we handle undefined variables ourselves
      });

      processedContent = compiledTemplate(transformedVariables);
    } catch (error) {
      // Check if it's an undefined variable error
      const errorMsg = String(error);
      if (errorMsg.includes("not defined") || errorMsg.includes("undefined")) {
        errors.push(
          createValidationError(
            `Undefined variable in template: ${errorMsg}`,
            "UNDEFINED_VARIABLE",
            { error: errorMsg }
          )
        );
      } else {
        errors.push(
          createValidationError(
            `Template processing error: ${error}`,
            "TEMPLATE_PROCESSING_ERROR",
            { error: errorMsg }
          )
        );
      }
      return {
        success: false,
        errors,
        warnings,
        content: "",
      };
    }

    // Check for undefined variables in the output if not allowed
    if (!allowUndefinedVariables) {
      // Extract all variables from template
      const templateVars = this.extractVariables(template.content);
      for (const varName of templateVars) {
        if (!(varName in transformedVariables)) {
          errors.push(
            createValidationError(
              `Undefined variable '${varName}' in template`,
              "UNDEFINED_VARIABLE",
              { propertyKey: varName }
            )
          );
        }
      }
    }

    // If we have errors, return failure
    if (errors.length > 0) {
      return {
        success: false,
        errors,
        warnings,
        content: processedContent,
      };
    }

    // Return successful result
    return {
      success: true,
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
