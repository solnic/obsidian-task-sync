import { Modal } from 'obsidian';
import type { SvelteComponent } from 'svelte';
import type TaskSyncPlugin from '../../main';

export abstract class SvelteModal extends Modal {
  protected component: SvelteComponent | null = null;
  protected plugin: TaskSyncPlugin;

  constructor(plugin: TaskSyncPlugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('svelte-modal-container');

    // Create the Svelte component
    this.component = this.createComponent(contentEl);
  }

  onClose() {
    // Cleanup Svelte component
    if (this.component) {
      this.component.$destroy();
      this.component = null;
    }
  }

  protected abstract createComponent(container: HTMLElement): SvelteComponent;

  protected createSvelteComponent<T extends SvelteComponent>(
    ComponentClass: new (options: any) => T,
    container: HTMLElement,
    props: Record<string, any> = {}
  ): T {
    return new ComponentClass({
      target: container,
      props: {
        ...props,
        plugin: this.plugin
      },
      context: new Map([
        ['task-sync-plugin', { plugin: this.plugin }]
      ])
    });
  }
}
