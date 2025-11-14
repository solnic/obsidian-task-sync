/**
 * NoteProcessor - Complete Note Processing Engine
 * Handles front-matter extraction, note type detection, content template processing, and validation
 */

import type {
  NoteType,
  ValidationError,
  ValidationWarning,
  TemplateProcessingResult,
} from "./types";
import {
  createValidationError,
  createValidationWarning,
} from "./validation";
import {
  PropertyProcessor,
  type PropertyProcessingOptions,
} from "./property-processor";
import { TemplateEngine, type ProcessOptions } from "./template-engine";
import { TypeRegistry } from "./registry";

/**
 * Front-matter extraction result
 */
export interface FrontMatterExtractionResult {
  /** Whether extraction was successful */
  valid: boolean;

  /** Extracted front-matter data */
  frontMatter: Record<string, any>;

  /** Note content after front-matter */
  content: string;

  /** Raw front-matter text */
  rawFrontMatter: string;

  /** Extraction errors (if any) */
  errors: ValidationError[];

  /** Extraction warnings (if any) */
  warnings: ValidationWarning[];
}

/**
 * Note type detection result
 */
export interface NoteTypeDetectionResult {
  /** Whether detection was successful */
  valid: boolean;

  /** Detected note type (null if not detected) */
  noteType: NoteType | null;

  /** Detection confidence level */
  confidence: "high" | "medium" | "low" | "none";

  /** Method used for detection */
  detectionMethod:
    | "frontmatter-type"
    | "file-path"
    | "content-analysis"
    | "none";

  /** Detection errors (if any) */
  errors: ValidationError[];

  /** Detection warnings (if any) */
  warnings: ValidationWarning[];
}

/**
 * Note processing options
 */
export interface NoteProcessingOptions {
  /** Property processing options */
  propertyOptions?: PropertyProcessingOptions;

  /** Template processing options */
  templateOptions?: ProcessOptions;

  /** Whether to detect note type automatically */
  autoDetectType?: boolean;

  /** Explicit note type ID to use (skips detection) */
  explicitNoteTypeId?: string;

  /** Whether to validate content against template */
  validateContent?: boolean;

  /** Whether to process template variables in content */
  processTemplateVariables?: boolean;
}

/**
 * Note processing result
 */
export interface NoteProcessingResult {
  /** Whether processing was successful */
  valid: boolean;

  /** Detected/used note type */
  noteType: NoteType | null;

  /** Processed properties */
  properties: Record<string, any>;

  /** Note content */
  content: string;

  /** Processing errors (if any) */
  errors: ValidationError[];

  /** Processing warnings (if any) */
  warnings: ValidationWarning[];

  /** Front-matter extraction result */
  frontMatterResult?: FrontMatterExtractionResult;

  /** Note type detection result */
  detectionResult?: NoteTypeDetectionResult;
}

/**
 * NoteProcessor handles complete note validation and processing
 */
export class NoteProcessor {
  private propertyProcessor: PropertyProcessor;
  private templateEngine: TemplateEngine;
  private registry: TypeRegistry;

  constructor(
    propertyProcessor: PropertyProcessor,
    templateEngine: TemplateEngine,
    registry: TypeRegistry
  ) {
    this.propertyProcessor = propertyProcessor;
    this.templateEngine = templateEngine;
    this.registry = registry;
  }

  /**
   * Extract front-matter from note content
   */
  extractFrontMatter(content: string): FrontMatterExtractionResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Match front-matter pattern
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);

    if (!frontMatterMatch) {
      // No front-matter found - this is valid
      return {
        valid: true,
        frontMatter: {},
        content: content,
        rawFrontMatter: "",
        errors: [],
        warnings: [],
      };
    }

    const rawFrontMatter = frontMatterMatch[1];
    const remainingContent = content
      .substring(frontMatterMatch[0].length)
      .replace(/^\n/, "");

    // Parse YAML front-matter
    try {
      // Use a simple YAML parser for now - in production, use js-yaml
      const frontMatter = this.parseYaml(rawFrontMatter);

      return {
        valid: true,
        frontMatter,
        content: remainingContent,
        rawFrontMatter,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      errors.push(
        createValidationError(
          `Failed to parse YAML front-matter: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          "YAML_PARSE_ERROR"
        )
      );

      return {
        valid: false,
        frontMatter: {},
        content: remainingContent,
        rawFrontMatter,
        errors,
        warnings,
      };
    }
  }

  /**
   * Detect note type from front-matter and file path
   */
  detectNoteType(
    frontMatter: Record<string, any>,
    filePath: string
  ): NoteTypeDetectionResult {
    const warnings: ValidationWarning[] = [];

    // Method 1: Check front-matter type field
    if (frontMatter.type || frontMatter.Type) {
      const typeId = frontMatter.type || frontMatter.Type;
      const noteType = this.registry.get(typeId);

      if (noteType) {
        return {
          valid: true,
          noteType,
          confidence: "high",
          detectionMethod: "frontmatter-type",
          errors: [],
          warnings: [],
        };
      }

      warnings.push(
        createValidationWarning(
          `Note type '${typeId}' specified in front-matter but not found in registry`,
          "NOTE_TYPE_NOT_FOUND",
          { suggestion: "Register the note type or check the type name" }
        )
      );
    }

    // Method 2: Check file path patterns
    const fileName = filePath.split("/").pop()?.toLowerCase() || "";
    const pathSegments = filePath.toLowerCase().split("/");

    // Check for common patterns
    const allNoteTypes = this.registry.getAll();
    for (const noteType of allNoteTypes) {
      const typeId = noteType.id.toLowerCase();

      // Check if file path contains note type name
      if (
        pathSegments.some((segment) => segment.includes(typeId)) ||
        fileName.includes(typeId)
      ) {
        return {
          valid: true,
          noteType,
          confidence: "medium",
          detectionMethod: "file-path",
          errors: [],
          warnings,
        };
      }
    }

    // No detection method succeeded
    return {
      valid: true,
      noteType: null,
      confidence: "none",
      detectionMethod: "none",
      errors: [],
      warnings,
    };
  }

  /**
   * Process a complete note
   */
  async processNote(
    content: string,
    filePath: string,
    options: NoteProcessingOptions = {}
  ): Promise<NoteProcessingResult> {
    const {
      propertyOptions = {},
      autoDetectType = true,
      explicitNoteTypeId,
    } = options;

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Step 1: Extract front-matter
    const frontMatterResult = this.extractFrontMatter(content);
    if (!frontMatterResult.valid) {
      return {
        valid: false,
        noteType: null,
        properties: {},
        content: frontMatterResult.content,
        errors: frontMatterResult.errors,
        warnings: frontMatterResult.warnings,
        frontMatterResult,
      };
    }

    // Step 2: Determine note type
    let noteType: NoteType | null = null;
    let detectionResult: NoteTypeDetectionResult | undefined;

    if (explicitNoteTypeId) {
      noteType = this.registry.get(explicitNoteTypeId);
      if (!noteType) {
        errors.push(
          createValidationError(
            `Explicit note type '${explicitNoteTypeId}' not found in registry`,
            "NOTE_TYPE_NOT_FOUND"
          )
        );
      }
    } else if (autoDetectType) {
      detectionResult = this.detectNoteType(
        frontMatterResult.frontMatter,
        filePath
      );
      noteType = detectionResult.noteType;
      warnings.push(...detectionResult.warnings);
    }

    if (!noteType) {
      errors.push(
        createValidationError(
          "Could not determine note type for processing",
          "NOTE_TYPE_NOT_DETECTED"
        )
      );

      return {
        valid: false,
        noteType: null,
        properties: {},
        content: frontMatterResult.content,
        errors,
        warnings,
        frontMatterResult,
        detectionResult,
      };
    }

    // Step 3: Process properties
    const propertyResult = await this.propertyProcessor.process(
      noteType,
      frontMatterResult.frontMatter,
      propertyOptions
    );

    if (!propertyResult.valid) {
      return {
        valid: false,
        noteType,
        properties: propertyResult.properties,
        content: frontMatterResult.content,
        errors: [...errors, ...propertyResult.errors],
        warnings: [...warnings, ...propertyResult.warnings],
        frontMatterResult,
        detectionResult,
      };
    }

    // Success
    return {
      valid: true,
      noteType,
      properties: propertyResult.properties,
      content: frontMatterResult.content,
      errors,
      warnings: [...warnings, ...propertyResult.warnings],
      frontMatterResult,
      detectionResult,
    };
  }

  /**
   * Process template content with properties
   */
  processTemplate(
    noteType: NoteType,
    properties: Record<string, any>,
    options: ProcessOptions = {}
  ): TemplateProcessingResult {
    const templateResult = this.templateEngine.process(
      noteType.template,
      {
        variables: properties,
        noteType,
      },
      options
    );

    return {
      success: templateResult.success,
      content: templateResult.content,
      errors: templateResult.errors,
      warnings: templateResult.warnings,
    };
  }

  /**
   * Simple YAML parser for front-matter
   * In production, this should use js-yaml library
   */
  private parseYaml(yamlText: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = yamlText.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) {
        // Check for invalid YAML syntax like unclosed arrays
        if (trimmed.includes("[") && !trimmed.includes("]")) {
          throw new Error(
            `Invalid YAML syntax: unclosed array in line "${trimmed}"`
          );
        }
        continue;
      }

      const key = trimmed.substring(0, colonIndex).trim();
      const valueText = trimmed.substring(colonIndex + 1).trim();

      // Check for invalid YAML syntax
      if (valueText.includes("[") && !valueText.includes("]")) {
        throw new Error(
          `Invalid YAML syntax: unclosed array in value "${valueText}"`
        );
      }

      // Simple value parsing
      let value: any = valueText;

      // Parse numbers
      if (/^\d+$/.test(valueText)) {
        value = parseInt(valueText, 10);
      } else if (/^\d+\.\d+$/.test(valueText)) {
        value = parseFloat(valueText);
      }
      // Parse booleans
      else if (valueText === "true") {
        value = true;
      } else if (valueText === "false") {
        value = false;
      }
      // Remove quotes from strings
      else if (
        (valueText.startsWith('"') && valueText.endsWith('"')) ||
        (valueText.startsWith("'") && valueText.endsWith("'"))
      ) {
        value = valueText.slice(1, -1);
      }

      result[key] = value;
    }

    return result;
  }
}
