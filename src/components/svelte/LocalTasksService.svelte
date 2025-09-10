<script lang="ts">
  import { onMount } from "svelte";
  import { Notice } from "obsidian";
  import { getPluginContext } from "./context";
  import ContextWidget from "./ContextWidget.svelte";
  import { taskStore } from "../../stores/taskStore";
  import type { Task } from "../../types/entities";

  interface Props {
    dayPlanningMode?: boolean;
  }

  let { dayPlanningMode = false }: Props = $props();

  const { plugin } = getPluginContext();

  // State
  let tasks = $state<Task[]>([]);
  let searchQuery = $state("");
  let error = $state<string | null>(null);
  let isLoading = $state(false);
  let hoveredTask = $state<string | null>(null);

  // Computed
  let filteredTasks = $derived.by(() => {
    if (!searchQuery) {
      return tasks;
    }
    return searchTasks(searchQuery, tasks);
  });

  onMount(() => {
    loadTasks();

    // Subscribe to task store updates
    const unsubscribe = taskStore.subscribe((state) => {
      tasks = state.entities;
      isLoading = state.loading;
      error = state.error;
    });

    return unsubscribe;
  });

  function searchTasks(query: string, taskList: Task[]): Task[] {
    const lowerQuery = query.toLowerCase();

    return taskList.filter(
      (task) =>
        task.title.toLowerCase().includes(lowerQuery) ||
        (task.category && task.category.toLowerCase().includes(lowerQuery)) ||
        (task.status && task.status.toLowerCase().includes(lowerQuery)) ||
        (task.project && task.project.toLowerCase().includes(lowerQuery)) ||
        (task.areas &&
          task.areas.some((area) => area.toLowerCase().includes(lowerQuery)))
    );
  }

  async function loadTasks(): Promise<void> {
    isLoading = true;
    error = null;

    try {
      await taskStore.refreshTasks();
    } catch (err: any) {
      error = err.message || "Failed to load local tasks";
    } finally {
      isLoading = false;
    }
  }

  async function refresh(): Promise<void> {
    await loadTasks();
  }

  async function addToToday(task: Task): Promise<void> {
    try {
      // Use the DailyNoteService to add the task to today's daily note
      const result = await plugin.dailyNoteService.addTaskToToday(
        task.filePath
      );

      if (result.success) {
        new Notice(`Added "${task.title}" to today's daily note`);
      } else {
        new Notice(
          `Failed to add task to today: ${result.error || "Unknown error"}`
        );
      }
    } catch (error: any) {
      console.error("Error adding task to today:", error);
      new Notice(
        `Error adding task to today: ${error.message || "Unknown error"}`
      );
    }
  }

  // Expose methods for the wrapper
  $effect(() => {
    if (typeof window !== "undefined") {
      (window as any).__localTasksServiceMethods = {
        refresh,
      };
    }
  });
</script>

<div
  class="local-tasks-service"
  data-type="local-tasks-service"
  data-testid="local-tasks-service"
>
  <!-- Context Widget -->
  <ContextWidget />

  <!-- Header Section -->
  <div class="local-tasks-header">
    <!-- Search input -->
    <div class="search-section">
      <input
        type="text"
        class="search-input"
        placeholder="Search local tasks..."
        bind:value={searchQuery}
        data-testid="local-search-input"
      />

      <!-- Refresh button -->
      <button
        class="refresh-button"
        title="Refresh"
        onclick={refresh}
        data-testid="local-refresh-button"
      >
        ↻
      </button>
    </div>
  </div>

  <!-- Content Section -->
  <div class="local-tasks-content">
    {#if error}
      <div class="error-message">
        {error}
      </div>
    {:else if isLoading}
      <div class="loading-indicator">Loading local tasks...</div>
    {:else}
      <div class="tasks-list">
        {#if filteredTasks.length === 0}
          <div class="empty-message">
            {searchQuery ? "No tasks match your search." : "No tasks found."}
          </div>
        {:else}
          {#each filteredTasks as task}
            <div
              class="task-item {hoveredTask === task.id ? 'hovered' : ''}"
              onmouseenter={() => (hoveredTask = task.id)}
              onmouseleave={() => (hoveredTask = null)}
              data-testid="local-task-item"
              role="listitem"
            >
              <div class="task-content">
                <div class="task-title">{task.title}</div>
                <div class="task-meta">
                  {#if task.category}
                    <span class="task-category">{task.category}</span>
                  {/if}
                  {#if task.priority}
                    <span class="task-priority">Priority: {task.priority}</span>
                  {/if}
                  {#if task.status}
                    <span class="task-status">Status: {task.status}</span>
                  {/if}
                  {#if task.project}
                    <span class="task-project">Project: {task.project}</span>
                  {/if}
                </div>
                {#if task.areas && task.areas.length > 0}
                  <div class="task-areas">
                    {#each task.areas as area}
                      <span class="task-area">{area}</span>
                    {/each}
                  </div>
                {/if}
              </div>

              <!-- Action overlay -->
              {#if hoveredTask === task.id}
                <div class="action-overlay">
                  <div class="action-buttons">
                    {#if dayPlanningMode}
                      <button
                        class="add-to-today-button"
                        title="Add to today"
                        onclick={() => addToToday(task)}
                        data-testid="add-to-today-button"
                      >
                        Add to today
                      </button>
                    {:else}
                      <button
                        class="open-task-button"
                        title="Open task"
                        onclick={() => {
                          if (task.file) {
                            plugin.app.workspace.getLeaf().openFile(task.file);
                          }
                        }}
                        data-testid="open-task-button"
                      >
                        Open
                      </button>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .local-tasks-header {
    margin-bottom: 1rem;
  }

  .search-section {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .search-input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
  }

  .refresh-button {
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
  }

  .refresh-button:hover {
    background: var(--background-modifier-hover);
  }

  .task-item {
    position: relative;
    padding: 1rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    margin-bottom: 0.5rem;
    background: var(--background-primary);
    transition: all 0.2s ease;
  }

  .task-item:hover {
    background: var(--background-modifier-hover);
  }

  .task-title {
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--text-normal);
  }

  .task-meta {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
    font-size: 0.9em;
    color: var(--text-muted);
  }

  .task-areas {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .task-area {
    padding: 0.2rem 0.5rem;
    background: var(--background-modifier-border);
    border-radius: 3px;
    font-size: 0.8em;
    color: var(--text-muted);
  }

  .action-overlay {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: rgba(var(--background-primary-rgb), 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
  }

  .add-to-today-button,
  .open-task-button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--interactive-accent);
    border-radius: 4px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    font-weight: 500;
  }

  .add-to-today-button:hover,
  .open-task-button:hover {
    background: var(--interactive-accent-hover);
  }
</style>
