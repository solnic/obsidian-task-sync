# TypeNote Core Module

A comprehensive typed note management system for Obsidian with template versioning, front-matter validation, and seamless integration with Obsidian's property and base systems.

## Overview

TypeNote provides a platform-agnostic foundation for creating and managing typed notes with:

- **Type-safe property definitions** using Zod schemas
- **Template versioning** with semantic versioning support
- **Comprehensive validation** with detailed error reporting
- **Property transformations** for data normalization
- **Cross-property validation** for complex business rules

## Phase 1.1: Core Types and Interfaces ✅

This phase implements the foundational types, interfaces, and utilities for TypeNote.

### Implemented Features

#### 1. Core Types (`types.ts`)

- `NoteType` - Complete note type definition with properties, template, and metadata
- `PropertyDefinition` - Property schema with Zod validation and transformations
- `Template` - Template definition with versioning and migration support
- `ValidationResult` - Comprehensive validation result with errors and warnings
- `VersionComparison` - Enum for version comparison results

#### 2. Version Utilities (`version.ts`)

Semantic versioning utilities for template and note type versioning:

```typescript
import { compareVersions, isCompatible, nextMajor } from './version';

// Compare versions
compareVersions("2.0.0", "1.5.0"); // VersionComparison.GREATER_THAN

// Check compatibility
isCompatible("1.5.0", "1.0.0"); // true (same major version)
isCompatible("2.0.0", "1.0.0"); // false (different major version)

// Get next version
nextMajor("1.5.3"); // "2.0.0"
nextMinor("1.5.3"); // "1.6.0"
nextPatch("1.5.3"); // "1.5.4"
```

#### 3. Validation Utilities (`validation.ts`)

Comprehensive validation system with Zod integration:

```typescript
import { validateProperty, validateProperties, validateNoteType } from './validation';

// Validate a single property
const result = validateProperty(propertyDef, value);
if (!result.valid) {
  console.error(result.errors);
}

// Validate all properties in a note type
const result = validateProperties(noteType, properties);
if (result.valid) {
  const validatedData = result.data;
}

// Validate note type definition
const result = validateNoteType(noteType);
```

#### 4. Common Schemas (`schemas.ts`)

Reusable Zod schemas for common property types:

```typescript
import {
  stringSchema,
  dateSchema,
  emailSchema,
  tagsSchema,
  enumSchema,
} from './schemas';

// Use predefined schemas
const nameProperty = {
  key: "name",
  schema: stringSchema,
  // ...
};

// Create custom enum schema
const statusSchema = enumSchema(["Draft", "Published", "Archived"]);
```

## Usage Examples

### Defining a Note Type

```typescript
import { z } from 'zod';
import type { NoteType } from './types';
import { stringSchema, dateSchema, tagsSchema } from './schemas';

const articleNoteType: NoteType = {
  id: "article",
  name: "Article",
  version: "1.0.0",
  properties: {
    title: {
      key: "title",
      name: "Title",
      schema: stringSchema,
      frontMatterKey: "title",
      required: true,
    },
    publishDate: {
      key: "publishDate",
      name: "Publish Date",
      schema: dateSchema,
      frontMatterKey: "publish_date",
      required: false,
    },
    tags: {
      key: "tags",
      name: "Tags",
      schema: tagsSchema,
      frontMatterKey: "tags",
      required: false,
      defaultValue: [],
    },
  },
  template: {
    version: "1.0.0",
    content: `# {{title}}

Published: {{publishDate}}

## Content

Write your article here...
`,
    variables: {
      title: {
        name: "title",
        defaultValue: "Untitled Article",
      },
      publishDate: {
        name: "publishDate",
        defaultValue: new Date().toISOString(),
      },
    },
  },
  metadata: {
    description: "A blog article or post",
    icon: "📝",
    color: "#3b82f6",
    category: "Content",
  },
};
```

### Validating Properties

```typescript
import { validateProperties } from './validation';

const properties = {
  title: "My First Article",
  publish_date: "2024-01-15",
  tags: ["typescript", "obsidian"],
};

const result = validateProperties(articleNoteType, properties);

if (result.valid) {
  console.log("Validated data:", result.data);
  // Data is now type-safe and transformed
} else {
  console.error("Validation errors:", result.errors);
  result.errors.forEach(error => {
    console.log(`- ${error.propertyKey}: ${error.message}`);
  });
}
```

### Property Transformations

```typescript
const slugProperty: PropertyDefinition = {
  key: "slug",
  name: "Slug",
  schema: stringSchema,
  frontMatterKey: "slug",
  required: true,
  transform: (value: string) => {
    // Transform to URL-friendly slug
    return value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  },
};

// Input: "My Article Title!"
// Output: "my-article-title"
```

### Cross-Property Validation

```typescript
const eventNoteType: NoteType = {
  // ... other properties
  crossPropertyValidation: (properties) => {
    const errors = [];
    
    // Validate that end date is after start date
    if (properties.start_date && properties.end_date) {
      const start = new Date(properties.start_date);
      const end = new Date(properties.end_date);
      
      if (end < start) {
        errors.push(
          createValidationError(
            "End date must be after start date",
            "INVALID_DATE_RANGE"
          )
        );
      }
    }
    
    return errors.length > 0
      ? createInvalidResult(errors)
      : createValidResult(properties);
  },
};
```

## Integration with TaskSync

TypeNote is designed to integrate seamlessly with the TaskSync application:

### Using with Obsidian Extension

```typescript
// In Obsidian extension
import type { NoteType } from '@/app/core/type-note';

class ObsidianNoteTypeManager {
  async createNote(noteType: NoteType, properties: Record<string, any>) {
    // Validate properties
    const result = validateProperties(noteType, properties);
    
    if (!result.valid) {
      throw new Error(`Validation failed: ${result.errors[0].message}`);
    }
    
    // Create note with validated data
    const note = await this.obsidianApi.createNote(
      noteType.template.content,
      result.data
    );
    
    return note;
  }
}
```

### Task Note Type Example

```typescript
const taskNoteType: NoteType = {
  id: "task",
  name: "Task",
  version: "1.0.0",
  properties: {
    title: {
      key: "title",
      schema: stringSchema,
      frontMatterKey: "title",
      required: true,
    },
    status: {
      key: "status",
      schema: enumSchema(["Backlog", "In Progress", "Done"]),
      frontMatterKey: "status",
      required: true,
      defaultValue: "Backlog",
    },
    priority: {
      key: "priority",
      schema: enumSchema(["Low", "Medium", "High", "Urgent"]),
      frontMatterKey: "priority",
      required: false,
    },
    // ... more properties
  },
  template: {
    version: "1.0.0",
    content: `# {{title}}

Status: {{status}}
Priority: {{priority}}

## Description

{{description}}
`,
    variables: {},
  },
};
```

## Testing

Comprehensive unit tests are provided for all core functionality:

```bash
# Run TypeNote tests
npm run test:unit -- tests/unit/type-note

# Run specific test file
npm run test:unit -- tests/unit/type-note/version.test.ts
```

## Next Steps

Phase 1.2 will implement:
- `TypeRegistry` for managing note type definitions
- Version compatibility checking and migration paths
- Serialization/deserialization for persistence

Phase 1.3 will implement:
- `TemplateEngine` for template processing
- Template variable replacement system
- Template inheritance mechanism

## Architecture

TypeNote follows a clean architecture with clear separation of concerns:

```
type-note/
├── types.ts          # Core type definitions
├── version.ts        # Version comparison utilities
├── validation.ts     # Validation utilities
├── schemas.ts        # Common Zod schemas
└── index.ts          # Public API exports
```

All functionality is platform-agnostic and can be used independently of Obsidian, making it easy to extract as a standalone library in the future.

