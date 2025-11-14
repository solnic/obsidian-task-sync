/**
 * Template Store
 * Manages template state using Svelte stores
 */

import { writable, derived } from "svelte/store";
import type { Template } from "../core/template-entities";

export interface TemplateStoreState {
  templates: readonly Template[];
  loading: boolean;
  error: string | null;
}

const initialState: TemplateStoreState = {
  templates: [],
  loading: false,
  error: null,
};

function createTemplateStore() {
  const { subscribe, set, update } = writable<TemplateStoreState>(initialState);

  return {
    subscribe,

    // Actions
    setLoading: (loading: boolean) =>
      update((state) => ({ ...state, loading })),

    setError: (error: string | null) =>
      update((state) => ({ ...state, error })),

    setTemplates: (templates: readonly Template[]) =>
      update((state) => ({ ...state, templates, error: null })),

    addTemplate: (template: Template) =>
      update((state) => ({
        ...state,
        templates: [...state.templates, template],
      })),

    updateTemplate: (updatedTemplate: Template) =>
      update((state) => ({
        ...state,
        templates: state.templates.map((template) =>
          template.id === updatedTemplate.id ? updatedTemplate : template
        ),
      })),

    removeTemplate: (templateId: string) =>
      update((state) => ({
        ...state,
        templates: state.templates.filter((template) => template.id !== templateId),
      })),

    // Reset store to initial state
    reset: () => set(initialState),
  };
}

export const templateStore = createTemplateStore();

// Derived stores for common queries
export const templatesByType = derived(
  templateStore,
  ($store) => {
    const byType: Record<string, readonly Template[]> = {};
    for (const template of $store.templates) {
      if (!byType[template.type]) {
        byType[template.type] = [];
      }
      byType[template.type] = [...byType[template.type], template];
    }
    return byType;
  }
);

export const availableTemplates = derived(
  templateStore,
  ($store) => $store.templates.filter((template) => template.fileExists)
);

export type TemplateStore = typeof templateStore;
