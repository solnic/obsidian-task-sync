/**
 * Core property definition interface
 * Used by extensions to define their own property registries
 */

export interface PropertyDefinition {
  key: string;
  name: string;
  type: "string" | "number" | "checkbox" | "array" | "date";
  source?: string;
  link?: boolean;
  default?: any;
  frontmatter: boolean; // Whether this property is part of front-matter
}


