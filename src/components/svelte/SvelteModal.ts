import { Modal } from "obsidian";
import { mount, unmount } from "svelte";
import type TaskSyncPlugin from "../../main";

export abstract class SvelteModal extends Modal {
  protected component: any = null;
  protected plugin: TaskSyncPlugin;

  constructor(plugin: TaskSyncPlugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("svelte-modal-container");

    // Create the Svelte component
    this.component = this.createComponent(contentEl);
  }

  onClose() {
    // Unmount Svelte 5 component
    if (this.component) {
      unmount(this.component);
      this.component = null;
    }
  }

  protected abstract createComponent(container: HTMLElement): any;

  protected createSvelteComponent(
    ComponentClass: any,
    container: HTMLElement,
    props: Record<string, any> = {}
  ): any {
    return mount(ComponentClass, {
      target: container,
      props: {
        ...props,
        plugin: this.plugin,
      },
      context: new Map([["task-sync-plugin", { plugin: this.plugin }]]),
    });
  }
}
