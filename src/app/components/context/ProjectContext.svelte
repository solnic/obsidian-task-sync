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

  const areaOptions = $derived.by(() =>
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
    // Don't close dropdown - allow multi-select
  }

  async function handleRemoveArea(areaToRemove: string) {
    const projectOps = new Projects.Operations(settings);
    const currentAreas = project.areas || [];
    const newAreas = currentAreas.filter((a) => a !== areaToRemove);

    await projectOps.update({
      ...project,
      areas: newAreas,
    });
  }

  function updateAreasButton() {
    if (!areasButtonEl) return;
    areasButtonEl.innerHTML = "";

    const areas = project.areas || [];

    if (areas.length === 0) {
      const label = document.createElement("span");
      label.textContent = "Add to area";
      label.style.color = "var(--text-muted)";
      areasButtonEl.appendChild(label);
    } else {
      // Create container for badges
      const container = document.createElement("div");
      container.style.display = "flex";
      container.style.flexWrap = "wrap";
      container.style.gap = "4px";
      container.style.alignItems = "center";

      areas.forEach((area) => {
        // Create badge
        const badge = document.createElement("span");
        badge.className = "task-sync-text-badge";
        badge.style.display = "inline-flex";
        badge.style.alignItems = "center";
        badge.style.gap = "4px";
        badge.style.paddingRight = "4px";

        // Area name
        const areaName = document.createElement("span");
        areaName.textContent = area;
        badge.appendChild(areaName);

        // Remove button
        const removeBtn = document.createElement("span");
        removeBtn.textContent = "×";
        removeBtn.style.cursor = "pointer";
        removeBtn.style.fontSize = "14px";
        removeBtn.style.fontWeight = "bold";
        removeBtn.style.opacity = "0.7";
        removeBtn.style.transition = "opacity 0.2s";
        removeBtn.title = `Remove ${area}`;

        removeBtn.onmouseenter = () => {
          removeBtn.style.opacity = "1";
        };
        removeBtn.onmouseleave = () => {
          removeBtn.style.opacity = "0.7";
        };

        removeBtn.onclick = async (e) => {
          e.stopPropagation();
          await handleRemoveArea(area);
        };

        badge.appendChild(removeBtn);
        container.appendChild(badge);
      });

      areasButtonEl.appendChild(container);
    }
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
      selectedValues={project.areas || []}
      onSelect={handleAreasSelect}
      onClose={() => (showAreasDropdown = false)}
      searchable={true}
      searchPlaceholder="Search areas..."
      keepOpenOnSelect={true}
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
