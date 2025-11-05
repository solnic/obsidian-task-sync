<script lang="ts">
  /**
   * ProjectContext - Displays project properties in the context widget
   * Uses semantic HTML with dl/dt/dd for property lists
   */

  import type { Project, Area } from "../../core/entities";
  import Dropdown from "../Dropdown.svelte";
  import { Projects } from "../../entities/Projects";

  interface Props {
    project: Project;
    settings: any;
    allAreas: Area[];
  }

  let { project, settings, allAreas }: Props = $props();

  // State for dropdown
  let showAreasDropdown = $state(false);

  // Button ref for dropdown anchoring
  let areasButtonEl = $state<HTMLButtonElement | null>(null);

  const areaOptions = $derived(
    allAreas.map((a) => ({
      value: a.name,
      label: a.name,
    }))
  );

  async function handleAreasSelect(value: string) {
    const projectOps = new Projects.Operations(settings);
    const currentAreas = project.areas || [];
    const newAreas = currentAreas.includes(value)
      ? currentAreas.filter((a) => a !== value)
      : [...currentAreas, value];

    await projectOps.update({
      ...project,
      areas: newAreas,
    });
    showAreasDropdown = false;
  }

  function updateAreasButton() {
    if (!areasButtonEl) return;
    areasButtonEl.innerHTML = "";

    const areas = project.areas || [];
    const label = document.createElement("span");
    label.textContent = areas.length > 0 ? areas.join(", ") : "Add to area";
    if (areas.length === 0) {
      label.style.color = "var(--text-muted)";
    }
    areasButtonEl.appendChild(label);
  }

  $effect(() => {
    updateAreasButton();
  });
</script>

<div class="project-context">
  <!-- Areas property -->
  <ul class="property-group">
    <li>
      <div class="property-label">Areas</div>
      <button
        bind:this={areasButtonEl}
        type="button"
        onclick={() => (showAreasDropdown = true)}
        class="task-sync-property-button mod-minimal task-sync-property-button-full"
        data-testid="context-areas-button"
        aria-label="Change areas"
      ></button>
    </li>
  </ul>

  {#if showAreasDropdown && areasButtonEl}
    <Dropdown
      anchor={areasButtonEl}
      items={areaOptions}
      selectedValue={project.areas?.[0]}
      onSelect={handleAreasSelect}
      onClose={() => (showAreasDropdown = false)}
      searchable={true}
      searchPlaceholder="Search areas..."
      testId="context-areas-dropdown"
    />
  {/if}
</div>

<style>
  .project-context {
    display: flex;
    flex-direction: column;
  }

  .property-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 0;
    border-bottom: 1px solid var(--background-modifier-border);
    list-style: none;
    margin: 0;
    padding: 12px 0;
  }

  .property-group:last-child {
    border-bottom: none;
  }

  .property-group li {
    list-style: none;
  }

  .property-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  :global(.task-sync-property-button-full) {
    width: 100%;
    justify-content: flex-start;
  }
</style>
