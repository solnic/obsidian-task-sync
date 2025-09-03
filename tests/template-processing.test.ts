import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Obsidian API
const mockApp = {
  vault: {
    getAbstractFileByPath: vi.fn(),
    read: vi.fn(),
    create: vi.fn(),
    modify: vi.fn()
  },
  plugins: {
    plugins: {}
  }
};

const mockTFile = class {
  constructor(public path: string) { }
};

// Mock the plugin
class MockTaskSyncPlugin {
  app = mockApp;
  settings = {
    templateFolder: 'Templates',
    useTemplater: false
  };

  private processTemplateVariables(content: string, data: any): string {
    let processedContent = content;

    // Replace common variables
    if (data.name) {
      processedContent = processedContent.replace(/<% tp\.file\.title %>/g, data.name);
      processedContent = processedContent.replace(/\{\{title\}\}/g, data.name);
      processedContent = processedContent.replace(/\{\{name\}\}/g, data.name);
    }

    if (data.description) {
      processedContent = processedContent.replace(/\{\{description\}\}/g, data.description);
    }

    if (data.areas) {
      processedContent = processedContent.replace(/\{\{areas\}\}/g, data.areas);
    }

    // Replace {{tasks}} with appropriate base embed
    if (data.name) {
      const baseEmbed = `![[${data.name}.base]]`;
      processedContent = processedContent.replace(/\{\{tasks\}\}/g, baseEmbed);
    }

    // Replace date variables
    const now = new Date();
    processedContent = processedContent.replace(/\{\{date\}\}/g, now.toISOString().split('T')[0]);
    processedContent = processedContent.replace(/\{\{time\}\}/g, now.toISOString());

    // Process Templater syntax if enabled
    if (this.settings.useTemplater) {
      processedContent = this.processTemplaterSyntax(processedContent, data);
    }

    return processedContent;
  }

  private processTemplaterSyntax(content: string, data: any): string {
    let processedContent = content;

    // Check if Templater plugin is available
    const templaterPlugin = (this.app as any).plugins?.plugins?.['templater-obsidian'];
    if (!templaterPlugin) {
      console.warn('Templater plugin not found, falling back to basic processing');
      return processedContent;
    }

    // Basic Templater syntax processing
    if (data.name) {
      processedContent = processedContent.replace(/<% tp\.file\.title %>/g, data.name);
      processedContent = processedContent.replace(/<% tp\.file\.basename %>/g, data.name);
    }

    const now = new Date();
    processedContent = processedContent.replace(/<% tp\.date\.now\(\) %>/g, now.toISOString().split('T')[0]);
    processedContent = processedContent.replace(/<% tp\.date\.now\("YYYY-MM-DD"\) %>/g, now.toISOString().split('T')[0]);

    return processedContent;
  }

  private ensureProperBaseEmbedding(content: string, data: any): string {
    const entityName = data.name;
    const expectedBaseEmbed = `![[${entityName}.base]]`;

    // Check if {{tasks}} was already processed
    if (content.includes(expectedBaseEmbed)) {
      return content;
    }

    // Check if template has generic Tasks.base embedding - replace it first
    const genericBasePattern = /!\[\[Tasks\.base\]\]/;
    if (genericBasePattern.test(content)) {
      return content.replace(genericBasePattern, expectedBaseEmbed);
    }

    // Check if template has any other base embedding already
    const anyBasePattern = /!\[\[.*\.base\]\]/;
    if (anyBasePattern.test(content)) {
      return content;
    }

    // Only add base embedding if no base-related content exists
    if (!content.includes('![[') || !content.includes('.base]]')) {
      return content.trim() + `\n\n## Tasks\n${expectedBaseEmbed}`;
    }

    return content;
  }

  // Public method for testing
  public testProcessTemplateVariables(content: string, data: any): string {
    return this.processTemplateVariables(content, data);
  }

  public testEnsureProperBaseEmbedding(content: string, data: any): string {
    return this.ensureProperBaseEmbedding(content, data);
  }
}

describe('Template Processing', () => {
  let plugin: MockTaskSyncPlugin;

  beforeEach(() => {
    plugin = new MockTaskSyncPlugin();
    vi.clearAllMocks();
  });

  describe('{{tasks}} syntax processing', () => {
    it('should replace {{tasks}} with specific base embed', () => {
      const template = `---
Name: {{name}}
Type: Project
---

## Overview
{{description}}

## Tasks
{{tasks}}`;

      const data = {
        name: 'Mobile App',
        description: 'A mobile application project'
      };

      const result = plugin.testProcessTemplateVariables(template, data);

      expect(result).toContain('![[Mobile App.base]]');
      expect(result).not.toContain('{{tasks}}');
    });

    it('should handle multiple {{tasks}} occurrences', () => {
      const template = `## Main Tasks
{{tasks}}

## Archived Tasks
{{tasks}}`;

      const data = { name: 'Test Project' };
      const result = plugin.testProcessTemplateVariables(template, data);

      const matches = result.match(/!\[\[Test Project\.base\]\]/g);
      expect(matches).toHaveLength(2);
    });

    it('should work with area templates', () => {
      const template = `---
Name: {{name}}
Type: Area
---

## Tasks
{{tasks}}`;

      const data = { name: 'Health & Fitness' };
      const result = plugin.testProcessTemplateVariables(template, data);

      expect(result).toContain('![[Health & Fitness.base]]');
    });
  });

  describe('Base embedding logic', () => {
    it('should not add duplicate base embeds when {{tasks}} is processed', () => {
      const content = `## Overview
Some content

## Tasks
![[Mobile App.base]]`;

      const data = { name: 'Mobile App' };
      const result = plugin.testEnsureProperBaseEmbedding(content, data);

      // Should not add another base embed
      expect(result).toBe(content);
      const matches = result.match(/!\[\[.*\.base\]\]/g);
      expect(matches).toHaveLength(1);
    });

    it('should replace generic Tasks.base with specific base', () => {
      const content = `## Tasks
![[Tasks.base]]`;

      const data = { name: 'Mobile App' };
      const result = plugin.testEnsureProperBaseEmbedding(content, data);

      expect(result).toContain('![[Mobile App.base]]');
      expect(result).not.toContain('![[Tasks.base]]');
    });

    it('should not interfere with existing specific base embeds', () => {
      const content = `## Tasks
![[Other Project.base]]`;

      const data = { name: 'Mobile App' };
      const result = plugin.testEnsureProperBaseEmbedding(content, data);

      // Should not change existing specific base embed
      expect(result).toBe(content);
      expect(result).toContain('![[Other Project.base]]');
    });
  });

  describe('Variable replacement', () => {
    it('should replace all standard variables', () => {
      const template = `---
Name: {{name}}
Type: Project
Areas: {{areas}}
---

{{description}}

Date: {{date}}`;

      const data = {
        name: 'Test Project',
        description: 'Test description',
        areas: 'Work, Development'
      };

      const result = plugin.testProcessTemplateVariables(template, data);

      expect(result).toContain('Name: Test Project');
      expect(result).toContain('Areas: Work, Development');
      expect(result).toContain('Test description');
      expect(result).toMatch(/Date: \d{4}-\d{2}-\d{2}/);
    });

    it('should handle Templater syntax', () => {
      const template = `---
Name: <% tp.file.title %>
---

{{description}}`;

      const data = {
        name: 'Test Project',
        description: 'Test description'
      };

      const result = plugin.testProcessTemplateVariables(template, data);

      expect(result).toContain('Name: Test Project');
      expect(result).toContain('Test description');
    });
  });
});
