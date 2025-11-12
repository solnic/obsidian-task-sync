/**
 * NoteTypeAccessor - Provides enhanced API for accessing NoteType properties
 *
 * This class wraps a NoteType and provides convenient property accessors
 * that make it easy to work with property defaults and options.
 */

import type { NoteType, PropertyDefinition } from "./types";
import { PropertyAccessor } from "./PropertyAccessor";

/**
 * Enhanced property accessor map
 * Provides property accessors for all properties in a note type
 */
export type PropertyAccessorMap = {
  [K in string]: PropertyAccessor;
};

/**
 * NoteType accessor that provides enhanced property access
 */
export class NoteTypeAccessor {
  private _propertyAccessors: Map<string, PropertyAccessor> = new Map();

  constructor(private readonly noteType: NoteType) {
    // Create property accessors for all properties
    for (const [key, propertyDef] of Object.entries(noteType.properties)) {
      this._propertyAccessors.set(key, new PropertyAccessor(propertyDef));
    }
  }

  /**
   * Get enhanced property accessor by key
   * This provides convenient access to property defaults and options
   */
  property(key: string): PropertyAccessor | undefined {
    return this._propertyAccessors.get(key);
  }

  /**
   * Get all property accessors as a map
   */
  get properties(): PropertyAccessorMap {
    const map: PropertyAccessorMap = {};
    for (const [key, accessor] of this._propertyAccessors.entries()) {
      map[key] = accessor;
    }
    return map;
  }

  /**
   * Get the underlying note type
   */
  get definition(): NoteType {
    return this.noteType;
  }

  /**
   * Get a property definition by key
   */
  getProperty(key: string): PropertyDefinition | undefined {
    return this.noteType.properties[key];
  }

  /**
   * Get all property keys
   */
  get propertyKeys(): string[] {
    return Object.keys(this.noteType.properties);
  }

  /**
   * Check if a property exists
   */
  hasProperty(key: string): boolean {
    return key in this.noteType.properties;
  }
}

/**
 * Create a note type accessor for enhanced property access
 */
export function createNoteTypeAccessor(noteType: NoteType): NoteTypeAccessor {
  return new NoteTypeAccessor(noteType);
}
