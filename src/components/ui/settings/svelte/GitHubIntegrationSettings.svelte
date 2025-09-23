<script lang="ts">
  import type { TaskSyncSettings, GitHubOrgRepoMapping } from "../types";
  import { Setting, App } from "obsidian";
  import { onMount } from "svelte";
  import type TaskSyncPlugin from "../../../../main";
  import { SortableGitHubMappingList } from "../SortableGitHubMappingList";

  let githubContainer: HTMLElement;
  let githubMappingsContainer: HTMLElement;
  let sortableMappingList: SortableGitHubMappingList | null = null;

  interface Props {
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    app: App;
    plugin: TaskSyncPlugin;
    enabled: boolean;
    onToggle: (enabled: boolean) => Promise<void>;
  }

  let { settings, saveSettings, app, plugin, enabled, onToggle }: Props =
    $props();

  onMount(() => {
    createGitHubSection();
  });

  function createGitHubSection(): void {
    // GitHub integration toggle
    new Setting(githubContainer)
      .setName("Enable GitHub Integration")
      .setDesc("Connect to GitHub to browse and import issues as tasks")
      .addToggle((toggle) => {
        toggle.setValue(enabled).onChange(async (value) => {
          // Allow enabling without token validation - user can configure token after enabling
          await onToggle(value);
        });
      });
  }

  function createGitHubSettings(): void {
    // Personal Access Token
    new Setting(githubContainer)
      .setName("GitHub Personal Access Token")
      .setDesc(
        "Your GitHub PAT for API access. Create one at github.com/settings/tokens"
      )
      .addText((text) => {
        text
          .setPlaceholder("ghp_... or github_pat_...")
          .setValue(settings.integrations.github.personalAccessToken)
          .onChange(async (value) => {
            // Save the token value - GitHub API will validate it
            settings.integrations.github.personalAccessToken = value;
            await saveSettings(settings);
          });

        // Set input type to password for security
        text.inputEl.type = "password";
        text.inputEl.style.fontFamily = "monospace";
      });

    // Default repository
    new Setting(githubContainer)
      .setName("Default Repository")
      .setDesc("Default repository to load issues from (format: owner/repo)")
      .addText((text) => {
        text
          .setPlaceholder("owner/repository")
          .setValue(settings.integrations.github.defaultRepository)
          .onChange(async (value) => {
            settings.integrations.github.defaultRepository = value;
            await saveSettings(settings);
          });
      });

    // Issue filters
    new Setting(githubContainer)
      .setName("Default Issue State")
      .setDesc("Default state filter for GitHub issues")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("open", "Open")
          .addOption("closed", "Closed")
          .addOption("all", "All")
          .setValue(settings.integrations.github.issueFilters.state)
          .onChange(async (value: "open" | "closed" | "all") => {
            settings.integrations.github.issueFilters.state = value;
            await saveSettings(settings);
          });
      });

    new Setting(githubContainer)
      .setName("Default Assignee Filter")
      .setDesc(
        'Default assignee filter (leave empty for all, "me" for your issues)'
      )
      .addText((text) => {
        text
          .setPlaceholder("me, username, or empty")
          .setValue(settings.integrations.github.issueFilters.assignee)
          .onChange(async (value) => {
            settings.integrations.github.issueFilters.assignee = value;
            await saveSettings(settings);
          });
      });

    // Organization/Repository Mappings
    createGitHubOrgRepoMappings();
  }

  function createGitHubOrgRepoMappings(): void {
    // Ensure orgRepoMappings array exists
    if (!settings.integrations.github.orgRepoMappings) {
      settings.integrations.github.orgRepoMappings = [];
    }

    // Sort mappings by priority (highest first) for display
    const sortedMappings = [
      ...settings.integrations.github.orgRepoMappings,
    ].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Create sortable mapping list
    sortableMappingList = new SortableGitHubMappingList({
      container: githubMappingsContainer,
      mappings: sortedMappings,
      onReorder: async (newOrder: GitHubOrgRepoMapping[]) => {
        settings.integrations.github.orgRepoMappings = newOrder;
        await saveSettings(settings);
      },
      onUpdate: async (index: number, mapping: GitHubOrgRepoMapping) => {
        // Find the mapping in the original array and update it
        const originalIndex =
          settings.integrations.github.orgRepoMappings.findIndex(
            (m) => m === sortedMappings[index]
          );
        if (originalIndex !== -1) {
          settings.integrations.github.orgRepoMappings[originalIndex] = mapping;
          await saveSettings(settings);
        }
      },
      onDelete: async (index: number) => {
        // Find the mapping in the original array and remove it
        const mappingToDelete = sortedMappings[index];
        const originalIndex =
          settings.integrations.github.orgRepoMappings.findIndex(
            (m) => m === mappingToDelete
          );
        if (originalIndex !== -1) {
          settings.integrations.github.orgRepoMappings.splice(originalIndex, 1);
          await saveSettings(settings);
          // Refresh the mappings section
          githubMappingsContainer.empty();
          createGitHubOrgRepoMappings();
        }
      },
      onAdd: async () => {
        const newMapping: GitHubOrgRepoMapping = {
          organization: "",
          repository: "",
          targetArea: "",
          targetProject: "",
          priority:
            (settings.integrations.github.orgRepoMappings.length || 0) + 1,
        };
        settings.integrations.github.orgRepoMappings.push(newMapping);
        await saveSettings(settings);
        // Update the sortable list with the new mappings
        const updatedSortedMappings = [
          ...settings.integrations.github.orgRepoMappings,
        ].sort((a, b) => (b.priority || 0) - (a.priority || 0));
        sortableMappingList?.updateMappings(updatedSortedMappings);
      },
    });
  }

  // Reactive statement to create/destroy settings based on toggle state
  $effect(() => {
    if (enabled) {
      createGitHubSettings();
    } else {
      // Clear GitHub settings when disabled
      const children = Array.from(githubContainer.children);
      children.slice(1).forEach((child) => child.remove()); // Keep the toggle, remove the rest
      githubMappingsContainer.empty();
    }
  });
</script>

<div bind:this={githubContainer}></div>
<div bind:this={githubMappingsContainer}></div>
