/**
 * TypeNote Usage Examples
 * Demonstrates how to use TypeNote for creating typed notes
 */

import { z } from "zod";
import type { NoteType, PropertyDefinition } from "./types";
import {
  stringSchema,
  dateSchema,
  tagsSchema,
  enumSchema,
  optionalStringSchema,
} from "./schemas";
import { validateProperties, validateNoteType } from "./validation";

/**
 * Example 1: Simple Article Note Type
 */
export const articleNoteType: NoteType = {
  id: "article",
  name: "Article",
  version: "1.0.0",
  properties: {
    title: {
      key: "title",
      name: "Title",
      type: "string",
      schema: stringSchema,
      frontMatterKey: "title",
      required: true,
      description: "Article title",
      visible: true,
      order: 1,
    },
    author: {
      key: "author",
      name: "Author",
      type: "string",
      schema: stringSchema,
      frontMatterKey: "author",
      required: true,
      description: "Article author",
      visible: true,
      order: 2,
    },
    publishDate: {
      key: "publishDate",
      name: "Publish Date",
      type: "date",
      schema: dateSchema,
      frontMatterKey: "publish_date",
      required: false,
      defaultValue: new Date(),
      description: "Date when article was published",
      visible: true,
      order: 3,
    },
    tags: {
      key: "tags",
      name: "Tags",
      type: "array",
      schema: tagsSchema,
      frontMatterKey: "tags",
      required: false,
      defaultValue: [],
      description: "Article tags for categorization",
      visible: true,
      order: 4,
    },
    excerpt: {
      key: "excerpt",
      name: "Excerpt",
      type: "string",
      schema: optionalStringSchema,
      frontMatterKey: "excerpt",
      required: false,
      description: "Short excerpt or summary",
      visible: true,
      order: 5,
    },
  },
  template: {
    version: "1.0.0",
    content: `# {{title}}

**Author:** {{author}}
**Published:** {{publishDate}}

{{excerpt}}

---

## Content

Write your article here...

## References

`,
    variables: {
      title: {
        name: "title",
        defaultValue: "Untitled Article",
        description: "Article title",
      },
      author: {
        name: "author",
        defaultValue: "Unknown Author",
        description: "Article author",
      },
      publishDate: {
        name: "publishDate",
        defaultValue: new Date().toISOString(),
        transform: (value: any) => {
          const date = new Date(value);
          return date.toLocaleDateString();
        },
        description: "Publication date",
      },
      excerpt: {
        name: "excerpt",
        defaultValue: "",
        description: "Article excerpt",
      },
    },
  },
  metadata: {
    description: "A blog article or post",
    author: "TypeNote",
    icon: "📝",
    color: "#3b82f6",
    category: "Content",
    tags: ["writing", "blog"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

/**
 * Example 2: Meeting Notes Type
 */
export const meetingNoteType: NoteType = {
  id: "meeting",
  name: "Meeting Notes",
  version: "1.0.0",
  properties: {
    title: {
      key: "title",
      name: "Meeting Title",
      type: "string",
      schema: stringSchema,
      frontMatterKey: "title",
      required: true,
    },
    date: {
      key: "date",
      name: "Meeting Date",
      type: "date",
      schema: dateSchema,
      frontMatterKey: "date",
      required: true,
      defaultValue: new Date(),
    },
    attendees: {
      key: "attendees",
      name: "Attendees",
      type: "array",
      schema: z.array(z.string()).default([]),
      frontMatterKey: "attendees",
      required: false,
      defaultValue: [],
    },
    location: {
      key: "location",
      name: "Location",
      type: "string",
      schema: optionalStringSchema,
      frontMatterKey: "location",
      required: false,
    },
    status: {
      key: "status",
      name: "Status",
      type: "enum",
      schema: enumSchema([
        "Scheduled",
        "In Progress",
        "Completed",
        "Cancelled",
      ]),
      frontMatterKey: "status",
      required: true,
      defaultValue: "Scheduled",
      options: ["Scheduled", "In Progress", "Completed", "Cancelled"],
    },
  },
  template: {
    version: "1.0.0",
    content: `# {{title}}

**Date:** {{date}}
**Location:** {{location}}
**Status:** {{status}}

## Attendees

{{attendees}}

## Agenda

1.
2.
3.

## Notes

## Action Items

- [ ]

## Decisions

`,
    variables: {
      title: {
        name: "title",
        defaultValue: "Team Meeting",
      },
      date: {
        name: "date",
        defaultValue: new Date().toISOString(),
        transform: (value: any) => new Date(value).toLocaleDateString(),
      },
      location: {
        name: "location",
        defaultValue: "Virtual",
      },
      status: {
        name: "status",
        defaultValue: "Scheduled",
      },
      attendees: {
        name: "attendees",
        defaultValue: [],
        transform: (value: string[]) => {
          return value.map((name) => `- ${name}`).join("\n");
        },
      },
    },
  },
  metadata: {
    description: "Meeting notes with agenda and action items",
    icon: "🤝",
    color: "#10b981",
    category: "Meetings",
  },
};

/**
 * Example 3: Book Review Note Type
 */
export const bookReviewNoteType: NoteType = {
  id: "book-review",
  name: "Book Review",
  version: "1.0.0",
  properties: {
    title: {
      key: "title",
      name: "Book Title",
      type: "string",
      schema: stringSchema,
      frontMatterKey: "title",
      required: true,
    },
    author: {
      key: "author",
      name: "Author",
      type: "string",
      schema: stringSchema,
      frontMatterKey: "author",
      required: true,
    },
    rating: {
      key: "rating",
      name: "Rating",
      type: "number",
      schema: z.number().min(1).max(5),
      frontMatterKey: "rating",
      required: false,
      defaultValue: 3,
    },
    dateRead: {
      key: "dateRead",
      name: "Date Read",
      type: "date",
      schema: dateSchema,
      frontMatterKey: "date_read",
      required: false,
    },
    genre: {
      key: "genre",
      name: "Genre",
      type: "enum",
      schema: enumSchema([
        "Fiction",
        "Non-Fiction",
        "Science Fiction",
        "Fantasy",
        "Mystery",
        "Biography",
        "History",
        "Other",
      ]),
      frontMatterKey: "genre",
      required: false,
      options: [
        "Fiction",
        "Non-Fiction",
        "Science Fiction",
        "Fantasy",
        "Mystery",
        "Biography",
        "History",
        "Other",
      ],
    },
    tags: {
      key: "tags",
      name: "Tags",
      type: "array",
      schema: tagsSchema,
      frontMatterKey: "tags",
      required: false,
      defaultValue: [],
    },
  },
  template: {
    version: "1.0.0",
    content: `# {{title}}

**Author:** {{author}}
**Genre:** {{genre}}
**Rating:** {{rating}}/5 ⭐
**Date Read:** {{dateRead}}

## Summary

## Key Takeaways

-

## Favorite Quotes

>

## My Thoughts

## Recommendation

Would I recommend this book?

`,
    variables: {
      title: {
        name: "title",
        defaultValue: "Untitled Book",
      },
      author: {
        name: "author",
        defaultValue: "Unknown Author",
      },
      genre: {
        name: "genre",
        defaultValue: "Other",
      },
      rating: {
        name: "rating",
        defaultValue: 3,
      },
      dateRead: {
        name: "dateRead",
        defaultValue: new Date().toISOString(),
        transform: (value: any) => new Date(value).toLocaleDateString(),
      },
    },
  },
  metadata: {
    description: "Book review with rating and notes",
    icon: "📚",
    color: "#8b5cf6",
    category: "Reading",
  },
};

/**
 * Example usage: Validating article properties
 */
export function exampleValidateArticle() {
  const properties = {
    title: "Introduction to TypeNote",
    author: "TypeNote Team",
    publish_date: "2024-01-15",
    tags: ["typescript", "obsidian", "note-taking"],
    excerpt: "Learn how to use TypeNote for typed notes in Obsidian",
  };

  const result = validateProperties(articleNoteType, properties);

  if (result.valid) {
    console.log("✅ Article properties are valid!");
    console.log("Validated data:", result.data);
  } else {
    console.error("❌ Validation failed:");
    result.errors.forEach((error) => {
      console.error(`  - ${error.propertyKey}: ${error.message}`);
    });
  }

  return result;
}

/**
 * Example usage: Validating note type definition
 */
export function exampleValidateNoteType() {
  const result = validateNoteType(articleNoteType);

  if (result.valid) {
    console.log("✅ Note type definition is valid!");
  } else {
    console.error("❌ Note type validation failed:");
    result.errors.forEach((error) => {
      console.error(`  - ${error.message}`);
    });
  }

  if (result.warnings.length > 0) {
    console.warn("⚠️ Warnings:");
    result.warnings.forEach((warning) => {
      console.warn(`  - ${warning.message}`);
    });
  }

  return result;
}
