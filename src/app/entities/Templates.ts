/**
 * Templates entity with Queries and Operations
 * Templates are separate from the main Entity system since they're meta-entities
 */

import { Template } from "../core/template-entities";
import { templateStore as store } from "../stores/templateStore";
import { eventBus } from "../core/events";
import { generateId } from "../utils/idGenerator";

export class Templates {
  static Queries = class TemplateQueries {

    async getAll(): Promise<readonly Template[]> {
      return new Promise((resolve) => {
        let unsubscribe: (() => void) | undefined;
        unsubscribe = store.subscribe((state) => {
          resolve(state.templates);
          if (unsubscribe) {
            unsubscribe();
          }
        });
      });
    }

    async getById(id: string): Promise<Template | null> {
      const templates = await this.getAll();
      return templates.find((template) => template.id === id) || null;
    }

    async getByExtension(extensionId: string): Promise<readonly Template[]> {
      // Templates are not extension-specific in the same way as tasks
      // Return all templates for now
      return this.getAll();
    }

    async getByType(type: "task" | "project" | "area" | "parent-task"): Promise<readonly Template[]> {
      const templates = await this.getAll();
      return templates.filter((template) => template.type === type);
    }

    async getAvailableTemplates(type?: "task" | "project" | "area" | "parent-task"): Promise<readonly Template[]> {
      const templates = await this.getAll();
      const available = templates.filter((template) => template.fileExists);
      
      if (type) {
        return available.filter((template) => template.type === type);
      }
      
      return available;
    }

    async getByFilePath(filePath: string): Promise<Template | null> {
      const templates = await this.getAll();
      return templates.find((template) => template.filePath === filePath) || null;
    }
  };

  static Operations = class TemplateOperations {

    async create(
      templateData: Omit<Template, "id" | "createdAt" | "updatedAt">
    ): Promise<Template> {
      const template = this.buildEntity(templateData);

      store.addTemplate(template);

      // Note: Template events are not part of the main event system
      // eventBus.trigger({ type: "templates.created", template });

      return template;
    }

    async update(template: Template): Promise<Template> {
      const updatedTemplate: Template = { ...template, updatedAt: this.timestamp() };

      store.updateTemplate(updatedTemplate);

      // Note: Template events are not part of the main event system
      // eventBus.trigger({ type: "templates.updated", template: updatedTemplate });

      return updatedTemplate;
    }

    async delete(id: string): Promise<void> {
      store.removeTemplate(id);
      // Note: Template events are not part of the main event system
      // eventBus.trigger({ type: "templates.deleted", templateId: id });
    }

    async incrementUsage(templateId: string): Promise<void> {
      const template = await new Templates.Queries().getById(templateId);
      if (template) {
        await this.update({
          ...template,
          usageCount: template.usageCount + 1,
          lastUsed: this.timestamp(),
        });
      }
    }

    async updateFileExists(templateId: string, fileExists: boolean): Promise<void> {
      const template = await new Templates.Queries().getById(templateId);
      if (template) {
        await this.update({
          ...template,
          fileExists,
        });
      }
    }

    public buildEntity(
      templateData: Omit<Template, "id" | "createdAt" | "updatedAt">
    ): Template {
      const now = this.timestamp();

      return {
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        ...templateData,
      } as Template;
    }

    public timestamp(): Date {
      return new Date();
    }
  };
}

export const templateQueries = new Templates.Queries();
export const templateOperations = new Templates.Operations();
